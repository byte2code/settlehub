import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { Modal } from '../ui/Modal';

/** Collects a code and hands off to the /join/:code page, which previews before joining. */
export default function JoinGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    onClose();
    navigate(`/join/${encodeURIComponent(clean)}`);
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" icon={<KeyRound className="h-5 w-5" />} title="Join a group" subtitle="Enter the code a friend shared with you">
      <form onSubmit={submit} className="space-y-4">
        <input
          className="input text-center font-mono text-lg font-bold uppercase tracking-widest"
          required
          maxLength={16}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="7X9K2A"
          aria-label="Invite code"
        />
        <button type="submit" className="btn-primary w-full py-2.5 text-sm" disabled={!code.trim()}>Continue</button>
      </form>
    </Modal>
  );
}
