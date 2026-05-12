---
name: testing-stack
description: Test the gpt-image-studio + chatgpt2api docker-compose stack end-to-end. Use when verifying the native admin tabs (号池 / 调用日志 / 注册机 / 上游设置 / 备份) that talk to `vendor/chatgpt2api/` over the docker network, the credit / redeem-code system, or any change that touches `src/upstream-api-client.js` / `/api/admin/upstream/*`.
---

# Testing the unified gpt-image-studio stack

This project ships a `docker-compose.yml` that brings up three services:

- `gpt-image-mysql` (MySQL 8) — pre-existing, exposes `0.0.0.0:3306` for host debugging.
- `gpt-image-chatgpt2api` (FastAPI + Next.js static export) — bound to `127.0.0.1:8080` only, intentionally not externally reachable.
- `gpt-image-app` (Node) — the only externally-exposed port (`0.0.0.0:3000`).

The app exposes 号池 / 调用日志 / 注册机 / 上游设置 / 备份 as native admin tabs. Each tab calls `/api/admin/upstream/...` on the app, which forwards (with `Authorization: Bearer ${CHATGPT2API_AUTH_KEY}`) to `http://chatgpt2api:80/upstream/api/...` over the docker network. There is no more `/upstream/*` reverse proxy and no iframe. `/v1/*` still stays at the root of `chatgpt2api:80` and is called by the app directly without path rewriting.

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

All observed status codes for the native-admin flow:

| Request | Expected |
|---|---|
| `GET /` | 200 (frontend) |
| `GET /admin` | 200 (login form if anonymous, dashboard otherwise) |
| `GET /upstream/` | 404 (reverse proxy was removed in PR #12) |
| `GET /api/admin/upstream/accounts` (anonymous) | 401 |
| `GET /api/admin/upstream/logs` (anonymous) | 401 |
| `GET /api/admin/upstream/register` (anonymous) | 401 |
| `GET /api/admin/upstream/settings` (anonymous) | 401 |
| `GET /api/admin/upstream/backups` (anonymous) | 401 |

Login to grab a session cookie:

```bash
curl -c /tmp/admin-cookies.txt \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"DevinTest123!"}' \
  http://localhost:3000/api/auth/login
```

Then reuse it (each tab hits a different `/api/admin/upstream/*` endpoint):

```bash
curl -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/upstream/accounts
curl -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/upstream/register
curl -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/upstream/settings
curl -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/upstream/backups
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
3. Verify 10 tabs: 生图记录 / 用户管理 / 卡密管理 / 积分流水 / 支付订单 / **号池** / **调用日志** / **注册机** / **上游设置** / **备份** / 接口设置.
4. Click 号池 — native page renders with an empty list. Add one `access_token` via the form; should appear in the table.
5. Click 调用日志 — native page shows chatgpt2api's call log with filter / pagination / delete.
6. Click 注册机 — form with mode / total / threads / mail JSON + 启动 / 停止 / 重置 buttons. 启动 makes the status badge flip to 运行中 and stats update every ≤2s. 停止 returns to 已停止.
7. Click 上游设置 — JSON editor shows chatgpt2api's `config.json`. Edit → 保存 round-trips. Try 测试代理 with a blank URL → should return JSON result.
8. Click 备份 — table of existing backups (initially empty). Click 立即备份 → watch 状态 flip to 正在备份 then to a new row.
9. Sanity: navigate to `http://localhost:3000/upstream/` directly — should be 404 (proxy is gone).

## What you cannot test without external resources

- **Real image generation via `/v1/images/generations`** — needs a valid ChatGPT Plus cookie/token attached to the upstream pool. Without one, requests return 503 / no-account-available regardless of our code. The route itself is unchanged by the unified-admin work, so curl-reaching it (T7 above) is sufficient regression evidence.
- **HTTPS / nginx production config** — only relevant on a real server with a domain. `README.md` has an nginx example; the docker stack itself runs HTTP on `:3000`.
- **Multi-user concurrency / load** — out of scope for local dev box.

## Common pitfalls

- The `/api/admin/upstream/*` tabs return 503 if `UPSTREAM_PROXY_BASE_URL` or `CHATGPT2API_AUTH_KEY` is empty — check the app container env if the page shows "Upstream (chatgpt2api) is not configured".
- chatgpt2api still mounts admin APIs under `/upstream/api/*` (controlled by `BASE_PATH=/upstream` in compose). If you remove that env var, the app's admin tabs will all 404 with no obvious clue — the bearer-protected calls in `src/upstream-api-client.js` hard-code `ADMIN_BASE_PATH=/upstream`.
- The 注册机 tab polls every 2s while focused. If you see "register poll failed" in the JS console, it's almost always a session timeout — re-login and the polling resumes.
- The admin user is bootstrapped from `.env` on every container start; if you change `ADMIN_EMAIL` after first boot, the new user is created but the old one persists in MySQL.
- `docker compose down -v` drops the MySQL volume — destroys the admin user, redeem codes, and credit transactions. Use `docker compose down` (no `-v`) to keep state.

## Devin secrets needed

None for local testing. The `.env.example` defaults are sufficient. If testing real image generation on a server, you would need a ChatGPT Plus session cookie/token configured via the native 号池 tab (or the 注册机 tab can auto-acquire one).
