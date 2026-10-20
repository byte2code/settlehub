import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useGroupWebSocket } from '../services/websocket';
import type { Group, User, Expense, GroupBalanceSummary, DebtRepayment, Settlement } from '../types';
import { AddExpenseModal } from './AddExpenseModal';
import { SettleUpModal } from './SettleUpModal';
import { InviteModal } from './InviteModal';
import { ExportSummaryModal } from './ExportSummaryModal';
import {
  ArrowLeft, Plus, CheckCircle2, Shuffle, Trash2, Calendar,
  CreditCard, Compass, Home, Heart, MoreHorizontal, UserPlus,
  Share2, Radio, Receipt, History, BarChart3, TrendingUp,
  Search, Pencil, PieChart, Archive, ArchiveRestore, Paperclip, X, Target
} from 'lucide-react';

interface GroupDetailProps {
  groupId: string;
  currentUser: User;
  onBack: () => void;
}

export const GroupDetail: React.FC<GroupDetailProps> = ({ groupId, currentUser, onBack }) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<GroupBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State: expenses | settlements | stats
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'stats'>('expenses');

  // Search and Category Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<DebtRepayment | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Local toggle for simplify debts
  const [simplifyDebts, setSimplifyDebts] = useState(true);

  const handleToggleArchive = async () => {
    if (!group) return;
    const nextArchived = !group.archived;
    const confirmMsg = nextArchived
      ? 'Archive this trip? It will be moved to the Archived tab.'
      : 'Restore this trip back to active trips?';
    if (!confirm(confirmMsg)) return;
    try {
      await api.updateGroup(groupId, { archived: nextArchived });
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update group status');
    }
  };

  const fetchData = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      setError(null);
      const [groupData, expensesData, balancesData, settlementsData] = await Promise.all([
        api.getGroup(groupId),
        api.getExpenses(groupId),
        api.getGroupBalances(groupId),
        api.getGroupSettlements(groupId).catch(() => []),
      ]);

      setGroup(groupData);
      setExpenses(expensesData);
      setBalanceSummary(balancesData);
      setSettlements(settlementsData);
      setSimplifyDebts(balancesData.simplifyByDefault);
    } catch (err: any) {
      setError(err.message || 'Failed to load group details');
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  // Real-time WebSocket connection
  const { isConnected: isLiveConnected } = useGroupWebSocket(groupId, () => {
    fetchData(false);
  });

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.deleteExpense(expenseId);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  const handleToggleSimplify = async (checked: boolean) => {
    setSimplifyDebts(checked);
    try {
      await api.updateGroup(groupId, { simplifyByDefault: checked });
    } catch {
      // Non-critical background sync
    }
  };

  if (loading && !group) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4 text-sm">
          {error || 'Group not found'}
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-slate-800 text-white rounded-xl hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  const activeDebts = simplifyDebts
    ? (balanceSummary?.simplifiedDebts || [])
    : (balanceSummary?.originalDebts || []);

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'trip': return Compass;
      case 'home': return Home;
      case 'couple': return Heart;
      default: return MoreHorizontal;
    }
  };
  const CategoryIcon = getCategoryIcon(group.groupType);

  const getCategoryBadge = (cat?: string) => {
    switch (cat?.toUpperCase()) {
      case 'FOOD': return { icon: '🍕', label: 'Food', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
      case 'TRANSPORT': return { icon: '🚗', label: 'Transport', color: 'bg-blue-500/10 text-blue-300 border-blue-500/20' };
      case 'STAY': return { icon: '🏨', label: 'Stay', color: 'bg-purple-500/10 text-purple-300 border-purple-500/20' };
      case 'ENTERTAINMENT': return { icon: '🎉', label: 'Fun', color: 'bg-pink-500/10 text-pink-300 border-pink-500/20' };
      case 'SHOPPING': return { icon: '🛒', label: 'Shopping', color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' };
      default: return { icon: '📦', label: 'Other', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  // Compute analytics
  const nonPaymentExpenses = expenses.filter(e => !e.isPayment);
  const totalSpendCents = nonPaymentExpenses.reduce((sum, e) => sum + e.costCents, 0);
  const currency = group.currencyCode || 'INR';

  // Budget calculations
  const budgetCents = group.budgetCents || 0;
  const hasBudget = budgetCents > 0;
  const budgetPct = hasBudget ? Math.min(100, Math.round((totalSpendCents / budgetCents) * 100)) : 0;
  const isOverBudget = hasBudget && totalSpendCents > budgetCents;
  const overBudgetCents = isOverBudget ? totalSpendCents - budgetCents : 0;

  // Spending per member map
  const memberPaidMap: Record<string, number> = {};
  // Spending per category map
  const categorySpendMap: Record<string, number> = {
    FOOD: 0,
    TRANSPORT: 0,
    STAY: 0,
    ENTERTAINMENT: 0,
    SHOPPING: 0,
    OTHER: 0,
  };

  nonPaymentExpenses.forEach(exp => {
    exp.payers.forEach(p => {
      memberPaidMap[p.userName] = (memberPaidMap[p.userName] || 0) + p.paidCents;
    });
    const cat = (exp.category || 'OTHER').toUpperCase();
    categorySpendMap[cat] = (categorySpendMap[cat] || 0) + exp.costCents;
  });

  // Filtered expenses based on search and category
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = searchQuery.trim() === '' ||
      exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.payers.some(p => p.userName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' ||
      (exp.category || 'OTHER').toUpperCase() === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Top Navigation & Group Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 border border-slate-800 transition-colors shrink-0 mt-0.5 sm:mt-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">{group.name}</h1>
              {group.archived && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Archive className="w-3 h-3" />
                  <span>Archived</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                <CategoryIcon className="w-3 h-3 text-emerald-400" />
                {group.groupType}
              </span>
              <span className="inline-flex items-center text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {group.currencyCode || 'INR'}
              </span>
              {/* WebSocket Live Status */}
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                  isLiveConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title={isLiveConnected ? 'Connected to live real-time sync' : 'Connecting to live updates...'}
              >
                <Radio className={`w-3 h-3 ${isLiveConnected ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
                <span>{isLiveConnected ? 'Live' : 'Syncing'}</span>
              </span>
              {group.inviteCode && (
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors cursor-pointer"
                  title="Click to copy invite code or link"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Code: {group.inviteCode}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{group.members.length} members involved</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Archive / Restore Button */}
          <button
            type="button"
            onClick={handleToggleArchive}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all active:scale-95 shadow-sm ${
              group.archived
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
            }`}
            title={group.archived ? 'Restore this trip back to active trips' : 'Archive this trip'}
          >
            {group.archived ? (
              <>
                <ArchiveRestore className="w-4 h-4 text-amber-400" />
                <span>Restore</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 text-slate-400" />
                <span>Archive</span>
              </>
            )}
          </button>

          {/* Share & Export Button (SettleHub 2.0 Feature) */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all active:scale-95 shadow-sm"
            title="Export WhatsApp Summary or Excel Spreadsheet"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Share & Export</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all active:scale-95 shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-slate-400" />
            <span>Invite</span>
          </button>

          <button
            onClick={() => { setSelectedRepayment(null); setShowSettleUp(true); }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all active:scale-95 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Settle Up</span>
          </button>

          <button
            onClick={() => {
              setEditingExpense(null);
              setShowAddExpense(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Target Trip Budget Pacing Bar (SettleHub 2.0 Feature) */}
      {hasBudget && (
        <div className="p-4 rounded-2xl glass-panel border border-slate-800 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isOverBudget ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' : 'bg-teal-500/15 text-teal-300 border border-teal-500/25'
              }`}>
                <Target className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Target Trip Budget Pacing</span>
                  {isOverBudget ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      ⚠️ Exceeded by {(overBudgetCents / 100).toFixed(2)} {currency}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {100 - budgetPct}% remaining
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isOverBudget
                    ? 'Total expenses have surpassed the group trip budget limit.'
                    : 'Spending is on pace with the target group budget.'}
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-left sm:text-right">
              <span className="text-slate-400">Spent </span>
              <strong className="text-white font-bold">{(totalSpendCents / 100).toFixed(2)} {currency}</strong>
              <span className="text-slate-400"> of </span>
              <strong className="text-teal-300 font-bold">{group.budgetFormatted || `${(budgetCents / 100).toFixed(2)} ${currency}`}</strong>
              <span className="text-slate-400"> ({Math.round((totalSpendCents / budgetCents) * 100)}%)</span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : budgetPct > 80
                  ? 'bg-gradient-to-r from-teal-400 to-amber-400'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Debt Graph Resolution Section */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Group Balances & Debts</h2>
              {simplifyDebts && (balanceSummary?.savedTransactionsCount || 0) > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ⚡ {balanceSummary?.savedTransactionsCount} repayments eliminated
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {simplifyDebts
                ? 'Displaying minimized settlement transactions via Dual Max-Heap algorithm'
                : 'Displaying raw direct pairwise debts'}
            </p>
          </div>

          {/* Simplify Debts Toggle Switch */}
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
            <Shuffle className={`w-3.5 h-3.5 ${simplifyDebts ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-xs font-medium text-slate-300">Simplify Debts</span>
            <button
              type="button"
              onClick={() => handleToggleSimplify(!simplifyDebts)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                simplifyDebts ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  simplifyDebts ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Member Balances List */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {group.members.map(m => {
            const isOwed = m.netBalanceCents > 0;
            const isDebt = m.netBalanceCents < 0;
            return (
              <div key={m.userId} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 truncate font-medium">{m.name}</span>
                <span className={`text-xs font-bold ${
                  isOwed ? 'text-emerald-400' : isDebt ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  {m.netBalanceFormatted}
                </span>
              </div>
            );
          })}
        </div>

        {/* Active Debts Cards */}
        {activeDebts.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5 opacity-80" />
            <p className="text-xs font-medium text-slate-300">All settled up!</p>
            <p className="text-[11px] text-slate-500">No pending debts inside this group.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeDebts.map((debt, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="text-xs truncate">
                  <span className="font-semibold text-rose-400">{debt.fromUserName}</span>
                  <span className="text-slate-500 mx-1.5">owes</span>
                  <span className="font-semibold text-emerald-400">{debt.toUserName}</span>
                  <div className="text-sm font-bold text-white mt-0.5">{debt.amountFormatted}</div>
                </div>

                <button
                  onClick={() => {
                    setSelectedRepayment(debt);
                    setShowSettleUp(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap active:scale-95"
                >
                  Settle
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs: Expenses | Settlements History | Stats */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start">
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'expenses'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Expenses ({expenses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settlements')}
              className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'settlements'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Settlement History ({settlements.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'stats'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Trip Stats</span>
            </button>
          </div>

          <span className="text-xs text-slate-400">
            Total Spend: <strong className="text-white">{(totalSpendCents / 100).toFixed(2)} {currency}</strong>
          </span>
        </div>

        {/* Tab 1: Expenses Feed */}
        {activeTab === 'expenses' && (
          <div className="space-y-3">
            {/* Search and Category Filter Toolbar */}
            {expenses.length > 0 && (
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search expenses by description or payer..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2 text-xs text-slate-500 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                      selectedCategory === 'ALL'
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    All ({expenses.length})
                  </button>
                  {[
                    { code: 'FOOD', icon: '🍕', label: 'Food' },
                    { code: 'TRANSPORT', icon: '🚗', label: 'Transport' },
                    { code: 'STAY', icon: '🏨', label: 'Stay' },
                    { code: 'ENTERTAINMENT', icon: '🎉', label: 'Fun' },
                    { code: 'SHOPPING', icon: '🛒', label: 'Shopping' },
                    { code: 'OTHER', icon: '📦', label: 'Other' },
                  ].map(c => {
                    const count = expenses.filter(e => (e.category || 'OTHER').toUpperCase() === c.code).length;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSelectedCategory(c.code)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                          selectedCategory === c.code
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <span>{c.icon}</span>
                        <span>{c.label}</span>
                        {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12 glass-panel rounded-2xl">
                <CreditCard className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-300">
                  {expenses.length === 0 ? 'No expenses recorded yet' : 'No expenses match your search'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {expenses.length === 0
                    ? 'Click "Add Expense" to start sharing costs.'
                    : 'Try clearing the search query or category filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map(expense => {
                  const isPayment = expense.isPayment;
                  const dateStr = new Date(expense.date).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric'
                  });
                  const categoryBadge = getCategoryBadge(expense.category);

                  return (
                    <div
                      key={expense.id}
                      className={`p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 sm:gap-4 transition-all ${
                        isPayment
                          ? 'bg-emerald-950/20 border-emerald-500/20'
                          : 'glass-card'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isPayment
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {isPayment ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <span className="text-base">{categoryBadge.icon}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-white truncate">{expense.description}</span>
                            {isPayment ? (
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                Settlement
                              </span>
                            ) : (
                              <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full border ${categoryBadge.color}`}>
                                {categoryBadge.label}
                              </span>
                            )}
                            {expense.receiptUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewReceiptUrl(expense.receiptUrl!);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer active:scale-95"
                                title="View attached receipt photo"
                              >
                                <Paperclip className="w-3 h-3 text-emerald-400" />
                                <span>Receipt</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {dateStr}
                            </span>
                            <span>•</span>
                            <span className="truncate">
                              Paid by {expense.payers.map(p => p.userName).join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-white font-mono">{expense.costFormatted}</div>
                          <div className="text-[11px] text-slate-400">
                            {expense.splits.length} splits
                          </div>
                        </div>

                        {/* Edit Expense Button */}
                        {!isPayment && (
                          <button
                            onClick={() => {
                              setEditingExpense(expense);
                              setShowAddExpense(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Edit expense"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Expense Button */}
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Settlement History */}
        {activeTab === 'settlements' && (
          settlements.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-2xl">
              <History className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-300">No settlements recorded yet</h3>
              <p className="text-xs text-slate-500 mt-1">When members tap &quot;Settle Up&quot;, a permanent audit log is recorded here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map(s => {
                const dateStr = s.date ? new Date(s.date).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'Recently';

                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          <span className="text-rose-400">{s.payerName}</span> paid <span className="text-emerald-400">{s.payeeName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {dateStr}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-emerald-400">{s.amountFormatted}</span>
                      <span className="block text-[10px] text-slate-500">Paid in full</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Tab 3: Trip Stats & Analytics */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Breakdown */}
            <div className="glass-panel p-4 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-emerald-400" />
                <span>Spending by Category</span>
              </h3>

              <div className="space-y-2.5">
                {[
                  { code: 'FOOD', icon: '🍕', label: 'Food & Dining', color: 'from-amber-500 to-yellow-400' },
                  { code: 'TRANSPORT', icon: '🚗', label: 'Transport & Fuel', color: 'from-blue-500 to-cyan-400' },
                  { code: 'STAY', icon: '🏨', label: 'Stay & Hotel', color: 'from-purple-500 to-indigo-400' },
                  { code: 'ENTERTAINMENT', icon: '🎉', label: 'Activities & Fun', color: 'from-pink-500 to-rose-400' },
                  { code: 'SHOPPING', icon: '🛒', label: 'Shopping & Groceries', color: 'from-teal-500 to-emerald-400' },
                  { code: 'OTHER', icon: '📦', label: 'General / Other', color: 'from-slate-600 to-slate-400' },
                ].map(cat => {
                  const spendCents = categorySpendMap[cat.code] || 0;
                  const pct = totalSpendCents > 0 ? Math.round((spendCents / totalSpendCents) * 100) : 0;
                  if (spendCents === 0 && totalSpendCents > 0) return null;

                  return (
                    <div key={cat.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium flex items-center gap-1.5">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                        <span className="text-slate-400 font-mono">
                          {(spendCents / 100).toFixed(2)} {currency} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${cat.color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Member Spending Breakdown */}
            <div className="glass-panel p-4 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Spending by Member</span>
              </h3>

              <div className="space-y-2.5">
                {group.members.map(m => {
                  const paidCents = memberPaidMap[m.name] || 0;
                  const percent = totalSpendCents > 0 ? Math.round((paidCents / totalSpendCents) * 100) : 0;
                  return (
                    <div key={m.userId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{m.name}</span>
                        <span className="text-slate-400 font-mono">
                          {(paidCents / 100).toFixed(2)} {currency} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Group Quick Metrics */}
              <div className={`grid ${hasBudget ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-2 border-t border-slate-800 text-center`}>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Avg Per Member</span>
                  <span className="text-xs font-bold text-white font-mono">
                    {group.members.length > 0 ? (totalSpendCents / group.members.length / 100).toFixed(2) : 0} {currency}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Settlements</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {settlements.length} completed
                  </span>
                </div>
                {hasBudget && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Target Budget</span>
                    <span className={`text-xs font-bold font-mono ${isOverBudget ? 'text-rose-400' : 'text-teal-300'}`}>
                      {Math.round((totalSpendCents / budgetCents) * 100)}% spent
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => {
          setShowAddExpense(false);
          setEditingExpense(null);
        }}
        group={group}
        currentUser={currentUser}
        initialExpense={editingExpense}
        onExpenseAdded={() => {
          fetchData(false);
          setEditingExpense(null);
        }}
      />

      <SettleUpModal
        isOpen={showSettleUp}
        onClose={() => { setShowSettleUp(false); setSelectedRepayment(null); }}
        group={group}
        currentUser={currentUser}
        initialRepayment={selectedRepayment}
        onSettlementRecorded={() => fetchData(false)}
      />

      <InviteModal
        isOpen={showInviteModal}
        group={group}
        onClose={() => setShowInviteModal(false)}
        onMemberAdded={() => fetchData(false)}
      />

      <ExportSummaryModal
        isOpen={showExportModal}
        group={group}
        balanceSummary={balanceSummary}
        onClose={() => setShowExportModal(false)}
      />

      {/* Receipt Lightbox Modal (SettleHub 2.0 Feature) */}
      {previewReceiptUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div
            className="relative max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Paperclip className="w-4 h-4 text-emerald-400" />
                <span>Expense Receipt Photo</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewReceiptUrl}
                alt="Receipt"
                className="max-w-full max-h-[65vh] rounded-xl object-contain shadow-md"
              />
            </div>

            <div className="p-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Saved permanently in PostgreSQL</span>
              <a
                href={previewReceiptUrl}
                download="settlehub-receipt.jpg"
                className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline flex items-center gap-1"
              >
                <span>Download Image</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
