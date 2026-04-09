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
  apiKey: string;
  defaultSectionId?: string;
}

// Section (가계부)
export interface Section {
  section_id: string;
  title: string;
  currency: string;
  memo?: string;
  isolation?: string;
  total_assets?: number;
  total_liabilities?: number;
}

// Account type (outer key in AccountsResult)
export type AccountType = "assets" | "liabilities" | "income" | "expenses" | "capital";

// Account (계정/항목)
export interface Account {
  account_id: string;
  title: string;
  type: "group" | "account";
  memo?: string;
  open_date?: number;
  close_date?: number;
  category?: string;
}

// AccountsResult: grouped by type
export type AccountsResult = Record<string, Account[]>;

// Per-account info in the lookup map (includes account type for API calls)
export interface AccountEntry {
  title: string;
  accountType: string; // 'assets' | 'liabilities' | etc.
}

// account_id → AccountEntry lookup map
export type AccountMap = Map<string, AccountEntry>;

// Entry (거래내역) - entry_date is a float: YYYYMMDD.NNNN
export interface Entry {
  entry_id: number;
  entry_date: number;
  l_account: string;
  l_account_id: string;
  r_account: string;
  r_account_id: string;
  money: number;
  item: string;
  memo?: string;
  total?: number;
}

// Entries API response shape
export interface EntriesResponse {
  reports: unknown[];
  rows: Entry[];
}

// Report API aggregate response (used for balance sheet and P&L)
export interface ReportResult {
  aggregate: Record<string, number>;
  rows_type: string;
  rows: Record<string, unknown>;
  in_out?: Record<string, unknown>;
}

// Balance sheet (mapped from report/assets,liabilities API)
export interface BalanceSheet {
  assets: number;
  liabilities: number;
  capital: number;
}

// P&L report (mapped from report/expenses,income API)
export interface PLResult {
  income: number;
  expenses: number;
  net_income: number;
}
