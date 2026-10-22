import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

/** Android hardware back: close an open dialog, else go back, else leave the app from the home screen. */
export function useNativeBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      } else if (location.pathname !== '/') {
        navigate(-1);
      } else {
        void CapacitorApp.exitApp();
      }
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [location.pathname, navigate]);
}
