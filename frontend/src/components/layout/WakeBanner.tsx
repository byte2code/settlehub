import { Coffee } from 'lucide-react';
import { useBackendWake } from '../../hooks/useBackendWake';

export function WakeBanner() {
  const { waking, seconds } = useBackendWake();
  if (!waking) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-200">
      <Coffee className="h-4 w-4 shrink-0" />
      <span>
        The free server is waking up (usually 30-60 s). Hang tight… {seconds > 0 && <span className="font-mono">{seconds}s</span>}
      </span>
    </div>
  );
}
