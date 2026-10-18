import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Group, User, Expense, GroupBalanceSummary, DebtRepayment } from '../types';
import { AddExpenseModal } from './AddExpenseModal';
import { SettleUpModal } from './SettleUpModal';
import { InviteModal } from './InviteModal';
import {
  ArrowLeft, Plus, CheckCircle2, Shuffle, Trash2, Calendar,
  CreditCard, Compass, Home, Heart, MoreHorizontal, UserPlus
} from 'lucide-react';

interface GroupDetailProps {
  groupId: string;
  currentUser: User;
  onBack: () => void;
}

export const GroupDetail: React.FC<GroupDetailProps> = ({ groupId, currentUser, onBack }) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<GroupBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<DebtRepayment | null>(null);

  // Local toggle for simplify debts
  const [simplifyDebts, setSimplifyDebts] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [groupData, expensesData, balancesData] = await Promise.all([
        api.getGroup(groupId),
        api.getExpenses(groupId),
        api.getGroupBalances(groupId),
      ]);

      setGroup(groupData);
      setExpenses(expensesData);
      setBalanceSummary(balancesData);
      setSimplifyDebts(balancesData.simplifyByDefault);
    } catch (err: any) {
      setError(err.message || 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.deleteExpense(expenseId);
      fetchData();
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
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                <CategoryIcon className="w-3 h-3 text-emerald-400" />
                {group.groupType}
              </span>
              <span className="inline-flex items-center text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {group.currencyCode || 'INR'}
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
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all active:scale-95 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
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
            onClick={() => setShowAddExpense(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

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

      {/* Chronological Activity Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Activity Feed</h2>
          <span className="text-xs text-slate-400">{expenses.length} transactions</span>
        </div>

        {expenses.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-2xl">
            <CreditCard className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No expenses recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1">Click "Add Expense" to start sharing costs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map(expense => {
              const isPayment = expense.isPayment;
              const dateStr = new Date(expense.date).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric'
              });

              return (
                <div
                  key={expense.id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    isPayment
                      ? 'bg-emerald-950/20 border-emerald-500/20'
                      : 'glass-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isPayment
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {isPayment ? <CheckCircle2 className="w-5 h-5" /> : <CreditCard className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{expense.description}</span>
                        {isPayment && (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            Settlement
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {dateStr}
                        </span>
                        <span>•</span>
                        <span>
                          Paid by {expense.payers.map(p => p.userName).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{expense.costFormatted}</div>
                      <div className="text-[11px] text-slate-400">
                        {expense.splits.length} splits ({expense.creationMethod.toLowerCase()})
                      </div>
                    </div>

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

      {/* Modals */}
      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        group={group}
        currentUser={currentUser}
        onExpenseAdded={() => fetchData()}
      />

      <SettleUpModal
        isOpen={showSettleUp}
        onClose={() => { setShowSettleUp(false); setSelectedRepayment(null); }}
        group={group}
        currentUser={currentUser}
        initialRepayment={selectedRepayment}
        onSettlementRecorded={() => fetchData()}
      />

      <InviteModal
        isOpen={showInviteModal}
        group={group}
        onClose={() => setShowInviteModal(false)}
        onMemberAdded={() => fetchData()}
      />
    </div>
  );
};
