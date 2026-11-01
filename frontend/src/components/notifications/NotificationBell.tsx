import { lazy, Suspense, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationsQuery } from '../../hooks/queries';

const ActivityInboxDrawer = lazy(() => import('./ActivityInboxDrawer').then((m) => ({ default: m.ActivityInboxDrawer })));

export function NotificationBell({ signedIn }: { signedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data } = useNotificationsQuery(signedIn);
  const unreadCount = data?.unreadCount ?? 0;

  if (!signedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative btn-ghost p-2"
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-app">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <Suspense fallback={null}>
          <ActivityInboxDrawer open onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
