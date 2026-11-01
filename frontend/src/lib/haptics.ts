import { Capacitor } from '@capacitor/core';
import { getPrefs } from './prefs';

/** A light buzz on key moments. Silently does nothing where unsupported (iOS Safari, desktop). */
export async function haptic(kind: 'tap' | 'success' = 'tap'): Promise<void> {
  if (!getPrefs().haptics) return;
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      navigator.vibrate?.(kind === 'success' ? [20, 40, 20] : 15);
    }
  } catch {
    // a missing buzz is never an error
  }
}
