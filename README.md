# whooing-mcp

[whooing.com](https://whooing.com) 복식부기 가계부를 Claude에서 직접 사용할 수 있는 MCP 서버입니다.

## 요구사항

- Node.js >= 22.0.0
- whooing.com 계정

## API 키 발급

whooing.com 로그인 후 **우측 상단 계정 > 비밀번호 및 보안 > [+AI 연동]** 버튼 클릭 → 인증키 발급

## 설치 및 빌드

```bash
git clone https://github.com/your-repo/whooing-mcp
cd whooing-mcp
npm install
npm run build
```

## Claude Code 설정

### Claude Code CLI

```bash
claude mcp add --scope user whooing /절대/경로/node /절대/경로/whooing/dist/index.js \
  -e WHOOING_API_KEY="발급받은_인증키" \
  -e WHOOING_SECTION_ID="기본_섹션_ID"
```

> `node` 경로는 `which node`로 확인합니다. macOS Homebrew 기준 `/opt/homebrew/bin/node`.  
> `--scope user`를 지정해야 모든 프로젝트에서 사용 가능합니다. 생략하면 현재 프로젝트에서만 동작합니다.

등록 후 새 CLI 세션을 열면 whooing 도구를 사용할 수 있습니다.

### Claude Desktop 앱

`~/Library/Application Support/Claude/claude_desktop_config.json`의 `mcpServers`에 추가합니다:

```json
{
  "mcpServers": {
    "whooing": {
      "command": "/절대/경로/node",
      "args": ["/절대/경로/whooing/dist/index.js"],
      "env": {
        "WHOOING_API_KEY": "발급받은_인증키",
        "WHOOING_SECTION_ID": "기본_섹션_ID"
      }
    }
  }
}
```

설정 후 Claude Desktop을 완전히 종료했다가 재시작합니다.

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `WHOOING_API_KEY` | 필수 | whooing AI 연동 인증키 |
| `WHOOING_SECTION_ID` | 선택 | 기본 섹션(가계부) ID |

## 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| `whooing_list_sections` | 모든 섹션(가계부) 목록 조회 |
| `whooing_list_accounts` | 계정/항목 목록 조회 (자산, 부채, 수입, 지출) |
| `whooing_list_entries` | 거래내역 조회 (기간 필터 지원) |
| `whooing_add_entry` | 새 거래 입력 |
| `whooing_update_entry` | 기존 거래 수정 |
| `whooing_balance_sheet` | 잔액표 조회 (자산/부채/순자산) |
| `whooing_pl_report` | 손익 리포트 조회 (수입/지출 요약) |
