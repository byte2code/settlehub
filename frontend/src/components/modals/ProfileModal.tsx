import { useState, type FormEvent } from 'react';
import { UserRound } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { SUPPORTED_CURRENCIES } from '../../lib/money';
import { useCurrentUser, useAuth } from '../../hooks/useAuth';
import { Modal } from '../ui/Modal';
import { ErrorNote } from '../ui/bits';
import { useToast } from '../ui/Toast';

export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const toast = useToast();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [currencyCode, setCurrencyCode] = useState(user.currencyCode);
  const [upiId, setUpiId] = useState(user.upiId ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setUser(await api.updateProfile({ firstName, lastName, currencyCode, upiId: upiId.trim() }));
      toast.success('Profile saved');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} icon={<UserRound className="h-5 w-5" />} title="Your profile" subtitle={user.email}>
      <div className="space-y-5">
        <ErrorNote message={error} />
        <form onSubmit={saveProfile} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="p-first">First name</label>
              <input id="p-first" className="input" required maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="p-last">Last name</label>
              <input id="p-last" className="input" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="p-currency">Default currency for new groups</label>
            <select id="p-currency" className="input" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-upi">UPI ID (optional)</label>
            <input id="p-upi" className="input font-mono" placeholder="yourname@okbank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
            <p className="mt-1 text-[11px] text-subtle">Group members who owe you get a one-tap “Pay via UPI” button. Visible only to your group members.</p>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </form>

        <form onSubmit={changePassword} className="space-y-3 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-fg">Change password</h3>
          <input type="password" className="input" placeholder="Current password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          <input type="password" className="input" placeholder="New password (8+ characters)" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          <button type="submit" className="btn-secondary w-full">Update password</button>
        </form>
      </div>
    </Modal>
  );
}
