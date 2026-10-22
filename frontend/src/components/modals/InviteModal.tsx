import { useState, type FormEvent } from 'react';
import { Check, Copy, Mail, RotateCcw, Share2, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { inviteLink } from '../../lib/groups';
import { useInvalidateGroup } from '../../hooks/queries';
import type { Group } from '../../types';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';

export default function InviteModal({ open, onClose, group }: { open: boolean; onClose: () => void; group: Group }) {
  const toast = useToast();
  const confirm = useConfirm();
  const invalidate = useInvalidateGroup();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const code = group.inviteCode ?? '';
  const link = inviteLink(code);

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' || !link ? code : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Copy failed — select the text and copy it manually');
    }
  };

  const share = async () => {
    const text = `Join "${group.name}" on SettleHub to split expenses. Code: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${group.name}`, text, url: link ?? undefined });
      } catch {
        // cancelled
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(link ? `${text}\n${link}` : text)}`, '_blank', 'noopener');
    }
  };

  const addByEmail = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.addMember(group.id, email.trim());
      toast.success(`Added ${email.trim()}`);
      setEmail('');
      void invalidate(group.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add that person'));
    } finally {
      setAdding(false);
    }
  };

  const resetCode = async () => {
    const ok = await confirm({
      title: 'Reset invite link?',
      message: 'The current code and link will stop working. Members already in the group are not affected.',
      confirmLabel: 'Reset link',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.resetInviteCode(group.id);
      await invalidate(group.id);
      toast.success('New invite link created');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} icon={<UserPlus className="h-5 w-5" />} title="Invite people" subtitle={group.name}>
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-line bg-surface-2 p-4">
          <span className="text-xs font-medium text-muted">Invite code</span>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-2xl font-black tracking-widest text-brand-fg">{code}</span>
            <button className="btn-secondary" onClick={() => copy('code')}>
              {copied === 'code' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'code' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted">{link ? 'Invite link' : 'Share the code'}</span>
          <div className="flex gap-2">
            {link && (
              <>
                <div className="input truncate font-mono text-xs">{link}</div>
                <button className="btn-secondary shrink-0 px-2.5" onClick={() => copy('link')} aria-label="Copy link">
                  {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </>
            )}
            <button className="btn-primary shrink-0" onClick={share}>
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          </div>
          {group.myRole === 'ADMIN' && (
            <button className="inline-flex items-center gap-1 text-[11px] text-subtle hover:text-fg" onClick={resetCode}>
              <RotateCcw className="h-3 w-3" /> Reset link (if it was shared too widely)
            </button>
          )}
        </div>

        <form onSubmit={addByEmail} className="space-y-2 border-t border-line pt-4">
          <label className="label" htmlFor="invite-email">Or add someone by email</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
              <input id="invite-email" type="email" required className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
            </div>
            <button type="submit" className="btn-secondary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
          <p className="text-[11px] text-subtle">You can add expenses for them right away; they see everything once they sign up with this email.</p>
        </form>
      </div>
    </Modal>
  );
}
