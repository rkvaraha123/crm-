import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthSession } from './session';
const Context = createContext<AuthSession | null>(null);
export function AuthProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  useEffect(() => {
    if (!state.authenticated) {
      void queryClient.cancelQueries().then(() => queryClient.clear());
    }
  }, [state.authenticated, queryClient]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useAuth() {
  const session = useContext(Context);
  if (!session) throw new Error('AuthProvider required');
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  return { ...state, session };
}
