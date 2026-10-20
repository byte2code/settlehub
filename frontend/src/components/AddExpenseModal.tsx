import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Group, User, Expense } from '../types';
import { SUPPORTED_CURRENCIES } from '../types';
import { getCurrencySymbol, getStoredCurrency } from '../utils/currency';
import {
  X, Receipt, CheckCircle, AlertCircle, Percent, Users, Coins,
  Sparkles, Camera, Trash2, Upload
} from 'lucide-react';

export interface CategoryOption {
  code: string;
  label: string;
  icon: string;
}

export const EXPENSE_CATEGORIES: CategoryOption[] = [
  { code: 'FOOD', label: 'Food', icon: '🍕' },
  { code: 'TRANSPORT', label: 'Transport', icon: '🚗' },
  { code: 'STAY', label: 'Stay', icon: '🏨' },
  { code: 'ENTERTAINMENT', label: 'Fun', icon: '🎉' },
  { code: 'SHOPPING', label: 'Shopping', icon: '🛒' },
  { code: 'OTHER', label: 'Other', icon: '📦' },
];

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  currentUser: User;
  initialExpense?: Expense | null;
  onExpenseAdded: (expense: Expense) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
  initialExpense,
  onExpenseAdded,
}) => {
  const isEditing = Boolean(initialExpense);
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<string>('OTHER');
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

  // Smart AI natural language parser state
  const [smartInput, setSmartInput] = useState('');
  const [smartParsed, setSmartParsed] = useState(false);

  // Receipt image state (base64 compressed data URL)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbol = getCurrencySymbol(currencyCode);

  const handleSmartParse = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!smartInput.trim()) return;

    let text = smartInput.trim();

    // 1. Amount match
    const amountMatch = text.match(/(?:₹|\$|€|£|rs\.?|inr\s*)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+\.[0-9]{1,2})/i);
    if (amountMatch) {
      const rawNum = amountMatch[1].replace(/,/g, '');
      const num = parseFloat(rawNum);
      if (!isNaN(num) && num > 0) {
        setAmountStr(num.toFixed(2));
        text = text.replace(amountMatch[0], ' ');
      }
    }

    // 2. Category keyword detection
    const lower = text.toLowerCase();
    if (/\b(food|dinner|lunch|breakfast|pizza|burger|meal|cafe|coffee|tea|beer|drinks|wine|restaurant|zomato|swiggy|snack|mcdonalds|kfc|subway|bar|pub)\b/.test(lower)) {
      setCategory('FOOD');
    } else if (/\b(cab|taxi|uber|ola|auto|flight|train|bus|metro|petrol|diesel|fuel|scooter|bike|toll|parking|transport)\b/.test(lower)) {
      setCategory('TRANSPORT');
    } else if (/\b(hotel|villa|resort|airbnb|stay|hostel|room|lodge|homestay|booking)\b/.test(lower)) {
      setCategory('STAY');
    } else if (/\b(party|club|clubbing|ticket|tickets|movie|concert|cruise|scuba|entry|fun|gaming|trekking)\b/.test(lower)) {
      setCategory('ENTERTAINMENT');
    } else if (/\b(shopping|mall|clothes|dress|souvenir|gift|market|store|mart|supermarket)\b/.test(lower)) {
      setCategory('SHOPPING');
    }

    // 3. Payer detection
    for (const m of group.members) {
      const firstName = m.name.split(' ')[0];
      const nameRegex = new RegExp(`(?:paid\\s+by|by|from|payer)?\\s*\\b${firstName}\\b(?:\\s*paid)?`, 'i');
      if (nameRegex.test(text)) {
        setIsMultiPayer(false);
        setSinglePayerId(m.userId);
        text = text.replace(nameRegex, ' ');
        break;
      }
    }

    // Clean up description
    text = text
      .replace(/\b(paid|by|split|equal|equally|for|with|inr|rs|at)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 0) {
      setDescription(text.charAt(0).toUpperCase() + text.slice(1));
    }

    setSmartParsed(true);
    setTimeout(() => setSmartParsed(false), 4000);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.65);
        setReceiptUrl(compressed);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Initialize form state when opening or when initialExpense changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialExpense) {
      setDescription(initialExpense.description);
      setAmountStr((initialExpense.costCents / 100).toFixed(2));
      setCategory(initialExpense.category || 'OTHER');
      setReceiptUrl(initialExpense.receiptUrl || null);
      setCurrencyCode(initialExpense.currencyCode || group.currencyCode || 'INR');
      setCreationMethod(
        initialExpense.creationMethod === 'PAYMENT' ? 'EQUAL' : initialExpense.creationMethod
      );

      // Setup payers
      if (initialExpense.payers.length > 1) {
        setIsMultiPayer(true);
        const payersMap: Record<string, string> = {};
        group.members.forEach(m => {
          const found = initialExpense.payers.find(p => p.userId === m.userId);
          payersMap[m.userId] = found ? (found.paidCents / 100).toFixed(2) : '0.00';
        });
        setPayerAmounts(payersMap);
      } else if (initialExpense.payers.length === 1) {
        setIsMultiPayer(false);
        setSinglePayerId(initialExpense.payers[0].userId);
      }

      // Setup splits
      const selMap: Record<string, boolean> = {};
      const exMap: Record<string, string> = {};
      const pctMap: Record<string, string> = {};

      group.members.forEach(m => {
        const found = initialExpense.splits.find(s => s.userId === m.userId);
        selMap[m.userId] = Boolean(found);
        exMap[m.userId] = found ? (found.owedCents / 100).toFixed(2) : '0.00';
        pctMap[m.userId] = found ? ((found.owedCents / initialExpense.costCents) * 100).toFixed(1) : '0';
      });

      setSelectedParticipants(selMap);
      setExactAmounts(exMap);
      setPercentages(pctMap);
    } else {
      // Default blank expense
      setDescription('');
      setAmountStr('');
      setCategory('OTHER');
      setCreationMethod('EQUAL');
      setIsMultiPayer(false);
      setSinglePayerId(currentUser.id);
      setReceiptUrl(null);
      setSmartInput('');

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
          initPayer[m.userId] = m.userId === currentUser.id ? '' : '0.00';
        });

        setSelectedParticipants(initSelected);
        setPercentages(initPct);
        setExactAmounts(initExact);
        setPayerAmounts(initPayer);
      }
      setCurrencyCode(group.currencyCode || getStoredCurrency() || 'INR');
    }
    setError(null);
  }, [group, isOpen, initialExpense, currentUser.id]);

  if (!isOpen) return null;

  const totalCents = Math.round((parseFloat(amountStr) || 0) * 100);

  // Validation logic
  let isValid = false;
  let validationMessage = '';

  if (totalCents <= 0) {
    validationMessage = 'Enter a valid amount';
  } else if (!description.trim()) {
    validationMessage = 'Enter a description';
  } else if (isMultiPayer) {
    const totalPaidCents = Object.values(payerAmounts).reduce(
      (acc, val) => acc + Math.round((parseFloat(val) || 0) * 100),
      0
    );
    const diff = totalCents - totalPaidCents;
    if (diff === 0) {
      isValid = true;
      validationMessage = 'Paid amounts match total';
    } else {
      validationMessage =
        diff > 0
          ? `${symbol}${(diff / 100).toFixed(2)} remaining to allocate`
          : `${symbol}${(Math.abs(diff) / 100).toFixed(2)} over allocated`;
    }
  } else {
    // Single payer is always valid for payers
    isValid = true;
  }

  // Split-specific validation
  if (isValid && totalCents > 0) {
    if (creationMethod === 'EQUAL') {
      const selectedCount = Object.values(selectedParticipants).filter(Boolean).length;
      if (selectedCount === 0) {
        isValid = false;
        validationMessage = 'Select at least 1 person to split';
      }
    } else if (creationMethod === 'EXACT') {
      const exactSumCents = Object.values(exactAmounts).reduce(
        (acc, val) => acc + Math.round((parseFloat(val) || 0) * 100),
        0
      );
      const diff = totalCents - exactSumCents;
      if (diff === 0) {
        isValid = true;
        validationMessage = 'Exact splits match total';
      } else {
        isValid = false;
        validationMessage =
          diff > 0
            ? `${symbol}${(diff / 100).toFixed(2)} left to split`
            : `${symbol}${(Math.abs(diff) / 100).toFixed(2)} over total amount`;
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
        isValid = false;
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

      const payload = {
        description: description.trim(),
        costCents: totalCents,
        currencyCode,
        category,
        receiptUrl: receiptUrl || null,
        creationMethod,
        payers,
        splits,
      };

      let result: Expense;
      if (isEditing && initialExpense) {
        result = await api.updateExpense(initialExpense.id, payload);
      } else {
        result = await api.createExpense(group.id, payload);
      }

      onExpenseAdded(result);
      onClose();
    } catch (err: any) {
      setError(err.message || (isEditing ? 'Failed to update expense' : 'Failed to add expense'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>{isEditing ? 'Edit Expense' : 'Add an Expense'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                2.0
              </span>
            </h2>
            <p className="text-xs text-slate-400">{group.name}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Smart AI Quick Entry Bar */}
          {!isEditing && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  <span>AI Smart Quick Fill</span>
                </span>
                {smartParsed && (
                  <span className="text-[10px] text-emerald-300 font-medium animate-fade-in">
                    ✨ Form auto-filled!
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={smartInput}
                  onChange={(e) => setSmartInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSmartParse();
                    }
                  }}
                  placeholder="e.g. Seafood Dinner at Brittos 1500 paid by Alice"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-950/90 border border-emerald-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => handleSmartParse()}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl transition-all shrink-0 active:scale-95"
                >
                  Magic Fill
                </button>
              </div>
            </div>
          )}

          {/* Description & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Seafood Dinner, Hotel Booking, Fuel"
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

          {/* Category Selector Chips */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = category === cat.code;
                return (
                  <button
                    key={cat.code}
                    type="button"
                    onClick={() => setCategory(cat.code)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <span className="text-base mb-0.5">{cat.icon}</span>
                    <span className="text-[10px]">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paid By Selection */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
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
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold text-xs">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payerAmounts[m.userId] || ''}
                        onChange={(e) =>
                          setPayerAmounts({
                            ...payerAmounts,
                            [m.userId]: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        className="w-full pl-6 pr-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Split Strategy Header */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-slate-300">Split Method</label>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreationMethod('EQUAL')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    creationMethod === 'EQUAL'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3 h-3 inline mr-1" />
                  Equally
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMethod('EXACT')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    creationMethod === 'EXACT'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Coins className="w-3 h-3 inline mr-1" />
                  Exact
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMethod('PERCENT')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    creationMethod === 'PERCENT'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Percent className="w-3 h-3 inline mr-1" />
                  %
                </button>
              </div>
            </div>

            {/* Split Content */}
            <div className="space-y-2 mt-2">
              {creationMethod === 'EQUAL' && (
                <div className="grid grid-cols-2 gap-2">
                  {group.members.map((m) => {
                    const isChecked = selectedParticipants[m.userId] ?? true;
                    return (
                      <label
                        key={m.userId}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedParticipants({
                              ...selectedParticipants,
                              [m.userId]: e.target.checked,
                            })
                          }
                          className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-800"
                        />
                        <span className="truncate">{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {creationMethod === 'EXACT' && (
                <div className="space-y-2">
                  {group.members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-300 truncate">{m.name}</span>
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold text-xs">
                          {symbol}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={exactAmounts[m.userId] || ''}
                          onChange={(e) =>
                            setExactAmounts({
                              ...exactAmounts,
                              [m.userId]: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {creationMethod === 'PERCENT' && (
                <div className="space-y-2">
                  {group.members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-300 truncate">{m.name}</span>
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={percentages[m.userId] || ''}
                          onChange={(e) =>
                            setPercentages({
                              ...percentages,
                              [m.userId]: e.target.value,
                            })
                          }
                          placeholder="0.0"
                          className="w-full pr-6 pl-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-right"
                        />
                        <span className="absolute right-2 top-1.5 text-slate-500 font-bold text-xs">
                          %
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Receipt / Bill Photo Attachment */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Receipt / Bill Photo</span>
                <span className="text-[10px] font-normal text-slate-500">(Optional)</span>
              </label>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => setReceiptUrl(null)}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>

            {receiptUrl ? (
              <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 max-h-48 flex items-center justify-center">
                <img
                  src={receiptUrl}
                  alt="Receipt Preview"
                  className="max-h-48 w-auto object-contain rounded-xl"
                />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900/50 hover:bg-slate-900/80 cursor-pointer transition-all group">
                <div className="w-8 h-8 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center mb-1.5 transition-colors">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white font-medium">
                  Upload Bill or Snap Photo
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  JPEG, PNG, or WebP (auto-compressed)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Validation Feedback Bar */}
          <div
            className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
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
            <span>{validationMessage}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? isEditing
                  ? 'Updating...'
                  : 'Saving...'
                : isEditing
                ? 'Save Changes'
                : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
