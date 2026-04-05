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

function today(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`;
}

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[] };

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(e: unknown): ToolResult {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text", text: `오류: ${msg}` }] };
}

export function registerTools(server: McpServer, client: WhooingClient): void {
  // 1. List sections
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

  // 2. List accounts
  server.tool(
    "whooing_list_accounts",
    "지정한 섹션의 모든 계정/항목 목록을 조회합니다. (자산, 부채, 수입, 지출 계정)",
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

  // 3. List entries
  server.tool(
    "whooing_list_entries",
    "지정한 기간의 거래내역을 조회합니다. 날짜는 YYYYMMDD 형식입니다.",
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
        .max(500)
        .optional()
        .describe("최대 조회 건수 (기본 100, 최대 500)"),
      section_id: z
        .string()
        .optional()
        .describe("섹션 ID (미지정 시 기본값 사용)"),
    },
    async ({ start_date, end_date, limit, section_id }) => {
      try {
        const sectionId = client.resolveSectionId(section_id);
        const startDate = start_date ?? firstDayOfMonth();
        const endDate = end_date ?? today();
        const entries = await client.getEntries(sectionId, startDate, endDate, limit ?? 100);
        const accountMap = await client.loadAccountMap(sectionId);
        return ok(formatEntries(entries, accountMap));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 4. Add entry
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

        if (!accountMap.has(l_account_id)) {
          return err(
            new Error(
              `차변 계정 ID '${l_account_id}'를 찾을 수 없습니다. whooing_list_accounts로 올바른 ID를 확인하세요.`
            )
          );
        }
        if (!accountMap.has(r_account_id)) {
          return err(
            new Error(
              `대변 계정 ID '${r_account_id}'를 찾을 수 없습니다. whooing_list_accounts로 올바른 ID를 확인하세요.`
            )
          );
        }

        const entry = await client.addEntry(
          sectionId,
          entry_date,
          l_account_id,
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

  // 5. Update entry
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

        if (l_account_id && !accountMap.has(l_account_id)) {
          return err(
            new Error(
              `차변 계정 ID '${l_account_id}'를 찾을 수 없습니다.`
            )
          );
        }
        if (r_account_id && !accountMap.has(r_account_id)) {
          return err(
            new Error(
              `대변 계정 ID '${r_account_id}'를 찾을 수 없습니다.`
            )
          );
        }

        const entry = await client.updateEntry(sectionId, entry_id, {
          entry_date,
          l_account_id,
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

  // 6. Balance sheet
  server.tool(
    "whooing_balance_sheet",
    "잔액표(자산/부채 현황)를 조회합니다.",
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
        const [balance, accountMap] = await Promise.all([
          client.getBalanceSheet(sectionId, startDate, endDate),
          client.loadAccountMap(sectionId),
        ]);
        const dateRange = `${startDate} ~ ${endDate}`;
        return ok(formatBalanceSheet(balance, accountMap, dateRange));
      } catch (e) {
        return err(e);
      }
    }
  );

  // 7. P&L report
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
        const [pl, accountMap] = await Promise.all([
          client.getPLReport(sectionId, startDate, endDate),
          client.loadAccountMap(sectionId),
        ]);
        const dateRange = `${startDate} ~ ${endDate}`;
        return ok(formatPLReport(pl, accountMap, dateRange));
      } catch (e) {
        return err(e);
      }
    }
  );
}
