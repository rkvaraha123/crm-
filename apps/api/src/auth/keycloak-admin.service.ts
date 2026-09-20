import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface KeycloakUser {
  id: string;
  username?: string;
  email?: string;
  emailVerified?: boolean;
  enabled?: boolean;
  firstName?: string;
  lastName?: string;
}
@Injectable()
export class KeycloakAdminService {
  private token?: { value: string; expires: number };
  constructor(private readonly config: ConfigService) {}
  private get base() {
    return `${this.config.getOrThrow<string>('KEYCLOAK_INTERNAL_URL')}/admin/realms/${encodeURIComponent(this.config.getOrThrow<string>('KEYCLOAK_REALM'))}`;
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 30000)
      return this.token.value;
    const response = await fetch(
      `${this.config.getOrThrow<string>('KEYCLOAK_INTERNAL_URL')}/realms/${encodeURIComponent(this.config.getOrThrow<string>('KEYCLOAK_REALM'))}/protocol/openid-connect/token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.getOrThrow<string>('KEYCLOAK_ADMIN_CLIENT_ID'),
          client_secret: this.config.getOrThrow<string>(
            'KEYCLOAK_ADMIN_CLIENT_SECRET',
          ),
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error('Service authentication failed');
    const result = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    if (
      typeof result.access_token !== 'string' ||
      !Number.isFinite(result.expires_in)
    )
      throw new Error('Invalid service response');
    this.token = {
      value: result.access_token,
      expires: Date.now() + result.expires_in * 1000,
    };
    return this.token.value;
  }
  private async call(path: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.base}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${await this.accessToken()}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        if (response.status === 401) this.token = undefined;
        throw new Error('Administration request failed');
      }
      return response;
    } catch {
      throw new ServiceUnavailableException(
        'Identity administration unavailable',
      );
    }
  }
  async findUsers(email: string): Promise<KeycloakUser[]> {
    return (
      await this.call(
        `/users?email=${encodeURIComponent(email)}&exact=true&max=2`,
      )
    ).json();
  }
  async getUser(id: string): Promise<KeycloakUser> {
    return (await this.call(`/users/${encodeURIComponent(id)}`)).json();
  }
  async createUser(user: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    await this.call('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...user,
        username: user.email,
        enabled: true,
        emailVerified: false,
        requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'],
      }),
    });
  }
  async disableUser(id: string): Promise<void> {
    await this.call(`/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
  }
  async sendSetupActions(id: string): Promise<void> {
    await this.call(`/users/${encodeURIComponent(id)}/execute-actions-email`, {
      method: 'PUT',
      body: JSON.stringify(['VERIFY_EMAIL', 'UPDATE_PASSWORD']),
    });
  }
}
