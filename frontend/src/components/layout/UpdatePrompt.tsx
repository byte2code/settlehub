import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/** Shows a "new version available" bar instead of silently serving a stale app. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[55] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-surface px-4 py-3 text-sm shadow-xl">
        <RefreshCw className="h-4 w-4 text-brand-fg" />
        <span className="text-fg">A new version of SettleHub is ready.</span>
        <button className="btn-primary" onClick={() => updateServiceWorker(true)}>
          Update
        </button>
        <button className="btn-ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    </div>
  );
}
