import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../app/session.js';
import { homePathFor } from '../app/roles.js';
import { DEMO_GROUPS, DEMO_PASSWORD, DEMO_USERS } from '../app/demo-users.js';
import { ApiError } from '../api/client.js';
import { Button, Notice } from '../ui/primitives.js';
import { Field, Input, PasswordInput } from '../ui/form.js';
import { AuthCard } from './auth/AuthCard.js';

export function SignInPage() {
  const { status, user, signIn } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in' && user) {
    const dest = (location.state as { from?: string } | null)?.from ?? homePathFor(user.role);
    return <Navigate to={dest} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const me = await signIn({ email: email.trim(), password });
      const dest = (location.state as { from?: string } | null)?.from ?? homePathFor(me.role);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? { message: err.message, code: err.code }
          : { message: 'Something went wrong. Try again.' },
      );
    } finally {
      setBusy(false);
    }
  };

  const quickFill = (userEmail: string) => {
    setEmail(userEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Travel expense reimbursement for Nortex Industries."
      footer={
        <span>
          Not registered yet? <Link to="/signup">Create a password</Link>
        </span>
      }
    >
      <form className="auth__form" onSubmit={submit}>
        {error ? (
          <Notice tone={error.code === 'ACCOUNT_NOT_REGISTERED' ? 'warn' : 'danger'}>
            {error.message}
            {error.code === 'ACCOUNT_NOT_REGISTERED' ? (
              <>
                {' '}
                <Link to="/signup">Create one →</Link>
              </>
            ) : null}
          </Notice>
        ) : null}

        <Field label="Work email">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@nortexindustries.com"
              autoFocus
              required
            />
          )}
        </Field>

        <Field label="Password">
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>

        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="auth__hint">
        Demo roster — password is <code>{DEMO_PASSWORD}</code>. Click a name to fill the form:
      </div>
      <div className="auth__roster">
        {DEMO_GROUPS.map((group) => {
          const people = DEMO_USERS.filter((u) => group.roles.includes(u.role));
          if (people.length === 0) return null;
          return (
            <div key={group.label} className="auth__roster-group">
              <div className="auth__roster-label">{group.label}</div>
              <div className="auth__chips">
                {people.map((p) => (
                  <button
                    key={p.empCode}
                    type="button"
                    className="chip"
                    onClick={() => quickFill(p.email)}
                    title={`${p.designation} · ${p.role}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AuthCard>
  );
}
