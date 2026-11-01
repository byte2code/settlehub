import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, BellRing, Check, CheckCheck, Clock, FileEdit, HandCoins, Receipt, Trash2, Zap } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { useCopy } from '../../lib/copy';
import { disableWebPush, enableWebPush, webPushState } from '../../lib/push';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsQuery } from '../../hooks/queries';
import type { AppNotification } from '../../types';
import { BUCKETS, FILTERS, bucketOf, formatTimeAgo, matchesFilter, type Bucket, type Filter } from '../../lib/inbox';

function iconFor(type: string) {
  switch (type) {
    case 'EXPENSE_CREATED': return <Receipt className="h-4 w-4 text-emerald-500" />;
    case 'EXPENSE_UPDATED': return <FileEdit className="h-4 w-4 text-sky-500" />;
    case 'EXPENSE_DELETED': return <Trash2 className="h-4 w-4 text-rose-500" />;
    case 'SETTLEMENT_RECORDED': return <HandCoins className="h-4 w-4 text-teal-500" />;
    case 'SETTLEMENT_DELETED': return <Trash2 className="h-4 w-4 text-amber-500" />;
    default: return <Bell className="h-4 w-4 text-brand-fg" />;
  }
}

export function ActivityInboxDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const t = useCopy();
  const [filter, setFilter] = useState<Filter>('all');
  const { data } = useNotificationsQuery(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const [push, setPush] = useState<Awaited<ReturnType<typeof webPushState>>>('unsupported');
  useEffect(() => {
    if (open) void webPushState().then(setPush).catch(() => setPush('unsupported'));
  }, [open]);
  const togglePush = async () => {
    try {
      if (push === 'on') await disableWebPush();
      else await enableWebPush();
    } finally {
      setPush(await webPushState());
    }
  };

  const unreadCount = data?.unreadCount ?? 0;
  const grouped = useMemo(() => {
    const out = new Map<Bucket, AppNotification[]>();
    for (const n of (data?.notifications ?? []).filter((x) => matchesFilter(x, filter))) {
      const b = bucketOf(n.createdAt);
      out.set(b, [...(out.get(b) ?? []), n]);
    }
    return out;
  }, [data, filter]);

  const go = (n: AppNotification, tab?: string) => {
    if (!n.read) markRead.mutate(n.id);
    onClose();
    if (n.groupId) navigate(`/groups/${n.groupId}${tab ? `?tab=${tab}` : ''}`);
  };

  return (
    <Drawer open={open} onClose={onClose} title="Activity inbox" subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter notifications">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`chip cursor-pointer ${filter === f.id ? 'border-emerald-500/40 bg-emerald-500/10 text-brand-fg' : 'border-line text-muted'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={() => markAll.mutate()} disabled={markAll.isPending} className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted hover:text-brand-fg">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      {(push === 'on' || push === 'off') && (
        <button type="button" onClick={() => void togglePush()} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-left text-xs text-muted hover:text-fg">
          <BellRing className="h-4 w-4 text-brand-fg" />
          {push === 'on' ? 'Background alerts are on for this device · turn off' : 'Get alerts even when SettleHub is closed'}
        </button>
      )}

      {grouped.size === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-subtle"><Check className="h-5 w-5" /></div>
          <p className="text-sm font-medium text-fg">{t('inbox.none')}</p>
          <p className="mt-1 max-w-xs text-xs text-muted">Alerts about expenses and settlements in your groups appear here.</p>
        </div>
      ) : (
        BUCKETS.filter((b) => grouped.has(b)).map((b) => (
          <section key={b} className="mb-4">
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-subtle">{b}</h3>
            <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line">
              {grouped.get(b)!.map((n) => (
                <li key={n.id} className={n.read ? '' : 'bg-surface-2/70'}>
                  <button type="button" onClick={() => go(n)} className="flex w-full items-start gap-3 p-3.5 text-left hover:bg-surface-3/50">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-surface-3">{iconFor(n.type)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-1">
                        <span className={`truncate text-xs font-semibold ${n.read ? 'text-muted' : 'text-fg'}`}>{n.title}</span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-subtle"><Clock className="h-2.5 w-2.5" />{formatTimeAgo(n.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.message}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand ring-4 ring-brand/20" />}
                  </button>
                  {n.groupId && (
                    <div className="flex gap-2 px-3.5 pb-3 pl-14">
                      <button type="button" onClick={() => go(n)} className="text-[11px] font-semibold text-brand-fg hover:underline">View group</button>
                      {n.type === 'EXPENSE_CREATED' && (
                        <button type="button" onClick={() => go(n, 'payments')} className="flex items-center gap-1 text-[11px] font-semibold text-brand-fg hover:underline">
                          <Zap className="h-3 w-3" /> Pay now
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Drawer>
  );
}
