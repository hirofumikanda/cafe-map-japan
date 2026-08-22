import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = path.join(__dirname, "..", "public");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pmtiles": "application/octet-stream",
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
}

// リクエストパスをpublicDir配下に解決する。".."等でpublicDirの外へ出られないようにする。
function resolvePublicPath(publicDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.normalize(path.join(publicDir, relative));
  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
    return null;
  }
  return resolved;
}

// "bytes=start-end"形式のRangeヘッダを解析する。開始・終了のみ指定する形式にも対応する。
// spec: PMTilesの静的配信要件(HTTP Rangeリクエストに対応し206で応答する)。
function parseRange(rangeHeader, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? "");
  if (!match) {
    return null;
  }

  const [, startStr, endStr] = match;
  if (startStr === "" && endStr === "") {
    return null;
  }

  let start;
  let end;
  if (startStr === "") {
    const suffixLength = Number(endStr);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? fileSize - 1 : Number(endStr);
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
    return { unsatisfiable: true };
  }

  return { start, end: Math.min(end, fileSize - 1) };
}

async function handleRequest(publicDir, req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  const filePath = resolvePublicPath(publicDir, req.url ?? "/");
  if (!filePath) {
    res.writeHead(400).end();
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    res.writeHead(404).end();
    return;
  }
  if (!fileStat.isFile()) {
    res.writeHead(404).end();
    return;
  }

  const contentType = contentTypeFor(filePath);
  const range = parseRange(req.headers.range, fileStat.size);

  if (range?.unsatisfiable) {
    res
      .writeHead(416, {
        "Content-Range": `bytes */${fileStat.size}`,
        "Accept-Ranges": "bytes",
      })
      .end();
    return;
  }

  if (range) {
    const { start, end } = range;
    res.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      "Accept-Ranges": "bytes",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": fileStat.size,
    "Accept-Ranges": "bytes",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

export function createServer(publicDir = DEFAULT_PUBLIC_DIR) {
  return http.createServer((req, res) => {
    handleRequest(publicDir, req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end();
    });
  });
}

function main() {
  const port = Number(process.env.PORT ?? 8080);
  const publicDir = process.env.PUBLIC_DIR
    ? path.resolve(process.env.PUBLIC_DIR)
    : DEFAULT_PUBLIC_DIR;
  const server = createServer(publicDir);
  server.listen(port, () => {
    console.log(`Serving ${publicDir} at http://localhost:${port}/ (Accept-Ranges: bytes)`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
