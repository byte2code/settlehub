import { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { getApiBaseUrl } from './api';

export interface GroupSocketEvent {
  type: 'EXPENSE_CREATED' | 'EXPENSE_DELETED' | 'SETTLEMENT_RECORDED' | 'MEMBER_JOINED';
  groupId: string;
  timestamp: string;
  data: any;
}

export function useGroupWebSocket(
  groupId: string | undefined,
  onEvent?: (event: GroupSocketEvent) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    if (!groupId) return;

    // Convert HTTP(S) API base URL to WS(S) URL
    const apiBase = getApiBaseUrl();
    let wsUrl: string;

    if (apiBase.startsWith('http://')) {
      wsUrl = apiBase.replace('http://', 'ws://').replace(/\/api\/v1\/?$/, '') + '/ws';
    } else if (apiBase.startsWith('https://')) {
      wsUrl = apiBase.replace('https://', 'wss://').replace(/\/api\/v1\/?$/, '') + '/ws';
    } else {
      // Relative URL (e.g. /api/v1)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }

    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setIsConnected(true);
        // Subscribe to group topic
        client.subscribe(`/topic/groups/${groupId}`, (message) => {
          try {
            const parsed: GroupSocketEvent = JSON.parse(message.body);
            if (onEvent) {
              onEvent(parsed);
            }
          } catch {
            // Ignore parse errors
          }
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: () => {
        setIsConnected(false);
      },
      onWebSocketClose: () => {
        setIsConnected(false);
      },
    });

    try {
      client.activate();
      clientRef.current = client;
    } catch {
      // Non-blocking fallback
    }

    return () => {
      if (clientRef.current) {
        try {
          clientRef.current.deactivate();
        } catch {
          // Ignore
        }
      }
      setIsConnected(false);
    };
  }, [groupId]);

  return { isConnected };
}
