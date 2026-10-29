import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { X, HandCoins, Receipt, Trash2, FileEdit, Bell, ChevronRight } from 'lucide-react';
import { IN_APP_NOTIFICATION_EVENT } from '../../hooks/useGlobalNotifications';
import type { AppNotification } from '../../types';

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

export function InAppNotificationBanner() {
  const [current, setCurrent] = useState<AppNotification | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleNotification(e: Event) {
      const customEvent = e as CustomEvent<AppNotification>;
      if (customEvent.detail) {
        setCurrent(customEvent.detail);
      }
    }

    window.addEventListener(IN_APP_NOTIFICATION_EVENT, handleNotification);
    return () => {
      window.removeEventListener(IN_APP_NOTIFICATION_EVENT, handleNotification);
    };
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      setCurrent(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  const handleClick = () => {
    const groupId = current.groupId;
    setCurrent(null);
    if (groupId) {
      navigate(`/groups/${groupId}`);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-3 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        role="alert"
        onClick={handleClick}
        className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-brand/30 bg-surface/95 p-3.5 shadow-2xl backdrop-blur-xl cursor-pointer hover:border-brand/60 transition-all hover:scale-[1.01]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-3 shadow-inner">
          {getNotificationIcon(current.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-bold text-fg tracking-tight">{current.title}</span>
            <span className="flex items-center text-[10px] text-brand-fg font-medium shrink-0">
              View <ChevronRight className="h-3 w-3" />
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted line-clamp-2 leading-relaxed">{current.message}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrent(null);
          }}
          className="shrink-0 p-1 text-subtle hover:text-fg rounded-lg transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

