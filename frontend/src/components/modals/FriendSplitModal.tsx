import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { findFriendGroup, nameFromEmail } from '../../lib/friend';
import { useGroups, keys } from '../../hooks/queries';
import { useCurrentUser } from '../../hooks/useAuth';
import { Modal } from '../ui/Modal';
import { ErrorNote } from '../ui/bits';

/** Splitting with just one person: opens your existing two-person group with them, or makes one. */
export default function FriendSplitModal({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: groups = [] } = useGroups();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (clean === user.email.toLowerCase()) return setError('That’s your own email address.');
    setBusy(true);
    setError(null);
    try {
      const existing = findFriendGroup(groups, user.id, clean);
      if (existing) {
        onClose();
        navigate(`/groups/${existing.id}`);
        return;
      }
      const group = await api.createGroup({
        name: `You & ${nameFromEmail(clean)}`,
        groupType: 'couple',
        currencyCode: user.currencyCode,
        simplifyByDefault: true,
        memberEmails: [clean],
      });
      await qc.invalidateQueries({ queryKey: keys.groups });
      onClose();
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not start a split with them'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} icon={<Heart className="h-5 w-5" />} title="Split with a friend" subtitle="Just the two of you, no group needed" size="sm">
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <ErrorNote message={error} />
        <div>
          <label className="label" htmlFor="friend-email">Their email address</label>
          <input id="friend-email" type="email" required autoFocus className="input" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-1 text-[11px] text-subtle">If they aren’t on SettleHub yet, they can sign up with this email and everything will be waiting. If you already split with them, we’ll open that.</p>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy || !email.trim()}>{busy ? 'One moment…' : 'Start splitting'}</button>
      </form>
    </Modal>
  );
}
