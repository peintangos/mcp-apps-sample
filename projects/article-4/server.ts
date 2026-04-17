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
import type { CouncilTranscript } from "./src/council.js";
import { runCouncil, summarizeCouncilFailure } from "./src/council.js";
import {
  registerOAuthRoutes,
  verifyAccessToken,
} from "./src/oauth.js";

const DEMO_MODE = Boolean(process.env.DEMO_MODE);

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
      const effectiveModel = DEMO_MODE ? "sonnet" : model;
      const result = await claudeProvider.ask(question, { model: effectiveModel });

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
      const effectiveModel = DEMO_MODE ? "flash" : model;
      const result = await geminiProvider.ask(question, { model: effectiveModel });

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

  registerAppTool(
    server,
    "start_council",
    {
      title: "Start LLM Council (ChatGPT 主催の合議)",
      description: `Start a 1-call pseudo-council on a user question. Call this tool whenever the user asks for a "council", says "合議して" / "Claude と Gemini で議論して" / "3 モデルで話し合って", or otherwise asks for multiple LLMs to weigh in on a decision.

The tool runs 2 rounds on the server in a single tool call:
- Round 1: your own initial answer (passed in as chatgpt_initial_answer) is recorded as-is. Claude (sonnet) and Gemini (flash) are called in parallel with the same raw question — each model answers independently without seeing your answer or each other's. This yields 3 independent initial answers.
- Round 2: Claude and Gemini are called again in parallel with a structured-evaluation prompt that shows all 3 Round 1 answers. Each returns a stance (agree/extend/partial/disagree) and a short reason based on whether the 3 Round 1 answers are consistent. If Round 1 failed for a provider, its Round 2 is skipped (error.code = "round1_failed").

The server then computes a consensus (unanimous_agree / mixed / unanimous_disagree) and returns a revision_prompt as the tool response's \`content\` field. The revision_prompt quotes all 3 Round 1 answers and the Round 2 stances, then instructs you (ChatGPT) to write your own Round 3 answer as your next chat message — the council never writes a final answer for you, you do.

Parameters:
- question: the user's question verbatim
- chatgpt_initial_answer: your own first-pass answer to the question (required, non-empty). This is recorded as your Round 1 entry and compared against Claude and Gemini's independent Round 1 answers.

Workflow: first answer the user's question yourself concisely in the chat, then immediately invoke start_council with that same answer as chatgpt_initial_answer. When the tool returns, read the revision_prompt in the content field and write your Round 3 revised answer as your next chat message. The iframe will display the full 3-speaker Round 1 + Round 2 stance transcript underneath.`,
      inputSchema: {
        question: z.string().describe("The user's question verbatim"),
        chatgpt_initial_answer: z
          .string()
          .describe(
            "Your own initial answer to the question. Required, non-empty. Recorded as your Round 1 entry, compared against Claude / Gemini independent Round 1 answers.",
          ),
      },
      _meta: { ui: { resourceUri: UI_RESOURCE_URI } },
    },
    async ({ question, chatgpt_initial_answer }) => {
      if (chatgpt_initial_answer.trim() === "") {
        return {
          content: [
            {
              type: "text" as const,
              text: "Council error (invalid_input): chatgpt_initial_answer must not be empty. Write your own initial answer first, then pass it in.",
            },
          ],
          structuredContent: {
            question,
            chatgpt_initial_answer,
            error: {
              code: "invalid_input",
              message:
                "chatgpt_initial_answer must not be empty. Write your own initial answer first, then pass it in.",
            },
          },
          isError: true,
        };
      }

      const missingKeys: string[] = [];
      if (!process.env.ANTHROPIC_API_KEY?.trim()) {
        missingKeys.push("ANTHROPIC_API_KEY");
      }
      if (!process.env.GOOGLE_API_KEY?.trim()) {
        missingKeys.push("GOOGLE_API_KEY");
      }
      if (missingKeys.length > 0) {
        const message = `Council requires both API keys but these are missing: ${missingKeys.join(", ")}. Set them in .env (see projects/article-4/.env.example).`;
        return {
          content: [
            {
              type: "text" as const,
              text: `Council error (unauthenticated): ${message}`,
            },
          ],
          structuredContent: {
            question,
            chatgpt_initial_answer,
            error: { code: "unauthenticated", message },
          },
          isError: true,
        };
      }

      const transcript: CouncilTranscript = await runCouncil(
        { question, chatgpt_initial_answer },
        { claude: claudeProvider, gemini: geminiProvider },
      );

      const round2 = transcript.rounds.find((r) => r.label === "round_2");
      const providerSpeakers = round2?.speakers ?? [];
      const allFailed =
        providerSpeakers.length > 0 &&
        providerSpeakers.every((s) => s.error !== undefined);

      if (allFailed) {
        const error = summarizeCouncilFailure(transcript);
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Council failed (${error.code}): ${error.message} ` +
                "See structuredContent.error.providers for details. " +
                "No revision prompt is available — you may retry later or continue with your initial answer.",
            },
          ],
          structuredContent: {
            ...transcript,
            error,
          },
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: transcript.revision_prompt,
          },
        ],
        structuredContent: transcript,
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

function normalizeMcpAcceptHeader(req: express.Request): void {
  const accept = req.headers.accept;
  let normalizedAccept: string | undefined;

  if (!accept) {
    normalizedAccept = "application/json, text/event-stream";
  } else if (
    (accept.includes("application/json") || accept.includes("*/*")) &&
    !accept.includes("text/event-stream")
  ) {
    normalizedAccept = "application/json, text/event-stream";
  }

  if (!normalizedAccept) {
    return;
  }

  req.headers.accept = normalizedAccept;

  const rawHeaders = req.rawHeaders;
  let patched = false;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (rawHeaders[i].toLowerCase() === "accept") {
      rawHeaders[i + 1] = normalizedAccept;
      patched = true;
      break;
    }
  }
  if (!patched) {
    rawHeaders.push("Accept", normalizedAccept);
  }
}

app.post(
  "/mcp",
  (req, res, next) => {
    if (oauthEnabled) return verifyAccessToken(req, res, next);
    next();
  },
  async (req, res) => {
    // ChatGPT's OAuth callback path can send an MCP initialize POST that only
    // advertises application/json. Relax that header to keep the SDK happy.
    normalizeMcpAcceptHeader(req);

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
