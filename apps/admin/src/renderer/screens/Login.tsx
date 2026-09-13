import { FormEvent, useState } from 'react';
import { useAuth } from '../states/authStore';
import { Button } from '../components/ui/button';

type Mode = 'login' | 'recovery';

export function LoginScreen() {
  const { login, error } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  }

  function backToLogin() {
    setMode('login');
    setRecoveryEmail('');
    setRecoveryMessage('');
  }

  async function handleRecoverySubmit(event: FormEvent) {
    event.preventDefault();
    setRecoverySubmitting(true);
    try {
      await window.authAPI.requestRecovery(recoveryEmail);
    } finally {
      // Always the same message regardless of outcome, whether the request actually succeeded
      // or the email doesn't exist — matches the backend's deliberately non-leaking design.
      setRecoveryMessage('If that email is registered, an admin will be notified to reset your password.');
      setRecoverySubmitting(false);
    }
  }

  if (mode === 'recovery') {
    return (
      <div className="flex h-screen items-center justify-center bg-surface font-body">
        <form
          className="flex w-80 flex-col gap-4 rounded-3xl bg-surface p-10 neu-raised-lg"
          onSubmit={handleRecoverySubmit}
        >
          <h1 className="m-0 text-center font-display text-2xl tracking-[0.05em] text-heading">Account Recovery</h1>
          <p className="m-0 text-sm text-secondary">
            Enter your email. If it's registered, an admin will see a request to reset your password.
          </p>
          <label className="flex flex-col gap-2 text-sm text-secondary">
            <span>Email</span>
            <input
              className="neu-field"
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              required
              disabled={recoverySubmitting || recoveryMessage !== ''}
            />
          </label>
          {recoveryMessage && <p className="m-0 text-sm text-secondary">{recoveryMessage}</p>}
          {!recoveryMessage && (
            <Button type="submit" disabled={recoverySubmitting}>
              {recoverySubmitting ? 'Sending…' : 'Request recovery'}
            </Button>
          )}
          <button
            type="button"
            className="cursor-pointer self-center border-none bg-transparent text-sm text-secondary underline hover:text-heading"
            onClick={backToLogin}
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-surface font-body">
      <form
        className="flex w-80 flex-col gap-4 rounded-3xl bg-surface p-10 neu-raised-lg"
        onSubmit={handleSubmit}
      >
        <h1 className="m-0 text-center font-display text-2xl tracking-[0.05em] text-heading">Andy Tours Admin</h1>
        <label className="flex flex-col gap-2 text-sm text-secondary">
          <span>Email</span>
          <input
            className="neu-field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-secondary">
          <span>Password</span>
          <input
            className="neu-field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="m-0 text-sm text-error">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <button
          type="button"
          className="cursor-pointer self-center border-none bg-transparent text-sm text-secondary underline hover:text-heading"
          onClick={() => setMode('recovery')}
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
}
