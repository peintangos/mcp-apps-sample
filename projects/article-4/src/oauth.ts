/**
 * Minimal OAuth 2.1 Authorization Server for MCP.
 *
 * MCP 仕様 (spec-006 参照) が要求する最小限のフローだけを実装した自前 OAuth サーバー。
 * ChatGPT の Custom Connector は OAuth 選択時に以下のフローを自動で実行する:
 *
 *   1. GET /.well-known/oauth-protected-resource         — リソース側メタデータ
 *   2. GET /.well-known/oauth-authorization-server       — 認可サーバーメタデータ (RFC 8414)
 *   3. POST /register                                    — Dynamic Client Registration (RFC 7591)
 *   4. GET /authorize?...                                — 同意画面を描画
 *   5. POST /authorize                                   — パスワード入力 → code 発行 → redirect
 *   6. POST /token                                       — code + PKCE verifier → access_token (RFC 6749 + 7636)
 *   7. POST /mcp  with `Authorization: Bearer <token>`   — トークン検証して既存 MCP handler へ
 *
 * 設計の割り切り (spec-006 で合意済み):
 *  - ユーザー認証 = env の OAUTH_OWNER_PASSWORD を同意画面で入力するだけ
 *  - DCR で誰が register しても固定 client_id を返す
 *  - トークン形式 = 不透明なランダム文字列 (JWT ではない)
 *  - ストレージ = インメモリ Map + TTL (サーバー再起動で全部消える)
 *  - スコープ = 定義しない
 *  - リフレッシュトークン = 発行しない。access_token TTL は 24h
 *  - PKCE は S256 のみサポート (`plain` は拒否)
 */

import type { Express, NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

// ---- 定数 --------------------------------------------------------------

const CODE_TTL_MS = 10 * 60 * 1000; // authorization code: 10 分
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // access token: 24 時間
const FIXED_CLIENT_ID = "article-4-mcp-client";

// ---- 型 ----------------------------------------------------------------

type CodeEntry = {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  redirectUri: string;
  expiresAt: number;
};

type TokenEntry = {
  clientId: string;
  expiresAt: number;
};

// ---- ストレージ (インメモリ) -------------------------------------------

const codes = new Map<string, CodeEntry>();
const tokens = new Map<string, TokenEntry>();

function cleanupExpired<T extends { expiresAt: number }>(
  map: Map<string, T>,
): void {
  const now = Date.now();
  for (const [key, value] of map) {
    if (value.expiresAt < now) map.delete(key);
  }
}

// ---- ヘルパー ----------------------------------------------------------

function randomOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function constantTimeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyPKCE(verifier: string, expectedChallenge: string): boolean {
  // RFC 7636: code_challenge = BASE64URL(SHA256(code_verifier))
  const computed = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return constantTimeEqualString(computed, expectedChallenge);
}

function getIssuer(req: Request): string {
  // 優先順位: env > forwarded headers > host header
  const fromEnv = process.env.OAUTH_ISSUER;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ??
    req.protocol;
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    req.header("host") ??
    "localhost";
  return `${proto}://${host}`;
}

function escapeHtml(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- ハンドラ: ディスカバリ --------------------------------------------

/** RFC 8414 — OAuth authorization server metadata */
export function serveAuthServerMetadata(req: Request, res: Response): void {
  const issuer = getIssuer(req);
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [],
  });
}

/** RFC 9728 — OAuth protected resource metadata */
export function serveResourceMetadata(req: Request, res: Response): void {
  const issuer = getIssuer(req);
  res.json({
    resource: `${issuer}/mcp`,
    authorization_servers: [issuer],
    scopes_supported: [],
    bearer_methods_supported: ["header"],
  });
}

// ---- ハンドラ: Dynamic Client Registration -----------------------------

/** RFC 7591 — 誰が register しても固定 client_id を返す */
export function handleRegister(req: Request, res: Response): void {
  const body = (req.body ?? {}) as {
    redirect_uris?: string[];
    client_name?: string;
  };
  res.status(201).json({
    client_id: FIXED_CLIENT_ID,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: body.redirect_uris ?? [],
    client_name: body.client_name ?? "MCP Client",
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  });
}

// ---- ハンドラ: 同意画面 ------------------------------------------------

/** GET /authorize — パスワード入力フォームを描画 */
export function renderConsentScreen(req: Request, res: Response): void {
  const query = req.query as Record<string, string | undefined>;
  const {
    client_id,
    redirect_uri,
    response_type,
    code_challenge,
    code_challenge_method,
    state,
    scope,
  } = query;

  if (response_type !== "code") {
    res.status(400).send("unsupported_response_type");
    return;
  }
  if (!redirect_uri || typeof redirect_uri !== "string") {
    res.status(400).send("redirect_uri required");
    return;
  }
  if (!code_challenge || code_challenge_method !== "S256") {
    res.status(400).send("PKCE S256 required");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>LLM Council のアクセス承認</title>
  <style>
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #fffaf5 0%, #fef1ea 100%);
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: #1f1208;
    }
    .card {
      max-width: 26rem;
      width: 100%;
      background: #ffffff;
      border: 1px solid #fce3d1;
      border-left: 5px solid #d97757;
      border-radius: 0.75rem;
      padding: 1.75rem 1.5rem;
      box-shadow: 0 8px 28px rgba(217, 119, 87, 0.18);
      box-sizing: border-box;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      color: #c85a34;
      letter-spacing: -0.01em;
    }
    p.muted {
      margin: 0 0 1.25rem;
      color: #8a5a3c;
      font-size: 0.875rem;
      line-height: 1.6;
    }
    label {
      display: block;
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c85a34;
      margin-bottom: 0.375rem;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: 1px solid #fce3d1;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      box-sizing: border-box;
      font-family: inherit;
      color: #1f1208;
      background: #fffaf5;
    }
    input[type="password"]:focus {
      outline: 2px solid #d97757;
      outline-offset: 1px;
      background: #ffffff;
    }
    button {
      width: 100%;
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, #d97757 0%, #c85a34 100%);
      color: #ffffff;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.02em;
      box-shadow: 0 4px 12px rgba(217, 119, 87, 0.28);
    }
    button:hover {
      filter: brightness(1.05);
    }
    .details {
      margin-top: 1rem;
      padding: 0.75rem 0.875rem;
      background: #fef7f0;
      border: 1px solid #fce3d1;
      border-radius: 0.5rem;
      font-size: 0.6875rem;
      color: #8a5a3c;
      line-height: 1.6;
      word-break: break-all;
    }
    .details code {
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      color: #c85a34;
    }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/authorize">
    <h1>LLM Council</h1>
    <p class="muted">
      MCP クライアントがこのサーバーへのアクセスを要求しています。
      オーナー用パスワードを入力して承認してください。
    </p>

    <label for="password">オーナーパスワード</label>
    <input type="password" id="password" name="password" autofocus required>

    <input type="hidden" name="client_id" value="${escapeHtml(client_id)}">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge)}">
    <input type="hidden" name="code_challenge_method" value="S256">
    <input type="hidden" name="state" value="${escapeHtml(state)}">
    <input type="hidden" name="scope" value="${escapeHtml(scope)}">

    <button type="submit">Approve</button>

    <div class="details">
      <strong>Client:</strong> <code>${escapeHtml(client_id)}</code><br>
      <strong>Redirect:</strong> <code>${escapeHtml(redirect_uri)}</code>
    </div>
  </form>
</body>
</html>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(html);
}

/** POST /authorize — パスワード検証 → code 発行 → ChatGPT callback に redirect */
export function handleConsent(req: Request, res: Response): void {
  const body = (req.body ?? {}) as Record<string, string | undefined>;
  const {
    password,
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    state,
  } = body;

  const expectedPassword = process.env.OAUTH_OWNER_PASSWORD;
  if (!expectedPassword) {
    res.status(500).send("OAUTH_OWNER_PASSWORD is not configured on the server");
    return;
  }
  if (!password || !constantTimeEqualString(password, expectedPassword)) {
    res.status(401).send("Invalid password");
    return;
  }
  if (!redirect_uri || !code_challenge || code_challenge_method !== "S256") {
    res.status(400).send("Missing or invalid OAuth parameters");
    return;
  }

  cleanupExpired(codes);
  const code = randomOpaqueToken(32);
  codes.set(code, {
    clientId: client_id ?? FIXED_CLIENT_ID,
    codeChallenge: code_challenge,
    codeChallengeMethod: "S256",
    redirectUri: redirect_uri,
    expiresAt: Date.now() + CODE_TTL_MS,
  });

  let target: URL;
  try {
    target = new URL(redirect_uri);
  } catch {
    res.status(400).send("Invalid redirect_uri");
    return;
  }
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  res.redirect(302, target.toString());
}

// ---- ハンドラ: トークン発行 --------------------------------------------

/** POST /token — code + PKCE verifier → access_token */
export function exchangeCodeForToken(req: Request, res: Response): void {
  const body = (req.body ?? {}) as Record<string, string | undefined>;
  const { grant_type, code, redirect_uri, code_verifier } = body;

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }
  if (!code || !redirect_uri || !code_verifier) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "code, redirect_uri, code_verifier are required",
    });
    return;
  }

  cleanupExpired(codes);
  const entry = codes.get(code);
  if (!entry) {
    res
      .status(400)
      .json({ error: "invalid_grant", error_description: "code not found or expired" });
    return;
  }

  // どのエラーでも code は使い捨てにする (replay 防止)
  codes.delete(code);

  if (entry.redirectUri !== redirect_uri) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "redirect_uri mismatch",
    });
    return;
  }
  if (!verifyPKCE(code_verifier, entry.codeChallenge)) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "PKCE verification failed",
    });
    return;
  }

  cleanupExpired(tokens);
  const accessToken = randomOpaqueToken(32);
  tokens.set(accessToken, {
    clientId: entry.clientId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(TOKEN_TTL_MS / 1000),
    scope: "",
  });
}

// ---- ミドルウェア: access_token 検証 -----------------------------------

/** `/mcp` の手前に挟む。401 時は RFC 9728 準拠の WWW-Authenticate ヘッダを返す。 */
export function verifyAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  cleanupExpired(tokens);

  const sendChallenge = (errorCode: string, message: string): void => {
    const issuer = getIssuer(req);
    const metadataUrl = `${issuer}/.well-known/oauth-protected-resource`;
    res.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${metadataUrl}", error="${errorCode}"`,
    );
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message },
      id: null,
    });
  };

  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    sendChallenge("invalid_request", "Missing or malformed Authorization header");
    return;
  }
  const token = match[1];
  const entry = tokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    sendChallenge("invalid_token", "Access token is invalid or expired");
    return;
  }
  next();
}

// ---- マウント ----------------------------------------------------------

/**
 * OAuth 関連のルートを Express app に一括登録する。
 * `server.ts` は事前に `express.json()` と `express.urlencoded({ extended: false })`
 * をグローバルに mount しておく必要がある (/register は JSON、/token と /authorize
 * POST は form-encoded で送られてくるため)。
 */
export function registerOAuthRoutes(app: Express): void {
  app.get("/.well-known/oauth-authorization-server", serveAuthServerMetadata);
  app.get("/.well-known/oauth-protected-resource", serveResourceMetadata);
  app.post("/register", handleRegister);
  app.get("/authorize", renderConsentScreen);
  app.post("/authorize", handleConsent);
  app.post("/token", exchangeCodeForToken);
}
