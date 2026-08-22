import { spawn } from "node:child_process";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export class OverpassFetchError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "OverpassFetchError";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Node.jsの組み込みfetchは、開発環境によってはOverpass APIの運用元(Kumi Systems)の
// インフラへの接続がTCP接続の時点でタイムアウトすることがある一方、同じホストへ
// curl/wgetからは問題なく到達できる場合がある。そのため既定のHTTPクライアントには
// curlをサブプロセスとして呼び出す実装を用いる(fetch互換のResponseサブセットを返す)。
function curlFetch(url, { method = "GET", headers = {}, body, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("curl request aborted before it started"));
      return;
    }

    const args = ["-sS", "-X", method];
    for (const [key, value] of Object.entries(headers)) {
      args.push("-H", `${key}: ${value}`);
    }
    if (body !== undefined) {
      args.push("--data-binary", "@-");
    }
    // レスポンス本文の末尾にHTTPステータスコードを1行追記させ、後段で分離する。
    args.push("-w", "\n%{http_code}", url);

    const child = spawn("curl", args);
    const stdoutChunks = [];
    let stderr = "";

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const onAbort = () => child.kill("SIGTERM");
    signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (error) => {
      signal?.removeEventListener("abort", onAbort);
      if (error.code === "ENOENT") {
        reject(new Error("curl was not found. Install it first (see pipeline/README.md)."));
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);

      if (signal?.aborted) {
        reject(new Error("curl request aborted (timeout)"));
        return;
      }
      if (code !== 0) {
        reject(new Error(`curl exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      const output = Buffer.concat(stdoutChunks).toString("utf8");
      const separatorIndex = output.lastIndexOf("\n");
      const status = Number(output.slice(separatorIndex + 1));
      const responseBody = output.slice(0, separatorIndex);

      resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => JSON.parse(responseBody),
      });
    });

    if (body !== undefined) {
      child.stdin.write(body);
    }
    child.stdin.end();
  });
}

// 都道府県の行政境界(admin_level=4)に絞ってamenity=cafeのnode/way/relationを取得する。
// 全国一括クエリはOverpass APIのデフォルトタイムアウトやレート制限に抵触しやすいため、
// 都道府県単位に分割する(design.md Decision 1)。
export function buildQuery(prefectureCode, { timeoutSeconds = 180 } = {}) {
  return `[out:json][timeout:${timeoutSeconds}];
area["ISO3166-2"="${prefectureCode}"]["admin_level"="4"]->.pref;
(
  nwr["amenity"="cafe"](area.pref);
);
out center tags;`;
}

// prefecture単位でOverpass APIを呼び出す。失敗時は指数バックオフでリトライし、
// 最終的に失敗した場合はOverpassFetchErrorをthrowして呼び出し元に失敗を伝える。
export async function queryOverpass(prefecture, options = {}) {
  const {
    endpoint = OVERPASS_ENDPOINT,
    maxAttempts = 3,
    initialRetryDelayMs = 5000,
    requestTimeoutMs = 200_000,
    fetchImpl = curlFetch,
  } = options;

  const query = buildQuery(prefecture.code);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (!response.ok) {
        throw new OverpassFetchError(
          `Overpass API responded with status ${response.status} for ${prefecture.code}`,
        );
      }

      const data = await response.json();
      if (!Array.isArray(data.elements)) {
        throw new OverpassFetchError(
          `Overpass API response missing "elements" for ${prefecture.code}`,
        );
      }

      return data.elements;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(initialRetryDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  throw new OverpassFetchError(
    `Failed to fetch POIs for ${prefecture.code} after ${maxAttempts} attempts: ${lastError.message}`,
    { cause: lastError },
  );
}
