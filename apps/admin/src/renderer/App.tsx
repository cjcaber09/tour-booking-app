import { AuthProvider, useAuth } from './AuthContext';
import { LoginScreen } from './screens/Login';
import { AppLayout } from './layout/AppLayout';

function AppShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div>Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  return <AppLayout />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
