import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const keys = {
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  expenses: (id: string) => ['group', id, 'expenses'] as const,
  balances: (id: string) => ['group', id, 'balances'] as const,
  settlements: (id: string) => ['group', id, 'settlements'] as const,
  activity: (id: string) => ['group', id, 'activity'] as const,
  receipt: (expenseId: string) => ['receipt', expenseId] as const,
};

export const useGroups = () => useQuery({ queryKey: keys.groups, queryFn: api.groups });

export const useGroup = (id: string) => useQuery({ queryKey: keys.group(id), queryFn: () => api.group(id) });

export const useExpenses = (id: string) => useQuery({ queryKey: keys.expenses(id), queryFn: () => api.expenses(id) });

export const useBalances = (id: string) => useQuery({ queryKey: keys.balances(id), queryFn: () => api.balances(id) });

export const useSettlements = (id: string) =>
  useQuery({ queryKey: keys.settlements(id), queryFn: () => api.settlements(id) });

export const useActivity = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.activity(id), queryFn: () => api.activity(id), enabled });

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
