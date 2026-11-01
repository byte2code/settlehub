import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { getBackendOrigin, getToken } from '../lib/api';

export interface PulseEvent {
  kind: 'EXPENSE' | 'SETTLEMENT' | 'JOIN' | string;
  at: string;
}

/** Anonymous platform activity (kind + time only). The server only lets admins subscribe. */
export function useAdminPulse(max = 20) {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const client = new Client({
      brokerURL: getBackendOrigin().replace(/^http/, 'ws') + '/ws',
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setLive(true);
        client.subscribe('/topic/admin/pulse', (m) => {
          try {
            setEvents((prev) => [JSON.parse(m.body) as PulseEvent, ...prev].slice(0, max));
          } catch {
            // ignore malformed frames
          }
        });
      },
      onWebSocketClose: () => setLive(false),
    });
    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [max]);

  return { events, live };
}
