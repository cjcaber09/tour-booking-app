import { LoaderCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { AppSettingsProvider } from './AppSettingsContext';
import { LoginScreen } from './screens/Login';
import { AppLayout } from './layout/AppLayout';

function AppShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface font-body">
        <h1 className="m-0 font-display text-2xl tracking-[0.05em] text-heading">Andy Tours Admin</h1>
        <LoaderCircle className="animate-[spin_0.8s_linear_infinite] text-accent-end" size={32} />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  return <AppLayout />;
}

export function App() {
  return (
    <AuthProvider>
      <AppSettingsProvider>
        <AppShell />
      </AppSettingsProvider>
    </AuthProvider>
  );
}
