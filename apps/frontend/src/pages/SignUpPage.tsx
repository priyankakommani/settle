import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../app/session.js';
import { homePathFor } from '../app/roles.js';
import { DEMO_USERS } from '../app/demo-users.js';
import { ApiError } from '../api/client.js';
import { Button, Notice } from '../ui/primitives.js';
import { Field, Input, PasswordInput } from '../ui/form.js';
import { AuthCard } from './auth/AuthCard.js';

export function SignUpPage() {
  const { status, user, signUp } = useSession();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in' && user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError({ message: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setError({ message: 'Passwords do not match.' });
      return;
    }
    setBusy(true);
    try {
      const me = await signUp({ email: email.trim(), password });
      navigate(homePathFor(me.role), { replace: true });
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

  return (
    <AuthCard
      title="Create a password"
      subtitle="For an existing Acme employee who hasn't set one yet."
      footer={
        <span>
          Already registered? <Link to="/signin">Sign in</Link>
        </span>
      }
    >
      <form className="auth__form" onSubmit={submit}>
        {error ? (
          <Notice tone={error.code === 'ACCOUNT_ALREADY_REGISTERED' ? 'warn' : 'danger'}>
            {error.message}
            {error.code === 'ACCOUNT_ALREADY_REGISTERED' ? (
              <>
                {' '}
                <Link to="/signin">Sign in →</Link>
              </>
            ) : null}
          </Notice>
        ) : null}

        <Field label="Work email" hint="Must match your record on the employee roster.">
          {(id) => (
            <Input
              id={id}
              type="email"
              list="roster-emails"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@acmecorp.com"
              autoFocus
              required
            />
          )}
        </Field>
        <datalist id="roster-emails">
          {DEMO_USERS.map((u) => (
            <option key={u.empCode} value={u.email}>
              {u.name}
            </option>
          ))}
        </datalist>

        <Field label="New password" hint="At least 8 characters.">
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label="Confirm password">
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          )}
        </Field>

        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? 'Creating…' : 'Create password & sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
