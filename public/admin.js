const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null,
  firstRun: false,
  view: "records",
  settings: null,
  users: [],
  records: [],
  redeemCodes: [],
  redeemFilter: "",
  transactions: [],
  payments: [],
  accounts: [],
  logs: [],
  logsFilter: { type: "", start_date: "", end_date: "" },
  logsExpanded: new Set(),
  logsSelected: new Set(),
  logsHighlightPrompt: "",
  register: null,
  registerLogsCollapsed: false,
  upstreamSettings: null,
  upstreamSettingsDraft: "",
  upstreamSettingsDraftDirty: false,
  upstreamSettingsStorage: null,
  backups: null,
  backupsExpanded: new Set(),
  lastBatch: null
};

let registerPollTimer = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmt(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("#toastLayer").appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function renderLogin() {
  $("#logoutBtn").classList.add("hidden");
  $("#adminApp").innerHTML = `
    <section class="hero">
      <h1>后台管理</h1>
      <p>请使用管理员账号登录。管理员账号由服务器环境变量 ADMIN_EMAIL / ADMIN_PASSWORD 初始化，普通前台注册不会获得后台权限。</p>
    </section>
    <section class="card" style="max-width:460px">
      <h2>管理员登录</h2>
      <form id="loginForm" class="form">
        <label>邮箱<input id="emailInput" type="email" autocomplete="email" required></label>
        <label>密码<input id="passwordInput" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">登录后台</button>
        <a class="secondary" href="/" style="display:grid;place-items:center">回到前台注册/登录</a>
      </form>
    </section>
  `;
  $("#loginForm").addEventListener("submit", login);
}

function renderDenied() {
  $("#logoutBtn").classList.remove("hidden");
  $("#adminApp").innerHTML = `
    <section class="hero">
      <h1>没有后台权限</h1>
      <p>当前账号 ${escapeHtml(state.user?.email || "")} 不是管理员。</p>
    </section>
    <section class="card" style="max-width:520px">
      <button class="secondary" type="button" id="backHome">返回前台</button>
    </section>
  `;
  $("#backHome").addEventListener("click", () => {
    window.location.href = "/";
  });
}

function renderAdmin() {
  $("#logoutBtn").classList.remove("hidden");
  $("#adminApp").innerHTML = `
    <section class="hero">
      <h1>后台管理</h1>
      <p>管理用户、积分、接口设置，并查看生图审计记录、提示词、IP 和浏览器信息。</p>
    </section>
    <div class="tabs">
      <button class="secondary ${state.view === "records" ? "active" : ""}" data-view="records">生图记录</button>
      <button class="secondary ${state.view === "users" ? "active" : ""}" data-view="users">用户管理</button>
      <button class="secondary ${state.view === "redeem" ? "active" : ""}" data-view="redeem">卡密管理</button>
      <button class="secondary ${state.view === "transactions" ? "active" : ""}" data-view="transactions">积分流水</button>
      <button class="secondary ${state.view === "payments" ? "active" : ""}" data-view="payments">支付订单</button>
      <button class="secondary ${state.view === "accounts" ? "active" : ""}" data-view="accounts">号池</button>
      <button class="secondary ${state.view === "logs" ? "active" : ""}" data-view="logs">调用日志</button>
      <button class="secondary ${state.view === "register" ? "active" : ""}" data-view="register">注册机</button>
      <button class="secondary ${state.view === "upstreamSettings" ? "active" : ""}" data-view="upstreamSettings">上游设置</button>
      <button class="secondary ${state.view === "backups" ? "active" : ""}" data-view="backups">备份</button>
      <button class="secondary ${state.view === "settings" ? "active" : ""}" data-view="settings">接口设置</button>
    </div>
    <section id="panel"></section>
  `;
  $$("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      stopRegisterPolling();
      state.view = button.dataset.view;
      await loadPanel();
      renderAdmin();
      renderPanel();
    });
  });
  renderPanel();
}

function stopRegisterPolling() {
  if (registerPollTimer) {
    clearInterval(registerPollTimer);
    registerPollTimer = null;
  }
}

function startRegisterPolling() {
  stopRegisterPolling();
  // 2s aligns with chatgpt2api's own SSE cadence (0.5s) without hammering the
  // admin proxy. Polling stops on every tab switch via stopRegisterPolling().
  registerPollTimer = setInterval(async () => {
    if (state.view !== "register") {
      stopRegisterPolling();
      return;
    }
    try {
      const data = await api("/api/admin/upstream/register");
      state.register = data.register || null;
      renderRegister({ preserveFocus: true });
    } catch (error) {
      // Silent — toast spam is worse than briefly stale stats.
      console.warn("register poll failed:", error.message);
    }
  }, 2000);
}

function renderPanel() {
  if (state.view === "records") return renderRecords();
  if (state.view === "users") return renderUsers();
  if (state.view === "redeem") return renderRedeem();
  if (state.view === "transactions") return renderTransactions();
  if (state.view === "payments") return renderPayments();
  if (state.view === "accounts") return renderAccounts();
  if (state.view === "logs") return renderLogs();
  if (state.view === "register") return renderRegister();
  if (state.view === "upstreamSettings") return renderUpstreamSettings();
  if (state.view === "backups") return renderBackups();
  renderSettings();
}

// chatgpt2api stores account.status as one of these four Chinese strings:
//   "正常" (normal) / "限流" (rate-limited) /
//   "异常" (abnormal)  / "禁用"  (disabled)
const ACCOUNT_STATUSES = ["正常", "限流", "异常", "禁用"];

function accountStatusClass(status) {
  if (status === "正常") return "";
  if (status === "限流") return "warn";
  return "failed";
}

function tokenPreview(token) {
  const value = String(token || "");
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function renderAccounts() {
  const items = state.accounts || [];
  $("#panel").innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <h2>号池（chatgpt2api 账号）</h2>
          <p class="muted">原生管理 chatgpt2api 的 ChatGPT 账号池：增加 / 删除 access_token、刷新状态、编辑配额。</p>
        </div>
        <div class="upstream-header-actions">
          <button class="secondary" type="button" id="accountsRefreshBtn">全部刷新状态</button>
          <button class="primary" type="button" id="accountsAddBtn">添加账号</button>
        </div>
      </div>
      <div class="table-wrap">
        ${items.length ? `
          <table>
            <thead>
              <tr>
                <th>账号</th>
                <th>类型</th>
                <th>状态</th>
                <th>access_token</th>
                <th>session_token</th>
                <th>配额</th>
                <th>已用</th>
                <th>上次刷新</th>
                <th>错误</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.map((account) => {
                const statusValue = String(account.status || "");
                const statusLabel = statusValue || "-";
                const statusClass = accountStatusClass(statusValue);
                return `
                  <tr data-token="${escapeHtml(account.access_token || "")}">
                    <td><strong>${escapeHtml(account.email || account.name || "-")}</strong></td>
                    <td>${escapeHtml(account.type || "-")}</td>
                    <td><span class="status ${statusClass}">${escapeHtml(statusLabel)}</span></td>
                    <td><code>${escapeHtml(tokenPreview(account.access_token))}</code></td>
                    <td>${account.has_session_token ? `<code>${escapeHtml(tokenPreview(account.session_token || "")) || "已设置"}</code>` : `<span class="muted">未设置</span>`}</td>
                    <td>${account.quota ?? "-"}</td>
                    <td>${account.used ?? "-"}</td>
                    <td>${fmt(account.last_renewal_at || account.updated_at || account.created_at)}</td>
                    <td class="prompt-cell">${account.last_renewal_error ? `<span class="muted">${escapeHtml(String(account.last_renewal_error).slice(0, 120))}</span>` : ""}</td>
                    <td>
                      <button class="secondary" data-action="refresh" type="button">刷新</button>
                      <button class="secondary" data-action="edit" type="button">编辑</button>
                      <button class="secondary" data-action="delete" type="button">删除</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        ` : `<div class="empty">号池暂无账号。点击右上角「添加账号」开始。</div>`}
      </div>
    </div>
  `;

  $("#accountsRefreshBtn").addEventListener("click", () => refreshAccounts());
  $("#accountsAddBtn").addEventListener("click", () => openAddAccountDialog());
  $$("tr[data-token]").forEach((row) => {
    const token = row.dataset.token;
    $("[data-action='refresh']", row)?.addEventListener("click", () => refreshAccounts([token]));
    $("[data-action='edit']", row)?.addEventListener("click", () => openEditAccountDialog(token));
    $("[data-action='delete']", row)?.addEventListener("click", () => deleteAccounts([token]));
  });
}

async function refreshAccounts(accessTokens = []) {
  try {
    const data = await api("/api/admin/upstream/accounts/refresh", {
      method: "POST",
      body: JSON.stringify({ access_tokens: accessTokens })
    });
    if (Array.isArray(data.items)) {
      state.accounts = data.items;
      renderAccounts();
    } else {
      await loadPanel();
      renderAccounts();
    }
    toast(accessTokens.length ? "账号已刷新" : "已刷新全部账号");
  } catch (error) {
    toast(error.message);
  }
}

async function deleteAccounts(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  if (!window.confirm(`确认删除 ${tokens.length} 个账号？此操作不可撤销。`)) return;
  try {
    await api("/api/admin/upstream/accounts", {
      method: "DELETE",
      body: JSON.stringify({ tokens })
    });
    toast("已删除");
    await loadPanel();
    renderAccounts();
  } catch (error) {
    toast(error.message);
  }
}

function openAddAccountDialog() {
  const wrap = document.createElement("div");
  wrap.className = "toast-layer";
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.42);display:grid;place-items:center;z-index:60";
  wrap.innerHTML = `
    <div class="card" style="max-width:560px;width:90%">
      <h2 style="margin-top:0">添加账号</h2>
      <p class="muted">把 ChatGPT 网页登录后拿到的 <code>access_token</code> 粘贴进来，一行一个。也可以填 JSON（含 access_token + session_token），一行一个 JSON 对象。</p>
      <label>access_token / JSON（每行一条）<textarea id="addAccountText" rows="10" style="font-family:monospace;font-size:12px"></textarea></label>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
        <button class="secondary" type="button" id="addAccountCancel">取消</button>
        <button class="primary" type="button" id="addAccountSubmit">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  $("#addAccountCancel", wrap).addEventListener("click", () => wrap.remove());
  $("#addAccountSubmit", wrap).addEventListener("click", async () => {
    const raw = $("#addAccountText", wrap).value.trim();
    if (!raw) { toast("请粘贴至少一条 access_token"); return; }
    const tokens = [];
    const entries = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("{")) {
        try {
          const obj = JSON.parse(trimmed);
          if (obj && typeof obj.access_token === "string") {
            entries.push({ access_token: obj.access_token, session_token: obj.session_token });
            continue;
          }
        } catch { /* fall through */ }
      }
      tokens.push(trimmed);
    }
    if (tokens.length === 0 && entries.length === 0) { toast("没有可用的 access_token"); return; }
    try {
      const result = await api("/api/admin/upstream/accounts", {
        method: "POST",
        body: JSON.stringify({ tokens, entries })
      });
      toast(`成功导入 ${result.added ?? result.refreshed ?? (tokens.length + entries.length)} 条`);
      wrap.remove();
      await loadPanel();
      renderAccounts();
    } catch (error) {
      toast(error.message);
    }
  });
}

function openEditAccountDialog(token) {
  const account = (state.accounts || []).find((a) => a.access_token === token);
  if (!account) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.42);display:grid;place-items:center;z-index:60";
  wrap.innerHTML = `
    <div class="card" style="max-width:520px;width:90%">
      <h2 style="margin-top:0">编辑账号</h2>
      <p class="muted">${escapeHtml(account.email || account.name || "")} <code>${escapeHtml(tokenPreview(account.access_token))}</code></p>
      <label>状态
        <select id="editAccountStatus">
          ${ACCOUNT_STATUSES.map((value) => `
            <option value="${value}" ${account.status === value ? "selected" : ""}>${value}</option>
          `).join("")}
        </select>
      </label>
      <label>类型 <input id="editAccountType" value="${escapeHtml(account.type || "")}"></label>
      <label>配额 <input id="editAccountQuota" type="number" min="0" value="${Number(account.quota || 0)}"></label>
      <label>session_token（留空保持原值；想清除就直接清空再勾选下面）<textarea id="editAccountSession" rows="3" style="font-family:monospace;font-size:12px"></textarea></label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="editAccountSessionClear"> 清除 session_token</label>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
        <button class="secondary" type="button" id="editAccountCancel">取消</button>
        <button class="primary" type="button" id="editAccountSubmit">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  $("#editAccountCancel", wrap).addEventListener("click", () => wrap.remove());
  $("#editAccountSubmit", wrap).addEventListener("click", async () => {
    const payload = { access_token: token };
    payload.status = $("#editAccountStatus", wrap).value;
    const typeValue = $("#editAccountType", wrap).value.trim();
    if (typeValue) payload.type = typeValue;
    payload.quota = Number($("#editAccountQuota", wrap).value || 0);
    const sessionValue = $("#editAccountSession", wrap).value.trim();
    const clearSession = $("#editAccountSessionClear", wrap).checked;
    if (clearSession) payload.session_token = "";
    else if (sessionValue) payload.session_token = sessionValue;
    try {
      await api("/api/admin/upstream/accounts/update", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast("账号已更新");
      wrap.remove();
      await loadPanel();
      renderAccounts();
    } catch (error) {
      toast(error.message);
    }
  });
}

const TX_TYPE_LABELS = {
  register_bonus: "注册赠送",
  checkin: "签到",
  consume_generate: "生图消耗",
  consume_edit: "编辑消耗",
  consume: "消耗",
  refund_failure: "失败退款",
  refund_partial: "部分退款",
  topup_redeem: "卡密充值",
  topup_payment: "支付充值",
  admin_adjust: "管理员调整",
  credit: "积分变动"
};

function txLabel(type) {
  return TX_TYPE_LABELS[type] || type;
}

// chatgpt2api LogService writes two types: "call" (image/chat upstream calls)
// and "account" (account pool events: 限流、移除异常账号、新增账号 etc).
const LOG_TYPE_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "call", label: "上游调用" },
  { value: "account", label: "号池事件" }
];

const LOG_TYPE_LABELS = { call: "上游调用", account: "号池事件" };

function logTypeLabel(type) {
  return LOG_TYPE_LABELS[type] || type || "-";
}

function logTypeClass(type) {
  if (type === "call") return "";
  if (type === "account") return "warn";
  return "";
}

function logStatusClass(status) {
  if (!status) return "";
  return status === "failed" ? "failed" : "";
}

function logRowMatchesHighlight(item) {
  const needle = (state.logsHighlightPrompt || "").trim();
  if (!needle) return false;
  const requestText = String(item?.detail?.request_text || "");
  if (!requestText) return false;
  const haystack = requestText.toLowerCase();
  // chatgpt2api truncates request_text to ~1000 chars and collapses whitespace,
  // so do a substring match on a short prefix of the original prompt.
  const prefix = needle.slice(0, 60).toLowerCase();
  return Boolean(prefix) && haystack.includes(prefix);
}

function renderLogs() {
  const items = state.logs || [];
  const filter = state.logsFilter || { type: "", start_date: "", end_date: "" };
  const selectedCount = state.logsSelected ? state.logsSelected.size : 0;
  $("#panel").innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <h2>调用日志（chatgpt2api）</h2>
          <p class="muted">原生展示上游 <code>data/logs.jsonl</code> 的调用与号池事件。点击「详情」可展开完整 payload，支持按类型 / 日期筛选与批量删除。</p>
        </div>
        <div class="upstream-header-actions">
          <button class="secondary" type="button" id="logsRefreshBtn">刷新</button>
          <button class="secondary" type="button" id="logsDeleteBtn" ${selectedCount ? "" : "disabled"}>删除所选${selectedCount ? `（${selectedCount}）` : ""}</button>
        </div>
      </div>
      <form id="logsFilterForm" class="form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">
        <label style="flex:1 1 160px">类型
          <select id="logsTypeInput">
            ${LOG_TYPE_OPTIONS.map((opt) => `<option value="${escapeHtml(opt.value)}" ${filter.type === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`).join("")}
          </select>
        </label>
        <label style="flex:1 1 160px">起始日期
          <input id="logsStartDateInput" type="date" value="${escapeHtml(filter.start_date || "")}">
        </label>
        <label style="flex:1 1 160px">结束日期
          <input id="logsEndDateInput" type="date" value="${escapeHtml(filter.end_date || "")}">
        </label>
        <button class="primary" type="submit">应用</button>
        <button class="secondary" type="button" id="logsResetBtn">重置</button>
      </form>
      ${state.logsHighlightPrompt ? `<p class="muted" style="margin-bottom:10px">已根据生图记录 prompt 高亮匹配的上游调用（<code>request_text</code> 前 60 字匹配）。<button class="tiny" type="button" id="logsClearHighlight">清除高亮</button></p>` : ""}
      <div class="table-wrap">
        ${items.length ? `
          <table>
            <thead>
              <tr>
                <th style="width:32px"><input type="checkbox" id="logsSelectAll"></th>
                <th>时间</th>
                <th>类型</th>
                <th>摘要</th>
                <th>模型</th>
                <th>端点</th>
                <th>状态</th>
                <th>耗时</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => {
                const id = String(item.id || "");
                const detail = item.detail || {};
                const expanded = state.logsExpanded.has(id);
                const selected = state.logsSelected.has(id);
                const highlight = logRowMatchesHighlight(item);
                const statusValue = String(detail.status || "");
                const duration = detail.duration_ms !== undefined && detail.duration_ms !== null
                  ? `${Number(detail.duration_ms)}ms`
                  : "-";
                return `
                  <tr data-log-id="${escapeHtml(id)}" ${highlight ? `style="background:#fef9c3"` : ""}>
                    <td><input type="checkbox" class="log-select" ${selected ? "checked" : ""}></td>
                    <td>${escapeHtml(item.time || "-")}</td>
                    <td><span class="status ${logTypeClass(item.type)}">${escapeHtml(logTypeLabel(item.type))}</span></td>
                    <td class="prompt-cell">${escapeHtml(item.summary || "-")}${detail.error ? `<br><span class="muted">错误：${escapeHtml(String(detail.error).slice(0, 160))}</span>` : ""}</td>
                    <td>${escapeHtml(detail.model || "-")}</td>
                    <td>${escapeHtml(detail.endpoint || "-")}</td>
                    <td>${statusValue ? `<span class="status ${logStatusClass(statusValue)}">${escapeHtml(statusValue)}</span>` : "-"}</td>
                    <td>${escapeHtml(duration)}</td>
                    <td><button class="tiny" type="button" data-action="toggle-detail">${expanded ? "收起" : "详情"}</button></td>
                  </tr>
                  ${expanded ? `<tr class="log-detail-row"><td></td><td colspan="8"><pre style="white-space:pre-wrap;word-break:break-word;background:var(--surface, #f8fafc);padding:10px;border-radius:8px;font-size:12px;margin:0;max-height:320px;overflow:auto">${escapeHtml(JSON.stringify(item, null, 2))}</pre></td></tr>` : ""}
                `;
              }).join("")}
            </tbody>
          </table>
        ` : `<div class="empty">暂无日志记录${filter.type || filter.start_date || filter.end_date ? "（当前筛选条件下）" : ""}</div>`}
      </div>
    </div>
  `;

  $("#logsRefreshBtn").addEventListener("click", async () => {
    await loadPanel();
    renderLogs();
  });
  $("#logsFilterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    state.logsFilter = {
      type: $("#logsTypeInput").value || "",
      start_date: $("#logsStartDateInput").value || "",
      end_date: $("#logsEndDateInput").value || ""
    };
    state.logsExpanded = new Set();
    state.logsSelected = new Set();
    await loadPanel();
    renderLogs();
  });
  $("#logsResetBtn").addEventListener("click", async () => {
    state.logsFilter = { type: "", start_date: "", end_date: "" };
    state.logsHighlightPrompt = "";
    state.logsExpanded = new Set();
    state.logsSelected = new Set();
    await loadPanel();
    renderLogs();
  });
  $("#logsClearHighlight")?.addEventListener("click", () => {
    state.logsHighlightPrompt = "";
    renderLogs();
  });
  $("#logsSelectAll")?.addEventListener("change", (event) => {
    if (event.target.checked) {
      state.logsSelected = new Set(items.map((item) => String(item.id || "")).filter(Boolean));
    } else {
      state.logsSelected = new Set();
    }
    renderLogs();
  });
  $("#logsDeleteBtn").addEventListener("click", () => deleteSelectedLogs());
  $$("tr[data-log-id]").forEach((row) => {
    const id = row.dataset.logId;
    $(".log-select", row)?.addEventListener("change", (event) => {
      if (event.target.checked) state.logsSelected.add(id);
      else state.logsSelected.delete(id);
      renderLogs();
    });
    $("button[data-action='toggle-detail']", row)?.addEventListener("click", () => {
      if (state.logsExpanded.has(id)) state.logsExpanded.delete(id);
      else state.logsExpanded.add(id);
      renderLogs();
    });
  });
}

async function deleteSelectedLogs() {
  const ids = [...state.logsSelected];
  if (ids.length === 0) return;
  if (!window.confirm(`确认删除 ${ids.length} 条日志？此操作不可撤销。`)) return;
  try {
    await api("/api/admin/upstream/logs/delete", {
      method: "POST",
      body: JSON.stringify({ ids })
    });
    toast(`已删除 ${ids.length} 条日志`);
    state.logsSelected = new Set();
    state.logsExpanded = new Set();
    await loadPanel();
    renderLogs();
  } catch (error) {
    toast(error.message);
  }
}

// ---------- 注册机 ----------
const REGISTER_MODE_LABELS = {
  total: "按总数",
  quota: "按累计配额",
  available: "按可用配额"
};

function renderRegister({ preserveFocus = false } = {}) {
  const reg = state.register || {};
  const stats = reg.stats || {};
  const mail = reg.mail || {};
  const mailJson = mail && typeof mail === "object" ? JSON.stringify(mail, null, 2) : "";
  const logs = Array.isArray(reg.logs) ? reg.logs : [];
  const enabled = Boolean(reg.enabled);
  // Preserve mail textarea focus across the 2s polling rerender — without this
  // the user can't edit mail JSON because every poll wipes their selection.
  const mailFocused = preserveFocus && document.activeElement && document.activeElement.id === "regMail";
  const mailSelStart = mailFocused ? document.activeElement.selectionStart : null;
  const mailSelEnd = mailFocused ? document.activeElement.selectionEnd : null;

  $("#panel").innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <h2>注册机（chatgpt2api）</h2>
          <p class="muted">驱动 chatgpt2api 内置的 ChatGPT 注册流程：按总数 / 累计配额 / 可用配额三种模式拉号，统计 + 日志通过本页面每 2 秒轮询展示。修改邮件提供商 / 代理 / 总数 / 线程数 / 模式后请点「保存配置」。</p>
        </div>
        <div class="upstream-header-actions">
          <span class="status ${enabled ? "warn" : ""}">${enabled ? "运行中" : "已停止"}</span>
        </div>
      </div>
      <form id="regForm" class="form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:flex-end">
        <label>模式
          <select id="regMode">
            ${Object.entries(REGISTER_MODE_LABELS).map(([value, label]) => `<option value="${escapeHtml(value)}" ${reg.mode === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
          </select>
        </label>
        <label>总数
          <input id="regTotal" type="number" min="1" value="${Number(reg.total || 10)}">
        </label>
        <label>目标累计配额
          <input id="regTargetQuota" type="number" min="1" value="${Number(reg.target_quota || 100)}">
        </label>
        <label>目标可用号
          <input id="regTargetAvailable" type="number" min="1" value="${Number(reg.target_available || 10)}">
        </label>
        <label>线程数
          <input id="regThreads" type="number" min="1" max="20" value="${Number(reg.threads || 3)}">
        </label>
        <label>检查间隔（秒）
          <input id="regCheckInterval" type="number" min="1" value="${Number(reg.check_interval || 5)}">
        </label>
        <label style="grid-column:1 / -1">代理（http://user:pass@host:port，留空走直连）
          <input id="regProxy" value="${escapeHtml(String(reg.proxy || ""))}">
        </label>
        <label style="grid-column:1 / -1">邮件提供商 JSON
          <textarea id="regMail" rows="6" style="font-family:monospace;font-size:12px">${escapeHtml(mailJson)}</textarea>
        </label>
        <div style="grid-column:1 / -1;display:flex;gap:10px;flex-wrap:wrap">
          <button class="primary" type="submit">保存配置</button>
          <button class="secondary" type="button" id="regStart" ${enabled ? "disabled" : ""}>启动</button>
          <button class="secondary" type="button" id="regStop" ${enabled ? "" : "disabled"}>停止</button>
          <button class="secondary" type="button" id="regReset">重置统计</button>
          <button class="secondary" type="button" id="regRefresh">手动刷新</button>
        </div>
      </form>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px">
        <div class="card" style="padding:10px"><div class="muted">完成 / 计划</div><div style="font-size:18px;font-weight:600">${Number(stats.done || 0)} / ${Number(reg.total || 0)}</div></div>
        <div class="card" style="padding:10px"><div class="muted">成功 / 失败</div><div style="font-size:18px;font-weight:600">${Number(stats.success || 0)} / ${Number(stats.fail || 0)}</div></div>
        <div class="card" style="padding:10px"><div class="muted">运行中</div><div style="font-size:18px;font-weight:600">${Number(stats.running || 0)}</div></div>
        <div class="card" style="padding:10px"><div class="muted">线程</div><div style="font-size:18px;font-weight:600">${Number(stats.threads || reg.threads || 0)}</div></div>
        <div class="card" style="padding:10px"><div class="muted">当前累计配额</div><div style="font-size:18px;font-weight:600">${Number(stats.current_quota || 0)}</div></div>
        <div class="card" style="padding:10px"><div class="muted">当前可用号</div><div style="font-size:18px;font-weight:600">${Number(stats.current_available || 0)}</div></div>
        <div class="card" style="padding:10px"><div class="muted">平均耗时（秒）</div><div style="font-size:18px;font-weight:600">${Number(stats.avg_seconds || 0).toFixed(1)}</div></div>
        <div class="card" style="padding:10px"><div class="muted">成功率</div><div style="font-size:18px;font-weight:600">${(Number(stats.success_rate || 0) * 100).toFixed(1)}%</div></div>
      </div>
      <div style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong>注册日志</strong>
          <span class="muted">最近 ${logs.length} 条（chatgpt2api 服务端只保留最近 300 条）</span>
        </div>
        <div class="table-wrap" style="max-height:320px">
          ${logs.length ? `
            <table>
              <thead>
                <tr><th style="width:160px">时间</th><th>消息</th></tr>
              </thead>
              <tbody>
                ${logs.slice().reverse().map((entry) => `
                  <tr>
                    <td>${escapeHtml(String(entry.ts || entry.time || ""))}</td>
                    <td style="color:${escapeHtml(entry.color === "red" ? "#b42318" : entry.color === "yellow" ? "#b45309" : "#0f172a")}">${escapeHtml(String(entry.text || ""))}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : `<div class="empty">${enabled ? "运行中，等待第一条日志…" : "暂无日志，点击「启动」开始"}</div>`}
        </div>
      </div>
    </div>
  `;
  if (mailFocused) {
    const ta = $("#regMail");
    if (ta) {
      ta.focus();
      if (mailSelStart != null) ta.setSelectionRange(mailSelStart, mailSelEnd);
    }
  }
  $("#regForm").addEventListener("submit", saveRegisterConfig);
  $("#regStart").addEventListener("click", () => registerLifecycle("start"));
  $("#regStop").addEventListener("click", () => registerLifecycle("stop"));
  $("#regReset").addEventListener("click", () => registerLifecycle("reset"));
  $("#regRefresh").addEventListener("click", async () => {
    await loadPanel();
    renderRegister();
  });
}

async function saveRegisterConfig(event) {
  event.preventDefault();
  let mailJson;
  try {
    const raw = $("#regMail").value.trim();
    mailJson = raw ? JSON.parse(raw) : {};
  } catch (error) {
    toast(`邮件 JSON 解析失败：${error.message}`);
    return;
  }
  const payload = {
    mode: $("#regMode").value,
    total: Number($("#regTotal").value || 0),
    threads: Number($("#regThreads").value || 0),
    target_quota: Number($("#regTargetQuota").value || 0),
    target_available: Number($("#regTargetAvailable").value || 0),
    check_interval: Number($("#regCheckInterval").value || 0),
    proxy: $("#regProxy").value.trim(),
    mail: mailJson
  };
  try {
    const data = await api("/api/admin/upstream/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.register = data.register || null;
    toast("注册机配置已保存");
    renderRegister();
  } catch (error) {
    toast(error.message);
  }
}

async function registerLifecycle(action) {
  if (action === "reset" && !window.confirm("确认重置注册机统计与日志？")) return;
  try {
    const data = await api(`/api/admin/upstream/register/${action}`, { method: "POST" });
    state.register = data.register || null;
    toast({ start: "注册任务已启动", stop: "已请求停止", reset: "统计已重置" }[action] || "操作成功");
    if (action === "start") startRegisterPolling();
    if (action === "stop") stopRegisterPolling();
    renderRegister();
  } catch (error) {
    toast(error.message);
  }
}

// ---------- 上游系统设置 ----------
function renderUpstreamSettings() {
  const draft = state.upstreamSettingsDraft || "";
  const storage = state.upstreamSettingsStorage || {};
  const backend = storage.backend || {};
  const health = storage.health || {};
  const proxy = state.upstreamSettings && typeof state.upstreamSettings.proxy === "string" ? state.upstreamSettings.proxy : "";

  $("#panel").innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <h2>上游系统设置（chatgpt2api）</h2>
          <p class="muted">直接编辑 chatgpt2api 的全局 <code>config.json</code>。常用字段：<code>proxy</code>（出口代理）、<code>refresh_account_interval_minute</code>（号池刷新间隔）、<code>image_retention_days</code>（生成图保留天数）、<code>auto_remove_invalid_accounts</code>、<code>auto_remove_rate_limited_accounts</code>、<code>sensitive_words</code>、<code>ai_review</code>、<code>backup</code>、<code>storage</code> 等。保存后即时生效。</p>
        </div>
        <div class="upstream-header-actions">
          <button class="secondary" type="button" id="upSettingsReload">重新加载</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 280px;gap:14px;align-items:flex-start">
        <div>
          <label style="display:flex;flex-direction:column;gap:4px">
            <span>config.json (JSON, 可编辑)</span>
            <textarea id="upSettingsTextarea" rows="24" style="font-family:monospace;font-size:12px;width:100%;min-height:360px">${escapeHtml(draft)}</textarea>
          </label>
          <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
            <button class="primary" type="button" id="upSettingsSave">保存</button>
            <button class="secondary" type="button" id="upSettingsFormat">格式化</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card" style="padding:10px">
            <strong>代理测试</strong>
            <label style="margin-top:6px">URL（留空就用 config 里 <code>proxy</code> = <code>${escapeHtml(proxy || "（空）")}</code>）
              <input id="proxyTestUrl" placeholder="${escapeHtml(proxy || "http://user:pass@host:port")}">
            </label>
            <button class="secondary" type="button" id="proxyTestBtn" style="margin-top:6px">测试代理</button>
            <pre id="proxyTestResult" class="muted" style="margin-top:6px;font-size:12px;background:#f8fafc;padding:8px;border-radius:6px;white-space:pre-wrap;min-height:40px"></pre>
          </div>
          <div class="card" style="padding:10px">
            <strong>存储后端</strong>
            <p class="muted" style="margin:6px 0">后端 <code>${escapeHtml(String(backend.kind || backend.type || backend.name || "json"))}</code>，状态 ${escapeHtml(String(health.status || "unknown"))}${health.message ? `：${escapeHtml(String(health.message))}` : ""}</p>
            <pre style="font-size:11px;background:#f8fafc;padding:8px;border-radius:6px;white-space:pre-wrap;max-height:200px;overflow:auto">${escapeHtml(JSON.stringify({ backend, health }, null, 2))}</pre>
          </div>
        </div>
      </div>
    </div>
  `;
  $("#upSettingsReload").addEventListener("click", async () => { await loadPanel(); renderUpstreamSettings(); });
  $("#upSettingsTextarea").addEventListener("input", (event) => {
    state.upstreamSettingsDraft = event.target.value;
    state.upstreamSettingsDraftDirty = true;
  });
  $("#upSettingsFormat").addEventListener("click", () => {
    try {
      const parsed = JSON.parse(state.upstreamSettingsDraft || "{}");
      state.upstreamSettingsDraft = JSON.stringify(parsed, null, 2);
      renderUpstreamSettings();
    } catch (error) {
      toast(`JSON 格式错误：${error.message}`);
    }
  });
  $("#upSettingsSave").addEventListener("click", saveUpstreamSettings);
  $("#proxyTestBtn").addEventListener("click", runProxyTest);
}

async function saveUpstreamSettings() {
  let parsed;
  try {
    parsed = JSON.parse(state.upstreamSettingsDraft || "{}");
  } catch (error) {
    toast(`JSON 格式错误：${error.message}`);
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    toast("配置必须是 JSON 对象");
    return;
  }
  try {
    const data = await api("/api/admin/upstream/settings", {
      method: "POST",
      body: JSON.stringify(parsed)
    });
    state.upstreamSettings = data && data.config ? data.config : parsed;
    state.upstreamSettingsDraft = JSON.stringify(state.upstreamSettings, null, 2);
    state.upstreamSettingsDraftDirty = false;
    toast("上游设置已保存");
    renderUpstreamSettings();
  } catch (error) {
    toast(error.message);
  }
}

async function runProxyTest() {
  const url = $("#proxyTestUrl").value.trim();
  const out = $("#proxyTestResult");
  out.textContent = "测试中…";
  try {
    const data = await api("/api/admin/upstream/proxy/test", {
      method: "POST",
      body: JSON.stringify({ url })
    });
    out.textContent = JSON.stringify(data && data.result ? data.result : data, null, 2);
  } catch (error) {
    out.textContent = `失败：${error.message}`;
  }
}

// ---------- 备份 ----------
function fmtBytes(n) {
  const value = Number(n || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = value;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function renderBackups() {
  const data = state.backups || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const stateObj = data.state || {};
  const settings = data.settings || {};
  const running = Boolean(stateObj.running);

  $("#panel").innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <h2>备份（chatgpt2api）</h2>
          <p class="muted">使用 chatgpt2api 内置的备份服务。备份内容默认包括 <code>data/</code> 下的账号、注册任务、日志、生成图。备份目标在「上游系统设置」的 <code>backup</code> 字段配置；当前 chatgpt2api 仅支持 <code>cloudflare_r2</code>，需要填上 Account ID / Access Key / Bucket 才能成功执行。</p>
        </div>
        <div class="upstream-header-actions">
          <button class="secondary" type="button" id="backupsReload">刷新</button>
          <button class="secondary" type="button" id="backupsTest">测试连接</button>
          <button class="primary" type="button" id="backupsRun" ${running ? "disabled" : ""}>立即备份${running ? "（运行中）" : ""}</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px">
        <div class="card" style="padding:10px"><div class="muted">类型</div><div style="font-weight:600">${escapeHtml(String(settings.type || settings.backend || "-"))}</div></div>
        <div class="card" style="padding:10px"><div class="muted">状态</div><div style="font-weight:600">${escapeHtml(running ? "正在备份…" : (stateObj.last_status || "idle"))}</div></div>
        <div class="card" style="padding:10px"><div class="muted">上次开始</div><div style="font-weight:600">${escapeHtml(String(stateObj.last_started_at || "-"))}</div></div>
        <div class="card" style="padding:10px"><div class="muted">上次完成</div><div style="font-weight:600">${escapeHtml(String(stateObj.last_finished_at || "-"))}</div></div>
        ${stateObj.last_error ? `<div class="card" style="padding:10px;grid-column:1/-1"><div class="muted">最近错误</div><div style="color:#b42318;font-size:12px;white-space:pre-wrap">${escapeHtml(String(stateObj.last_error))}</div></div>` : ""}
      </div>
      <pre id="backupsTestResult" class="muted" style="font-size:12px;background:#f8fafc;padding:8px;border-radius:6px;white-space:pre-wrap;min-height:0;margin-bottom:14px"></pre>
      <div class="table-wrap">
        ${items.length ? `
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>时间</th>
                <th>大小</th>
                <th>触发</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => {
                const key = String(item.key || item.id || "");
                const expanded = state.backupsExpanded.has(key);
                return `
                  <tr data-backup-key="${escapeHtml(key)}">
                    <td>${escapeHtml(String(item.name || item.key || "-"))}</td>
                    <td>${escapeHtml(String(item.created_at || item.time || "-"))}</td>
                    <td>${escapeHtml(fmtBytes(item.size))}</td>
                    <td>${escapeHtml(String(item.trigger || "-"))}</td>
                    <td>${item.status ? `<span class="status ${item.status === "failed" ? "failed" : ""}">${escapeHtml(String(item.status))}</span>` : "-"}</td>
                    <td>
                      <button class="tiny" type="button" data-action="detail">${expanded ? "收起" : "详情"}</button>
                      <a class="tiny" href="/api/admin/upstream/backups/download?key=${encodeURIComponent(key)}" target="_blank" rel="noopener" style="margin-left:6px">下载</a>
                      <button class="tiny" type="button" data-action="delete" style="margin-left:6px">删除</button>
                    </td>
                  </tr>
                  ${expanded && item.__detail ? `<tr><td></td><td colspan="5"><pre style="font-size:12px;background:#f8fafc;padding:8px;border-radius:6px;white-space:pre-wrap;max-height:300px;overflow:auto">${escapeHtml(JSON.stringify(item.__detail, null, 2))}</pre></td></tr>` : ""}
                `;
              }).join("")}
            </tbody>
          </table>
        ` : `<div class="empty">还没有备份。点击「立即备份」生成第一个。</div>`}
      </div>
    </div>
  `;
  $("#backupsReload").addEventListener("click", async () => { await loadPanel(); renderBackups(); });
  $("#backupsTest").addEventListener("click", testBackupConnection);
  $("#backupsRun").addEventListener("click", runBackupNow);
  $$("tr[data-backup-key]").forEach((row) => {
    const key = row.dataset.backupKey;
    $("button[data-action='detail']", row)?.addEventListener("click", () => toggleBackupDetail(key));
    $("button[data-action='delete']", row)?.addEventListener("click", () => deleteBackupItem(key));
  });
}

async function testBackupConnection() {
  const out = $("#backupsTestResult");
  if (out) out.textContent = "测试中…";
  try {
    const data = await api("/api/admin/upstream/backups/test", { method: "POST" });
    if (out) out.textContent = JSON.stringify(data && data.result ? data.result : data, null, 2);
  } catch (error) {
    if (out) out.textContent = `失败：${error.message}`;
  }
}

async function runBackupNow() {
  try {
    await api("/api/admin/upstream/backups/run", { method: "POST" });
    toast("备份任务已触发");
    await loadPanel();
    renderBackups();
  } catch (error) {
    toast(error.message);
  }
}

async function deleteBackupItem(key) {
  if (!key) return;
  if (!window.confirm(`确认删除备份 ${key}？此操作不可撤销。`)) return;
  try {
    await api("/api/admin/upstream/backups/delete", {
      method: "POST",
      body: JSON.stringify({ key })
    });
    toast("备份已删除");
    state.backupsExpanded.delete(key);
    await loadPanel();
    renderBackups();
  } catch (error) {
    toast(error.message);
  }
}

async function toggleBackupDetail(key) {
  if (!key || !state.backups || !Array.isArray(state.backups.items)) return;
  const item = state.backups.items.find((x) => String(x.key || x.id || "") === key);
  if (!item) return;
  if (state.backupsExpanded.has(key)) {
    state.backupsExpanded.delete(key);
    renderBackups();
    return;
  }
  try {
    if (!item.__detail) {
      const data = await api(`/api/admin/upstream/backups/detail?key=${encodeURIComponent(key)}`);
      item.__detail = data && data.item ? data.item : data;
    }
    state.backupsExpanded.add(key);
    renderBackups();
  } catch (error) {
    toast(error.message);
  }
}

function renderRecords() {
  $("#panel").innerHTML = `
    <div class="card">
      <h2>生图记录</h2>
      <div class="table-wrap">
        ${state.records.length ? `
          <table>
            <thead>
              <tr>
                <th>图片</th>
                <th>用户</th>
                <th>提示词</th>
                <th>IP / UA</th>
                <th>公开</th>
                <th>上游</th>
                <th>状态</th>
                <th>时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${state.records.map((record) => `
                <tr data-record-id="${escapeHtml(record.id || record.firstGenerationId || "")}">
                  <td>${record.imageUrl ? `<a href="${escapeHtml(record.imageUrl)}" target="_blank"><img class="thumb" src="${escapeHtml(record.imageUrl)}" alt=""></a>` : `<div class="thumb"></div>`}</td>
                  <td><strong>${escapeHtml(record.userName || record.userEmail || "未知用户")}</strong><br><span class="muted">${escapeHtml(record.userEmail || record.userId)}</span></td>
                  <td class="prompt-cell">${escapeHtml(record.prompt)}${record.errorMessage ? `<br><span class="muted">错误：${escapeHtml(record.errorMessage)}</span>` : ""}</td>
                  <td><strong>${escapeHtml(record.ipAddress || "-")}</strong><br><span class="muted">${escapeHtml(record.userAgent || "-")}</span></td>
                  <td>${record.isPublic ? "是" : "否"}</td>
                  <td>${record.upstreamUsed ? `<span class="status">${escapeHtml(record.upstreamUsed)}</span>` : "-"}</td>
                  <td><span class="status ${record.status === "failed" ? "failed" : ""}">${escapeHtml(record.status)}</span></td>
                  <td>${fmt(record.createdAt)}</td>
                  <td>${record.upstreamUsed === "chatgpt2api" ? `<button class="tiny" type="button" data-action="upstream-log" data-prompt="${escapeHtml(record.prompt || "")}" data-created="${escapeHtml(record.createdAt || "")}">上游日志</button>` : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<div class="empty">暂无生图记录</div>`}
      </div>
    </div>
  `;
  $$("button[data-action='upstream-log']").forEach((button) => {
    button.addEventListener("click", () => jumpToUpstreamLog(button.dataset.prompt, button.dataset.created));
  });
}

async function jumpToUpstreamLog(prompt, createdAt) {
  const day = isoDay(createdAt);
  state.logsFilter = { type: "call", start_date: day, end_date: day };
  state.logsHighlightPrompt = String(prompt || "");
  state.logsExpanded = new Set();
  state.logsSelected = new Set();
  state.view = "logs";
  await loadPanel();
  renderAdmin();
}

function isoDay(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  // chatgpt2api stores its log day in local server time (YYYY-MM-DD slice of its
  // local clock). Use the local-time date here so cross-linked filters line up
  // when both containers share the host timezone (docker-compose default).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayPart = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayPart}`;
}

function renderUsers() {
  $("#panel").innerHTML = `
    <div class="card">
      <h2>用户管理</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>状态</th>
              <th>积分</th>
              <th>增减积分</th>
              <th>注册时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.users.map((user) => `
              <tr data-user-id="${escapeHtml(user.id)}">
                <td><strong>${escapeHtml(user.name || user.email)}</strong><br><span class="muted">${escapeHtml(user.email)}</span></td>
                <td>
                  <select class="role-input" ${user.id === state.user.id ? "disabled" : ""}>
                    <option value="user" ${user.role === "user" ? "selected" : ""}>用户</option>
                    <option value="admin" ${user.role === "admin" ? "selected" : ""}>管理员</option>
                  </select>
                </td>
                <td>
                  <select class="status-input" ${user.id === state.user.id ? "disabled" : ""}>
                    <option value="active" ${user.status === "active" ? "selected" : ""}>启用</option>
                    <option value="disabled" ${user.status === "disabled" ? "selected" : ""}>停用</option>
                  </select>
                </td>
                <td><input class="credits-input" type="number" min="0" value="${Number(user.credits || 0)}"></td>
                <td><input class="credit-delta-input" type="number" step="1" value="0"></td>
                <td>${fmt(user.createdAt)}</td>
                <td><button class="tiny save-user" type="button">保存</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  $$(".save-user").forEach((button) => {
    button.addEventListener("click", () => saveUser(button.closest("tr")));
  });
}

function renderSettings() {
  const settings = state.settings || {};
  const upstreams = settings.upstreams || { chatgpt2api: {}, cpa: {} };
  const active = settings.activeUpstream || "chatgpt2api";
  $("#panel").innerHTML = `
    <div class="grid">
      <section class="card">
        <h2>接口设置</h2>
        <form id="settingsForm" class="form">
          <fieldset class="upstream-group">
            <legend>当前启用上游</legend>
            <label><input type="radio" name="activeUpstream" value="chatgpt2api" ${active === "chatgpt2api" ? "checked" : ""}> chatgpt2api（默认，docker-compose 内置反代）</label>
            <label><input type="radio" name="activeUpstream" value="cpa" ${active === "cpa" ? "checked" : ""}> CPA（CLIProxyAPI / OpenAI 兼容 Bearer）</label>
          </fieldset>

          <fieldset class="upstream-group">
            <legend>chatgpt2api 上游</legend>
            <label>API Key<input id="apiKeyInput" type="password" placeholder="${escapeHtml(upstreams.chatgpt2api?.apiKeyMask || "不修改则留空")}"></label>
            <label>API 地址<input id="apiBaseUrlInput" value="${escapeHtml(upstreams.chatgpt2api?.apiBaseUrl || "")}" placeholder="http://chatgpt2api:80/v1"></label>
            <label>模型<input id="modelInput" value="${escapeHtml(upstreams.chatgpt2api?.model || settings.model || "gpt-image-2")}"></label>
            <div class="upstream-actions">
              <button class="tiny" type="button" data-test-upstream="chatgpt2api">测试 chatgpt2api</button>
              <button id="clearKeyBtn" class="tiny secondary" type="button">清除该 Key</button>
              <span class="muted upstream-test-result" data-test-result="chatgpt2api"></span>
            </div>
          </fieldset>

          <fieldset class="upstream-group">
            <legend>CPA 上游</legend>
            <label>API Key<input id="cpaApiKeyInput" type="password" placeholder="${escapeHtml(upstreams.cpa?.apiKeyMask || "不修改则留空")}"></label>
            <label>API 地址<input id="cpaApiBaseUrlInput" value="${escapeHtml(upstreams.cpa?.apiBaseUrl || "")}" placeholder="https://your-cpa.example.com/v1"></label>
            <label>模型<input id="cpaModelInput" value="${escapeHtml(upstreams.cpa?.model || "")}" placeholder="gpt-image-2"></label>
            <div class="upstream-actions">
              <button class="tiny" type="button" data-test-upstream="cpa">测试 CPA</button>
              <button id="clearCpaKeyBtn" class="tiny secondary" type="button">清除该 Key</button>
              <span class="muted upstream-test-result" data-test-result="cpa"></span>
            </div>
          </fieldset>

          <fieldset class="upstream-group">
            <legend>其它</legend>
            <label>注册送积分<input id="defaultCreditsInput" type="number" min="0" value="${Number(settings.defaultCredits ?? 10)}"></label>
            <label>每张图消耗积分<input id="generationCreditCostInput" type="number" min="0" value="${Number(settings.generationCreditCost ?? 1)}"></label>
            <label>单次最大张数<input id="maxImagesInput" type="number" min="1" max="4" value="${Number(settings.maxImagesPerRequest ?? 1)}"></label>
            <label><input id="allowRegistrationInput" type="checkbox" ${settings.allowRegistration ? "checked" : ""}> 开放注册</label>
            <label><input id="requireApprovalInput" type="checkbox" ${settings.requireApproval ? "checked" : ""}> 新用户需要后台启用</label>
          </fieldset>

          <button class="primary" type="submit">保存设置</button>
        </form>
      </section>
      <section class="card">
        <h2>说明</h2>
        <p class="muted">两组上游可以同时填写，但每次生图只会用「当前启用上游」那一组。切换后立即生效，已经在跑的请求不受影响。点击「测试」会用对应 Key 调用上游的 <code>/v1/models</code> 做连通性检查。</p>
        <p class="muted">CPA 上游需要 OpenAI 兼容的 Bearer Key（CLIProxyAPI、CherryStudio、Codex 用的那种）。如果只用 CPA，可以把 chatgpt2api 容器从 docker-compose 里去掉。</p>
        <p class="muted">前台生图按「每张图消耗积分」扣分；签到每天 1 积分。</p>
      </section>
    </div>
  `;
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#clearKeyBtn").addEventListener("click", clearKey);
  $("#clearCpaKeyBtn").addEventListener("click", clearCpaKey);
  document.querySelectorAll("[data-test-upstream]").forEach((btn) => {
    btn.addEventListener("click", () => testUpstream(btn.dataset.testUpstream));
  });
}

function renderRedeem() {
  const codes = state.redeemCodes || [];
  const filter = state.redeemFilter || "";
  const lastBatch = state.lastBatch;
  $("#panel").innerHTML = `
    <div class="grid">
      <section class="card">
        <h2>批量生成卡密</h2>
        <p class="muted">生成后请下载或复制保存，平台只在生成的当下显示完整列表。</p>
        <form id="redeemCreateForm" class="form">
          <label>数量<input id="redeemCount" type="number" min="1" max="1000" value="10" required></label>
          <label>每张卡密积分<input id="redeemCredits" type="number" min="1" max="100000" value="100" required></label>
          <label>有效期（天，留空表示永不过期）<input id="redeemDays" type="number" min="0" max="3650" placeholder="不填则永不过期"></label>
          <label>批次备注（可选）<input id="redeemNote" type="text" maxlength="255" placeholder="例如：双十一活动"></label>
          <button class="primary" type="submit">生成卡密</button>
        </form>
        ${lastBatch ? `
          <div class="redeem-last-batch">
            <h3>最新生成批次（${escapeHtml(lastBatch.batchId)} · ${lastBatch.codes.length} 张 · 每张 ${lastBatch.credits} 积分）</h3>
            <div class="redeem-actions">
              <button class="secondary" id="redeemCopyBtn" type="button">一键复制</button>
              <button class="secondary" id="redeemDownloadBtn" type="button">下载 .txt</button>
            </div>
            <pre class="redeem-codes">${escapeHtml(lastBatch.codes.join("\n"))}</pre>
          </div>
        ` : ""}
      </section>
      <section class="card">
        <h2>所有卡密</h2>
        <div class="redeem-filters">
          <button class="tiny ${filter === "" ? "active" : ""}" data-filter="">全部</button>
          <button class="tiny ${filter === "unused" ? "active" : ""}" data-filter="unused">未使用</button>
          <button class="tiny ${filter === "used" ? "active" : ""}" data-filter="used">已使用</button>
          <button class="tiny ${filter === "disabled" ? "active" : ""}" data-filter="disabled">已禁用</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>卡密</th>
                <th>积分</th>
                <th>状态</th>
                <th>批次</th>
                <th>使用者</th>
                <th>使用时间</th>
                <th>到期</th>
                <th>创建</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${codes.length ? codes.map((code) => `
                <tr>
                  <td><code>${escapeHtml(code.code)}</code></td>
                  <td>${Number(code.credits || 0)}</td>
                  <td><span class="status ${code.status === "used" ? "" : code.status === "disabled" ? "failed" : ""}">${escapeHtml(code.status)}</span></td>
                  <td class="muted">${escapeHtml(code.batchId || "-")}</td>
                  <td class="muted">${escapeHtml(code.usedByUserEmail || "-")}</td>
                  <td class="muted">${code.usedAt ? fmt(code.usedAt) : "-"}</td>
                  <td class="muted">${code.expiresAt ? fmt(code.expiresAt) : "-"}</td>
                  <td class="muted">${fmt(code.createdAt)}</td>
                  <td>${code.status === "unused" ? `<button class="tiny redeem-disable" data-code="${escapeHtml(code.code)}" type="button">禁用</button>` : ""}</td>
                </tr>
              `).join("") : `<tr><td colspan="9" class="empty">暂无卡密</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
  $("#redeemCreateForm").addEventListener("submit", createRedeemBatch);
  $$("[data-filter]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.redeemFilter = button.dataset.filter;
      await loadPanel();
      renderRedeem();
    });
  });
  $$(".redeem-disable").forEach((button) => {
    button.addEventListener("click", () => disableRedeemCode(button.dataset.code));
  });
  if (lastBatch) {
    $("#redeemCopyBtn").addEventListener("click", () => {
      navigator.clipboard.writeText(lastBatch.codes.join("\n")).then(
        () => toast("已复制"),
        () => toast("复制失败")
      );
    });
    $("#redeemDownloadBtn").addEventListener("click", () => {
      const blob = new Blob([lastBatch.codes.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redeem-codes-${lastBatch.batchId}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
}

async function createRedeemBatch(event) {
  event.preventDefault();
  const count = Number($("#redeemCount").value || 0);
  const credits = Number($("#redeemCredits").value || 0);
  const expiresInDays = Number($("#redeemDays").value || 0);
  const note = $("#redeemNote").value.trim();
  if (!count || !credits) {
    toast("请填写数量和积分");
    return;
  }
  try {
    const result = await api("/api/admin/redeem-codes", {
      method: "POST",
      body: JSON.stringify({
        count,
        credits,
        expiresInDays: expiresInDays || undefined,
        note: note || undefined
      })
    });
    state.lastBatch = result;
    toast(`已生成 ${result.codes.length} 张卡密`);
    await loadPanel();
    renderRedeem();
  } catch (error) {
    toast(error.message);
  }
}

async function disableRedeemCode(code) {
  if (!confirm(`确定要禁用卡密 ${code} 吗？`)) return;
  try {
    await api(`/api/admin/redeem-codes/${encodeURIComponent(code)}/disable`, { method: "POST" });
    toast("已禁用");
    await loadPanel();
    renderRedeem();
  } catch (error) {
    toast(error.message);
  }
}

function renderTransactions() {
  const txs = state.transactions || [];
  $("#panel").innerHTML = `
    <div class="card">
      <h2>积分流水</h2>
      <p class="muted">最近 200 条积分流水（按时间倒序）。</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>类型</th>
              <th>变动</th>
              <th>余额</th>
              <th>关联</th>
              <th>备注</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            ${txs.length ? txs.map((tx) => `
              <tr>
                <td><strong>${escapeHtml(tx.userEmail || tx.userName || tx.userId)}</strong></td>
                <td>${escapeHtml(txLabel(tx.type))}</td>
                <td class="${tx.delta >= 0 ? "tx-pos" : "tx-neg"}">${tx.delta >= 0 ? "+" : ""}${tx.delta}</td>
                <td>${tx.balanceAfter}</td>
                <td class="muted">${escapeHtml(tx.refType ? `${tx.refType}:${tx.refId}` : "-")}</td>
                <td class="muted">${escapeHtml(tx.note || "")}</td>
                <td class="muted">${fmt(tx.createdAt)}</td>
              </tr>
            `).join("") : `<tr><td colspan="7" class="empty">暂无流水</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPayments() {
  const payments = state.payments || [];
  $("#panel").innerHTML = `
    <div class="card">
      <h2>支付订单</h2>
      <p class="muted">PR 2 接入易支付/虎皮椒等支付渠道后，此处会显示真实订单。</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>用户</th>
              <th>渠道</th>
              <th>上游订单</th>
              <th>金额</th>
              <th>积分</th>
              <th>状态</th>
              <th>支付时间</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length ? payments.map((p) => `
              <tr>
                <td><code>${escapeHtml(p.id)}</code></td>
                <td><strong>${escapeHtml(p.userEmail || p.userId)}</strong></td>
                <td>${escapeHtml(p.provider)}</td>
                <td class="muted">${escapeHtml(p.providerOrderId || "-")}</td>
                <td>${(p.amountCents / 100).toFixed(2)} ${escapeHtml(p.currency)}</td>
                <td>${p.credits}</td>
                <td><span class="status ${p.status === "paid" ? "" : p.status === "failed" ? "failed" : ""}">${escapeHtml(p.status)}</span></td>
                <td class="muted">${p.paidAt ? fmt(p.paidAt) : "-"}</td>
                <td class="muted">${fmt(p.createdAt)}</td>
              </tr>
            `).join("") : `<tr><td colspan="9" class="empty">暂无订单</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function loadPanel() {
  if (state.view === "records") {
    const data = await api("/api/admin/generations?limit=200");
    state.records = data.records || [];
  } else if (state.view === "users") {
    const data = await api("/api/admin/users");
    state.users = data.users || [];
  } else if (state.view === "redeem") {
    const query = state.redeemFilter ? `?status=${encodeURIComponent(state.redeemFilter)}` : "";
    const data = await api(`/api/admin/redeem-codes${query}`);
    state.redeemCodes = data.codes || [];
  } else if (state.view === "transactions") {
    const data = await api("/api/admin/credit-transactions");
    state.transactions = data.transactions || [];
  } else if (state.view === "payments") {
    const data = await api("/api/admin/payments");
    state.payments = data.payments || [];
  } else if (state.view === "accounts") {
    try {
      const data = await api("/api/admin/upstream/accounts");
      state.accounts = data.items || [];
    } catch (error) {
      state.accounts = [];
      toast(error.message);
    }
  } else if (state.view === "logs") {
    try {
      const params = new URLSearchParams();
      const filter = state.logsFilter || {};
      if (filter.type) params.set("type", filter.type);
      if (filter.start_date) params.set("start_date", filter.start_date);
      if (filter.end_date) params.set("end_date", filter.end_date);
      const query = params.toString();
      const data = await api(`/api/admin/upstream/logs${query ? `?${query}` : ""}`);
      state.logs = Array.isArray(data.items) ? data.items : [];
    } catch (error) {
      state.logs = [];
      toast(error.message);
    }
  } else if (state.view === "register") {
    try {
      const data = await api("/api/admin/upstream/register");
      state.register = data.register || null;
      startRegisterPolling();
    } catch (error) {
      state.register = null;
      toast(error.message);
    }
  } else if (state.view === "upstreamSettings") {
    try {
      const data = await api("/api/admin/upstream/settings");
      state.upstreamSettings = (data && data.config) || null;
      state.upstreamSettingsDraft = JSON.stringify(state.upstreamSettings || {}, null, 2);
      state.upstreamSettingsDraftDirty = false;
    } catch (error) {
      state.upstreamSettings = null;
      state.upstreamSettingsDraft = "";
      state.upstreamSettingsDraftDirty = false;
      toast(error.message);
    }
    try {
      const storage = await api("/api/admin/upstream/storage");
      state.upstreamSettingsStorage = storage || null;
    } catch (error) {
      state.upstreamSettingsStorage = null;
    }
  } else if (state.view === "backups") {
    try {
      state.backups = await api("/api/admin/upstream/backups");
    } catch (error) {
      state.backups = null;
      toast(error.message);
    }
  } else {
    state.settings = await api("/api/admin/settings");
  }
}

async function login(event) {
  event.preventDefault();
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#emailInput").value,
        password: $("#passwordInput").value
      })
    });
    await bootstrap();
  } catch (error) {
    toast(error.message);
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => null);
  state.user = null;
  renderLogin();
}

async function saveUser(row) {
  try {
    await api(`/api/admin/users/${row.dataset.userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        role: $(".role-input", row).value,
        status: $(".status-input", row).value,
        credits: Number($(".credits-input", row).value || 0),
        creditDelta: Number($(".credit-delta-input", row).value || 0)
      })
    });
    toast("用户已保存");
    await loadPanel();
    renderUsers();
  } catch (error) {
    toast(error.message);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const activeUpstreamInput = document.querySelector('input[name="activeUpstream"]:checked');
  try {
    state.settings = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({
        openaiApiKey: $("#apiKeyInput").value.trim(),
        apiBaseUrl: $("#apiBaseUrlInput").value.trim(),
        model: $("#modelInput").value.trim(),
        cpaApiKey: $("#cpaApiKeyInput").value.trim(),
        cpaApiBaseUrl: $("#cpaApiBaseUrlInput").value.trim(),
        cpaModel: $("#cpaModelInput").value.trim(),
        activeUpstream: activeUpstreamInput?.value || "chatgpt2api",
        defaultCredits: Number($("#defaultCreditsInput").value || 0),
        generationCreditCost: Number($("#generationCreditCostInput").value || 0),
        maxImagesPerRequest: Number($("#maxImagesInput").value || 1),
        allowRegistration: $("#allowRegistrationInput").checked,
        requireApproval: $("#requireApprovalInput").checked
      })
    });
    toast("设置已保存");
    renderSettings();
  } catch (error) {
    toast(error.message);
  }
}

async function clearKey() {
  try {
    state.settings = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ clearApiKey: true })
    });
    toast("chatgpt2api API Key 已清除");
    renderSettings();
  } catch (error) {
    toast(error.message);
  }
}

async function clearCpaKey() {
  try {
    state.settings = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ clearCpaApiKey: true })
    });
    toast("CPA API Key 已清除");
    renderSettings();
  } catch (error) {
    toast(error.message);
  }
}

async function testUpstream(upstream) {
  const resultEl = document.querySelector(`[data-test-result="${upstream}"]`);
  if (resultEl) {
    resultEl.textContent = "测试中…";
    resultEl.classList.remove("failed", "ok");
  }
  try {
    const data = await api("/api/admin/settings/test", {
      method: "POST",
      body: JSON.stringify({ upstream })
    });
    if (resultEl) {
      resultEl.textContent = data.ok
        ? `✓ ${data.message || "连通"}`
        : `✗ ${data.message || `HTTP ${data.status}`}`;
      resultEl.classList.add(data.ok ? "ok" : "failed");
    }
  } catch (error) {
    if (resultEl) {
      resultEl.textContent = `✗ ${error.message}`;
      resultEl.classList.add("failed");
    }
  }
}

async function bootstrap() {
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
    state.firstRun = data.firstRun;
    if (!state.user) return renderLogin();
    if (state.user.role !== "admin") return renderDenied();
    await loadPanel();
    renderAdmin();
  } catch (error) {
    toast(error.message);
    renderLogin();
  }
}

$("#logoutBtn").addEventListener("click", logout);
bootstrap();
