import { AuthProvider, useAuth } from './AuthContext';
import { LoginScreen } from './screens/Login';

function AppShell() {
  const { status, session, logout } = useAuth();

  if (status === 'loading') {
    return <div>Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  return (
    <div>
      <p>Signed in as {session?.admin.name}</p>
      <button onClick={() => logout()}>Sign out</button>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
