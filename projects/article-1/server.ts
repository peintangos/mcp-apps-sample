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

  registerAppResource(
    server,
    "hello_time UI",
    UI_RESOURCE_URI,
    {
      description: "Minimal hello_time UI that renders the server time.",
    },
    async () => ({
      contents: [
        {
          uri: UI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await loadUiHtml(),
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
