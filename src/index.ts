import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WhooingClient } from "./client.js";
import { registerTools } from "./tools.js";
import type { WhooingConfig } from "./types.js";

/**
 * 필수 환경변수를 읽어오고, 없을 경우 프로그램을 오류로 종료하는 함수
 * @param name 환경변수 키 이름
 * @returns 설정된 환경변수 문자열 값
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`오류: 필수 환경변수 '${name}'가 설정되지 않았습니다.`);
    process.exit(1);
  }
  return value;
}

// Whooing API를 위한 설정 객체 (API 키는 필수, 기본 섹션 ID는 선택)
const config: WhooingConfig = {
  apiKey: requireEnv("WHOOING_API_KEY"),
  defaultSectionId: process.env.WHOOING_SECTION_ID,
};

// API 요청을 처리할 클라이언트 생성
const client = new WhooingClient(config);

// MCP(Model Context Protocol) 서버 인스턴스 생성
const server = new McpServer({
  name: "whooing",
  version: "0.1.0", // 서버 버전
});

// 클라이언트 객체와 함께 MCP 서버가 제공할 도구(Tools) 등록
registerTools(server, client);

// 표준 입출력(stdio) 기반으로 클라이언트-서버 간 통신 연결
const transport = new StdioServerTransport();
await server.connect(transport);
