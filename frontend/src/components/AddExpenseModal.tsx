import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Group, User, Expense } from '../types';
import { SUPPORTED_CURRENCIES } from '../types';
import { getCurrencySymbol, getStoredCurrency } from '../utils/currency';
import { X, Receipt, CheckCircle, AlertCircle, Percent, Users, Coins } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  currentUser: User;
  onExpenseAdded: (expense: Expense) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
  onExpenseAdded,
}) => {
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currencyCode, setCurrencyCode] = useState(group.currencyCode || getStoredCurrency() || 'INR');
  const [creationMethod, setCreationMethod] = useState<'EQUAL' | 'EXACT' | 'PERCENT'>('EQUAL');

  // Payer state
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [singlePayerId, setSinglePayerId] = useState(currentUser.id);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});

  // Split state
  const [selectedParticipants, setSelectedParticipants] = useState<Record<string, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbol = getCurrencySymbol(currencyCode);

  // Initialize participants on open
  useEffect(() => {
    if (group.members) {
      const initSelected: Record<string, boolean> = {};
      const initPct: Record<string, string> = {};
      const initExact: Record<string, string> = {};
      const initPayer: Record<string, string> = {};

      const count = group.members.length;
      const defaultPct = count > 0 ? (100 / count).toFixed(2) : '0';

      group.members.forEach((m) => {
        initSelected[m.userId] = true;
        initPct[m.userId] = defaultPct;
        initExact[m.userId] = '0.00';
        initPayer[m.userId] = m.userId === currentUser.id ? amountStr : '0.00';
      });

      setSelectedParticipants(initSelected);
      setPercentages(initPct);
      setExactAmounts(initExact);
      setPayerAmounts(initPayer);
      setCurrencyCode(group.currencyCode || getStoredCurrency() || 'INR');
    }
  }, [group, isOpen]);

  if (!isOpen) return null;

  const totalCents = Math.round((parseFloat(amountStr) || 0) * 100);

  // Validation calculations
  let isValid = false;
  let validationMessage = '';

  if (totalCents <= 0) {
    validationMessage = 'Enter a valid expense amount';
  } else if (isMultiPayer) {
    const paidSumCents = Object.values(payerAmounts).reduce(
      (acc, val) => acc + Math.round((parseFloat(val) || 0) * 100),
      0
    );
    if (paidSumCents !== totalCents) {
      validationMessage = `Payer total (${symbol}${(paidSumCents / 100).toFixed(2)}) must equal cost (${symbol}${(totalCents / 100).toFixed(2)})`;
    }
  }

  if (totalCents > 0 && (!isMultiPayer || !validationMessage)) {
    if (creationMethod === 'EQUAL') {
      const activeCount = Object.values(selectedParticipants).filter(Boolean).length;
      if (activeCount === 0) {
        validationMessage = 'Select at least one participant';
      } else {
        isValid = true;
        const base = Math.floor(totalCents / activeCount);
        const rem = totalCents % activeCount;
        validationMessage =
          rem > 0
            ? `${activeCount} people: ${rem} pay ${symbol}${((base + 1) / 100).toFixed(2)}, remainder pay ${symbol}${(base / 100).toFixed(2)}`
            : `${symbol}${(base / 100).toFixed(2)} per person`;
      }
    } else if (creationMethod === 'EXACT') {
      const splitSumCents = Object.values(exactAmounts).reduce(
        (acc, val) => acc + Math.round((parseFloat(val) || 0) * 100),
        0
      );
      const diff = totalCents - splitSumCents;
      if (diff === 0) {
        isValid = true;
        validationMessage = 'Exact split matches 100%';
      } else {
        validationMessage =
          diff > 0
            ? `${symbol}${(diff / 100).toFixed(2)} remaining to assign`
            : `${symbol}${(Math.abs(diff) / 100).toFixed(2)} over assigned`;
      }
    } else if (creationMethod === 'PERCENT') {
      const pctSum = Object.values(percentages).reduce(
        (acc, val) => acc + (parseFloat(val) || 0),
        0
      );
      const diff = Math.round((100 - pctSum) * 100) / 100;
      if (Math.abs(diff) <= 0.05) {
        isValid = true;
        validationMessage = 'Percentages match 100%';
      } else {
        validationMessage =
          diff > 0 ? `${diff.toFixed(1)}% remaining` : `${Math.abs(diff).toFixed(1)}% over 100%`;
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !description.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Build Payers payload
      const payers = isMultiPayer
        ? Object.entries(payerAmounts)
            .map(([userId, val]) => ({
              userId,
              paidCents: Math.round((parseFloat(val) || 0) * 100),
            }))
            .filter((p) => p.paidCents > 0)
        : [
            {
              userId: singlePayerId,
              paidCents: totalCents,
            },
          ];

      // Build Splits payload
      let splits: Array<{ userId: string; owedCents?: number; percentage?: number }> = [];

      if (creationMethod === 'EQUAL') {
        splits = Object.entries(selectedParticipants)
          .filter(([_, selected]) => selected)
          .map(([userId]) => ({ userId }));
      } else if (creationMethod === 'EXACT') {
        splits = Object.entries(exactAmounts)
          .map(([userId, val]) => ({
            userId,
            owedCents: Math.round((parseFloat(val) || 0) * 100),
          }))
          .filter((s) => (s.owedCents || 0) > 0);
      } else if (creationMethod === 'PERCENT') {
        splits = Object.entries(percentages)
          .map(([userId, val]) => ({
            userId,
            percentage: parseFloat(val) || 0,
          }))
          .filter((s) => (s.percentage || 0) > 0);
      }

      const expense = await api.createExpense(group.id, {
        description: description.trim(),
        costCents: totalCents,
        currencyCode,
        creationMethod,
        payers,
        splits,
      });

      onExpenseAdded(expense);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Add an Expense</h2>
            <p className="text-xs text-slate-400">{group.name}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Dinner, Groceries, Hotel"
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">Amount ({symbol})</label>
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  className="bg-slate-950 text-emerald-400 border border-slate-800 rounded-md text-[11px] font-mono px-1 py-0.5 focus:outline-none"
                  title="Currency"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-emerald-400 font-bold text-sm">
                  {symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Paid By Selection */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">Paid By</label>
              <button
                type="button"
                onClick={() => setIsMultiPayer(!isMultiPayer)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
              >
                {isMultiPayer ? 'Switch to Single Payer' : 'Multiple People Paid?'}
              </button>
            </div>

            {!isMultiPayer ? (
              <select
                value={singlePayerId}
                onChange={(e) => setSinglePayerId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              >
                {group.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} {m.userId === currentUser.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2 mt-2">
                {group.members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300 truncate">{m.name}</span>
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={payerAmounts[m.userId] || ''}
                        onChange={(e) =>
                          setPayerAmounts({ ...payerAmounts, [m.userId]: e.target.value })
                        }
                        placeholder="0.00"
                        className="w-full pl-7 pr-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-right focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Split Strategy Tabs */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Split Strategy</label>
            <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setCreationMethod('EQUAL')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-all ${
                  creationMethod === 'EQUAL'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Split Equally</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationMethod('EXACT')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-all ${
                  creationMethod === 'EXACT'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Exact Amounts</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationMethod('PERCENT')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-all ${
                  creationMethod === 'PERCENT'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Percentage</span>
              </button>
            </div>
          </div>

          {/* Split Strategy Details Form */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto">
            <div className="space-y-2">
              {creationMethod === 'EQUAL' &&
                group.members.map((m) => (
                  <label
                    key={m.userId}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900/60 cursor-pointer text-xs transition-colors"
                  >
                    <span className="text-slate-200 font-medium truncate">{m.name}</span>
                    <input
                      type="checkbox"
                      checked={!!selectedParticipants[m.userId]}
                      onChange={(e) =>
                        setSelectedParticipants({
                          ...selectedParticipants,
                          [m.userId]: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                    />
                  </label>
                ))}

              {creationMethod === 'EXACT' &&
                group.members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-200 font-medium truncate">{m.name}</span>
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={exactAmounts[m.userId] || ''}
                        onChange={(e) =>
                          setExactAmounts({ ...exactAmounts, [m.userId]: e.target.value })
                        }
                        placeholder="0.00"
                        className="w-full pl-7 pr-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-right focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                ))}

              {creationMethod === 'PERCENT' &&
                group.members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-200 font-medium truncate">{m.name}</span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        step="0.1"
                        value={percentages[m.userId] || ''}
                        onChange={(e) =>
                          setPercentages({ ...percentages, [m.userId]: e.target.value })
                        }
                        placeholder="0.0"
                        className="w-full pr-6 pl-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-right focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <span className="absolute right-2 top-1.5 text-slate-500">%</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Validation Status Bar */}
          <div
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
              isValid
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
          >
            {isValid ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{validationMessage}</span>
          </div>

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Adding Expense...' : 'Save Expense'}
          </button>
        </form>
      </div>
    </div>
  );
};
