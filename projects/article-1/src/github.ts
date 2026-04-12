/**
 * 薄い GitHub REST API クライアント。
 *
 * 認証不要の公開エンドポイントのみ利用する。
 * `GITHUB_TOKEN` 環境変数があれば Authorization ヘッダに乗せて
 * rate limit を 60/h → 5000/h に引き上げる (任意)。
 *
 * エラーは throw せず `Result<T>` で返す。呼び出し側は `result.ok`
 * を見て分岐し、UI に構造化エラーとして転送する。
 */

const GITHUB_API_BASE = "https://api.github.com";

export type AnalyzeRepoResult = {
  owner: string;
  repo: string;
  stars: number;
  languages: Array<{ name: string; percentage: number }>;
  contributors: Array<{
    login: string;
    avatarUrl: string;
    contributions: number;
  }>;
};

export type AnalyzeRepoError =
  | { code: "not_found"; message: string }
  | { code: "rate_limited"; message: string; resetAt: string }
  | { code: "network_error"; message: string };

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AnalyzeRepoError };

export type GitHubRepo = {
  name: string;
  full_name: string;
  stargazers_count: number;
  description: string | null;
};

export type GitHubLanguages = Record<string, number>;

export type GitHubContributor = {
  login: string;
  avatar_url: string;
  contributions: number;
};

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "article-1-github-dashboard/0.0.1",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson<T>(url: string): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(url, { headers: getHeaders() });
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: {
        code: "not_found",
        message: `GitHub resource not found: ${url.replace(GITHUB_API_BASE, "")}`,
      },
    };
  }

  const remaining = response.headers.get("x-ratelimit-remaining");
  const isRateLimited =
    (response.status === 403 || response.status === 429) && remaining === "0";
  if (isRateLimited) {
    const reset = response.headers.get("x-ratelimit-reset");
    const resetAt = reset
      ? new Date(Number(reset) * 1000).toISOString()
      : "unknown";
    return {
      ok: false,
      error: {
        code: "rate_limited",
        message:
          "GitHub API rate limit reached. Set GITHUB_TOKEN to increase the limit.",
        resetAt,
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message: `HTTP ${response.status}: ${response.statusText}`,
      },
    };
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message: `Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
}

function encodeRepoPath(owner: string, repo: string): string {
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export async function fetchRepo(
  owner: string,
  repo: string,
): Promise<Result<GitHubRepo>> {
  return fetchJson<GitHubRepo>(
    `${GITHUB_API_BASE}/repos/${encodeRepoPath(owner, repo)}`,
  );
}

export async function fetchLanguages(
  owner: string,
  repo: string,
): Promise<Result<GitHubLanguages>> {
  return fetchJson<GitHubLanguages>(
    `${GITHUB_API_BASE}/repos/${encodeRepoPath(owner, repo)}/languages`,
  );
}

export async function fetchContributors(
  owner: string,
  repo: string,
): Promise<Result<GitHubContributor[]>> {
  return fetchJson<GitHubContributor[]>(
    `${GITHUB_API_BASE}/repos/${encodeRepoPath(owner, repo)}/contributors?per_page=5`,
  );
}
