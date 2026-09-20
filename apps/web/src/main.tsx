import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAuthSession } from './auth/session';
import { AuthProvider } from './auth/auth-context';
import { App } from './app';
import './styles.css';
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <main className="p-12" role="status">
    Preparing sign-in…
  </main>,
);
async function start() {
  const session = createAuthSession();
  await session.init(); // Keycloak consumes the callback before React Router starts.
  const client = new QueryClient();
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <AuthProvider session={session}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
void start().catch(() =>
  root.render(
    <main className="p-12" role="alert">
      Authentication configuration unavailable. Contact your administrator.
    </main>,
  ),
);
