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
    fetchImpl = fetch,
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
