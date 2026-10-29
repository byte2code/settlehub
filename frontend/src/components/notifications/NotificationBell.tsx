import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  HandCoins,
  Receipt,
  Trash2,
  FileEdit,
} from 'lucide-react';
import { useNotificationsQuery, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/queries';
import type { AppNotification } from '../../types';

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 30) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'EXPENSE_CREATED':
      return <Receipt className="h-4 w-4 text-emerald-400" />;
    case 'EXPENSE_UPDATED':
      return <FileEdit className="h-4 w-4 text-sky-400" />;
    case 'EXPENSE_DELETED':
      return <Trash2 className="h-4 w-4 text-rose-400" />;
    case 'SETTLEMENT_RECORDED':
      return <HandCoins className="h-4 w-4 text-teal-400" />;
    case 'SETTLEMENT_DELETED':
      return <Trash2 className="h-4 w-4 text-amber-400" />;
    default:
      return <Bell className="h-4 w-4 text-brand-fg" />;
  }
}

export function NotificationBell({ signedIn }: { signedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data } = useNotificationsQuery(signedIn);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (notif: AppNotification) => {
    if (!notif.read) {
      markRead.mutate(notif.id);
    }
    setIsOpen(false);
    if (notif.groupId) {
      navigate(`/groups/${notif.groupId}`);
    }
  };

  const handleMarkAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unreadCount > 0) {
      markAllRead.mutate();
    }
  };

  if (!signedIn) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative btn-ghost p-2"
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-app animate-in fade-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface p-0 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Notifications</span>
              {unreadCount > 0 && (
                <span className="chip border-emerald-500/25 bg-emerald-500/10 text-brand-fg">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-brand-fg transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[22rem] divide-y divide-line/60 overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-subtle mb-2">
                  <Check className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-fg">All caught up!</p>
                <p className="text-xs text-muted mt-1 max-w-xs">
                  When group members add expenses or settlements, alerts will appear right here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.read;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleSelect(notif)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-surface-3/50 ${
                      isUnread ? 'bg-surface-2/70' : ''
                    }`}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-surface-3">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`truncate text-xs font-semibold ${isUnread ? 'text-fg' : 'text-muted'}`}>
                          {notif.title}
                        </span>
                        <span className="flex items-center gap-1 shrink-0 text-[10px] text-subtle">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand ring-4 ring-brand/20" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

