import type { Section, AccountsResult, AccountMap, Entry, BalanceSheet, PLResult } from "./types.js";

/**
 * 숫자를 한국어 원화(KRW) 형식의 문자열로 변환합니다. (예: 10,000원)
 * @param n 포맷할 숫자
 */
function formatAmount(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

/**
 * float 형태의 날짜 값(예: 20110817.0001)을 YYYY-MM-DD 문자열로 변환합니다.
 * 정수 부분(YYYYMMDD)만 추출하여 하이픈(-)을 추가합니다.
 * @param entryDate 변환할 날짜 값
 */
function formatEntryDate(entryDate: number): string {
  // entry_date는 20110817.0001 형태의 float 값입니다 — 정수 부분이 YYYYMMDD입니다.
  const yyyymmdd = Math.floor(entryDate).toString();
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * 섹션 목록을 Markdown 문자열 형태로 포맷팅합니다.
 */
export function formatSections(sections: Section[]): string {
  if (!sections || sections.length === 0) {
    return "등록된 섹션(가계부)이 없습니다.";
  }
  const lines = ["## 섹션 목록\n"];
  for (const s of sections) {
    lines.push(`- **${s.title}** (ID: \`${s.section_id}\`, 통화: ${s.currency ?? "KRW"})`);
  }
  return lines.join("\n");
}

const TYPE_LABEL: Record<string, string> = {
  assets: "자산",
  liabilities: "부채",
  income: "수입",
  expenses: "지출",
  capital: "자본",
};

/**
 * 대분류별로 그룹화된 계정 및 항목 목록을 Markdown 문자열로 변환합니다.
 */
export function formatAccounts(grouped: AccountsResult): string {
  const lines = ["## 계정/항목 목록\n"];
  for (const [type, accounts] of Object.entries(grouped)) {
    if (!accounts || accounts.length === 0) continue;
    const label = TYPE_LABEL[type] ?? type;
    lines.push(`### ${label}`);
    for (const acc of accounts) {
      lines.push(`- ${acc.title} (ID: \`${acc.account_id}\`)`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * 조회된 거래 내역 목록을 사람들이 읽기 쉬운 Markdown 목록으로 변환합니다.
 * @param entries 거래 내역 배열
 * @param accountMap 계정 ID를 이름으로 바꿔주기 위한 맵
 */
export function formatEntries(entries: Entry[], accountMap: AccountMap): string {
  if (!entries || entries.length === 0) {
    return "해당 기간에 거래가 없습니다.";
  }
  const lines = [`## 거래내역 (${entries.length}건)\n`];
  for (const e of entries) {
    const lName = accountMap.get(e.l_account_id)?.title ?? e.l_account_id;
    const rName = accountMap.get(e.r_account_id)?.title ?? e.r_account_id;
    const memo = e.memo ? ` — ${e.memo}` : "";
    lines.push(
      `- **${formatEntryDate(e.entry_date)}** ${e.item} | ${formatAmount(e.money)} | ${lName} ← ${rName}${memo} (ID: \`${e.entry_id}\`)`
    );
  }
  return lines.join("\n");
}

/**
 * 새롭게 입력된 거래 데이터를 읽기 쉬운 Markdown 결과로 출력합니다.
 * 작성 완료 메시지와 함께 주요 정보를 요약합니다.
 */
export function formatNewEntry(entry: Entry, accountMap: AccountMap): string {
  const lName = accountMap.get(entry.l_account_id)?.title ?? entry.l_account_id;
  const rName = accountMap.get(entry.r_account_id)?.title ?? entry.r_account_id;
  return [
    "## 거래 입력 완료\n",
    `- **날짜**: ${formatEntryDate(entry.entry_date)}`,
    `- **적요**: ${entry.item}`,
    `- **금액**: ${formatAmount(entry.money)}`,
    `- **차변 (L)**: ${lName}`,
    `- **대변 (R)**: ${rName}`,
    entry.memo ? `- **메모**: ${entry.memo}` : "",
    `- **거래 ID**: \`${entry.entry_id}\``,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 수정된 거래 데이터를 읽기 쉬운 Markdown 결과로 출력합니다.
 */
export function formatUpdatedEntry(entry: Entry, accountMap: AccountMap): string {
  const lName = accountMap.get(entry.l_account_id)?.title ?? entry.l_account_id;
  const rName = accountMap.get(entry.r_account_id)?.title ?? entry.r_account_id;
  return [
    "## 거래 수정 완료\n",
    `- **날짜**: ${formatEntryDate(entry.entry_date)}`,
    `- **적요**: ${entry.item}`,
    `- **금액**: ${formatAmount(entry.money)}`,
    `- **차변 (L)**: ${lName}`,
    `- **대변 (R)**: ${rName}`,
    entry.memo ? `- **메모**: ${entry.memo}` : "",
    `- **거래 ID**: \`${entry.entry_id}\``,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 잔액표(자산/부채/자본 현황) 정보를 Markdown 변환하여 출력합니다.
 */
export function formatBalanceSheet(balance: BalanceSheet, dateRange: string): string {
  return [
    `## 잔액표 (${dateRange})\n`,
    `- **자산**: ${formatAmount(balance.assets)}`,
    `- **부채**: ${formatAmount(balance.liabilities)}`,
    `- **순자산 (자본)**: ${formatAmount(balance.capital)}`,
  ].join("\n");
}

/**
 * 손익 리포트(수입/지출/Net 현황) 정보를 Markdown으로 변환하여 출력합니다.
 */
export function formatPLReport(pl: PLResult, dateRange: string): string {
  const netLabel = pl.net_income >= 0 ? "흑자" : "적자";
  return [
    `## 손익 리포트 (${dateRange})\n`,
    `- **수입**: ${formatAmount(pl.income)}`,
    `- **지출**: ${formatAmount(pl.expenses)}`,
    `- **손익 (수입 - 지출)**: ${formatAmount(pl.net_income)} (${netLabel})`,
  ].join("\n");
}
