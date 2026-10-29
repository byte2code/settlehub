import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type {
  Activity,
  AuthResponse,
  Expense,
  ExpenseInput,
  Group,
  GroupBalanceSummary,
  GroupMember,
  GroupRole,
  GroupType,
  InvitePreview,
  Settlement,
  User,
} from '../types';
import { storage } from './storage';

const TOKEN_KEY = 'settlehub_token';
const API_URL_KEY = 'settlehub_api_url';

export const UNAUTHORIZED_EVENT = 'settlehub:unauthorized';

export function getApiBaseUrl(): string {
  return storage.get(API_URL_KEY) || import.meta.env.VITE_API_URL || '/api/v1';
}

export function setApiBaseUrl(url: string | null) {
  const clean = url?.trim().replace(/\/+$/, '');
  if (clean) storage.set(API_URL_KEY, clean);
  else storage.remove(API_URL_KEY);
}

/** Origin of the backend (no /api/v1 suffix), used for health checks and WebSockets. */
export function getBackendOrigin(): string {
  const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
  return base.startsWith('http') ? base : window.location.origin + base;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function getToken(): string | null {
  return storage.get(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) storage.set(TOKEN_KEY, token);
  else storage.remove(TOKEN_KEY);
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const base = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${base}. Check your connection or the server setting.`);
  }

  if (response.status === 204) return undefined as T;

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith('/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      response.status,
      payload?.message || `Request failed (HTTP ${response.status})`,
      payload?.fieldErrors,
    );
  }
  if (!isJson) {
    throw new ApiError(response.status, `Unexpected response from ${base}. Check the server setting.`);
  }
  return payload as T;
}

export interface GroupUpdate {
  name?: string;
  groupType?: GroupType;
  simplifyByDefault?: boolean;
  archived?: boolean;
  budgetCents?: number;
  currencyCode?: string;
}

export const api = {
  // Auth & profile
  register: (data: { email: string; password: string; firstName: string; lastName?: string; currencyCode?: string }) =>
    request<AuthResponse>('POST', '/auth/register', data),
  login: (data: { email: string; password: string }) => request<AuthResponse>('POST', '/auth/login', data),
  me: () => request<User>('GET', '/auth/me'),
  updateProfile: (data: { firstName?: string; lastName?: string; currencyCode?: string; upiId?: string }) =>
    request<User>('PATCH', '/auth/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<void>('POST', '/auth/me/password', data),

  // Groups
  groups: () => request<Group[]>('GET', '/groups'),
  group: (id: string) => request<Group>('GET', `/groups/${id}`),
  createGroup: (data: {
    name: string;
    groupType: GroupType;
    currencyCode: string;
    simplifyByDefault: boolean;
    budgetCents?: number | null;
    memberEmails: string[];
  }) => request<Group>('POST', '/groups', data),
  updateGroup: (id: string, data: GroupUpdate) => request<Group>('PUT', `/groups/${id}`, data),
  deleteGroup: (id: string) => request<{ success: boolean }>('DELETE', `/groups/${id}`),
  addMember: (groupId: string, email: string) => request<GroupMember>('POST', `/groups/${groupId}/members`, { email }),
  removeMember: (groupId: string, userId: string) =>
    request<{ success: boolean }>('DELETE', `/groups/${groupId}/members/${userId}`),
  setMemberRole: (groupId: string, userId: string, role: GroupRole) =>
    request<GroupMember>('PATCH', `/groups/${groupId}/members/${userId}`, { role }),
  leaveGroup: (groupId: string) => request<{ success: boolean }>('POST', `/groups/${groupId}/leave`),
  resetInviteCode: (groupId: string) => request<Group>('POST', `/groups/${groupId}/invite-code`),
  previewInvite: (code: string) => request<InvitePreview>('GET', `/groups/invite/${encodeURIComponent(code)}`),
  joinGroup: (inviteCode: string) =>
    request<Group>('POST', '/groups/join', { inviteCode: inviteCode.trim().toUpperCase() }),
  activity: (groupId: string, before?: string) =>
    request<Activity[]>('GET', `/groups/${groupId}/activity?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`),

  // Expenses
  expenses: (groupId: string) => request<Expense[]>('GET', `/groups/${groupId}/expenses`),
  createExpense: (groupId: string, data: ExpenseInput) => request<Expense>('POST', `/groups/${groupId}/expenses`, data),
  updateExpense: (id: string, data: ExpenseInput) => request<Expense>('PUT', `/expenses/${id}`, data),
  deleteExpense: (id: string) => request<{ success: boolean }>('DELETE', `/expenses/${id}`),
  receipt: (id: string) => request<{ dataUrl: string }>('GET', `/expenses/${id}/receipt`),

  // Balances & settlements
  balances: (groupId: string) => request<GroupBalanceSummary>('GET', `/groups/${groupId}/balances`),
  settlements: (groupId: string) => request<Settlement[]>('GET', `/groups/${groupId}/settlements`),
  recordSettlement: (data: { groupId: string; payerId: string; payeeId: string; amountCents: number; note?: string }) =>
    request<Settlement>('POST', '/settlements', data),
  deleteSettlement: (id: string) => request<{ success: boolean }>('DELETE', `/settlements/${id}`),

  // Exports
  whatsappSummary: (groupId: string) =>
    request<{ summaryText: string; totalSpendFormatted: string }>('GET', `/groups/${groupId}/export/whatsapp`),
  emailReport: (groupId: string) =>
    request<{ success: boolean; message: string }>(
      'POST',
      `/groups/${groupId}/export/email?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
    ),
  async downloadExcel(groupId: string, fileBaseName: string): Promise<void> {
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const token = getToken();
    const res = await fetch(`${getApiBaseUrl()}/groups/${groupId}/export/excel?tz=${tz}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, `Could not generate the Excel report (HTTP ${res.status})`);
    await downloadBlob(await res.blob(), `${safeFileName(fileBaseName)}_SettleHub.xlsx`);
  },
};

export function safeFileName(name: string): string {
  return (name || 'SettleHub').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);

      // Write to Documents directory (publicly visible in Files app, no FileProvider needed)
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      // getUri returns the content:// or file:// URI that can safely be shared
      const uriResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Documents,
      });

      const shareUri = uriResult.uri; // content:// URI on Android ≥ 7

      await Share.share({
        title: fileName,
        text: `SettleHub export: ${fileName}`,
        url: shareUri,
        dialogTitle: `Share or Save ${fileName}`,
      });
      return;
    } catch (e) {
      console.warn('Native file save/share failed, falling back to browser download', e);
      // fall through to web download
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
