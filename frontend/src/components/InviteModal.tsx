import React, { useState } from 'react';
import type { Group } from '../types';
import { api } from '../services/api';
import { X, Copy, Check, Share2, Mail, Users, Link as LinkIcon, Send } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  group: Group;
  onClose: () => void;
  onMemberAdded: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, group, onClose, onMemberAdded }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [email, setEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const inviteCode = group.inviteCode || group.id.substring(0, 8).toUpperCase();
  const origin = window.location.origin;
  const inviteLink = `${origin}/?join=${inviteCode}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${group.name} on SettleHub`,
          text: `Join our group "${group.name}" to split expenses and settle debts seamlessly on SettleHub!\nUse Invite Code: ${inviteCode}`,
          url: inviteLink,
        });
      } catch {
        // Ignored if cancelled
      }
    } else {
      const text = encodeURIComponent(
        `Join our group "${group.name}" on SettleHub to split expenses!\nInvite Code: ${inviteCode}\nJoin here: ${inviteLink}`
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setAddingEmail(true);
    setEmailStatus(null);
    try {
      await api.addMember(group.id, email.trim());
      setEmailStatus(`Successfully invited ${email.trim()}!`);
      setEmail('');
      onMemberAdded();
      setTimeout(() => setEmailStatus(null), 3000);
    } catch (err: any) {
      setEmailStatus(`Error: ${err.message || 'Failed to add member'}`);
    } finally {
      setAddingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Invite to Group</h2>
            <p className="text-xs text-slate-400">Share with members to split expenses in &quot;{group.name}&quot;</p>
          </div>
        </div>

        {/* Section 1: Unique Invite Code */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Group Invite Code</span>
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Fast Join</span>
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="font-mono text-xl font-black text-emerald-400 tracking-wider pl-1">
              {inviteCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Direct Invite Link */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Direct Invite Link</span>
            <span className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider">1-Click Join</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 truncate">
              {inviteLink}
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors shrink-0"
              title="Copy Link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Section 3: Add via Email */}
        <form onSubmit={handleAddEmail} className="space-y-2 pt-1 border-t border-slate-800/80">
          <label className="block text-xs font-medium text-slate-400">Or Add Member by Email</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={addingEmail || !email.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1"
            >
              <Send className="w-3 h-3 text-emerald-400" />
              <span>{addingEmail ? 'Adding...' : 'Add'}</span>
            </button>
          </div>

          {emailStatus && (
            <p className={`text-xs mt-1.5 ${emailStatus.startsWith('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {emailStatus}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
