export interface AuthenticatedPrincipal {
  subject: string;
  email?: string;
  emailVerified: boolean;
}
