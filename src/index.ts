import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WhooingClient } from "./client.js";
import { registerTools } from "./tools.js";
import type { WhooingConfig } from "./types.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`오류: 필수 환경변수 '${name}'가 설정되지 않았습니다.`);
    process.exit(1);
  }
  return value;
}

const config: WhooingConfig = {
  apiKey: requireEnv("WHOOING_API_KEY"),
  defaultSectionId: process.env.WHOOING_SECTION_ID,
};

const client = new WhooingClient(config);

const server = new McpServer({
  name: "whooing",
  version: "0.1.0",
});

registerTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
