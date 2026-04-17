import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WhooingClient } from "./client.js";
import {
  formatSections,
  formatAccounts,
  formatEntries,
  formatNewEntry,
  formatUpdatedEntry,
  formatBalanceSheet,
  formatPLReport,
} from "./formatters.js";
import type { AccountEntry } from "./types.js";

/**
 * Date 객체를 실행 환경의 로컬 날짜 기준 YYYYMMDD 문자열로 변환합니다.
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * 현재 로컬 날짜를 YYYYMMDD 형태의 문자열로 반환합니다.
 */
function today(): string {
  return formatLocalDate(new Date());
}

/**
 * 이번 달의 1일을 로컬 날짜 기준 YYYYMMDD 형태의 문자열로 반환합니다.
 */
function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`;
}

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[] };

/**
 * 도구가 성공적으로 실행되었을 때 반환할 공통 응답 형식을 생성합니다.
 */
function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * 도구 실행 중 에러가 발생했을 때 반환할 에러 텍스트 형식을 생성합니다.
 */
function err(e: unknown): ToolResult {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text", text: `오류: ${msg}` }] };
}

/**
 * 거래 입력/수정/필터에 사용할 수 있는 실제 거래 항목인지 확인합니다.
 */
function validateTransactionAccount(
  entry: AccountEntry,
  accountId: string,
  label: string
): ToolResult | undefined {
  if (entry.type === "account") {
    return undefined;
  }

  return err(
    new Error(
      `${label} ID '${accountId}'는 분류용 그룹입니다. 거래에는 whooing_list_accounts에서 '거래 항목'으로 표시된 ID를 사용하세요.`
    )
  );
}

/**
 * MCP 서버에 모든 Whooing API 관련 도구(Tools)들을 등록합니다.
 */
export function registerTools(server: McpServer, client: WhooingClient): void {
  // 1. 섹션 목록 조회 도구

  server.tool(
    "whooing_list_sections",
    "후잉 계정의 모든 섹션(가계부) 목록을 조회합니다.",
    {},
    async () => {
      try {
        const sections = await client.getSections();
        return ok(formatSections(sections));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 2. 계정 항목 목록 조회 도구 (자산, 부채, 자본, 수입, 지출 등)
  server.tool(
    "whooing_list_accounts",
    "지정한 섹션의 모든 계정/항목 목록을 조회합니다. (자산, 부채, 자본, 수입, 지출 계정)",
    {
      section_id: z
        .string()
        .optional()
        .describe("섹션 ID (미지정 시 기본값 WHOOING_SECTION_ID 사용)"),
    },
    async ({ section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const accounts = await client.getAccounts(sectionId);
        return ok(formatAccounts(accounts));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 3. 거래 내역 조회 도구 (특정 조건 필터링 포함)
  server.tool(
    "whooing_list_entries",
    "거래내역을 조회합니다. 날짜(YYYYMMDD), 적요/메모 키워드, 계정 항목, 금액 범위로 필터링할 수 있습니다.",
    {
      start_date: z
        .string()
        .optional()
        .describe("조회 시작일 (YYYYMMDD, 미지정 시 이번 달 1일)"),
      end_date: z
        .string()
        .optional()
        .describe("조회 종료일 (YYYYMMDD, 미지정 시 오늘)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("최대 조회 건수 (기본 20, 최대 100)"),
      item: z
        .string()
        .optional()
        .describe("적요 검색. 와일드카드 * 지원 (예: *커피*, 스타벅스*)"),
      memo: z
        .string()
        .optional()
        .describe("메모 검색. 공백은 AND 조건, ! prefix로 제외 (예: '카페 !라떼')"),
      account_id: z
        .string()
        .optional()
        .describe("특정 계정 항목 ID로 필터 (차변 또는 대변 중 한쪽이라도 일치하는 거래)"),
      money_from: z
        .number()
        .int()
        .optional()
        .describe("최소 금액 필터"),
      money_to: z
        .number()
        .int()
        .optional()
        .describe("최대 금액 필터"),
      sort_column: z
        .enum(["entry_date", "item", "money", "total", "l_account_id", "r_account_id"])
        .optional()
        .describe("정렬 기준 (기본: entry_date)"),
      sort_order: z
        .enum(["desc", "asc"])
        .optional()
        .describe("정렬 순서 (기본: desc)"),
      section_id: z
        .string()
        .optional()
        .describe("섹션 ID (미지정 시 기본값 사용)"),
    },
    async ({ start_date, end_date, limit, item, memo, account_id, money_from, money_to, sort_column, sort_order, section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const startDate = start_date ?? firstDayOfMonth();
        const endDate = end_date ?? today();

        let resolvedAccount: string | undefined;
        if (account_id) {
          const accountMap = await client.loadAccountMap(sectionId);
          const entry = accountMap.get(account_id);
          if (!entry) {
            return err(new Error(`계정 항목 ID '${account_id}'를 찾을 수 없습니다. whooing_list_accounts로 올바른 ID를 확인하세요.`));
          }
          const validationError = validateTransactionAccount(entry, account_id, "계정 항목");
          if (validationError) return validationError;
          resolvedAccount = entry.accountType;
        }

        const entries = await client.getEntries(sectionId, startDate, endDate, {
          limit,
          item,
          memo,
          accountId: account_id,
          account: resolvedAccount,
          moneyFrom: money_from,
          moneyTo: money_to,
          sortColumn: sort_column,
          sortOrder: sort_order,
        });
        const accountMap = await client.loadAccountMap(sectionId);
        return ok(formatEntries(entries, accountMap));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 4. 새 거래 내역 추가 도구 (복식부기)
  server.tool(
    "whooing_add_entry",
    "새 거래를 입력합니다. 후잉은 복식부기 방식으로, 차변(l_account_id)과 대변(r_account_id) 계정 ID가 필요합니다. 계정 ID는 whooing_list_accounts 도구로 확인하세요.",
    {
      entry_date: z.string().describe("거래 날짜 (YYYYMMDD)"),
      l_account_id: z.string().describe("차변 계정 ID (왼쪽, 예: 지출 계정)"),
      r_account_id: z.string().describe("대변 계정 ID (오른쪽, 예: 자산 계정)"),
      money: z.number().int().min(1).describe("금액 (원 단위 양의 정수)"),
      item: z.string().describe("적요 (거래 내용 설명)"),
      memo: z.string().optional().describe("메모 (선택)"),
      section_id: z.string().optional().describe("섹션 ID (미지정 시 기본값 사용)"),
    },
    async ({ entry_date, l_account_id, r_account_id, money, item, memo, section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const accountMap = await client.loadAccountMap(sectionId);

        const lEntry = accountMap.get(l_account_id);
        if (!lEntry) {
          return err(
            new Error(
              `차변 계정 ID '${l_account_id}'를 찾을 수 없습니다. whooing_list_accounts로 올바른 ID를 확인하세요.`
            )
          );
        }
        const lValidationError = validateTransactionAccount(lEntry, l_account_id, "차변 계정");
        if (lValidationError) return lValidationError;

        const rEntry = accountMap.get(r_account_id);
        if (!rEntry) {
          return err(
            new Error(
              `대변 계정 ID '${r_account_id}'를 찾을 수 없습니다. whooing_list_accounts로 올바른 ID를 확인하세요.`
            )
          );
        }
        const rValidationError = validateTransactionAccount(rEntry, r_account_id, "대변 계정");
        if (rValidationError) return rValidationError;

        const entry = await client.addEntry(
          sectionId,
          entry_date,
          lEntry.accountType,
          l_account_id,
          rEntry.accountType,
          r_account_id,
          money,
          item,
          memo
        );
        return ok(formatNewEntry(entry, accountMap));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 5. 기존 거래 내역 수정 도구
  server.tool(
    "whooing_update_entry",
    "기존 거래를 수정합니다. 수정할 필드만 지정하면 됩니다. 거래 ID는 whooing_list_entries 조회 결과에서 확인하세요.",
    {
      entry_id: z.string().describe("수정할 거래 ID"),
      entry_date: z.string().optional().describe("새 날짜 (YYYYMMDD)"),
      l_account_id: z.string().optional().describe("새 차변 계정 ID"),
      r_account_id: z.string().optional().describe("새 대변 계정 ID"),
      money: z.number().int().min(1).optional().describe("새 금액"),
      item: z.string().optional().describe("새 적요"),
      memo: z.string().optional().describe("새 메모"),
      section_id: z.string().optional().describe("섹션 ID (미지정 시 기본값 사용)"),
    },
    async ({ entry_id, entry_date, l_account_id, r_account_id, money, item, memo, section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const accountMap = await client.loadAccountMap(sectionId);

        let lAccount: string | undefined;
        if (l_account_id) {
          const lEntry = accountMap.get(l_account_id);
          if (!lEntry) return err(new Error(`차변 계정 ID '${l_account_id}'를 찾을 수 없습니다.`));
          const validationError = validateTransactionAccount(lEntry, l_account_id, "차변 계정");
          if (validationError) return validationError;
          lAccount = lEntry.accountType;
        }

        let rAccount: string | undefined;
        if (r_account_id) {
          const rEntry = accountMap.get(r_account_id);
          if (!rEntry) return err(new Error(`대변 계정 ID '${r_account_id}'를 찾을 수 없습니다.`));
          const validationError = validateTransactionAccount(rEntry, r_account_id, "대변 계정");
          if (validationError) return validationError;
          rAccount = rEntry.accountType;
        }

        const entry = await client.updateEntry(sectionId, entry_id, {
          entry_date,
          l_account: lAccount,
          l_account_id,
          r_account: rAccount,
          r_account_id,
          money,
          item,
          memo,
        });
        return ok(formatUpdatedEntry(entry, accountMap));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 6. 거래 내역 삭제 도구
  server.tool(
    "whooing_delete_entry",
    "거래를 삭제합니다. 거래 ID는 whooing_list_entries 조회 결과에서 확인하세요. 삭제는 되돌릴 수 없으니 주의하세요.",
    {
      entry_id: z.string().describe("삭제할 거래 ID"),
      section_id: z.string().optional().describe("섹션 ID (미지정 시 기본값 사용)"),
    },
    async ({ entry_id, section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const accountMap = await client.loadAccountMap(sectionId);
        const deleted = await client.deleteEntry(sectionId, entry_id);
        const detail = formatEntries([deleted], accountMap);
        return ok(`거래 ID '${entry_id}'가 삭제되었습니다.\n\n${detail}`);
      } catch (e) {
        return err(e);
      }
    }
  );

  // 7. 잔액표(자산/부채/자본 현황) 조회 도구 (구 6번에서 변경)
  server.tool(
    "whooing_balance_sheet",
    "잔액표(자산/부채/순자산 현황)를 조회합니다.",
    {
      start_date: z.string().optional().describe("시작일 (YYYYMMDD, 미지정 시 이번 달 1일)"),
      end_date: z.string().optional().describe("종료일 (YYYYMMDD, 미지정 시 오늘)"),
      section_id: z.string().optional().describe("섹션 ID (미지정 시 기본값 사용)"),
    },
    async ({ start_date, end_date, section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const startDate = start_date ?? firstDayOfMonth();
        const endDate = end_date ?? today();
        const balance = await client.getBalanceSheet(sectionId, startDate, endDate);
        const dateRange = `${startDate} ~ ${endDate}`;
        return ok(formatBalanceSheet(balance, dateRange));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 8. 손익 리포트(수입/지출 총계 및 순수익) 조회 도구
  server.tool(
    "whooing_pl_report",
    "손익 리포트(수입/지출 요약)를 조회합니다.",
    {
      start_date: z.string().optional().describe("시작일 (YYYYMMDD, 미지정 시 이번 달 1일)"),
      end_date: z.string().optional().describe("종료일 (YYYYMMDD, 미지정 시 오늘)"),
      section_id: z.string().optional().describe("섹션 ID (미지정 시 기본값 사용)"),
    },
    async ({ start_date, end_date, section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const startDate = start_date ?? firstDayOfMonth();
        const endDate = end_date ?? today();
        const pl = await client.getPLReport(sectionId, startDate, endDate);
        const dateRange = `${startDate} ~ ${endDate}`;
        return ok(formatPLReport(pl, dateRange));
      } catch (e) {
        return err(e);
      }
    }
  );
}
