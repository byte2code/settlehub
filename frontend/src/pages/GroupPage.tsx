import { lazy, Suspense, useCallback, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Archive, ArchiveRestore, ArrowLeft, BarChart3, CheckCircle2, History, Plus, Radio, Receipt, Settings, Share2, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatMoney } from '../lib/money';
import { keys, useBalances, useExpenses, useGroup, useInvalidateGroup, useSettlements } from '../hooks/queries';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroupSocket, type GroupSocketEvent } from '../hooks/useGroupSocket';
import type { DebtRepayment, Expense, Settlement } from '../types';
import { ActivityFeed } from '../components/group/ActivityFeed';
import { BalancesPanel } from '../components/group/BalancesPanel';
import { BudgetBar } from '../components/group/BudgetBar';
import { ExpenseList } from '../components/group/ExpenseList';
import { SettlementList } from '../components/group/SettlementList';
import { StatsPanel } from '../components/group/StatsPanel';
import { ErrorNote, PageSpinner } from '../components/ui/bits';
import { GroupTypeIcon } from '../components/ui/GroupTypeIcon';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

const ExpenseFormModal = lazy(() => import('../components/modals/ExpenseFormModal'));
const SettleUpModal = lazy(() => import('../components/modals/SettleUpModal'));
const InviteModal = lazy(() => import('../components/modals/InviteModal'));
const ExportModal = lazy(() => import('../components/modals/ExportModal'));
const GroupSettingsModal = lazy(() => import('../components/modals/GroupSettingsModal'));
const ReceiptViewer = lazy(() => import('../components/modals/ReceiptViewer'));

type Tab = 'expenses' | 'payments' | 'stats' | 'activity';
type ModalState =
  | { kind: 'expense'; expense: Expense | null }
  | { kind: 'settle'; repayment: DebtRepayment | null }
  | { kind: 'invite' }
  | { kind: 'export' }
  | { kind: 'settings' }
  | { kind: 'receipt'; expense: Expense }
  | null;

export function GroupPage() {
  const { groupId = '' } = useParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateGroup();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'expenses';
  const [modal, setModal] = useState<ModalState>(null);

  const groupQuery = useGroup(groupId);
  const expensesQuery = useExpenses(groupId);
  const balancesQuery = useBalances(groupId);
  const settlementsQuery = useSettlements(groupId);
  const group = groupQuery.data;

  const onSocketEvent = useCallback(
    (event: GroupSocketEvent) => {
      if (event.type === 'GROUP_DELETED' || (event.type === 'MEMBER_LEFT' && event.entityId === user.id && event.actorId !== user.id)) {
        queryClient.removeQueries({ queryKey: ['group', groupId] });
        void queryClient.invalidateQueries({ queryKey: keys.groups });
        toast.info(event.type === 'GROUP_DELETED' ? 'This group was deleted' : 'You were removed from this group');
        navigate('/');
        return;
      }
      void invalidate(groupId);
    },
    [groupId, user.id, queryClient, invalidate, navigate, toast],
  );
  const live = useGroupSocket(group ? groupId : undefined, onSocketEvent);

  const setTab = (next: Tab) => setParams(next === 'expenses' ? {} : { tab: next }, { replace: true });

  if (groupQuery.isLoading) return <PageSpinner />;
  if (groupQuery.error || !group) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <ErrorNote message={errorMessage(groupQuery.error, 'Group not found')} />
        <button className="btn-secondary" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /> Back to groups</button>
      </div>
    );
  }

  const expenses = expensesQuery.data ?? [];
  const settlements = settlementsQuery.data ?? [];
  const simplify = group.simplifyByDefault;

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      await invalidate(groupId);
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteExpense = async (expense: Expense) => {
    if (await confirm({ title: 'Delete expense?', message: `“${expense.description}” (${expense.costFormatted}) will be removed for everyone.`, confirmLabel: 'Delete', danger: true })) {
      await run(() => api.deleteExpense(expense.id), 'Expense deleted');
    }
  };

  const undoSettlement = async (s: Settlement) => {
    if (await confirm({ title: 'Undo this payment?', message: `${s.payerName} → ${s.payeeName}, ${s.amountFormatted}. Balances will change back.`, confirmLabel: 'Undo payment', danger: true })) {
      await run(() => api.deleteSettlement(s.id), 'Payment removed');
    }
  };

  const toggleArchive = () =>
    run(() => api.updateGroup(groupId, { archived: !group.archived }), group.archived ? 'Group restored' : 'Group archived');

  const TABS: { id: Tab; label: string; icon: typeof Receipt; count?: number }[] = [
    { id: 'expenses', label: 'Expenses', icon: Receipt, count: expenses.length },
    { id: 'payments', label: 'Payments', icon: History, count: settlements.length },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 pb-24 animate-fade-in sm:space-y-6 sm:px-4 sm:py-6">
      <header className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <button className="btn-ghost mt-0.5 shrink-0 border border-line p-2" onClick={() => navigate('/')} aria-label="Back to groups">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold tracking-tight text-fg sm:text-2xl">{group.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="chip border-line text-muted"><GroupTypeIcon type={group.groupType} className="h-3 w-3" /> {group.groupType}</span>
              <span className="chip border-emerald-500/20 bg-emerald-500/10 font-mono text-brand-fg">{group.currencyCode}</span>
              {group.archived && <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"><Archive className="h-3 w-3" /> archived</span>}
              <span className={`chip ${live ? 'border-emerald-500/30 text-pos' : 'border-line text-subtle'}`} title={live ? 'Live updates on' : 'Connecting to live updates'}>
                <Radio className={`h-3 w-3 ${live ? 'animate-pulse' : ''}`} /> {live ? 'live' : 'offline'}
              </span>
              <span className="text-xs text-muted">{formatMoney(group.totalSpendCents, group.currencyCode)} total</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:flex">
          <button className="btn-secondary" onClick={() => setModal({ kind: 'invite' })} aria-label="Invite people"><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Invite</span></button>
          <button className="btn-secondary" onClick={() => setModal({ kind: 'export' })} aria-label="Share and export"><Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span></button>
          <button className="btn-secondary" onClick={toggleArchive} title={group.archived ? 'Restore' : 'Archive'}>
            {group.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            <span className="hidden sm:inline">{group.archived ? 'Restore' : 'Archive'}</span>
          </button>
          <button className="btn-secondary" onClick={() => setModal({ kind: 'settings' })} aria-label="Group settings"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Settings</span></button>
          <button className="btn-secondary col-span-2 sm:col-span-1" onClick={() => setModal({ kind: 'settle', repayment: null })}><CheckCircle2 className="h-4 w-4 text-brand-fg" /> Settle up</button>
          <button className="btn-primary col-span-2 sm:col-span-1" onClick={() => setModal({ kind: 'expense', expense: null })}><Plus className="h-4 w-4" /> Add expense</button>
        </div>
      </header>

      <BudgetBar group={group} />

      <BalancesPanel
        group={group}
        balances={balancesQuery.data}
        simplify={simplify}
        onToggleSimplify={(value) => void run(() => api.updateGroup(groupId, { simplifyByDefault: value }), value ? 'Simplification on' : 'Simplification off')}
        onSettle={(repayment) => setModal({ kind: 'settle', repayment })}
      />

      <div className="space-y-3">
        <div className="segmented max-w-full overflow-x-auto" role="tablist">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="whitespace-nowrap">
              <Icon className="h-3.5 w-3.5" /> {label}{count !== undefined && ` (${count})`}
            </button>
          ))}
        </div>

        {tab === 'expenses' && (
          <ExpenseList
            expenses={expenses}
            currency={group.currencyCode}
            onAdd={() => setModal({ kind: 'expense', expense: null })}
            onEdit={(expense) => setModal({ kind: 'expense', expense })}
            onDelete={deleteExpense}
            onViewReceipt={(expense) => setModal({ kind: 'receipt', expense })}
          />
        )}
        {tab === 'payments' && <SettlementList group={group} settlements={settlements} onUndo={undoSettlement} />}
        {tab === 'stats' && <StatsPanel group={group} expenses={expenses} />}
        {tab === 'activity' && <ActivityFeed groupId={groupId} />}
      </div>

      <button
        className="btn-primary fixed bottom-5 right-5 z-30 h-14 w-14 rounded-full p-0 shadow-xl sm:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={() => setModal({ kind: 'expense', expense: null })}
        aria-label="Add expense"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Suspense fallback={null}>
        {modal?.kind === 'expense' && <ExpenseFormModal key={modal.expense?.id ?? 'new'} group={group} expense={modal.expense} onClose={() => setModal(null)} />}
        {modal?.kind === 'settle' && (
          <SettleUpModal key={modal.repayment ? `${modal.repayment.fromUserId}-${modal.repayment.toUserId}` : 'new'} group={group} repayment={modal.repayment} onClose={() => setModal(null)} />
        )}
        {modal?.kind === 'invite' && <InviteModal open group={group} onClose={() => setModal(null)} />}
        {modal?.kind === 'export' && <ExportModal group={group} onClose={() => setModal(null)} />}
        {modal?.kind === 'settings' && <GroupSettingsModal group={group} onClose={() => setModal(null)} />}
        {modal?.kind === 'receipt' && <ReceiptViewer expenseId={modal.expense.id} title={modal.expense.description} onClose={() => setModal(null)} />}
      </Suspense>
    </div>
  );
}
