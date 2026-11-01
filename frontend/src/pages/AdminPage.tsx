import { lazy, Suspense, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Database, Gauge, Mail, Search, Server, ShieldCheck, Users } from 'lucide-react';
import { api, getApiBaseUrl } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatBytes, formatMoney } from '../lib/money';
import { useAdminPulse } from '../hooks/useAdminPulse';
import { useCurrentUser } from '../hooks/useAuth';
import { ErrorNote, PageSpinner } from '../components/ui/bits';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

const ServerConfigModal = lazy(() => import('../components/modals/ServerConfigModal'));

const PULSE_LABEL: Record<string, string> = { EXPENSE: '💸 An expense was added', SETTLEMENT: '🤝 A payment was recorded', JOIN: '👋 Someone joined a group' };

function Meter({ value, max, warnAt = 0.8 }: { value: number; max: number; warnAt?: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${pct >= warnAt ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase text-subtle">{label}</p>
      <p className="font-mono text-2xl font-black text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function usePing() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    let stop = false;
    const run = async () => {
      const t = performance.now();
      try {
        await fetch(`${getApiBaseUrl()}/health`, { cache: 'no-store' });
        if (!stop) setMs(Math.round(performance.now() - t));
      } catch {
        if (!stop) setMs(null);
      }
    };
    void run();
    const id = setInterval(run, 30_000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  return ms;
}

function Explorer() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [kind, setKind] = useState<'users' | 'groups'>('users');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  const users = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => api.adminUsers(q), enabled: kind === 'users' });
  const groups = useQuery({ queryKey: ['admin', 'groups', q], queryFn: () => api.adminGroups(q), enabled: kind === 'groups' });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.adminSetActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const flip = async (id: string, name: string, active: boolean) => {
    const ok = await confirm({
      title: active ? `Activate ${name}?` : `Deactivate ${name}?`,
      message: active ? 'They will be able to sign in again.' : 'They will be signed out and unable to sign in until reactivated.',
      confirmLabel: active ? 'Activate' : 'Deactivate',
      danger: !active,
    });
    if (ok) toggle.mutate({ id, active });
  };

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={kind === 'users'} onClick={() => setKind('users')}>Users</button>
          <button role="tab" aria-selected={kind === 'groups'} onClick={() => setKind('groups')}>Groups</button>
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-subtle" />
          <input className="input pl-8" placeholder={kind === 'users' ? 'Search name or email' : 'Search group name'} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Search" />
        </label>
      </div>
      {kind === 'users' ? (
        <ul className="divide-y divide-line">
          {users.data?.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{u.name} {u.admin && <span className="chip border-emerald-500/30 text-brand-fg">admin</span>} {!u.active && <span className="chip border-rose-500/30 text-neg">inactive</span>}</p>
                <p className="truncate text-xs text-muted">{u.email} · {u.groupCount} group{u.groupCount === 1 ? '' : 's'} · joined {new Date(u.createdAt).toLocaleDateString()}</p>
              </div>
              {!u.admin && u.id !== me.id && (
                <button className="btn-secondary text-xs" disabled={toggle.isPending} onClick={() => void flip(u.id, u.name, !u.active)}>{u.active ? 'Deactivate' : 'Activate'}</button>
              )}
            </li>
          ))}
          {users.data?.length === 0 && <li className="py-6 text-center text-sm text-muted">No users found</li>}
        </ul>
      ) : (
        <ul className="divide-y divide-line">
          {groups.data?.map((g) => (
            <li key={g.id} className="py-2.5">
              <p className="text-sm font-semibold text-fg">{g.name} {g.archived && <span className="chip border-line text-subtle">archived</span>}</p>
              <p className="text-xs text-muted">{g.currencyCode} · {g.memberCount} member{g.memberCount === 1 ? '' : 's'} · created {new Date(g.createdAt).toLocaleDateString()}</p>
            </li>
          ))}
          {groups.data?.length === 0 && <li className="py-6 text-center text-sm text-muted">No groups found</li>}
        </ul>
      )}
      <ErrorNote message={users.error ? errorMessage(users.error) : groups.error ? errorMessage(groups.error) : null} />
    </section>
  );
}

export function AdminPage() {
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: api.adminOverview, refetchInterval: 60_000 });
  const health = useQuery({ queryKey: ['admin', 'health'], queryFn: api.adminHealth, refetchInterval: 60_000 });
  const { events, live } = useAdminPulse();
  const ping = usePing();
  const [showServer, setShowServer] = useState(false);

  if (overview.isLoading) return <PageSpinner />;
  const o = overview.data;
  const h = health.data;
  const sumCurrencies = (m?: Record<string, number>) => Object.entries(m ?? {}).map(([c, v]) => formatMoney(v, c)).join(' · ') || '—';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-fg"><ShieldCheck className="h-6 w-6 text-brand-fg" /> Admin portal</h1>
        <button type="button" className="btn-secondary text-xs" onClick={() => setShowServer(true)}><Server className="h-3.5 w-3.5" /> Server connection</button>
      </div>
      <Suspense fallback={null}>{showServer && <ServerConfigModal open onClose={() => setShowServer(false)} />}</Suspense>
      <ErrorNote message={overview.error ? errorMessage(overview.error) : null} />

      {o && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Users" value={o.totalUsers} />
          <Kpi label="Active groups" value={o.activeGroups} hint={`${o.totalGroups} total`} />
          <Kpi label="Expenses" value={o.expenseCount} hint={sumCurrencies(o.expenseVolumeByCurrency)} />
          <Kpi label="Settlements" value={o.settlementCount} hint={Object.entries(o.settlementRatioByCurrency).map(([c, r]) => `${c} ${Math.round(r * 100)}% settled`).join(' · ') || undefined} />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-fg"><Gauge className="h-4 w-4" /> Free-tier health</h2>
          {h ? (
            <>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted"><Mail className="h-3.5 w-3.5" /> Brevo emails today · {h.emailsSentToday}/{h.emailDailyLimit}</p>
                <Meter value={h.emailsSentToday} max={h.emailDailyLimit} />
              </div>
              <p className="text-xs text-muted">API ping: <span className="font-mono font-bold text-fg">{ping === null ? '—' : `${ping} ms`}</span> · DB ({h.database}) <span className="font-mono font-bold text-fg">{h.dbLatencyMs} ms</span> · up {Math.floor(h.uptimeSeconds / 3600)}h</p>
              {h.tables.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-muted"><Database className="h-3.5 w-3.5" /> Largest tables (Neon free tier: 0.5 GB)</p>
                  <ul className="space-y-1.5">
                    {h.tables.slice(0, 6).map((t) => (
                      <li key={t.table} className="text-xs">
                        <div className="flex justify-between text-muted"><span className="font-mono">{t.table}</span><span>{formatBytes(t.sizeBytes)} · {t.rows} rows</span></div>
                        <Meter value={t.sizeBytes} max={h.tables[0].sizeBytes} warnAt={2} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : <PageSpinner />}
        </section>

        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
            <Activity className="h-4 w-4" /> Live pulse
            <span className={`chip ${live ? 'border-emerald-500/30 text-pos' : 'border-line text-subtle'}`}>{live ? 'live' : 'connecting…'}</span>
          </h2>
          <ul className="space-y-1.5" aria-live="polite">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex justify-between text-xs text-muted">
                <span>{PULSE_LABEL[e.kind] ?? e.kind}</span>
                <span className="text-subtle">{new Date(e.at).toLocaleTimeString()}</span>
              </li>
            ))}
            {events.length === 0 && <li className="py-6 text-center text-sm text-muted">Waiting for activity…</li>}
          </ul>
        </section>
      </div>

      <h2 className="flex items-center gap-2 text-sm font-bold text-fg"><Users className="h-4 w-4" /> Explorer</h2>
      <Explorer />
    </div>
  );
}
