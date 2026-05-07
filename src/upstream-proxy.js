const http = require("http");
const https = require("https");

// Hop-by-hop headers we never forward (per RFC 7230 §6.1).
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

function parseUpstream(rawUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function buildOutgoingHeaders(req, target) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const key = name.toLowerCase();
    if (HOP_BY_HOP.has(key)) continue;
    headers[name] = value;
  }
  headers.host = target.host;

  const original = req.headers["x-forwarded-for"];
  const remote = req.socket?.remoteAddress;
  if (remote) {
    headers["x-forwarded-for"] = original ? `${original}, ${remote}` : remote;
  }
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "http";
  headers["x-forwarded-host"] = req.headers.host || target.host;
  return headers;
}

// Reverse proxies any request whose path starts with `mountPath` to
// `upstreamBase`. The mount path is preserved 1:1 — chatgpt2api is built
// with NEXT_PUBLIC_BASE_PATH=<mountPath> and BASE_PATH=<mountPath> so the
// upstream itself owns routing under that prefix.
function createUpstreamProxy({ upstreamBase, mountPath, timeoutMs = 120000 }) {
  const target = parseUpstream(upstreamBase);
  if (!target) {
    return async function disabled(_req, res) {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Upstream proxy is not configured" }));
    };
  }

  const transport = target.protocol === "https:" ? https : http;

  return function proxy(req, res) {
    const incomingPath = req.url || "/";
    const stripped = incomingPath.startsWith(mountPath)
      ? incomingPath.slice(mountPath.length) || "/"
      : incomingPath;
    const targetPath = `${mountPath}${stripped === "/" ? "/" : stripped}`;

    const options = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: targetPath,
      headers: buildOutgoingHeaders(req, target)
    };

    const upstreamReq = transport.request(options, (upstreamRes) => {
      const headers = { ...upstreamRes.headers };
      delete headers["transfer-encoding"];
      res.writeHead(upstreamRes.statusCode || 502, headers);
      upstreamRes.pipe(res);
    });

    upstreamReq.setTimeout(timeoutMs, () => {
      upstreamReq.destroy(new Error("Upstream proxy timeout"));
    });

    upstreamReq.on("error", (error) => {
      console.error("upstream-proxy:", error.message || error);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Bad gateway" }));
      } else {
        res.destroy(error);
      }
    });

    req.on("aborted", () => upstreamReq.destroy());
    req.pipe(upstreamReq);
  };
}

module.exports = { createUpstreamProxy };
