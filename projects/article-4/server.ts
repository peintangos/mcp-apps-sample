import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import cors from "cors";
import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import { claudeProvider } from "./src/providers/claude.js";
import { geminiProvider } from "./src/providers/gemini.js";
import type { ProviderError } from "./src/providers/types.js";
import {
  registerOAuthRoutes,
  verifyAccessToken,
} from "./src/oauth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UI_RESOURCE_URI = "ui://llm-council/mcp-app.html";
const UI_HTML_PATH = path.join(__dirname, "dist", "mcp-app.html");

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>ask_claude placeholder</title>
  </head>
  <body style="font-family:system-ui;padding:2rem;color:#334155;">
    <h1 style="margin:0 0 1rem;font-size:1.25rem;">ask_claude placeholder</h1>
    <p>
      Run <code>npm run build</code> to generate <code>dist/mcp-app.html</code>
      (see spec-001 task list).
    </p>
  </body>
</html>`;

async function loadUiHtml(): Promise<string> {
  try {
    return await readFile(UI_HTML_PATH, "utf-8");
  } catch {
    return FALLBACK_HTML;
  }
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "article-4-llm-council",
    version: "0.0.1",
  });

  registerAppTool(
    server,
    "ask_claude",
    {
      title: "Ask Claude (second opinion)",
      description: `Get a second opinion from Claude (Anthropic). Call this tool whenever the user asks for a "second opinion", says "Claude にも聞いて" / "Claude に相談" / "Claude と比較", asks "他のモデルはどう思う?", or otherwise signals they want Claude's view on something.

The tool forwards the question to Claude via the Anthropic API and renders Claude's answer as a rich Markdown card inside the chat. Your own answer to the user is already shown in the regular chat message above the iframe, so you do NOT need to duplicate it inside the tool.

Parameters:
- question: the question to forward (pass the user's original question verbatim)
- model: "sonnet" (default, fast) or "opus" (slower but deeper) — pick based on how hard the question is

Workflow: first answer the user's question yourself concisely in the chat, then immediately invoke this tool in the same turn. The iframe will render Claude's independent view underneath.`,
      inputSchema: {
        question: z.string().describe("The question to forward to Claude"),
        model: z
          .enum(["sonnet", "opus"])
          .optional()
          .describe("Which Claude model to use. Defaults to sonnet."),
      },
      _meta: { ui: { resourceUri: UI_RESOURCE_URI } },
    },
    async ({ question, model }) => {
      const result = await claudeProvider.ask(question, { model });

      const errorResult = (error: ProviderError) => ({
        content: [
          {
            type: "text" as const,
            text: `Claude API error (${error.code}): ${error.message}`,
          },
        ],
        structuredContent: {
          question,
          error,
        },
        isError: true,
      });

      if (!result.ok) return errorResult(result.error);

      return {
        content: [
          {
            type: "text" as const,
            text: result.data.text,
          },
        ],
        structuredContent: {
          question,
          claude_answer: result.data.text,
          model_used: result.data.modelUsed,
          latency_ms: result.data.latencyMs,
        },
      };
    },
  );

  registerAppTool(
    server,
    "ask_gemini",
    {
      title: "Ask Gemini (second opinion)",
      description: `Get a second opinion from Gemini (Google). Call this tool whenever the user asks for a "second opinion" from Gemini, says "Gemini にも聞いて" / "Gemini に相談" / "Gemini と比較", asks "Google のモデルはどう思う?", or otherwise signals they want Gemini's view on something.

The tool forwards the question to Gemini via the Google AI Studio API and renders Gemini's answer as a rich Markdown card inside the chat. Your own answer to the user is already shown in the regular chat message above the iframe, so you do NOT need to duplicate it inside the tool.

Parameters:
- question: the question to forward (pass the user's original question verbatim)
- model: "flash" (default, fast and cheap) or "pro" (slower but deeper) — pick based on how hard the question is

Workflow: first answer the user's question yourself concisely in the chat, then immediately invoke this tool in the same turn. The iframe will render Gemini's independent view underneath.`,
      inputSchema: {
        question: z.string().describe("The question to forward to Gemini"),
        model: z
          .enum(["flash", "pro"])
          .optional()
          .describe("Which Gemini model to use. Defaults to flash."),
      },
      _meta: { ui: { resourceUri: UI_RESOURCE_URI } },
    },
    async ({ question, model }) => {
      const result = await geminiProvider.ask(question, { model });

      const errorResult = (error: ProviderError) => ({
        content: [
          {
            type: "text" as const,
            text: `Gemini API error (${error.code}): ${error.message}`,
          },
        ],
        structuredContent: {
          question,
          error,
        },
        isError: true,
      });

      if (!result.ok) return errorResult(result.error);

      return {
        content: [
          {
            type: "text" as const,
            text: result.data.text,
          },
        ],
        structuredContent: {
          question,
          gemini_answer: result.data.text,
          model_used: result.data.modelUsed,
          latency_ms: result.data.latencyMs,
        },
      };
    },
  );

  registerAppResource(
    server,
    "Article 4 UI",
    UI_RESOURCE_URI,
    {
      description:
        "Article 4 UI resource. Renders the single-answer view for ask_claude / ask_gemini and the stance-based council timeline for start_council (tool-specific routing added in spec-004).",
    },
    async () => ({
      contents: [
        {
          uri: UI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await loadUiHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
          },
        },
      ],
    }),
  );

  return server;
}

// DNS rebinding 保護の設定:
// - 既定 (localhost バインド) では SDK が自動で localhost のみ許可
// - cloudflared トンネル経由で公開する時は ALLOWED_HOSTS にトンネルのホスト名を
//   カンマ区切りで渡す (例: ALLOWED_HOSTS="abc.trycloudflare.com")
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean)
  : undefined;

const app = createMcpExpressApp({
  host: process.env.MCP_HOST ?? "127.0.0.1",
  ...(allowedHosts ? { allowedHosts } : {}),
});
app.use(cors());
app.use(express.json());
// OAuth の /token と /authorize POST は form-encoded で送られてくるため併用
app.use(express.urlencoded({ extended: false }));

// OAuth 2.1 認可:
// - `OAUTH_OWNER_PASSWORD` が設定されていれば OAuth モードで起動し、
//   /.well-known/* /register /authorize /token をマウント、/mcp を保護する
// - 未設定ならローカル開発モードとして /mcp は無保護 (basic-host で簡単に叩けるように)
// - 公開ホスティング (Fly.io 等) では必ず OAUTH_OWNER_PASSWORD をセットする
const oauthEnabled = Boolean(process.env.OAUTH_OWNER_PASSWORD);
if (oauthEnabled) {
  registerOAuthRoutes(app);
  console.log("[article-4] OAuth 2.1 authorization server enabled");
} else {
  console.warn(
    "[article-4] ⚠️  OAUTH_OWNER_PASSWORD is not set. OAuth is disabled and /mcp is open. " +
      "This is OK for local development but NEVER for public deployment.",
  );
}

app.post(
  "/mcp",
  (req, res, next) => {
    if (oauthEnabled) return verifyAccessToken(req, res, next);
    next();
  },
  async (req, res) => {
    const server = createMcpServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (err) {
      console.error("[article-4] handleRequest failed:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  },
);

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(
    `[article-4] MCP server listening on http://localhost:${PORT}/mcp`,
  );
});
