// Whooing API 응답의 기본 래퍼(Wrapper) 형식
export interface ApiResponse<T> {
  code: number;
  message: string;
  error_parameters?: Record<string, unknown>;
  rest_of_api?: number;
  results: T;
}

// 인증 및 기본 환경설정
export interface WhooingConfig {
  apiKey: string;
  defaultSectionId?: string; // 지정되지 않았을 때 사용할 기본 섹션 ID
}

// Section (가계부 단위)
export interface Section {
  section_id: string; // 섹션 고유 ID
  title: string; // 섹션 이름
  currency: string; // 통화 (예: KRW)
  memo?: string;
  isolation?: string;
  total_assets?: number;
  total_liabilities?: number;
}

// 계정/항목의 대분류 (AccountsResult의 최상위 키로 사용됨)
export type AccountType = "assets" | "liabilities" | "income" | "expenses" | "capital";

// Account (계정/항목 목록의 한 항목: group은 분류용 그룹, account는 거래 항목)
export interface Account {
  account_id: string; // 계정 고유 ID
  title: string; // 계정 이름
  type: "group" | "account"; // 계정 유형 (그룹 혹은 일반 계정)
  memo?: string;
  open_date?: number;
  close_date?: number;
  category?: string;
}

// AccountsResult: 대분류(AccountType)를 키로 하여 묶여 있는 계정 목록
export type AccountsResult = Record<AccountType, Account[]>;

// 조회 맵(AccountMap)에서 사용하는 계정에 대한 요약된 정보
// API 호출 시 필요한 대분류(accountType)를 함께 포함
export interface AccountEntry {
  title: string;
  accountType: AccountType;
  type: Account["type"]; // group은 분류용, account는 거래에 사용할 수 있는 항목
}

// 계정 ID(account_id)를 키로 하여 AccountEntry를 빠르게 찾기 위한 맵 자료구조
export type AccountMap = Map<string, AccountEntry>;

// Entry (개별 거래 내역)
// entry_date는 YYYYMMDD.NNNN 형태의 실수(float)값임
export interface Entry {
  entry_id: number;
  entry_date: number; // 거래일자와 일중 순번 (예: 20260411.0001)
  l_account: string;  // 차변 대분류 (예: expenses)
  l_account_id: string; // 차변 계정 ID
  r_account: string;  // 대변 대분류 (예: assets)
  r_account_id: string; // 대변 계정 ID
  money: number; // 거래 금액
  item: string; // 거래 적요
  memo?: string; // 부가 메모
  total?: number; // 거래 후 잔액 (옵션)
}

// 거래 내역(Entries)을 조회했을 때의 API 응답 형태
export interface EntriesResponse {
  reports: unknown[];
  rows: Entry[]; // 실제 거래 목록 리스트
}

// 리포트 조회(잔액표, 손익계산서 등) 시 API의 집계 결과 응답
export interface ReportResult {
  aggregate: Record<string, number>; // 항목별 합계 금액
  rows_type: string;
  rows: Record<string, unknown>;
  in_out?: Record<string, unknown>;
}

// 잔액표(자산/부채/자본 현황) 구조 (report/assets,liabilities API로부터 매핑)
export interface BalanceSheet {
  assets: number;
  liabilities: number;
  capital: number;
}

// 손익계산서(P&L) 구조 (report/expenses,income API로부터 매핑)
export interface PLResult {
  income: number;
  expenses: number;
  net_income: number; // 순손익 = 수입 - 지출
}
