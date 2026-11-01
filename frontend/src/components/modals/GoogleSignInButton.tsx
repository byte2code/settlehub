import { useEffect, useRef } from 'react';

interface GoogleId {
  accounts: { id: { initialize: (c: unknown) => void; renderButton: (el: HTMLElement, o: unknown) => void } };
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** "Continue with Google". Renders nothing unless VITE_GOOGLE_CLIENT_ID is configured at build time. */
export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  useEffect(() => {
    cb.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID || !holder.current) return;
    const render = () => {
      const google = (window as unknown as { google?: GoogleId }).google;
      if (!google || !holder.current) return;
      google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r: { credential: string }) => cb.current(r.credential) });
      google.accounts.id.renderButton(holder.current, { theme: 'outline', size: 'large', width: 300, text: 'continue_with' });
    };
    if ((window as unknown as { google?: GoogleId }).google) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, []);

  if (!CLIENT_ID) return null;
  return (
    <div className="space-y-3">
      <div ref={holder} className="flex justify-center" />
      <div className="flex items-center gap-3 text-[11px] text-subtle"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
    </div>
  );
}
