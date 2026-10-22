export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  currencyCode: string;
  upiId?: string | null;
}

export type GroupRole = 'ADMIN' | 'MEMBER';
export type GroupType = 'trip' | 'home' | 'couple' | 'other';

export interface GroupMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: GroupRole;
  joinedAt: string;
  netBalanceCents: number;
  netBalanceFormatted: string;
  placeholder: boolean;
  upiId?: string | null;
}

export interface Group {
  id: string;
  name: string;
  groupType: GroupType;
  simplifyByDefault: boolean;
  currencyCode: string;
  inviteCode?: string;
  archived: boolean;
  budgetCents?: number | null;
  budgetFormatted?: string | null;
  createdAt: string;
  updatedAt: string;
  members: GroupMember[];
  userNetBalanceCents: number;
  userNetBalanceFormatted: string;
  totalSpendCents: number;
  totalSpendFormatted: string;
  myRole: GroupRole;
}

export interface ExpensePayer {
  userId: string;
  userName: string;
  paidCents: number;
  paidFormatted: string;
}

export interface ExpenseSplit {
  userId: string;
  userName: string;
  owedCents: number;
  owedFormatted: string;
}

export type SplitMethod = 'EQUAL' | 'EXACT' | 'PERCENT';

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  costCents: number;
  costFormatted: string;
  currencyCode: string;
  date: string;
  creationMethod: SplitMethod | 'PAYMENT';
  isPayment: boolean;
  category: string;
  hasReceipt: boolean;
  notes?: string | null;
  originalCurrency?: string | null;
  originalAmountCents?: number | null;
  originalFormatted?: string | null;
  createdBy: User | null;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseInput {
  description: string;
  costCents: number;
  date?: string;
  category?: string;
  receiptUrl?: string | null;
  creationMethod: SplitMethod;
  payers?: { userId: string; paidCents: number }[];
  splits: { userId: string; owedCents?: number; percentage?: number }[];
  notes?: string | null;
  originalCurrency?: string | null;
  originalAmountCents?: number | null;
}

export interface DebtRepayment {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amountCents: number;
  amountFormatted: string;
  currencyCode: string;
}

export interface GroupBalanceSummary {
  groupId: string;
  groupName: string;
  simplifyByDefault: boolean;
  simplifiedDebts: DebtRepayment[];
  originalDebts: DebtRepayment[];
  savedTransactionsCount: number;
  netBalances: Record<string, number>;
  netBalancesFormatted: Record<string, string>;
}

export interface Settlement {
  id: string;
  groupId: string;
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amountCents: number;
  amountFormatted: string;
  currencyCode: string;
  date: string;
  createdAt: string;
  note?: string | null;
  createdByName?: string | null;
}

export interface Activity {
  id: string;
  type: string;
  summary: string;
  actorId?: string | null;
  actorName: string;
  amountCents?: number | null;
  amountFormatted?: string | null;
  createdAt: string;
}

export interface InvitePreview {
  inviteCode: string;
  groupName: string;
  groupType: GroupType;
  currencyCode: string;
  memberCount: number;
  alreadyMember: boolean;
  groupId?: string | null;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: User;
}
