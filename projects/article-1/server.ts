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
import {
  fetchRepo,
  fetchLanguages,
  fetchContributors,
  type AnalyzeRepoResult,
  type AnalyzeRepoError,
} from "./src/github.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UI_RESOURCE_URI = "ui://github-dashboard/mcp-app.html";
const UI_HTML_PATH = path.join(__dirname, "dist", "mcp-app.html");

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>hello_time placeholder</title>
  </head>
  <body style="font-family:system-ui;padding:2rem;color:#334155;">
    <h1 style="margin:0 0 1rem;font-size:1.25rem;">hello_time placeholder</h1>
    <p>
      Run <code>npm run build</code> to generate <code>dist/mcp-app.html</code>
      (see spec-001 task 3/4).
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
    name: "article-1-github-dashboard",
    version: "0.0.1",
  });

  registerAppTool(
    server,
    "hello_time",
    {
      title: "Hello Time",
      description:
        "Returns the current server time and renders it inside the MCP Apps iframe. Used in spec-001 as the minimal MCP Apps round-trip.",
      _meta: {
        ui: { resourceUri: UI_RESOURCE_URI },
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: new Date().toISOString(),
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "analyze_repo",
    {
      title: "Analyze GitHub Repository",
      description:
        "Fetches a GitHub public repository's star count, language breakdown, and top contributors, and renders them as a dashboard inside the MCP Apps iframe.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
      },
      _meta: {
        ui: { resourceUri: UI_RESOURCE_URI },
      },
    },
    async ({ owner, repo }) => {
      const [repoRes, langsRes, contribsRes] = await Promise.all([
        fetchRepo(owner, repo),
        fetchLanguages(owner, repo),
        fetchContributors(owner, repo),
      ]);

      const errorResult = (error: AnalyzeRepoError) => ({
        content: [
          {
            type: "text" as const,
            text: `GitHub API error (${error.code}): ${error.message}`,
          },
        ],
        structuredContent: { error },
        isError: true,
      });

      if (!repoRes.ok) return errorResult(repoRes.error);
      if (!langsRes.ok) return errorResult(langsRes.error);
      if (!contribsRes.ok) return errorResult(contribsRes.error);

      const totalBytes = Object.values(langsRes.data).reduce(
        (a, b) => a + b,
        0,
      );
      const languages = Object.entries(langsRes.data)
        .map(([name, bytes]) => ({
          name,
          percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage);

      const contributors = contribsRes.data.slice(0, 5).map((c) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions,
      }));

      const result: AnalyzeRepoResult = {
        owner,
        repo,
        stars: repoRes.data.stargazers_count,
        languages,
        contributors,
      };

      const topLang = languages[0];
      const summary = topLang
        ? `${owner}/${repo}: ${result.stars.toLocaleString()} stars, top language ${topLang.name} (${topLang.percentage.toFixed(1)}%), ${contributors.length} contributors`
        : `${owner}/${repo}: ${result.stars.toLocaleString()} stars, ${contributors.length} contributors`;

      return {
        content: [
          {
            type: "text" as const,
            text: summary,
          },
        ],
        structuredContent: result,
      };
    },
  );

  registerAppResource(
    server,
    "article-1 UI",
    UI_RESOURCE_URI,
    {
      description:
        "Article 1 UI resource. Renders hello_time and analyze_repo results.",
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
                connectDomains: ["https://api.github.com"],
                resourceDomains: ["https://avatars.githubusercontent.com"],
              },
            },
          },
        },
      ],
    }),
  );

  return server;
}

const app = createMcpExpressApp();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req, res) => {
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
    console.error("[article-1] handleRequest failed:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

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
    `[article-1] MCP server listening on http://localhost:${PORT}/mcp`,
  );
});
