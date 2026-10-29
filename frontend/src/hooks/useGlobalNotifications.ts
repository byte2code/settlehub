import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Client } from '@stomp/stompjs';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getBackendOrigin, getToken } from '../lib/api';
import { keys } from './queries';
import type { AppNotification, NotificationSummary, User } from '../types';

export const IN_APP_NOTIFICATION_EVENT = 'settlehub:in-app-notification';

export function useGlobalNotifications(user: User | null) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const clientRef = useRef<Client | null>(null);

  // 1. Android Local Notifications setup and tap listeners
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Create notification channel with sound & vibration on Android
    LocalNotifications.createChannel({
      id: 'settlehub_alerts',
      name: 'SettleHub Activity & Expense Alerts',
      description: 'Notifications for new expenses and debt settlements',
      importance: 5, // High importance = heads-up banner
      visibility: 1,
      vibration: true,
      sound: 'beep.wav',
    }).catch(() => {});

    // Request permissions on first launch
    LocalNotifications.checkPermissions().then((perm) => {
      if (perm.display !== 'granted') {
        LocalNotifications.requestPermissions().catch(() => {});
      }
    });

    // Listen to notification taps (deep-link to the group)
    const subPromise = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = action.notification.extra as { groupId?: string } | undefined;
      if (extra?.groupId) {
        navigate(`/groups/${extra.groupId}`);
      }
    });

    return () => {
      subPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [navigate]);

  // 2. Global STOMP WebSocket connection to /topic/users/{userId}/notifications
  useEffect(() => {
    const token = getToken();
    if (!user?.id || !token) {
      if (clientRef.current) {
        void clientRef.current.deactivate();
        clientRef.current = null;
      }
      return;
    }

    const client = new Client({
      brokerURL: getBackendOrigin().replace(/^http/, 'ws') + '/ws',
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      onConnect: () => {
        client.subscribe(`/topic/users/${user.id}/notifications`, (message) => {
          try {
            const data = JSON.parse(message.body);

            // If it's a READ_ALL sync event from another tab
            if (data.type === 'NOTIFICATIONS_READ_ALL') {
              queryClient.setQueryData<NotificationSummary>(keys.notifications, (old) => {
                if (!old) return old;
                return {
                  notifications: old.notifications.map((n) => ({ ...n, read: true })),
                  unreadCount: 0,
                };
              });
              return;
            }

            const notif = data as AppNotification;

            // Update React Query cache immediately
            queryClient.setQueryData<NotificationSummary>(keys.notifications, (old) => {
              const currentList = old?.notifications ?? [];
              const exists = currentList.some((n) => n.id === notif.id);
              if (exists) return old;
              return {
                notifications: [notif, ...currentList].slice(0, 50),
                unreadCount: (old?.unreadCount ?? 0) + 1,
              };
            });

            // Also invalidate the affected group's queries so balances & expense lists auto-update
            if (notif.groupId) {
              void queryClient.invalidateQueries({ queryKey: ['group', notif.groupId] });
              void queryClient.invalidateQueries({ queryKey: keys.groups });
            }

            // In-app floating toast banner
            window.dispatchEvent(new CustomEvent(IN_APP_NOTIFICATION_EVENT, { detail: notif }));

            // Dispatch Android Native heads-up status-bar notification
            if (Capacitor.isNativePlatform()) {
              LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(Math.random() * 1000000),
                    channelId: 'settlehub_alerts',
                    title: notif.title,
                    body: notif.message,
                    extra: { groupId: notif.groupId },
                    schedule: { at: new Date(Date.now() + 100) },
                  },
                ],
              }).catch(() => {});
            } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              // Web Browser system notification
              try {
                new Notification(notif.title, {
                  body: notif.message,
                  icon: '/icon-192.png',
                });
              } catch {
                // Ignore mobile browser restrictions
              }
            }
          } catch {
            // Ignore malformed frames
          }
        });
      },
      onWebSocketClose: () => {},
      onStompError: () => {},
    });

    client.activate();
    clientRef.current = client;

    return () => {
      void client.deactivate();
      clientRef.current = null;
    };
  }, [user?.id, queryClient]);
}

