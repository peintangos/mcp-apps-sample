import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { handleRegister, renderConsentScreen } from "./oauth.js";

type MockResponse = {
  headers: Record<string, string>;
  statusCode: number;
  body: unknown;
  response: Response;
};

function createMockResponse(): MockResponse {
  const state = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
  };

  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(payload: unknown) {
      state.body = payload;
      return response;
    },
    send(payload: unknown) {
      state.body = payload;
      return response;
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
      return response;
    },
  } as unknown as Response;

  return {
    get headers() {
      return state.headers;
    },
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    response,
  };
}

function createRequest(
  overrides: Partial<Request> = {},
): Request {
  const base = {
    protocol: "https",
    headers: {} as Record<string, string | undefined>,
    query: {},
    body: {},
    header(name: string): string | undefined {
      return (base.headers as Record<string, string | undefined>)[
        name.toLowerCase()
      ];
    },
  };
  return { ...base, ...overrides } as unknown as Request;
}

describe("oauth handlers", () => {
  it("returns the Article 4 fixed client id on dynamic client registration", () => {
    const req = createRequest({
      body: {
        redirect_uris: ["https://chat.openai.com/aip/callback"],
        client_name: "ChatGPT",
      },
    });
    const mock = createMockResponse();

    handleRegister(req, mock.response);

    expect(mock.statusCode).toBe(201);
    expect(mock.body).toMatchObject({
      client_id: "article-4-mcp-client",
      redirect_uris: ["https://chat.openai.com/aip/callback"],
      client_name: "ChatGPT",
      token_endpoint_auth_method: "none",
    });
  });

  it("renders an Article 4 branded consent screen", () => {
    const req = createRequest({
      query: {
        client_id: "article-4-mcp-client",
        redirect_uri: "https://chat.openai.com/aip/callback",
        response_type: "code",
        code_challenge: "pkce-challenge",
        code_challenge_method: "S256",
        state: "state-123",
      },
    });
    const mock = createMockResponse();

    renderConsentScreen(req, mock.response);

    expect(mock.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(mock.statusCode).toBe(200);
    expect(mock.body).toContain("<title>LLM Council のアクセス承認</title>");
    expect(mock.body).toContain("<h1>LLM Council</h1>");
    expect(mock.body).toContain('value="article-4-mcp-client"');
  });
});
