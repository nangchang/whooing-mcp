import type { Section, AccountsResult, AccountMap, Entry, BalanceSheet, PLResult } from "./types.js";

function formatAmount(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

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

export function formatEntries(entries: Entry[], accountMap: AccountMap): string {
  if (!entries || entries.length === 0) {
    return "해당 기간에 거래가 없습니다.";
  }
  const lines = [`## 거래내역 (${entries.length}건)\n`];
  for (const e of entries) {
    const lName = accountMap.get(e.l_account_id) ?? e.l_account_id;
    const rName = accountMap.get(e.r_account_id) ?? e.r_account_id;
    const memo = e.memo ? ` — ${e.memo}` : "";
    lines.push(
      `- **${formatDate(e.entry_date)}** ${e.item} | ${formatAmount(e.money)} | ${lName} ← ${rName}${memo} (ID: \`${e.entry_id}\`)`
    );
  }
  return lines.join("\n");
}

export function formatNewEntry(entry: Entry, accountMap: AccountMap): string {
  const lName = accountMap.get(entry.l_account_id) ?? entry.l_account_id;
  const rName = accountMap.get(entry.r_account_id) ?? entry.r_account_id;
  return [
    "## 거래 입력 완료\n",
    `- **날짜**: ${formatDate(entry.entry_date)}`,
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

export function formatUpdatedEntry(entry: Entry, accountMap: AccountMap): string {
  const lName = accountMap.get(entry.l_account_id) ?? entry.l_account_id;
  const rName = accountMap.get(entry.r_account_id) ?? entry.r_account_id;
  return [
    "## 거래 수정 완료\n",
    `- **날짜**: ${formatDate(entry.entry_date)}`,
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

export function formatBalanceSheet(
  balance: BalanceSheet,
  accountMap: AccountMap,
  dateRange: string
): string {
  const lines = [`## 잔액표 (${dateRange})\n`];

  const renderGroup = (label: string, group: BalanceSheet["assets"] | undefined) => {
    if (!group) return;
    lines.push(`### ${label}: **${formatAmount(group.total)}**`);
    if (group.accounts && group.accounts.length > 0) {
      for (const acc of group.accounts) {
        const name = acc.title ?? accountMap.get(acc.account_id) ?? acc.account_id;
        lines.push(`  - ${name}: ${formatAmount(acc.total)}`);
      }
    }
    lines.push("");
  };

  renderGroup("자산", balance.assets);
  renderGroup("부채", balance.liabilities);
  if (balance.capital) {
    renderGroup("자본", balance.capital);
  }

  const net = (balance.assets?.total ?? 0) - (balance.liabilities?.total ?? 0);
  lines.push(`**순자산 (자산 - 부채): ${formatAmount(net)}**`);

  return lines.join("\n");
}

export function formatPLReport(
  pl: PLResult,
  accountMap: AccountMap,
  dateRange: string
): string {
  const lines = [`## 손익 리포트 (${dateRange})\n`];

  lines.push(`### 수입: **${formatAmount(pl.income_total)}**`);
  if (pl.income && pl.income.length > 0) {
    for (const cat of pl.income) {
      const name = cat.title ?? accountMap.get(cat.account_id) ?? cat.account_id;
      lines.push(`  - ${name}: ${formatAmount(cat.total)}`);
    }
  }
  lines.push("");

  lines.push(`### 지출: **${formatAmount(pl.expenses_total)}**`);
  if (pl.expenses && pl.expenses.length > 0) {
    for (const cat of pl.expenses) {
      const name = cat.title ?? accountMap.get(cat.account_id) ?? cat.account_id;
      lines.push(`  - ${name}: ${formatAmount(cat.total)}`);
    }
  }
  lines.push("");

  const netLabel = pl.net >= 0 ? "흑자" : "적자";
  lines.push(`**손익 (수입 - 지출): ${formatAmount(pl.net)} (${netLabel})**`);

  return lines.join("\n");
}
