const http = require("http");
const https = require("https");

// chatgpt2api's admin / account / register / system / logs routers are mounted
// under `BASE_PATH` (set to `/upstream` in docker-compose). The `/v1/*`
// OpenAI-compatible routes stay at the root, so we only prefix admin calls.
const ADMIN_BASE_PATH = "/upstream";

function getConfig() {
  const baseUrl = String(process.env.UPSTREAM_PROXY_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const authKey = String(process.env.CHATGPT2API_AUTH_KEY || "").trim();
  return { baseUrl, authKey };
}

function isConfigured() {
  const { baseUrl, authKey } = getConfig();
  return Boolean(baseUrl && authKey);
}

function buildAdminUrl(path, query = null) {
  const { baseUrl } = getConfig();
  if (!baseUrl) throw new Error("UPSTREAM_PROXY_BASE_URL is not configured");
  const clean = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${ADMIN_BASE_PATH}${clean}`, baseUrl);
  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      const str = String(value);
      if (!str) continue;
      url.searchParams.set(key, str);
    }
  }
  return url;
}

async function adminRequest(method, path, body = null, { timeoutMs = 60000, query = null } = {}) {
  const { authKey } = getConfig();
  if (!authKey) throw new Error("CHATGPT2API_AUTH_KEY is not configured");
  const url = buildAdminUrl(path, query);
  const transport = url.protocol === "https:" ? https : http;
  const bodyStr = body !== null && body !== undefined ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search || ""}`,
        headers: {
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {})
        },
        timeout: timeoutMs
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              data = { error: text.slice(0, 500) };
            }
          }
          resolve({ status: response.statusCode || 0, data });
        });
      }
    );
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy(new Error("Upstream admin API timeout"));
    });
    if (bodyStr) request.write(bodyStr);
    request.end();
  });
}

module.exports = { adminRequest, isConfigured, buildAdminUrl, getConfig };
