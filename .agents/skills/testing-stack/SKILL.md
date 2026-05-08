---
name: testing-stack
description: Test the gpt-image-studio + chatgpt2api docker-compose stack end-to-end. Use when verifying the unified admin / single-port reverse-proxy flow, the credit / redeem-code system, or any change that touches `vendor/chatgpt2api/` mounted under `/upstream/*`.
---

# Testing the unified gpt-image-studio stack

This project ships a `docker-compose.yml` that brings up three services:

- `gpt-image-mysql` (MySQL 8) — pre-existing, exposes `0.0.0.0:3306` for host debugging.
- `gpt-image-chatgpt2api` (FastAPI + Next.js static export) — bound to `127.0.0.1:8080` only, intentionally not externally reachable.
- `gpt-image-app` (Node) — the only externally-exposed port (`0.0.0.0:3000`).

The app reverse-proxies `/upstream/*` to `chatgpt2api:80` over the docker network, gated by an admin session check (must be `role="admin"` AND `status="active"`). `/v1/*` stays at the root of `chatgpt2api:80` and is called by the app directly without path rewriting.

## Bringing up the stack

```bash
cd <repo-root>
cp .env.example .env
# At minimum override these (leave defaults at your own risk in prod):
sed -i 's/MYSQL_PASSWORD=change-me/MYSQL_PASSWORD=devin-test-pw/' .env
sed -i 's/ADMIN_PASSWORD=change-this-password/ADMIN_PASSWORD=DevinTest123!/' .env
docker compose up -d --build
```

First `--build` is slow (~2 minutes) because the chatgpt2api image runs `npm run build` for the Next.js static export. Subsequent rebuilds are cached unless `vendor/chatgpt2api/web/` changed.

Verify state:

```bash
docker compose ps                # all healthy / Up
docker port gpt-image-chatgpt2api  # MUST show "127.0.0.1:8080" only
docker port gpt-image-app          # "0.0.0.0:3000"
```

The admin user is auto-bootstrapped on first start using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. Defaults in `.env.example` are `admin@example.com` / `change-this-password`.

## Smoke-test routes via curl

All observed status codes for the unified-admin flow:

| Request | Expected |
|---|---|
| `GET /` | 200 (frontend) |
| `GET /admin` | 200 (login form if anonymous, dashboard otherwise) |
| `GET /upstream/` (anonymous, `Accept: text/html`) | 302 → `/admin?upstreamAuth=required` |
| `GET /upstream/api/...` (anonymous, `Accept: application/json`) | 403 |
| `GET /upstream/_next/...` (anonymous) | 403 (assets are gated too) |
| `GET /upstream` (admin, no trailing slash) | 308 → `/upstream/` |
| `GET /upstream/` (admin) | 200 (chatgpt2api Next.js index, with `/upstream/_next/...` URLs in HTML) |
| `GET /upstream/login/` (admin) | 200 (chatgpt2api login) |

Login to grab a session cookie:

```bash
curl -c /tmp/admin-cookies.txt \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"DevinTest123!"}' \
  http://localhost:3000/api/auth/login
```

Then reuse it:

```bash
curl -b /tmp/admin-cookies.txt http://localhost:3000/upstream/
```

From inside the app container, the upstream `/v1/*` is reachable at the root (no path rewriting):

```bash
docker exec gpt-image-app sh -c 'apk add --no-cache curl >/dev/null; curl -s -o /dev/null -w "%{http_code}" http://chatgpt2api:80/v1/models'
# expect 401 — route exists, no API key sent
```

## Browser walkthrough (recorded)

Before recording, maximize the browser window:

```bash
sudo apt-get install -y wmctrl 2>/dev/null
wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz
```

Then primary flow:

1. Visit `http://localhost:3000/`, dismiss the 内容合规管理公告 modal, click 登录, enter admin credentials.
2. Click 后台 in the header.
3. Verify 7 tabs: 生图记录 / 用户管理 / 卡密管理 / 积分流水 / 支付订单 / **上游管理** / 接口设置.
4. Click 上游管理 — iframe should render the chatgpt2api `欢迎回来` login.
5. Type `chatgpt2api` (or whatever `CHATGPT2API_AUTH_KEY` is set to) into the password field, click 登录. The iframe transitions to 号池管理.
6. Click 日志管理 inside the iframe — status bar should show `localhost:3000/upstream/logs/`. Confirms basePath baked into Next.js export and axios baseURL.
7. Logout from our admin (top-right 退出), navigate to `http://localhost:3000/upstream/` directly. Should redirect to `/admin?upstreamAuth=required` with no upstream content leaked.

## What you cannot test without external resources

- **Real image generation via `/v1/images/generations`** — needs a valid ChatGPT Plus cookie/token attached to the upstream pool. Without one, requests return 503 / no-account-available regardless of our code. The route itself is unchanged by the unified-admin work, so curl-reaching it (T7 above) is sufficient regression evidence.
- **HTTPS / nginx production config** — only relevant on a real server with a domain. `README.md` has an nginx example; the docker stack itself runs HTTP on `:3000`.
- **Multi-user concurrency / load** — out of scope for local dev box.

## Common pitfalls

- If `/upstream/` returns 200 but assets 404, the `NEXT_PUBLIC_BASE_PATH` build arg likely wasn't passed — re-build with `docker compose build chatgpt2api --no-cache`.
- If the iframe shows a blank page, check the browser console for CSP / frame-ancestors errors (we currently set no CSP, so it should just work; if it doesn't, that may have changed).
- If anonymous `/upstream/` gives 502/504 instead of 302, the proxy is forwarding before checking auth — auth check should always run first inside `handleUpstream` in `server.js`.
- The admin user is bootstrapped from `.env` on every container start; if you change `ADMIN_EMAIL` after first boot, the new user is created but the old one persists in MySQL.
- `docker compose down -v` drops the MySQL volume — destroys the admin user, redeem codes, and credit transactions. Use `docker compose down` (no `-v`) to keep state.

## Devin secrets needed

None for local testing. The `.env.example` defaults are sufficient. If testing real image generation on a server, you would need a ChatGPT Plus session cookie/token configured inside the chatgpt2api admin UI (under 上游管理 → 号池管理).
