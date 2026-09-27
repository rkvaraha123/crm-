import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

interface AuthorizationValue {
  can: (permission: string) => boolean;
}

const AuthorizationContext = createContext<AuthorizationValue | null>(null);

export function AuthorizationProvider({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: ReactNode;
}) {
  const value = useMemo(() => {
    const effective = new Set(permissions);
    return { can: (permission: string) => effective.has(permission) };
  }, [permissions]);
  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  );
}

export function useAuthorization() {
  const value = useContext(AuthorizationContext);
  if (!value) throw new Error('AuthorizationProvider required');
  return value;
}

export function Can({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  return useAuthorization().can(permission) ? children : null;
}
