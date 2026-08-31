import { AuthProvider, useAuth } from './AuthContext';
import { LoginScreen } from './screens/Login';
import { Dashboard } from './screens/Dashboard';

function AppShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div>Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  return <Dashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
