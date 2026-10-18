import type { Group, GroupBalanceSummary, Expense, User, Settlement, DebtRepayment } from '../types';

export const getApiBaseUrl = (): string => {
  return localStorage.getItem('settlehub_api_url') || import.meta.env.VITE_API_URL || '/api/v1';
};

export const setApiBaseUrl = (url: string) => {
  if (url && url.trim().length > 0) {
    localStorage.setItem('settlehub_api_url', url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('settlehub_api_url');
  }
};

class ApiService {
  private token: string | null = localStorage.getItem('settlehub_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('settlehub_token', token);
    } else {
      localStorage.removeItem('settlehub_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const baseUrl = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${baseUrl}${cleanEndpoint}`;

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new Error(`Cannot reach backend at "${baseUrl}". Please ensure your backend is deployed and check the Server URL setting.`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      if (contentType.includes('application/json')) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message || errorBody?.error || `HTTP error ${response.status}`);
      } else {
        throw new Error(`Server returned HTTP ${response.status} from ${fullUrl}.`);
      }
    }

    if (!contentType.includes('application/json')) {
      throw new Error(
        `Received non-JSON response from "${fullUrl}". Please check your backend deployment URL in Server Settings.`
      );
    }

    return response.json();
  }

  // --- Auth Endpoints ---
  async register(data: { email: string; password?: string; firstName: string; lastName?: string; currencyCode?: string }) {
    const res = await this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.token);
    return res;
  }

  async login(data: { email: string; password?: string }) {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.token);
    return res;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async updateCurrency(currencyCode: string): Promise<User> {
    return this.request<User>('/auth/me/currency', {
      method: 'PATCH',
      body: JSON.stringify({ currencyCode }),
    });
  }

  logout() {
    this.setToken(null);
  }

  // --- Group Endpoints ---
  async getGroups(): Promise<Group[]> {
    return this.request<Group[]>('/groups');
  }

  async getGroup(id: string): Promise<Group> {
    return this.request<Group>(`/groups/${id}`);
  }

  async createGroup(data: {
    name: string;
    groupType?: string;
    simplifyByDefault?: boolean;
    currencyCode?: string;
    memberEmails?: string[];
  }): Promise<Group> {
    return this.request<Group>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGroup(id: string, data: { name?: string; simplifyByDefault?: boolean }): Promise<Group> {
    return this.request<Group>(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteGroup(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/groups/${id}`, {
      method: 'DELETE',
    });
  }

  async addMember(groupId: string, email: string) {
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async joinGroup(inviteCode: string): Promise<Group> {
    return this.request<Group>('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
    });
  }

  // --- Expense Endpoints ---
  async getExpenses(groupId: string): Promise<Expense[]> {
    return this.request<Expense[]>(`/groups/${groupId}/expenses`);
  }

  async createExpense(
    groupId: string,
    data: {
      description: string;
      costCents: number;
      currencyCode?: string;
      date?: string;
      creationMethod?: string;
      payers?: { userId: string; paidCents: number }[];
      splits: { userId: string; owedCents?: number; percentage?: number }[];
    }
  ): Promise<Expense> {
    return this.request<Expense>(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(expenseId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/expenses/${expenseId}`, {
      method: 'DELETE',
    });
  }

  // --- Balance Endpoints ---
  async getGroupBalances(groupId: string): Promise<GroupBalanceSummary> {
    return this.request<GroupBalanceSummary>(`/groups/${groupId}/balances`);
  }

  async getSimplifiedDebts(groupId: string): Promise<DebtRepayment[]> {
    return this.request<DebtRepayment[]>(`/groups/${groupId}/simplified-debts`);
  }

  // --- Settlement Endpoints ---
  async recordSettlement(data: {
    groupId?: string;
    payerId?: string;
    payeeId: string;
    amountCents: number;
    currencyCode?: string;
    date?: string;
  }): Promise<Settlement> {
    return this.request<Settlement>('/settlements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiService();
