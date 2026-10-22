import { useState } from 'react';
import { Server } from 'lucide-react';
import { getApiBaseUrl, setApiBaseUrl } from '../../lib/api';
import { Modal } from '../ui/Modal';

/** Lets the Android app / self-hosters point the client at any backend without rebuilding. */
export default function ServerConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(getApiBaseUrl);
  const [status, setStatus] = useState<string | null>(null);

  const test = async () => {
    setStatus('Checking…');
    try {
      const origin = url.replace(/\/api\/v1\/?$/, '');
      const res = await fetch(`${origin.startsWith('http') ? origin : window.location.origin + origin}/api/v1/health`);
      const body = await res.json();
      setStatus(res.ok ? `Connected · server ${body.version ?? ''}` : `Server responded with HTTP ${res.status}`);
    } catch {
      setStatus('Could not reach that server (it may be waking up — try again in 30 s)');
    }
  };

  const save = (value: string | null) => {
    setApiBaseUrl(value);
    window.location.reload();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Server className="h-5 w-5" />}
      title="Server"
      subtitle="Which SettleHub backend this app talks to"
      footer={
        <>
          <button className="btn-ghost" onClick={() => save(null)}>Reset to default</button>
          <button className="btn-primary" onClick={() => save(url)}>Save & reload</button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="label" htmlFor="api-url">API base URL</label>
        <input id="api-url" className="input font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-backend.onrender.com/api/v1" />
        <button type="button" className="btn-secondary" onClick={test}>Test connection</button>
        {status && <p className="text-xs text-muted">{status}</p>}
      </div>
    </Modal>
  );
}
