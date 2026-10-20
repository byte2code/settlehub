export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  currencyCode: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  netBalanceCents: number;
  netBalanceFormatted: string;
}

export interface Group {
  id: string;
  name: string;
  groupType: string;
  simplifyByDefault: boolean;
  currencyCode: string;
  inviteCode?: string;
  archived?: boolean;
  budgetCents?: number | null;
  budgetFormatted?: string | null;
  createdAt: string;
  updatedAt: string;
  members: GroupMember[];
  userNetBalanceCents: number;
  userNetBalanceFormatted: string;
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

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  costCents: number;
  costFormatted: string;
  currencyCode: string;
  date: string;
  creationMethod: 'EQUAL' | 'EXACT' | 'PERCENT' | 'PAYMENT';
  isPayment: boolean;
  category?: string;
  receiptUrl?: string | null;
  createdBy: User;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  createdAt: string;
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
  groupId?: string;
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amountCents: number;
  amountFormatted: string;
  currencyCode: string;
  date: string;
  createdAt: string;
}
