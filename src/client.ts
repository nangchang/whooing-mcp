import type {
  WhooingConfig,
  ApiResponse,
  Section,
  AccountType,
  AccountMap,
  AccountsResult,
  Entry,
  EntriesResponse,
  ReportResult,
  BalanceSheet,
  PLResult,
} from "./types.js";

const BASE_URL = "https://whooing.com/api";

export class WhooingClient {
  private config: WhooingConfig;
  // 각 섹션별(section_id)로 조회한 계정 정보를 메모리에 임시 저장(캐시)하는 맵
  private accountCache: Map<string, AccountMap> = new Map();

  constructor(config: WhooingConfig) {
    this.config = config;
  }

  /**
   * Whooing API 서버로 HTTP GET 요청을 전송하는 범용 내부 메서드
   * @param path API 엔드포인트 경로
   * @param params URL 쿼리 파라미터 (옵션)
   */
  private async apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    const res = await fetch(url.toString(), {
      headers: { "X-API-KEY": this.config.apiKey },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== 200) {
      throw new Error(`Whooing API error ${json.code}: ${json.message}`);
    }
    return json.results;
  }

  /**
   * Whooing API 서버로 HTTP POST 요청을 전송하는 범용 내부 메서드
   * @param path API 엔드포인트 경로
   * @param body POST 본문으로 보낼 데이터 객체
   */
  private async apiPost<T>(path: string, body: Record<string, string | number>): Promise<T> {
    const res = await fetch(`${BASE_URL}/${path}`, {
      method: "POST",
      headers: {
        "X-API-KEY": this.config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(
        Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]))
      ).toString(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== 200) {
      throw new Error(`Whooing API error ${json.code}: ${json.message}`);
    }
    return json.results;
  }

  /**
   * Whooing API 서버로 HTTP DELETE 요청을 전송하는 범용 내부 메서드
   * @param path API 엔드포인트 경로
   * @param params URL 쿼리 파라미터 (옵션)
   */
  private async apiDelete<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: { "X-API-KEY": this.config.apiKey },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== 200) {
      throw new Error(`Whooing API error ${json.code}: ${json.message}`);
    }
    return json.results;
  }

  /**
   * Whooing API 서버로 HTTP PUT 요청을 전송하는 범용 내부 메서드
   * @param path API 엔드포인트 경로
   * @param body PUT 본문으로 보낼 수정 데이터 객체
   */
  private async apiPut<T>(path: string, body: Record<string, string | number>): Promise<T> {
    const res = await fetch(`${BASE_URL}/${path}`, {
      method: "PUT",
      headers: {
        "X-API-KEY": this.config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(
        Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]))
      ).toString(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== 200) {
      throw new Error(`Whooing API error ${json.code}: ${json.message}`);
    }
    return json.results;
  }

  /**
   * 사용할 섹션 ID를 확인합니다. 파라미터로 주어진 ID가 없으면 설정된 기본 섹션 ID를 반환합니다.
   * @param sectionId 지정된 섹션 ID (optional)
   * @throws 섹션 ID가 전혀 설정되어 있지 않을 경우 예외 발생
   */
  resolveSectionId(sectionId?: string): string {
    const id = sectionId ?? this.config.defaultSectionId;
    if (!id) {
      throw new Error(
        "섹션 ID가 필요합니다. section_id 파라미터를 지정하거나 WHOOING_SECTION_ID 환경변수를 설정하세요."
      );
    }
    return id;
  }

  // --- 도메인 메서드 (Domain methods) ---

  /** 모든 섹션(가계부 단위) 목록을 조회합니다. */
  async getSections(): Promise<Section[]> {
    return this.apiGet<Section[]>("sections.json");
  }

  /** 특정 섹션에 포함된 모든 계정 및 항목을 유형별로 그룹화하여 조회합니다. */
  async getAccounts(sectionId: string): Promise<AccountsResult> {
    return this.apiGet<AccountsResult>("accounts.json", { section_id: sectionId });
  }

  /**
   * account_id를 키값으로 하여 빠르게 계정 정보를 찾을 수 있는 AccountMap을 생성하고 반환합니다.
   * 네트워크와 API 호출을 아끼기 위해 각 섹션별로 캐싱(Caching)을 사용합니다.
   */
  async loadAccountMap(sectionId: string): Promise<AccountMap> {
    if (this.accountCache.has(sectionId)) {
      return this.accountCache.get(sectionId)!;
    }
    const grouped = await this.getAccounts(sectionId);
    const map: AccountMap = new Map();
    const groupedEntries = Object.entries(grouped) as Array<
      [AccountType, AccountsResult[AccountType]]
    >;
    for (const [accountType, accounts] of groupedEntries) {
      for (const acc of accounts) {
        map.set(acc.account_id, { title: acc.title, accountType, type: acc.type });
      }
    }
    this.accountCache.set(sectionId, map);
    return map;
  }

  /**
   * 범위가 지정된 특정 조건에 맞추어 거래 내역 목록을 조회합니다.
   */
  async getEntries(
    sectionId: string,
    startDate: string,
    endDate: string,
    options: {
      limit?: number;
      item?: string;
      memo?: string;
      accountId?: string;
      account?: string;
      moneyFrom?: number;
      moneyTo?: number;
      sortColumn?: string;
      sortOrder?: string;
    } = {}
  ): Promise<Entry[]> {
    const params: Record<string, string> = {
      section_id: sectionId,
      start_date: startDate,
      end_date: endDate,
      limit: String(options.limit ?? 20),
    };
    if (options.item) params.item = options.item;
    if (options.memo) params.memo = options.memo;
    if (options.accountId && options.account) {
      params.account = options.account;
      params.account_id = options.accountId;
    }
    if (options.moneyFrom !== undefined) params.money_from = String(options.moneyFrom);
    if (options.moneyTo !== undefined) params.money_to = String(options.moneyTo);
    if (options.sortColumn) params.sort_column = options.sortColumn;
    if (options.sortOrder) params.sort_order = options.sortOrder;

    const result = await this.apiGet<EntriesResponse>("entries.json", params);
    return result.rows ?? [];
  }

  /**
   * 새로운 거래 내역을 작성하여 추가합니다. (복식부기 방식에 따라 차변과 대변 정보 모두 필요)
   */
  async addEntry(
    sectionId: string,
    entryDate: string,
    lAccount: string,
    lAccountId: string,
    rAccount: string,
    rAccountId: string,
    money: number,
    item: string,
    memo?: string
  ): Promise<Entry> {
    const body: Record<string, string | number> = {
      section_id: sectionId,
      entry_date: entryDate,
      l_account: lAccount,
      l_account_id: lAccountId,
      r_account: rAccount,
      r_account_id: rAccountId,
      money,
      item,
    };
    if (memo) body.memo = memo;
    return this.apiPost<Entry>("entries.json", body);
  }

  /**
   * 기존에 작성된 거래 내역을 수정합니다.
   * 수정을 원하는 프로퍼티만 객체(fields)에 담아 전달하면, 해당 값만 업데이트 처리됩니다.
   */
  async updateEntry(
    sectionId: string,
    entryId: string,
    fields: {
      entry_date?: string;
      l_account?: string;
      l_account_id?: string;
      r_account?: string;
      r_account_id?: string;
      money?: number;
      item?: string;
      memo?: string;
    }
  ): Promise<Entry> {
    const body: Record<string, string | number> = { section_id: sectionId };
    if (fields.entry_date !== undefined) body.entry_date = fields.entry_date;
    if (fields.l_account !== undefined) body.l_account = fields.l_account;
    if (fields.l_account_id !== undefined) body.l_account_id = fields.l_account_id;
    if (fields.r_account !== undefined) body.r_account = fields.r_account;
    if (fields.r_account_id !== undefined) body.r_account_id = fields.r_account_id;
    if (fields.money !== undefined) body.money = fields.money;
    if (fields.item !== undefined) body.item = fields.item;
    if (fields.memo !== undefined) body.memo = fields.memo;
    return this.apiPut<Entry>(`entries/${entryId}.json`, body);
  }

  /**
   * 기존에 작성된 거래 내역을 삭제합니다.
   */
  async deleteEntry(sectionId: string, entryId: string): Promise<void> {
    await this.apiDelete<unknown>(`entries/${entryId}.json`, { section_id: sectionId });
  }

  /**
   * 특정 섹션에서 명시된 기간 동안의 잔액표(자산/부채/자본 요약) 데이터를 조회합니다.
   */
  async getBalanceSheet(
    sectionId: string,
    startDate: string,
    endDate: string
  ): Promise<BalanceSheet> {
    const result = await this.apiGet<ReportResult>("report/assets,liabilities.json", {
      section_id: sectionId,
      start_date: startDate,
      end_date: endDate,
      rows_type: "none",
    });
    return {
      assets: result.aggregate.assets ?? 0,
      liabilities: result.aggregate.liabilities ?? 0,
      capital: result.aggregate.capital ?? 0,
    };
  }

  /**
   * 구간 손익 리포트(선택 기간 내의 수입 및 지출 총계, 순이익 요약) 정보를 조회합니다.
   */
  async getPLReport(
    sectionId: string,
    startDate: string,
    endDate: string
  ): Promise<PLResult> {
    const result = await this.apiGet<ReportResult>("report/expenses,income.json", {
      section_id: sectionId,
      start_date: startDate,
      end_date: endDate,
      rows_type: "none",
    });
    return {
      income: result.aggregate.income ?? 0,
      expenses: result.aggregate.expenses ?? 0,
      net_income: result.aggregate.net_income ?? 0,
    };
  }
}
