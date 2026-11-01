import { useState, type FormEvent } from 'react';
import { Download, LogOut, ShieldAlert } from 'lucide-react';
import { api, downloadBlob, setToken } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useAuth, useCurrentUser } from '../../hooks/useAuth';
import { useConfirm } from '../ui/ConfirmDialog';
import { ErrorNote } from '../ui/bits';
import { useToast } from '../ui/Toast';

/** Sign out other devices, download your data, delete your account. */
export function AccountSection() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const revoke = async () => {
    if (!(await confirm({ title: 'Sign out other devices?', message: 'Every other phone or browser will need to sign in again. This one stays signed in.', confirmLabel: 'Sign them out' }))) return;
    setBusy(true);
    try {
      setToken((await api.revokeOtherSessions()).token);
      toast.success('Other devices signed out');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await api.exportMyData();
      await downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'SettleHub_my_data.json');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!(await confirm({ title: 'Delete your account?', message: 'Your name and email are removed. Your past expenses stay in your groups under “Deleted user” so everyone’s balances stay correct. This can’t be undone.', confirmLabel: 'Delete my account', danger: true }))) return;
    setBusy(true);
    try {
      await api.deleteAccount({ password: password || undefined, confirmEmail });
      toast.success('Your account was deleted');
      signOut();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-line pt-4" aria-label="Account controls">
      <h3 className="text-sm font-semibold text-fg">Your account</h3>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void revoke()}><LogOut className="h-3.5 w-3.5" /> Sign out other devices</button>
        <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void exportData()}><Download className="h-3.5 w-3.5" /> Download my data</button>
      </div>
      <details className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-neg"><ShieldAlert className="h-3.5 w-3.5" /> Delete my account</summary>
        <form onSubmit={(e) => void remove(e)} className="mt-3 space-y-2">
          <p className="text-[11px] text-muted">You need to be settled up in all your groups first.</p>
          <ErrorNote message={error} />
          <input className="input" type="email" required placeholder={`Type ${user.email} to confirm`} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" />
          <input className="input" type="password" placeholder="Password (leave empty if you use Google)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button type="submit" className="btn-danger w-full" disabled={busy || !confirmEmail}>Delete my account</button>
        </form>
      </details>
    </section>
  );
}
