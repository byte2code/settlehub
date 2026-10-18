import React, { useState } from 'react';
import { api } from '../services/api';
import type { Group, User, DebtRepayment, Settlement } from '../types';
import { getCurrencySymbol, getStoredCurrency } from '../utils/currency';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  currentUser: User;
  initialRepayment?: DebtRepayment | null;
  onSettlementRecorded: (settlement: Settlement) => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
  initialRepayment,
  onSettlementRecorded,
}) => {
  const [payerId, setPayerId] = useState(initialRepayment?.fromUserId || currentUser.id);
  const [payeeId, setPayeeId] = useState(
    initialRepayment?.toUserId || (group.members.find((m) => m.userId !== currentUser.id)?.userId || '')
  );
  const [amountStr, setAmountStr] = useState(
    initialRepayment ? (initialRepayment.amountCents / 100).toFixed(2) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencyCode = initialRepayment?.currencyCode || group.currencyCode || getStoredCurrency() || 'INR';
  const symbol = getCurrencySymbol(currencyCode);

  if (!isOpen) return null;

  const totalCents = Math.round((parseFloat(amountStr) || 0) * 100);
  const isValid = totalCents > 0 && payerId !== payeeId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const settlement = await api.recordSettlement({
        groupId: group.id,
        payerId,
        payeeId,
        amountCents: totalCents,
        currencyCode,
      });

      onSettlementRecorded(settlement);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Settle Up Debt</h2>
          <p className="text-xs text-slate-400">Record a payment transfer between group members</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Visual Payer -> Payee Flow */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
            <div className="flex-1">
              <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">
                Payer (Who paid?)
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                {group.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} {m.userId === currentUser.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4 text-emerald-400">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="flex-1">
              <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">
                Payee (Recipient)
              </label>
              <select
                value={payeeId}
                onChange={(e) => setPayeeId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                {group.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} {m.userId === currentUser.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-400">
                Amount to Settle ({symbol})
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {currencyCode}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-emerald-400 font-bold text-sm">
                {symbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </form>
      </div>
    </div>
  );
};
