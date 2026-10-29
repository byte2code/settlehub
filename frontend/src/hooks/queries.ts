import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { NotificationSummary } from '../types';

export const keys = {
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  expenses: (id: string) => ['group', id, 'expenses'] as const,
  balances: (id: string) => ['group', id, 'balances'] as const,
  settlements: (id: string) => ['group', id, 'settlements'] as const,
  activity: (id: string) => ['group', id, 'activity'] as const,
  receipt: (expenseId: string) => ['receipt', expenseId] as const,
  notifications: ['notifications'] as const,
};

export const useGroups = () => useQuery({ queryKey: keys.groups, queryFn: api.groups });

export const useGroup = (id: string) => useQuery({ queryKey: keys.group(id), queryFn: () => api.group(id) });

export const useExpenses = (id: string) => useQuery({ queryKey: keys.expenses(id), queryFn: () => api.expenses(id) });

export const useBalances = (id: string) => useQuery({ queryKey: keys.balances(id), queryFn: () => api.balances(id) });

export const useSettlements = (id: string) =>
  useQuery({ queryKey: keys.settlements(id), queryFn: () => api.settlements(id) });

export const useActivity = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.activity(id), queryFn: () => api.activity(id), enabled });

export const useNotificationsQuery = (enabled = true) =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => api.notifications(),
    enabled,
    refetchInterval: 60000,
  });

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: keys.notifications });
      const previous = queryClient.getQueryData<NotificationSummary>(keys.notifications);
      queryClient.setQueryData<NotificationSummary>(keys.notifications, (old) => {
        if (!old) return old;
        let newlyRead = 0;
        const updated = old.notifications.map((n) => {
          if (n.id === id && !n.read) {
            newlyRead = 1;
            return { ...n, read: true };
          }
          return n;
        });
        return {
          notifications: updated,
          unreadCount: Math.max(0, old.unreadCount - newlyRead),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(keys.notifications, context.previous);
      }
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: keys.notifications });
      const previous = queryClient.getQueryData<NotificationSummary>(keys.notifications);
      queryClient.setQueryData<NotificationSummary>(keys.notifications, (old) => {
        if (!old) return old;
        return {
          notifications: old.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(keys.notifications, context.previous);
      }
    },
  });
}

export const useReceipt = (expenseId: string | null) =>
  useQuery({
    queryKey: keys.receipt(expenseId ?? ''),
    queryFn: () => api.receipt(expenseId!),
    enabled: Boolean(expenseId),
    staleTime: Infinity,
  });

/** Refetch everything about one group (and the dashboard list) after a change. */
export function useInvalidateGroup() {
  const queryClient = useQueryClient();
  return (groupId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['group', groupId] }),
      queryClient.invalidateQueries({ queryKey: keys.groups }),
    ]);
}
