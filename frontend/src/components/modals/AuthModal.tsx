import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, LogIn, Mail, RefreshCw } from 'lucide-react';
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
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ open, onClose, context, initialMode = 'login' }: AuthModalProps) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [regStep, setRegStep] = useState<'details' | 'otp'>('details');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [otp, setOtp] = useState('');

  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDetailsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        const res = await api.login({ email, password });
        signIn(res);
        onClose();
      } else {
        // Step 1: Send OTP / check bypass
        const otpRes = await api.sendOtp(email);
        if (otpRes.bypassed) {
          // Bypassed (development or test domain) - create account immediately
          const res = await api.register({ email, password, firstName, lastName, currencyCode });
          signIn(res);
          onClose();
        } else {
          // Verification required - transition to Step 2
          setRegStep('otp');
          setResendCooldown(60);
          setOtp('');
        }
      }
    } catch (err) {
      setError(errorMessage(err, mode === 'login' ? 'Could not sign you in' : 'Could not proceed with registration'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.register({
        email,
        password,
        firstName,
        lastName,
        currencyCode,
        otp: otp.trim(),
      });
      signIn(res);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await api.sendOtp(email);
      setResendCooldown(60);
    } catch (err) {
      setError(errorMessage(err, 'Could not resend code'));
    } finally {
      setResending(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={regStep === 'otp' ? <KeyRound className="h-5 w-5 text-brand" /> : <LogIn className="h-5 w-5" />}
      title={isLogin ? 'Welcome back' : regStep === 'otp' ? 'Check your email' : 'Create your account'}
      subtitle={
        isLogin
          ? 'Sign in to see your groups and balances'
          : regStep === 'otp'
          ? `We sent a 6-digit code to ${email}`
          : 'Free forever. Takes 20 seconds.'
      }
    >
      <div className="space-y-4">
        {context && <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-brand-fg">{context}</p>}

        {regStep === 'details' && (
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
                  setRegStep('details');
                  setError(null);
                }}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>
        )}

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

        {regStep === 'details' ? (
          <form onSubmit={handleDetailsSubmit} className="space-y-3">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    className="input"
                    required
                    maxLength={60}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    className="input"
                    maxLength={60}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
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
              {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Continue'}
            </button>
          </form>
        ) : (
          /* Step 2: OTP Entry */
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-2">
                <Mail className="h-4 w-4 text-brand-fg" />
                <span>Verification code sent to</span>
              </div>
              <p className="font-semibold text-fg text-sm">{email}</p>
            </div>

            <div>
              <label className="label text-center block" htmlFor="otp">Enter 6-digit code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="······"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input text-center text-2xl font-bold font-mono tracking-[0.4em] py-3 focus:border-brand"
              />
              <p className="mt-1.5 text-center text-[11px] text-subtle">
                Check your inbox and spam folder. Code is valid for 10 minutes.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.trim().length !== 6}
              className="btn-primary w-full py-2.5 text-sm"
            >
              {loading ? 'Verifying…' : 'Verify & Create Account'}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRegStep('details');
                  setError(null);
                }}
                className="flex items-center gap-1 text-muted hover:text-fg transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change email
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="flex items-center gap-1 font-medium text-brand-fg disabled:text-subtle disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${resending ? 'animate-spin' : ''}`} />
                {resending
                  ? 'Sending…'
                  : resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
