export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  currencyCode: string;
  upiId?: string | null;
  bio?: string | null;
  avatarId?: string | null;
  chimeSound?: string | null;
  admin?: boolean;
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

export interface SendOtpResponse {
  success: boolean;
  bypassed: boolean;
  message: string;
  expiresInSeconds: number;
}

export interface AppNotification {
  id: string;
  groupId: string;
  entityId?: string | null;
  type: string;
  title: string;
  message: string;
  actorId?: string | null;
  actorName: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationSummary {
  notifications: AppNotification[];
  unreadCount: number;
}

export interface GroupDebtDetail {
  groupId: string;
  groupName: string;
  amountCents: number;
}

export interface PersonPayment {
  userId: string;
  userName: string;
  upiId: string | null;
  currencyCode: string;
  totalAmountCents: number;
  groupBreakdown: GroupDebtDetail[];
}

export interface UserPaymentSummary {
  totalOweByCurrency: Record<string, number>;
  totalReceivableByCurrency: Record<string, number>;
  peopleYouOwe: PersonPayment[];
  peopleWhoOweYou: PersonPayment[];
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
}

export interface AdminOverview {
  totalUsers: number;
  activeGroups: number;
  totalGroups: number;
  expenseCount: number;
  settlementCount: number;
  expenseVolumeByCurrency: Record<string, number>;
  settledVolumeByCurrency: Record<string, number>;
  settlementRatioByCurrency: Record<string, number>;
}

export interface AdminHealth {
  emailsSentToday: number;
  emailDailyLimit: number;
  dbLatencyMs: number;
  database: string;
  tables: { table: string; sizeBytes: number; rows: number }[];
  uptimeSeconds: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  active: boolean;
  admin: boolean;
  groupCount: number;
}

export interface AdminGroup {
  id: string;
  name: string;
  currencyCode: string;
  archived: boolean;
  createdAt: string;
  memberCount: number;
}

export interface Engagement {
  reactions: Record<string, number>;
  mine: string[];
  comments: number;
}

export interface ExpenseComment {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface Award {
  id: string;
  emoji: string;
  title: string;
  winners: string[];
  detail: string;
}

export interface AwardsResponse {
  revealed: boolean;
  eligible: boolean;
  message: string | null;
  revealedAt: string | null;
  awards: Award[];
}
