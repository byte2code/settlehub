import { lazy, Suspense, useState, type FormEvent } from 'react';
import { UserRound } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { SUPPORTED_CURRENCIES } from '../../lib/money';
import { AVATARS } from '../../lib/avatars';
import { CHIMES, playChime } from '../../lib/chime';
import { useCurrentUser, useAuth } from '../../hooks/useAuth';
import { Modal } from '../ui/Modal';
import { Avatar, ErrorNote, PageSpinner } from '../ui/bits';
import { useToast } from '../ui/Toast';
import { useQuery } from '@tanstack/react-query';

const UpiQrPanel = lazy(() => import('../profile/UpiQrPanel'));
const WrappedPanel = lazy(() => import('../profile/WrappedPanel'));

type Tab = 'profile' | 'badges' | 'qr' | 'wrapped';
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'badges', label: 'Badges' },
  { id: 'qr', label: 'Get paid' },
  { id: 'wrapped', label: 'Wrapped' },
];

function BadgesPanel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['badges'], queryFn: api.badges });
  if (isLoading) return <PageSpinner />;
  return (
    <div className="space-y-3">
      <ErrorNote message={error ? errorMessage(error) : null} />
      <ul className="grid grid-cols-2 gap-3">
        {data?.map((b) => (
          <li key={b.id} className={`rounded-2xl border p-4 text-center ${b.earned ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-line bg-surface-2 opacity-60'}`}>
            <div className={`text-3xl ${b.earned ? '' : 'grayscale'}`}>{b.emoji}</div>
            <p className="mt-1 text-sm font-bold text-fg">{b.name}</p>
            <p className="mt-0.5 text-[11px] text-muted">{b.description}</p>
            <p className={`mt-2 text-[10px] font-semibold uppercase ${b.earned ? 'text-pos' : 'text-subtle'}`}>{b.earned ? 'Earned' : 'Locked'}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('profile');
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [currencyCode, setCurrencyCode] = useState(user.currencyCode);
  const [upiId, setUpiId] = useState(user.upiId ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarId, setAvatarId] = useState(user.avatarId ?? '');
  const [chimeSound, setChimeSound] = useState(user.chimeSound ?? 'cha-ching');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setUser(await api.updateProfile({ firstName, lastName, currencyCode, upiId: upiId.trim(), bio: bio.trim(), avatarId, chimeSound }));
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
    <Modal open={open} onClose={onClose} icon={<Avatar name={user.fullName} avatarId={avatarId || user.avatarId} />} title={user.fullName} subtitle={user.bio || user.email} size="lg">
      <div className="space-y-5">
        <div className="segmented w-full" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="flex-1">{t.label}</button>
          ))}
        </div>
        <ErrorNote message={error} />

        {tab === 'profile' && (
          <>
            <form onSubmit={saveProfile} className="space-y-3">
              <div>
                <span className="label">Avatar</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
                  <button type="button" role="radio" aria-checked={avatarId === ''} onClick={() => setAvatarId('')} className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-bold ${avatarId === '' ? 'border-emerald-500 bg-emerald-500/10' : 'border-line'}`} title="Initials">
                    <UserRound className="h-4 w-4" />
                  </button>
                  {AVATARS.map((a) => (
                    <button key={a.id} type="button" role="radio" aria-checked={avatarId === a.id} aria-label={a.label} title={a.label} onClick={() => setAvatarId(a.id)} className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${avatarId === a.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-line hover:border-line-strong'}`}>
                      {a.emoji}
                    </button>
                  ))}
                </div>
              </div>
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
                <label className="label" htmlFor="p-bio">Bio (optional)</label>
                <input id="p-bio" className="input" maxLength={120} placeholder="Splitting bills, not friendships" value={bio} onChange={(e) => setBio(e.target.value)} />
                <p className="mt-1 text-right text-[10px] text-subtle">{bio.length}/120</p>
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
              <div>
                <span className="label">Payment-received sound</span>
                <div className="grid grid-cols-2 gap-2">
                  {CHIMES.map((c) => (
                    <button key={c.id} type="button" aria-pressed={chimeSound === c.id} onClick={() => { setChimeSound(c.id); playChime(c.id); }} className={`rounded-xl border px-3 py-2 text-left text-sm ${chimeSound === c.id ? 'border-emerald-500 bg-emerald-500/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
            </form>

            <form onSubmit={changePassword} className="space-y-3 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-fg">Change password</h3>
              <input type="password" className="input" placeholder="Current password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              <input type="password" className="input" placeholder="New password (8+ characters)" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              <button type="submit" className="btn-secondary w-full">Update password</button>
            </form>
          </>
        )}

        {tab === 'badges' && <BadgesPanel />}
        <Suspense fallback={<PageSpinner />}>
          {tab === 'qr' && <UpiQrPanel upiId={user.upiId} payeeName={user.fullName} currency={user.currencyCode} />}
          {tab === 'wrapped' && <WrappedPanel />}
        </Suspense>
      </div>
    </Modal>
  );
}
