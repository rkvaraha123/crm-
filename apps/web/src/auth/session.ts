import Keycloak from 'keycloak-js';
export interface AuthSnapshot {
  ready: boolean;
  authenticated: boolean;
  error: string | null;
}
export type AuthAdapter = Pick<
  Keycloak,
  | 'init'
  | 'login'
  | 'createLogoutUrl'
  | 'clearToken'
  | 'updateToken'
  | 'token'
  | 'authenticated'
  | 'onTokenExpired'
  | 'onAuthLogout'
>;
export class AuthSession {
  private state: AuthSnapshot = {
    ready: false,
    authenticated: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private initialization?: Promise<void>;
  constructor(
    private readonly adapter: AuthAdapter,
    private readonly redirect: (url: string) => void = (url) =>
      window.location.assign(url),
  ) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(value: AuthSnapshot) {
    this.state = value;
    this.listeners.forEach((listener) => listener());
  }
  init(): Promise<void> {
    this.initialization ??= (async () => {
      this.adapter.onAuthLogout = () => this.clear();
      this.adapter.onTokenExpired = () => {
        void this.accessToken().catch(() => {});
      };
      try {
        const authenticated = await this.adapter.init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          flow: 'standard',
          checkLoginIframe: false,
        });
        this.publish({ ready: true, authenticated, error: null });
      } catch {
        this.publish({
          ready: true,
          authenticated: false,
          error: 'Sign-in service unavailable. Please reload to try again.',
        });
      }
    })();
    return this.initialization;
  }
  login = async () => {
    try {
      await this.adapter.login({
        redirectUri: `${window.location.origin}/app`,
      });
    } catch {
      this.publish({ ...this.state, error: 'Unable to start sign-in.' });
    }
  };
  clear = () => {
    this.adapter.clearToken();
    this.publish({ ready: true, authenticated: false, error: null });
  };
  async logout() {
    const url = this.adapter.createLogoutUrl({
      redirectUri: window.location.origin,
    });
    this.clear();
    this.redirect(url);
  }
  accessToken = async (): Promise<string> => {
    if (!this.state.authenticated) throw new Error('Sign-in required');
    try {
      await this.adapter.updateToken(30);
      if (!this.adapter.token) throw new Error('No token');
      return this.adapter.token;
    } catch {
      this.clear();
      throw new Error('Session expired. Please sign in again.');
    }
  };
}
export function createAuthSession() {
  const url = import.meta.env.VITE_KEYCLOAK_URL;
  const realm = import.meta.env.VITE_KEYCLOAK_REALM;
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;
  if (!url || !realm || !clientId)
    throw new Error('Keycloak frontend configuration is required');
  return new AuthSession(new Keycloak({ url, realm, clientId }));
}
