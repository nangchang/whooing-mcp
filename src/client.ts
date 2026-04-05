import crypto from "node:crypto";
import type {
  WhooingConfig,
  ApiResponse,
  Section,
  Account,
  AccountMap,
  AccountsResult,
  Entry,
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

  private buildApiKey(): string {
    const nounce = crypto.randomBytes(20).toString("hex");
    const timestamp = Date.now();
    // Note: "signiture" and "nounce" are intentional typos from the official Whooing API spec
    return `app_id=${this.config.appId},token=${this.config.token},signiture=${this.config.signature},nounce=${nounce},timestamp=${timestamp}`;
  }

  private async apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    const res = await fetch(url.toString(), {
      headers: { "X-API-KEY": this.buildApiKey() },
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
        "X-API-KEY": this.buildApiKey(),
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
        "X-API-KEY": this.buildApiKey(),
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
    return this.apiGet<Section[]>("app/sections.json");
  }

  async getAccounts(sectionId: string): Promise<AccountsResult> {
    return this.apiGet<AccountsResult>(`app/${sectionId}/accounts.json`);
  }

  /** Returns an account_id → title map, cached per section. */
  async loadAccountMap(sectionId: string): Promise<AccountMap> {
    if (this.accountCache.has(sectionId)) {
      return this.accountCache.get(sectionId)!;
    }
    const grouped = await this.getAccounts(sectionId);
    const map: AccountMap = new Map();
    for (const accounts of Object.values(grouped)) {
      for (const acc of accounts) {
        map.set(acc.account_id, acc.title);
      }
    }
    this.accountCache.set(sectionId, map);
    return map;
  }

  async getEntries(
    sectionId: string,
    startDate: string,
    endDate: string,
    limit = 100
  ): Promise<Entry[]> {
    return this.apiGet<Entry[]>(`app/${sectionId}/entries.json_array`, {
      start_date: startDate,
      end_date: endDate,
      limit: String(limit),
    });
  }

  async addEntry(
    sectionId: string,
    entryDate: string,
    lAccountId: string,
    rAccountId: string,
    money: number,
    item: string,
    memo?: string
  ): Promise<Entry> {
    const body: Record<string, string | number> = {
      entry_date: entryDate,
      l_account_id: lAccountId,
      r_account_id: rAccountId,
      money,
      item,
    };
    if (memo) body.memo = memo;
    return this.apiPost<Entry>(`app/${sectionId}/entries.json_array`, body);
  }

  async updateEntry(
    sectionId: string,
    entryId: string,
    fields: {
      entry_date?: string;
      l_account_id?: string;
      r_account_id?: string;
      money?: number;
      item?: string;
      memo?: string;
    }
  ): Promise<Entry> {
    const body: Record<string, string | number> = {};
    if (fields.entry_date !== undefined) body.entry_date = fields.entry_date;
    if (fields.l_account_id !== undefined) body.l_account_id = fields.l_account_id;
    if (fields.r_account_id !== undefined) body.r_account_id = fields.r_account_id;
    if (fields.money !== undefined) body.money = fields.money;
    if (fields.item !== undefined) body.item = fields.item;
    if (fields.memo !== undefined) body.memo = fields.memo;
    return this.apiPut<Entry>(`app/${sectionId}/entries.json_array/${entryId}`, body);
  }

  async getBalanceSheet(
    sectionId: string,
    startDate: string,
    endDate: string
  ): Promise<BalanceSheet> {
    return this.apiGet<BalanceSheet>(`app/${sectionId}/balance_sheet.json`, {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async getPLReport(
    sectionId: string,
    startDate: string,
    endDate: string
  ): Promise<PLResult> {
    return this.apiGet<PLResult>(`app/${sectionId}/pl.json`, {
      start_date: startDate,
      end_date: endDate,
    });
  }
}
