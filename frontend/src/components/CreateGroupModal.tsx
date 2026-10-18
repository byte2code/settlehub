import React, { useState } from 'react';
import { api } from '../services/api';
import type { Group } from '../types';
import { SUPPORTED_CURRENCIES } from '../types';
import { getStoredCurrency } from '../utils/currency';
import { X, Users, Compass, Home, Heart, MoreHorizontal, Plus, Trash2, Coins } from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose, onGroupCreated }) => {
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState('trip');
  const [currencyCode, setCurrencyCode] = useState(getStoredCurrency() || 'INR');
  const [simplifyByDefault, setSimplifyByDefault] = useState(true);
  const [emails, setEmails] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddEmail = () => {
    setEmails([...emails, '']);
  };

  const handleRemoveEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, val: string) => {
    const updated = [...emails];
    updated[index] = val;
    setEmails(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const validEmails = emails.map((em) => em.trim().toLowerCase()).filter((em) => em.length > 0);
      const group = await api.createGroup({
        name: name.trim(),
        groupType,
        currencyCode,
        simplifyByDefault,
        memberEmails: validEmails,
      });

      onGroupCreated(group);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Create New Group</h2>
            <p className="text-xs text-slate-400">Share expenses with housemates, trips, or friends</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Group Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Goa Trip 2026, Bangalore Apartment"
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Group Currency Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Group Currency (Default: Indian Rupee)</span>
              </label>
              <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                {SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode)?.symbol} {currencyCode}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-h-24 overflow-y-auto pr-1">
              {SUPPORTED_CURRENCIES.map((cur) => {
                const isSelected = currencyCode === cur.code;
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => setCurrencyCode(cur.code)}
                    className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span>{cur.flag}</span>
                    <span className="font-mono font-bold">{cur.symbol}</span>
                    <span className="text-[10px]">{cur.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Group Category</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'trip', label: 'Trip', icon: Compass },
                { id: 'home', label: 'Home', icon: Home },
                { id: 'couple', label: 'Couple', icon: Heart },
                { id: 'other', label: 'Other', icon: MoreHorizontal },
              ].map((cat) => {
                const Icon = cat.icon;
                const selected = groupType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setGroupType(cat.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      selected
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">Invite Members (Email)</label>
              <button
                type="button"
                onClick={handleAddEmail}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Person</span>
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {emails.map((email, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(idx, e.target.value)}
                    placeholder={`friend${idx + 1}@example.com`}
                    className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-200">Simplify Debts Automatically</div>
              <div className="text-[11px] text-slate-400">Reduces number of transfers via debt graph solver</div>
            </div>
            <input
              type="checkbox"
              checked={simplifyByDefault}
              onChange={(e) => setSimplifyByDefault(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
};
