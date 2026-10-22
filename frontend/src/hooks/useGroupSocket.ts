import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { getBackendOrigin, getToken } from '../lib/api';

export interface GroupSocketEvent {
  type: string;
  groupId: string;
  actorId: string | null;
  entityId: string | null;
  timestamp: string;
}

/**
 * Live updates for one group over the backend's STOMP broker. The JWT is sent on CONNECT
 * (the server rejects anonymous connections and foreign group subscriptions).
 */
export function useGroupSocket(groupId: string | undefined, onEvent: (event: GroupSocketEvent) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);

  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = getToken();
    if (!groupId || !token) return;

    const client = new Client({
      brokerURL: getBackendOrigin().replace(/^http/, 'ws') + '/ws',
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/groups/${groupId}`, (message) => {
          try {
            handler.current(JSON.parse(message.body) as GroupSocketEvent);
          } catch {
            // ignore malformed frames
          }
        });
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: () => setConnected(false),
    });
    client.activate();

    return () => {
      setConnected(false);
      void client.deactivate();
    };
  }, [groupId]);

  return connected;
}
