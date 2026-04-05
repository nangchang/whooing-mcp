// Whooing API response wrapper
export interface ApiResponse<T> {
  code: number;
  message: string;
  error_parameters?: Record<string, unknown>;
  rest_of_api?: number;
  results: T;
}

// Authentication config
export interface WhooingConfig {
  appId: string;
  token: string;
  signature: string;
  defaultSectionId?: string;
}

// Section (가계부)
export interface Section {
  section_id: string;
  title: string;
  currency: string;
  opened_at?: string;
}

// Account type
export type AccountType = "assets" | "liabilities" | "income" | "expenses" | "capital";

// Account (계정/항목)
export interface Account {
  account_id: string;
  title: string;
  type: AccountType;
  section_id: string;
  opened_at?: string;
  closed_at?: string | null;
}

// account_id → title lookup map
export type AccountMap = Map<string, string>;

// Entry (거래내역)
export interface Entry {
  entry_id: string;
  entry_date: string; // YYYYMMDD
  l_account_id: string;
  r_account_id: string;
  money: number;
  item: string;
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

// Balance sheet account group
export interface BalanceAccount {
  account_id: string;
  title?: string;
  total: number;
}

export interface BalanceGroup {
  type: AccountType;
  total: number;
  accounts: BalanceAccount[];
}

export interface BalanceSheet {
  assets: BalanceGroup;
  liabilities: BalanceGroup;
  capital?: BalanceGroup;
}

// P&L report
export interface PLCategory {
  account_id: string;
  title?: string;
  total: number;
}

export interface PLResult {
  income: PLCategory[];
  expenses: PLCategory[];
  income_total: number;
  expenses_total: number;
  net: number;
}

// Accounts response (grouped by type)
export type AccountsResult = Record<string, Account[]>;
