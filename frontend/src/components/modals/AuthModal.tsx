import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { SUPPORTED_CURRENCIES } from '../../lib/money';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../ui/Modal';
import { ErrorNote } from '../ui/bits';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown above the form, e.g. when arriving from an invite link */
  context?: string;
}

export default function AuthModal({ open, onClose, context }: AuthModalProps) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({ email, password, firstName, lastName, currencyCode });
      signIn(res);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in'));
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<LogIn className="h-5 w-5" />}
      title={isLogin ? 'Welcome back' : 'Create your account'}
      subtitle={isLogin ? 'Sign in to see your groups and balances' : 'Free forever. Takes 20 seconds.'}
    >
      <div className="space-y-4">
        {context && <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-brand-fg">{context}</p>}
        <div className="segmented w-full" role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className="flex-1 justify-center"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {import.meta.env.DEV && isLogin && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-2 text-[11px] text-muted">
            <span>Local demo:</span>
            <span className="flex gap-1.5">
              {['alice', 'bob'].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="btn-secondary px-2 py-1"
                  onClick={() => {
                    setEmail(`${n}@settlehub.com`);
                    setPassword('password123');
                  }}
                >
                  {n}
                </button>
              ))}
            </span>
          </div>
        )}

        <ErrorNote message={error} />

        <form onSubmit={submit} className="space-y-3">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="firstName">First name</label>
                <input id="firstName" className="input" required maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div>
                <label className="label" htmlFor="lastName">Last name</label>
                <input id="lastName" className="input" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              required
              minLength={isLogin ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {!isLogin && <p className="mt-1 text-[11px] text-subtle">At least 8 characters.</p>}
          </div>
          {!isLogin && (
            <div>
              <label className="label" htmlFor="currency">Default currency</label>
              <select id="currency" className="input" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-subtle">Were you added to a group by email? Sign up with that email to see it.</p>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
            {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </Modal>
  );
}
