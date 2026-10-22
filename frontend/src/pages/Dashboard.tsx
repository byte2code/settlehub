import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Archive, ArrowRight, KeyRound, Plus, RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { budgetStatus } from '../lib/groups';
import { errorMessage } from '../lib/errors';
import { formatMoney, sumByCurrency } from '../lib/money';
import { useGroups } from '../hooks/queries';
import { useCurrentUser } from '../hooks/useAuth';
import type { Group } from '../types';
import { Avatar, Balance, EmptyState, ErrorNote, PageSpinner } from '../components/ui/bits';
import { GroupTypeIcon } from '../components/ui/GroupTypeIcon';

const CreateGroupModal = lazy(() => import('../components/modals/CreateGroupModal'));
const JoinGroupModal = lazy(() => import('../components/modals/JoinGroupModal'));

function Totals({ totals, tone }: { totals: Record<string, number>; tone: 'pos' | 'neg' }) {
  const entries = Object.entries(totals).filter(([, c]) => c !== 0);
  if (entries.length === 0) return <div className="font-mono text-lg font-black text-subtle">—</div>;
  return (
    <div className="space-y-0.5">
      {entries.map(([code, cents]) => (
        <div key={code} className={`truncate font-mono text-lg font-black sm:text-xl ${tone === 'pos' ? 'text-pos' : 'text-neg'}`}>
          {formatMoney(Math.abs(cents), code)}
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const user = useCurrentUser();
  const { data: groups = [], isLoading, error, refetch, isFetching } = useGroups();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [modal, setModal] = useState<'create' | 'join' | null>(null);

  // Balances in different currencies are never added together
  const { owed, owe } = useMemo(() => {
    const active = groups.filter((g) => !g.archived);
    return {
      owed: sumByCurrency(active.filter((g) => g.userNetBalanceCents > 0).map((g) => ({ currencyCode: g.currencyCode, cents: g.userNetBalanceCents }))),
      owe: sumByCurrency(active.filter((g) => g.userNetBalanceCents < 0).map((g) => ({ currencyCode: g.currencyCode, cents: g.userNetBalanceCents }))),
    };
  }, [groups]);

  const visible = groups.filter((g) => (tab === 'active' ? !g.archived : g.archived));
  const archivedCount = groups.filter((g) => g.archived).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 animate-fade-in">
      <section className="card relative flex flex-col justify-between gap-6 overflow-hidden p-5 sm:p-6 md:flex-row md:items-center">
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Hi, {user.firstName} 👋</h1>
          <p className="text-sm text-muted">
            {Object.keys(owed).length || Object.keys(owe).length ? 'Here’s where you stand across your active groups.' : 'You’re all settled up.'}
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-3 md:min-w-80">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-pos"><TrendingUp className="h-4 w-4" /> You are owed</div>
            <Totals totals={owed} tone="pos" />
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neg"><TrendingDown className="h-4 w-4" /> You owe</div>
            <Totals totals={owe} tone="neg" />
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
              <Users className="h-3.5 w-3.5" /> Active ({groups.length - archivedCount})
            </button>
            <button role="tab" aria-selected={tab === 'archived'} onClick={() => setTab('archived')}>
              <Archive className="h-3.5 w-3.5" /> Archived ({archivedCount})
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2" onClick={() => refetch()} aria-label="Refresh" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button className="btn-secondary" onClick={() => setModal('join')}><KeyRound className="h-3.5 w-3.5" /> Join</button>
            <button className="btn-primary" onClick={() => setModal('create')}><Plus className="h-4 w-4" /> New group</button>
          </div>
        </div>

        <ErrorNote message={error ? errorMessage(error) : null} />

        {isLoading ? (
          <PageSpinner />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={tab === 'active' ? <Users className="h-6 w-6" /> : <Archive className="h-6 w-6" />}
            title={tab === 'active' ? 'No groups yet' : 'Nothing archived'}
            action={tab === 'active' ? <button className="btn-primary" onClick={() => setModal('create')}>Create your first group</button> : undefined}
          >
            {tab === 'active' ? 'Create a group for a trip, your flat or a night out — or join one with a code.' : 'Finished trips you archive end up here.'}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((g) => <GroupCard key={g.id} group={g} />)}
          </div>
        )}
      </section>

      <Suspense fallback={null}>
        {modal === 'create' && <CreateGroupModal open onClose={() => setModal(null)} />}
        {modal === 'join' && <JoinGroupModal open onClose={() => setModal(null)} />}
      </Suspense>
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  const budget = budgetStatus(group);
  return (
    <Link to={`/groups/${group.id}`} className="card group flex flex-col justify-between p-5 transition-all hover:border-emerald-500/40">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-brand-fg"><GroupTypeIcon type={group.groupType} className="h-4 w-4" /></span>
          <span className="flex items-center gap-1.5">
            <span className="chip border-emerald-500/20 bg-emerald-500/10 font-mono text-brand-fg">{group.currencyCode}</span>
            {group.myRole === 'ADMIN' && <span className="chip border-line text-subtle">admin</span>}
          </span>
        </div>
        <h3 className="truncate text-lg font-bold text-fg group-hover:text-brand-fg">{group.name}</h3>
        <div className="mt-2 flex -space-x-1.5">
          {group.members.slice(0, 6).map((m) => (
            <span key={m.userId} className="rounded-full ring-2 ring-[var(--surface)]" title={m.name}><Avatar name={m.name} size="sm" /></span>
          ))}
          {group.members.length > 6 && <span className="pl-3 text-xs text-subtle">+{group.members.length - 6}</span>}
        </div>
        <p className="mt-2 text-xs text-muted">{formatMoney(group.totalSpendCents, group.currencyCode)} spent</p>
        {budget && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={`h-full rounded-full ${budget.over ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(budget.pct, 100)}%` }} />
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
        <div>
          <span className="block text-[10px] font-semibold uppercase text-subtle">Your balance</span>
          <Balance cents={group.userNetBalanceCents} currency={group.currencyCode} className="text-sm" />
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 text-subtle transition-all group-hover:bg-emerald-500 group-hover:text-white">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
