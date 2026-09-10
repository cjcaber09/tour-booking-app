import { FormEvent, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../components/ui/button';

export function LoginScreen() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      </form>
    </div>
  );
}
