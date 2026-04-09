import type {
  WhooingConfig,
  ApiResponse,
  Section,
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
  private accountCache: Map<string, AccountMap> = new Map();

  constructor(config: WhooingConfig) {
    this.config = config;
  }

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

  // Resolve section ID (use provided or fall back to default)
  resolveSectionId(sectionId?: string): string {
    const id = sectionId ?? this.config.defaultSectionId;
    if (!id) {
      throw new Error(
        "섹션 ID가 필요합니다. section_id 파라미터를 지정하거나 WHOOING_SECTION_ID 환경변수를 설정하세요."
      );
    }
    return id;
  }

  // --- Domain methods ---

  async getSections(): Promise<Section[]> {
    return this.apiGet<Section[]>("sections.json");
  }

  async getAccounts(sectionId: string): Promise<AccountsResult> {
    return this.apiGet<AccountsResult>("accounts.json", { section_id: sectionId });
  }

  /** Returns an account_id → AccountEntry map, cached per section. */
  async loadAccountMap(sectionId: string): Promise<AccountMap> {
    if (this.accountCache.has(sectionId)) {
      return this.accountCache.get(sectionId)!;
    }
    const grouped = await this.getAccounts(sectionId);
    const map: AccountMap = new Map();
    for (const [accountType, accounts] of Object.entries(grouped)) {
      for (const acc of accounts) {
        map.set(acc.account_id, { title: acc.title, accountType });
      }
    }
    this.accountCache.set(sectionId, map);
    return map;
  }

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
