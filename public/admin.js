const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null,
  firstRun: false,
  view: "users",
  settings: null,
  users: [],
  records: [],
  redeemCodes: [],
  redeemFilter: "",
  transactions: [],
  payments: [],
  accounts: [],
  accountsView: {
    search: "",
    typeFilter: "all",
    statusFilter: "all",
    page: 1,
    pageSize: 10,
    selected: new Set()
  },
  logs: [],
  logsError: "",
  logsFilter: { type: "", start_date: "", end_date: "" },
  logsExpanded: new Set(),
  logsSelected: new Set(),
  logsHighlightPrompt: "",
  register: null,
  registerLogsCollapsed: false,
  lastBatch: null,
  showAdvancedSettings: false,
  showUpstreamTabs: false
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
      <p>请使用管理员账号登录。</p>
    </section>
    <section class="card" style="max-width:460px">
      <h2>管理员登录</h2>
      <form id="loginForm" class="form">
        <label>邮箱<input id="emailInput" type="email" autocomplete="email" required></label>
        <label>密码<input id="passwordInput" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">登录后台</button>
        <a class="secondary" href="/" style="display:grid;place-items:center">回到前台</a>
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
  $("#backHome").addEventListener("click", () => { window.location.href = "/"; });
}

// ===================== Main Admin Layout =====================

const UPSTREAM_VIEWS = ["accounts", "register", "settings", "logs"];

function renderAdmin() {
  $("#logoutBtn").classList.remove("hidden");
  const isUpstreamView = UPSTREAM_VIEWS.includes(state.view);
  $("#adminApp").innerHTML = `
    <section class="hero">
      <h1>后台管理</h1>
      <p>管理用户、积分、接口，查看生图日志。</p>
    </section>
    <div class="tabs">
      <button class="secondary ${state.view === "users" ? "active" : ""}" data-view="users">用户管理</button>
      <button class="secondary ${state.view === "redeem" ? "active" : ""}" data-view="redeem">卡密管理</button>
      <button class="secondary ${state.view === "transactions" ? "active" : ""}" data-view="transactions">积分流水</button>
      <button class="secondary ${isUpstreamView ? "active" : ""}" data-view="upstream">上游管理</button>
    </div>
    ${isUpstreamView ? `
      <div class="sub-tabs">
        <button class="secondary ${state.view === "accounts" ? "active" : ""}" data-view="accounts">号池</button>
        <button class="secondary ${state.view === "register" ? "active" : ""}" data-view="register">注册机</button>
        <button class="secondary ${state.view === "settings" ? "active" : ""}" data-view="settings">接口设置</button>
        <button class="secondary ${state.view === "logs" ? "active" : ""}" data-view="logs">调用日志</button>
      </div>
    ` : ""}
    <section id="panel"></section>
  `;
  $$("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      stopRegisterPolling();
      const target = button.dataset.view;
      // Clicking the "上游管理" main tab defaults to the first sub-tab (号池)
      state.view = target === "upstream" ? "accounts" : target;
      await loadPanel();
      renderAdmin();
    });
  });
  renderPanel();
}

function stopRegisterPolling() {
  if (registerPollTimer) { clearInterval(registerPollTimer); registerPollTimer = null; }
}

function startRegisterPolling() {
  stopRegisterPolling();
  // Only patch the live stats / logs sections during polling so the form
  // inputs the admin is editing are never overwritten. The full form is only
  // re-rendered after explicit user actions (save / start / stop / reset / tab
  // navigation) via renderRegister().
  registerPollTimer = setInterval(async () => {
    if (state.view !== "register") { stopRegisterPolling(); return; }
    try {
      const data = await api("/api/admin/upstream/register");
      state.register = data.register || null;
      const reg = state.register || {};
      patchRegisterLiveSections(reg);
      // If the register loop finished on its own (enabled flipped to false),
      // stop polling and refresh the form so the inputs become editable again.
      if (!reg.enabled) {
        stopRegisterPolling();
        renderRegister();
      }
    } catch (error) { console.warn("register poll failed:", error.message); }
  }, 2000);
}

// Update only the stats grid + log stream in-place. The <form> and its inputs
// are deliberately left untouched so anything the admin is typing survives.
function patchRegisterLiveSections(reg) {
  const statusBadge = $("#regStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = reg.enabled ? "运行中" : "已停止";
    statusBadge.className = `status ${reg.enabled ? "warn" : ""}`;
  }
  const startBtn = $("#regStart");
  const stopBtn = $("#regStop");
  if (startBtn) startBtn.disabled = Boolean(reg.enabled);
  if (stopBtn) stopBtn.disabled = !reg.enabled;

  const statsGrid = $("#regStatsGrid");
  if (statsGrid) statsGrid.innerHTML = renderRegisterStatsCards(reg);

  const logsHost = $("#regLogsHost");
  if (logsHost) logsHost.innerHTML = renderRegisterLogsBlock(reg);
}

function renderRegisterStatsCards(reg) {
  const stats = reg.stats || {};
  return `
    <div class="card" style="padding:10px"><div class="muted">完成/计划</div><div style="font-size:18px;font-weight:600">${Number(stats.done||0)}/${Number(reg.total||0)}</div></div>
    <div class="card" style="padding:10px"><div class="muted">成功/失败</div><div style="font-size:18px;font-weight:600">${Number(stats.success||0)}/${Number(stats.fail||0)}</div></div>
    <div class="card" style="padding:10px"><div class="muted">成功率</div><div style="font-size:18px;font-weight:600">${Number(stats.success_rate||0).toFixed(1)}%</div></div>
    <div class="card" style="padding:10px"><div class="muted">运行时间</div><div style="font-size:18px;font-weight:600">${Number(stats.elapsed_seconds||0)}s</div></div>
    <div class="card" style="padding:10px"><div class="muted">平均注册</div><div style="font-size:18px;font-weight:600">${Number(stats.avg_seconds||0)}s</div></div>
    <div class="card" style="padding:10px"><div class="muted">当前额度</div><div style="font-size:18px;font-weight:600">${Number(stats.current_quota||0)}</div></div>
    <div class="card" style="padding:10px"><div class="muted">正常账号</div><div style="font-size:18px;font-weight:600">${Number(stats.current_available||0)}</div></div>
    <div class="card" style="padding:10px"><div class="muted">运行线程</div><div style="font-size:18px;font-weight:600">${Number(stats.running||0)}/${Number(stats.threads||0)}</div></div>
  `;
}

function formatRegisterLogTime(value) {
  const raw = String(value || "");
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    try { return parsed.toLocaleTimeString("zh-CN", { hour12: false }); }
    catch (_) { /* fall through */ }
  }
  return raw.replace(/T/, " ").slice(0, 19);
}

function renderRegisterLogsBlock(reg) {
  const logs = Array.isArray(reg?.logs) ? reg.logs : [];
  const rows = logs.length
    ? logs.slice().reverse().map((entry) => {
        const level = String(entry.level || "");
        const cls = level === "red"
          ? "color:#e11d48"
          : level === "green"
            ? "color:#059669"
            : level === "yellow"
              ? "color:#d97706"
              : "color:#475569";
        const time = formatRegisterLogTime(entry.time || entry.ts);
        return `<div style="${cls}"><span style="color:#94a3b8">${escapeHtml(time)}</span><span style="padding-left:8px">${escapeHtml(String(entry.text || ""))}</span></div>`;
      }).join("")
    : `<div class="muted">暂无日志。注册机启动后这里会持续输出每个账号的注册进度。</div>`;
  return `
    <div class="register-logs" style="margin-top:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div>
          <strong>实时日志</strong>
          <span class="muted" style="margin-left:8px;font-size:12px">遇到 HTTP 400 等错误通常是邮箱被封，请更换 provider 的域名。</span>
        </div>
        <span class="status">${logs.length}</span>
      </div>
      <div style="max-height:320px;overflow-y:auto;border:1px solid var(--line,#e2e8f0);border-radius:10px;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.8;background:#f8fafc">
        ${rows}
      </div>
    </div>
  `;
}

function renderPanel() {
  if (state.view === "logs") return renderUnifiedLogs();
  if (state.view === "users") return renderUsers();
  if (state.view === "redeem") return renderRedeem();
  if (state.view === "transactions") return renderTransactions();
  if (state.view === "payments") return renderPayments();
  if (state.view === "accounts") return renderAccounts();
  if (state.view === "register") return renderRegister();
  renderSettings();
}


// ===================== Upstream Logs =====================

function renderUnifiedLogs() {
  const upstreamLogs = state.logs || [];
  const filter = state.logsFilter || { type: "", start_date: "", end_date: "" };
  const panel = $("#panel") || $("#upstreamPanel");
  if (!panel) return;

  const selectedCount = state.logsSelected ? state.logsSelected.size : 0;

  panel.innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <h2>上游调用日志</h2>
          <p class="muted">仅展示上游 chatgpt2api 的调用日志。可按日期筛选，点击「详情」查看 payload，并支持删除所选日志。</p>
        </div>
        <div class="upstream-header-actions">
          <button class="secondary" type="button" id="logsRefreshBtn">刷新</button>
          <button class="secondary" type="button" id="logsDeleteBtn" ${selectedCount ? "" : "disabled"}>删除所选${selectedCount ? ` (${selectedCount})` : ""}</button>
        </div>
      </div>
      <form id="logsFilterForm" class="form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">
        <label style="flex:1 1 160px">起始日期
          <input id="logsStartDateInput" type="date" value="${escapeHtml(filter.start_date || "")}">
        </label>
        <label style="flex:1 1 160px">结束日期
          <input id="logsEndDateInput" type="date" value="${escapeHtml(filter.end_date || "")}">
        </label>
        <button class="primary" type="submit">筛选</button>
        <button class="secondary" type="button" id="logsResetBtn">重置</button>
      </form>
      <div class="table-wrap">
        ${upstreamLogs.length ? `
          <table>
            <thead>
              <tr>
                <th style="width:32px"><input type="checkbox" id="logsSelectAll"></th>
                <th>类型</th>
                <th>摘要</th>
                <th>模型</th>
                <th>状态</th>
                <th>耗时</th>
                <th>时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${upstreamLogs.map((item) => renderUpstreamLogRow(item)).join("")}
            </tbody>
          </table>
        ` : state.logsError ? `<div class="empty" style="color:#e11d48">上游调用日志加载失败：${escapeHtml(state.logsError)}</div>` : `<div class="empty">暂无记录</div>`}
      </div>
    </div>
  `;

  // Event binding
  $("#logsRefreshBtn").addEventListener("click", async () => { await loadPanel(); renderUnifiedLogs(); });
  $("#logsFilterForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    state.logsFilter = {
      type: "",
      start_date: $("#logsStartDateInput").value || "",
      end_date: $("#logsEndDateInput").value || ""
    };
    state.logsExpanded = new Set();
    state.logsSelected = new Set();
    await loadPanel();
    renderUnifiedLogs();
  });
  $("#logsResetBtn").addEventListener("click", async () => {
    state.logsFilter = { type: "", start_date: "", end_date: "" };
    state.logsExpanded = new Set();
    state.logsSelected = new Set();
    await loadPanel();
    renderUnifiedLogs();
  });
  $("#logsSelectAll")?.addEventListener("change", (e) => {
    if (e.target.checked) {
      const ids = [];
      for (const item of upstreamLogs) { if (item.id) ids.push(String(item.id)); }
      state.logsSelected = new Set(ids);
    } else {
      state.logsSelected = new Set();
    }
    renderUnifiedLogs();
  });
  $("#logsDeleteBtn").addEventListener("click", () => deleteSelectedLogs());
  $$("tr[data-log-id]").forEach((row) => {
    const id = row.dataset.logId;
    $(".log-select", row)?.addEventListener("change", (e) => {
      if (e.target.checked) state.logsSelected.add(id);
      else state.logsSelected.delete(id);
      renderUnifiedLogs();
    });
    $("button[data-action='toggle-detail']", row)?.addEventListener("click", () => {
      if (state.logsExpanded.has(id)) state.logsExpanded.delete(id);
      else state.logsExpanded.add(id);
      renderUnifiedLogs();
    });
  });
}

function renderUpstreamLogRow(item) {
  const id = String(item.id || "");
  const detail = item.detail || {};
  const expanded = state.logsExpanded.has(id);
  const selected = state.logsSelected.has(id);
  const statusValue = String(detail.status || "");
  const duration = detail.duration_ms != null ? `${Number(detail.duration_ms)}ms` : "-";
  return `
    <tr data-log-id="${escapeHtml(id)}" class="upstream-log-row">
      <td><input type="checkbox" class="log-select" ${selected ? "checked" : ""}></td>
      <td></td>
      <td class="muted">${escapeHtml(logTypeLabel(item.type))}</td>
      <td class="prompt-cell">${escapeHtml(item.summary || "-")}${detail.error ? `<br><span class="muted">${escapeHtml(String(detail.error).slice(0, 120))}</span>` : ""}</td>
      <td>${escapeHtml(detail.model || "-")}</td>
      <td>${statusValue ? `<span class="status ${statusValue === "failed" ? "failed" : ""}">${escapeHtml(statusValue)}</span>` : "-"}</td>
      <td>${escapeHtml(duration)}</td>
      <td>${escapeHtml(item.time || "-")}</td>
      <td><button class="tiny" type="button" data-action="toggle-detail">${expanded ? "收起" : "详情"}</button></td>
    </tr>
    ${expanded ? `<tr class="log-detail-row"><td></td><td colspan="8"><pre style="white-space:pre-wrap;word-break:break-word;background:var(--surface,#f8fafc);padding:10px;border-radius:8px;font-size:12px;margin:0;max-height:320px;overflow:auto">${escapeHtml(JSON.stringify(item, null, 2))}</pre></td></tr>` : ""}
  `;
}

async function deleteSelectedLogs() {
  const ids = [...state.logsSelected];
  if (ids.length === 0) return;
  if (!window.confirm(`确认删除 ${ids.length} 条日志？`)) return;
  try {
    await api("/api/admin/upstream/logs/delete", { method: "POST", body: JSON.stringify({ ids }) });
    toast(`已删除 ${ids.length} 条`);
    state.logsSelected = new Set();
    state.logsExpanded = new Set();
    await loadPanel();
    renderUnifiedLogs();
  } catch (error) { toast(error.message); }
}

const LOG_TYPE_LABELS = { call: "上游调用", account: "号池事件" };
function logTypeLabel(type) { return LOG_TYPE_LABELS[type] || type || "-"; }


// ===================== Accounts (号池) =====================

const ACCOUNT_STATUSES = ["正常", "限流", "异常", "禁用"];
const ACCOUNT_TYPE_LABELS = { pro: "Pro", prolite: "Pro Lite", plus: "Plus", free: "Free" };
const ACCOUNT_TYPE_OPTIONS = ["free", "plus", "pro", "prolite"];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function accountStatusClass(status) {
  if (status === "正常") return "ok";
  if (status === "限流") return "warn";
  if (status === "禁用") return "muted";
  return "failed";
}
function tokenPreview(token) {
  const value = String(token || "");
  if (value.length <= 18) return value;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}
function displayAccountType(account) {
  const raw = String(account?.type || "").toLowerCase() || "free";
  return ACCOUNT_TYPE_LABELS[raw] || raw;
}
function accountTypeKey(account) {
  return String(account?.type || "free").toLowerCase() || "free";
}
function isUnlimitedQuotaAccount(account) {
  const t = accountTypeKey(account);
  return t === "pro" || t === "prolite";
}
function quotaDisplay(account) {
  if (isUnlimitedQuotaAccount(account)) return "∞";
  if (account?.image_quota_unknown) return "未知";
  return String(Math.max(0, Number(account?.quota || 0)));
}
function quotaSummary(items) {
  const available = items.filter((it) => it.status === "正常");
  if (available.some(isUnlimitedQuotaAccount)) return "∞";
  if (available.some((it) => it.image_quota_unknown)) return "未知";
  const total = available.reduce((sum, it) => sum + Math.max(0, Number(it.quota || 0)), 0);
  return total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total);
}
function formatRestoreAt(value) {
  if (!value) return { absolute: "—", relative: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { absolute: String(value), relative: "" };
  const diffMs = Math.max(0, date.getTime() - Date.now());
  const totalHours = Math.ceil(diffMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const relative = diffMs > 0 ? `剩余 ${days}d ${hours}h` : "已到恢复时间";
  const pad = (n) => String(n).padStart(2, "0");
  const absolute = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { absolute, relative };
}
function accountsViewState() {
  if (!state.accountsView) {
    state.accountsView = { search: "", typeFilter: "all", statusFilter: "all", page: 1, pageSize: 10, selected: new Set() };
  }
  if (!(state.accountsView.selected instanceof Set)) {
    state.accountsView.selected = new Set(state.accountsView.selected || []);
  }
  return state.accountsView;
}
function reconcileAccountsSelection() {
  const view = accountsViewState();
  const live = new Set((state.accounts || []).map((a) => a.access_token).filter(Boolean));
  for (const tok of [...view.selected]) {
    if (!live.has(tok)) view.selected.delete(tok);
  }
}
function filteredAccounts() {
  const view = accountsViewState();
  const items = state.accounts || [];
  const q = view.search.trim().toLowerCase();
  return items.filter((acc) => {
    if (q && !String(acc.email || "").toLowerCase().includes(q)) return false;
    if (view.typeFilter !== "all" && accountTypeKey(acc) !== view.typeFilter) return false;
    if (view.statusFilter !== "all" && String(acc.status || "正常") !== view.statusFilter) return false;
    return true;
  });
}
function accountStatsBuckets(items) {
  const total = items.length;
  let active = 0, limited = 0, abnormal = 0, disabled = 0;
  for (const it of items) {
    const s = String(it.status || "正常");
    if (s === "正常") active++;
    else if (s === "限流") limited++;
    else if (s === "异常") abnormal++;
    else if (s === "禁用") disabled++;
  }
  return { total, active, limited, abnormal, disabled, quota: quotaSummary(items) };
}
function availableAccountTypes(items) {
  const set = new Set();
  for (const it of items) set.add(accountTypeKey(it));
  return [...set];
}
function downloadAccountTokens(items) {
  const tokens = items.map((a) => a.access_token).filter(Boolean);
  if (!tokens.length) { toast("没有可导出的 token"); return; }
  const blob = new Blob([tokens.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `accounts-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderAccountsStats() {
  const stats = accountStatsBuckets(state.accounts || []);
  const host = $("#acctStats");
  if (!host) return;
  const cards = [
    { key: "total", label: "账户总数", value: stats.total, tone: "ink" },
    { key: "active", label: "正常账户", value: stats.active, tone: "ok" },
    { key: "limited", label: "限流账户", value: stats.limited, tone: "warn" },
    { key: "abnormal", label: "异常账户", value: stats.abnormal, tone: "danger" },
    { key: "disabled", label: "禁用账户", value: stats.disabled, tone: "muted" },
    { key: "quota", label: "剩余额度", value: stats.quota, tone: "info" }
  ];
  host.innerHTML = cards.map((c) => `
    <div class="account-stat-card tone-${c.tone}">
      <div class="label">${c.label}</div>
      <div class="value">${escapeHtml(String(c.value))}</div>
    </div>
  `).join("");
}

function renderAccountsBulkbar() {
  const view = accountsViewState();
  const host = $("#acctBulkbar");
  if (!host) return;
  const count = view.selected.size;
  if (count === 0) { host.innerHTML = ""; return; }
  host.innerHTML = `
    <div class="account-bulkbar">
      <div>已选 <strong>${count}</strong> 个账号</div>
      <div class="account-bulkbar-actions">
        <button class="secondary" type="button" id="acctBulkRefresh">刷新选中</button>
        <button class="secondary" type="button" id="acctBulkRemoveAbnormal">移除异常账号</button>
        <button class="secondary" type="button" id="acctBulkClear">取消选择</button>
        <button class="primary" type="button" id="acctBulkDelete">删除选中</button>
      </div>
    </div>
  `;
  $("#acctBulkRefresh", host).addEventListener("click", () => refreshAccounts([...view.selected]));
  $("#acctBulkRemoveAbnormal", host).addEventListener("click", () => removeAbnormalSelected());
  $("#acctBulkClear", host).addEventListener("click", () => { view.selected.clear(); patchAccountsView(); });
  $("#acctBulkDelete", host).addEventListener("click", () => deleteAccounts([...view.selected]));
}

function renderAccountsTable() {
  const view = accountsViewState();
  const host = $("#acctTableHost");
  if (!host) return;
  const all = filteredAccounts();
  const total = all.length;
  const pageSize = Math.max(1, Number(view.pageSize) || 10);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (view.page > pageCount) view.page = pageCount;
  const start = (view.page - 1) * pageSize;
  const rows = all.slice(start, start + pageSize);
  const allSelected = rows.length > 0 && rows.every((r) => view.selected.has(r.access_token));

  if (!total) {
    host.innerHTML = `<div class="empty">${(state.accounts || []).length ? "没有匹配筛选条件的账号。" : "号池暂无账号。点击右上角“新增”导入 token。"}</div>`;
    return;
  }

  host.innerHTML = `
    <div class="table-wrap account-table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:36px"><input type="checkbox" id="acctSelectAll" ${allSelected ? "checked" : ""}></th>
            <th>Token</th>
            <th>类型</th>
            <th>状态</th>
            <th>账号信息</th>
            <th style="text-align:right">额度</th>
            <th>恢复时间</th>
            <th style="text-align:right">成功</th>
            <th style="text-align:right">失败</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((acc) => {
            const token = acc.access_token || "";
            const checked = view.selected.has(token) ? "checked" : "";
            const statusCls = accountStatusClass(String(acc.status || ""));
            const typeKey = accountTypeKey(acc);
            const restore = formatRestoreAt(acc.restore_at);
            const isPro = typeKey === "pro" || typeKey === "prolite";
            return `
              <tr data-token="${escapeHtml(token)}">
                <td><input type="checkbox" class="acct-row-check" data-token="${escapeHtml(token)}" ${checked}></td>
                <td><code class="token-cell" title="${escapeHtml(token)}">${escapeHtml(tokenPreview(token))}</code></td>
                <td><span class="type-badge type-${typeKey}">${escapeHtml(displayAccountType(acc))}</span></td>
                <td><span class="status ${statusCls}">${escapeHtml(String(acc.status || "-"))}</span></td>
                <td><div>${escapeHtml(String(acc.email || "-"))}</div></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums">${escapeHtml(quotaDisplay(acc))}${isPro ? "" : ""}</td>
                <td>${restore.absolute === "—" ? `<span class="muted">—</span>` : `<div>${escapeHtml(restore.absolute)}</div><div class="muted" style="font-size:11px">${escapeHtml(restore.relative)}</div>`}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums">${Number(acc.success || 0)}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums">${Number(acc.fail || 0)}</td>
                <td><div class="row-actions">
                  <button class="icon-btn" data-action="edit" type="button" title="编辑">编辑</button>
                  <button class="icon-btn" data-action="refresh" type="button" title="刷新此账号">刷新</button>
                  <button class="icon-btn danger" data-action="delete" type="button" title="删除">删除</button>
                </div></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div class="account-pagination">
      <div class="muted" style="font-size:12px">显示第 ${start + 1}–${Math.min(start + rows.length, total)} 条，共 ${total} 条</div>
      <div class="pager">
        <button class="secondary" type="button" id="acctPagePrev" ${view.page <= 1 ? "disabled" : ""}>‹</button>
        <span class="muted">${view.page} / ${pageCount} 页</span>
        <button class="secondary" type="button" id="acctPageNext" ${view.page >= pageCount ? "disabled" : ""}>›</button>
        <select id="acctPageSize">${PAGE_SIZE_OPTIONS.map((n) => `<option value="${n}" ${pageSize === n ? "selected" : ""}>${n}/页</option>`).join("")}</select>
      </div>
    </div>
  `;

  $("#acctSelectAll", host)?.addEventListener("change", (event) => {
    if (event.target.checked) for (const r of rows) view.selected.add(r.access_token);
    else for (const r of rows) view.selected.delete(r.access_token);
    patchAccountsView();
  });
  $$(".acct-row-check", host).forEach((cb) => {
    cb.addEventListener("change", (event) => {
      const tok = event.target.dataset.token;
      if (event.target.checked) view.selected.add(tok); else view.selected.delete(tok);
      patchAccountsView();
    });
  });
  $$("tr[data-token]", host).forEach((row) => {
    const token = row.dataset.token;
    $("[data-action='refresh']", row)?.addEventListener("click", () => refreshAccounts([token]));
    $("[data-action='edit']", row)?.addEventListener("click", () => openEditAccountDialog(token));
    $("[data-action='delete']", row)?.addEventListener("click", () => deleteAccounts([token]));
  });
  $("#acctPagePrev", host)?.addEventListener("click", () => { view.page = Math.max(1, view.page - 1); renderAccountsTable(); });
  $("#acctPageNext", host)?.addEventListener("click", () => { view.page = Math.min(pageCount, view.page + 1); renderAccountsTable(); });
  $("#acctPageSize", host)?.addEventListener("change", (event) => {
    view.pageSize = Number(event.target.value) || 10;
    view.page = 1;
    renderAccountsTable();
  });
}

function patchAccountsView() {
  reconcileAccountsSelection();
  renderAccountsStats();
  renderAccountsBulkbar();
  renderAccountsTable();
}

function renderAccounts() {
  const view = accountsViewState();
  reconcileAccountsSelection();
  const target = UPSTREAM_VIEWS.includes(state.view) ? ($("#upstreamPanel") || $("#panel")) : $("#panel");
  const types = availableAccountTypes(state.accounts || []);
  target.innerHTML = `
    <div class="card account-card">
      <div class="upstream-header">
        <div>
          <h2>号池</h2>
          <p class="muted">管理 chatgpt2api 的 ChatGPT 账号池，支持筛选、批量刷新、导出 Token、移除异常账号。</p>
        </div>
        <div class="upstream-header-actions">
          <button class="secondary" type="button" id="acctRefreshAllBtn">一键刷新所有</button>
          <button class="secondary" type="button" id="acctExportBtn">导出全部 Token</button>
          <button class="primary" type="button" id="acctAddBtn">新增账号</button>
        </div>
      </div>

      <div id="acctStats" class="account-stats"></div>

      <div class="account-filters">
        <label class="account-search">
          <span class="muted" style="font-size:12px">搜索邮箱</span>
          <input id="acctSearch" type="search" placeholder="按邮箱过滤" value="${escapeHtml(view.search)}">
        </label>
        <label>
          <span class="muted" style="font-size:12px">类型</span>
          <select id="acctTypeFilter">
            <option value="all" ${view.typeFilter === "all" ? "selected" : ""}>全部类型</option>
            ${types.map((t) => `<option value="${escapeHtml(t)}" ${view.typeFilter === t ? "selected" : ""}>${escapeHtml(ACCOUNT_TYPE_LABELS[t] || t)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span class="muted" style="font-size:12px">状态</span>
          <select id="acctStatusFilter">
            <option value="all" ${view.statusFilter === "all" ? "selected" : ""}>全部状态</option>
            ${ACCOUNT_STATUSES.map((s) => `<option value="${s}" ${view.statusFilter === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
        <div class="account-filter-spacer"></div>
        <button class="secondary" type="button" id="acctRefreshBtn">刷新列表</button>
      </div>

      <div id="acctBulkbar"></div>
      <div id="acctTableHost"></div>
    </div>
  `;

  $("#acctAddBtn").addEventListener("click", () => openAddAccountDialog());
  $("#acctRefreshAllBtn").addEventListener("click", () => refreshAccounts([]));
  $("#acctExportBtn").addEventListener("click", () => downloadAccountTokens(state.accounts || []));
  $("#acctRefreshBtn").addEventListener("click", async () => {
    try { const data = await api("/api/admin/upstream/accounts"); state.accounts = data.items || []; patchAccountsView(); toast("已刷新列表"); }
    catch (error) { toast(error.message); }
  });
  const search = $("#acctSearch");
  if (search) {
    search.addEventListener("input", (event) => {
      view.search = String(event.target.value || "");
      view.page = 1;
      renderAccountsTable();
    });
  }
  $("#acctTypeFilter")?.addEventListener("change", (event) => {
    view.typeFilter = String(event.target.value || "all");
    view.page = 1;
    patchAccountsView();
  });
  $("#acctStatusFilter")?.addEventListener("change", (event) => {
    view.statusFilter = String(event.target.value || "all");
    view.page = 1;
    patchAccountsView();
  });

  patchAccountsView();
}

async function refreshAccounts(accessTokens = []) {
  const list = Array.isArray(accessTokens) ? accessTokens.filter(Boolean) : [];
  try {
    const data = await api("/api/admin/upstream/accounts/refresh", { method: "POST", body: JSON.stringify({ access_tokens: list }) });
    if (Array.isArray(data.items)) { state.accounts = data.items; patchAccountsView(); }
    else { await loadPanel(); patchAccountsView(); }
    toast(list.length ? `已刷新 ${list.length} 个` : "已刷新全部");
  } catch (error) { toast(error.message); }
}

async function deleteAccounts(tokens) {
  const list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
  if (!list.length) return;
  if (!window.confirm(`确认删除 ${list.length} 个账号？此操作不可撤销。`)) return;
  try {
    await api("/api/admin/upstream/accounts", { method: "DELETE", body: JSON.stringify({ tokens: list }) });
    toast(`已删除 ${list.length} 个`);
    accountsViewState().selected.clear();
    await loadPanel(); patchAccountsView();
  } catch (error) { toast(error.message); }
}

async function removeAbnormalSelected() {
  const view = accountsViewState();
  const items = state.accounts || [];
  const abnormal = items
    .filter((a) => view.selected.has(a.access_token) && a.status === "异常")
    .map((a) => a.access_token);
  if (!abnormal.length) { toast("选中范围内没有异常账号"); return; }
  deleteAccounts(abnormal);
}

function openAddAccountDialog() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.42);display:grid;place-items:center;z-index:60";
  wrap.innerHTML = `
    <div class="card" style="max-width:560px;width:90%">
      <h2 style="margin-top:0">添加账号</h2>
      <p class="muted">粘贴 access_token，一行一个。也支持 JSON 格式。</p>
      <label>access_token / JSON<textarea id="addAccountText" rows="8" style="font-family:monospace;font-size:12px"></textarea></label>
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
    if (!raw) { toast("请粘贴至少一条"); return; }
    const tokens = []; const entries = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim(); if (!trimmed) continue;
      if (trimmed.startsWith("{")) {
        try { const obj = JSON.parse(trimmed); if (obj?.access_token) { entries.push({ access_token: obj.access_token, session_token: obj.session_token }); continue; } } catch {}
      }
      tokens.push(trimmed);
    }
    if (!tokens.length && !entries.length) { toast("没有可用的 token"); return; }
    try {
      const result = await api("/api/admin/upstream/accounts", { method: "POST", body: JSON.stringify({ tokens, entries }) });
      toast(`导入 ${result.added ?? (tokens.length + entries.length)} 条`);
      wrap.remove(); await loadPanel(); patchAccountsView();
    } catch (error) { toast(error.message); }
  });
}

function openEditAccountDialog(token) {
  const account = (state.accounts || []).find((a) => a.access_token === token);
  if (!account) return;
  const currentType = accountTypeKey(account);
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.42);display:grid;place-items:center;z-index:60";
  wrap.innerHTML = `
    <div class="card" style="max-width:520px;width:90%">
      <h2 style="margin-top:0">编辑账号</h2>
      <p class="muted" style="font-size:12px;margin-top:-6px">${escapeHtml(account.email || "未关联邮箱")} · <code style="font-family:ui-monospace,monospace">${escapeHtml(tokenPreview(token))}</code></p>
      <label>类型<select id="editAccountType">${ACCOUNT_TYPE_OPTIONS.map((v) => `<option value="${v}" ${currentType === v ? "selected" : ""}>${ACCOUNT_TYPE_LABELS[v] || v}</option>`).join("")}</select></label>
      <label>状态<select id="editAccountStatus">${ACCOUNT_STATUSES.map((v) => `<option value="${v}" ${account.status === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>配额 <input id="editAccountQuota" type="number" min="0" value="${Number(account.quota || 0)}"></label>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
        <button class="secondary" type="button" id="editAccountCancel">取消</button>
        <button class="primary" type="button" id="editAccountSubmit">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  $("#editAccountCancel", wrap).addEventListener("click", () => wrap.remove());
  $("#editAccountSubmit", wrap).addEventListener("click", async () => {
    const payload = {
      access_token: token,
      type: $("#editAccountType", wrap).value,
      status: $("#editAccountStatus", wrap).value,
      quota: Number($("#editAccountQuota", wrap).value || 0)
    };
    try {
      await api("/api/admin/upstream/accounts/update", { method: "POST", body: JSON.stringify(payload) });
      toast("已更新"); wrap.remove(); await loadPanel(); patchAccountsView();
    } catch (error) { toast(error.message); }
  });
}


// ===================== Register (注册机) =====================

const REGISTER_MODE_LABELS = { total: "按总数", quota: "按累计配额", available: "按可用配额" };
const MAIL_PROVIDER_TYPES = [
  { value: "cloudflare_temp_email", label: "Cloudflare Temp Email" },
  { value: "tempmail_lol", label: "TempMail.lol" },
  { value: "moemail", label: "MoEmail" },
  { value: "inbucket", label: "Inbucket" },
  { value: "duckmail", label: "DuckMail" },
  { value: "gptmail", label: "GPTMail" },
  { value: "yyds_mail", label: "YYDS Mail" }
];

function getProviderDefaults(type) {
  const defaults = {
    cloudflare_temp_email: { api_base: "", admin_password: "", domain: [] },
    tempmail_lol: { api_key: "", domain: [] },
    moemail: { api_base: "", api_key: "", domain: [] },
    inbucket: { api_base: "", domain: [], random_subdomain: true },
    duckmail: { api_key: "", default_domain: "duckmail.sbs" },
    gptmail: { api_key: "", default_domain: "" },
    yyds_mail: { api_base: "https://maliapi.215.im/v1", api_key: "", domain: [], subdomain: "", wildcard: false }
  };
  return defaults[type] || {};
}

function renderProviderFields(provider, index, disabled) {
  const type = String(provider.type || "tempmail_lol");
  const domainList = Array.isArray(provider.domain) ? provider.domain.join("\n") : "";
  let fields = "";

  // API Base (cloudflare, moemail, inbucket, yyds_mail)
  if (["cloudflare_temp_email", "moemail", "inbucket", "yyds_mail"].includes(type)) {
    fields += `<label>API Base<input class="prov-field" data-idx="${index}" data-key="api_base" value="${escapeHtml(String(provider.api_base || ""))}" ${disabled} placeholder="https://..."></label>`;
  }
  // Admin Password (cloudflare)
  if (type === "cloudflare_temp_email") {
    fields += `<label>Admin Password<input class="prov-field" data-idx="${index}" data-key="admin_password" value="${escapeHtml(String(provider.admin_password || ""))}" ${disabled}></label>`;
  }
  // API Key (tempmail_lol, moemail, duckmail, gptmail, yyds_mail)
  if (["tempmail_lol", "moemail", "duckmail", "gptmail", "yyds_mail"].includes(type)) {
    fields += `<label>API Key<input class="prov-field" data-idx="${index}" data-key="api_key" value="${escapeHtml(String(provider.api_key || ""))}" ${disabled}></label>`;
  }
  // Default Domain (duckmail, gptmail)
  if (["duckmail", "gptmail"].includes(type)) {
    fields += `<label>Default Domain<input class="prov-field" data-idx="${index}" data-key="default_domain" value="${escapeHtml(String(provider.default_domain || ""))}" ${disabled} placeholder="${type === "duckmail" ? "duckmail.sbs" : ""}"></label>`;
  }
  // Subdomain + Wildcard (yyds_mail)
  if (type === "yyds_mail") {
    fields += `<label>Subdomain<input class="prov-field" data-idx="${index}" data-key="subdomain" value="${escapeHtml(String(provider.subdomain || ""))}" ${disabled}></label>`;
    fields += `<label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" class="prov-check" data-idx="${index}" data-key="wildcard" ${provider.wildcard ? "checked" : ""} ${disabled}> Wildcard</label>`;
  }
  // Random subdomain (inbucket)
  if (type === "inbucket") {
    fields += `<label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" class="prov-check" data-idx="${index}" data-key="random_subdomain" ${provider.random_subdomain !== false ? "checked" : ""} ${disabled}> 随机子域名</label>`;
  }
  // Domain list (cloudflare, tempmail_lol, moemail, inbucket, yyds_mail)
  if (["cloudflare_temp_email", "tempmail_lol", "moemail", "inbucket", "yyds_mail"].includes(type)) {
    fields += `<label style="grid-column:1/-1">域名列表（每行一个）<textarea class="prov-field" data-idx="${index}" data-key="domain" rows="3" style="font-family:monospace;font-size:12px" ${disabled} placeholder="每行一个域名">${escapeHtml(domainList)}</textarea></label>`;
  }
  // Expiry time (moemail)
  if (type === "moemail") {
    fields += `<label>过期时间（秒）<input class="prov-field" data-idx="${index}" data-key="expiry_time" type="number" min="0" value="${Number(provider.expiry_time || 0)}" ${disabled}></label>`;
  }
  return fields;
}

// Returns whether a given register field should be disabled based on the
// active mode + running state. Mirrors the upstream chatgpt2api UI in
// vendor/chatgpt2api/web/src/app/register/components/register-card.tsx.
function registerFieldDisabled(field, mode, enabled) {
  if (enabled) return true;
  if (field === "total") return mode !== "total";
  if (field === "target_quota") return mode !== "quota";
  if (field === "target_available") return mode !== "available";
  if (field === "check_interval") return mode === "total";
  return false;
}

function renderRegister() {
  const reg = state.register || {};
  const mail = reg.mail || {};
  const providers = Array.isArray(mail.providers) ? mail.providers : [];
  const enabled = Boolean(reg.enabled);
  const mode = String(reg.mode || "total");
  const dis = enabled ? "disabled" : "";
  const dAttr = (field) => registerFieldDisabled(field, mode, enabled) ? "disabled" : "";

  const target = $("#upstreamPanel") || $("#panel");
  target.innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div><h2>注册机</h2><p class="muted">chatgpt2api 自动注册流程。可配置多个邮箱提供商，按启用顺序轮换。</p></div>
        <div class="upstream-header-actions"><span id="regStatusBadge" class="status ${enabled ? "warn" : ""}">${enabled ? "运行中" : "已停止"}</span></div>
      </div>

      <form id="regForm" class="form">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:flex-end">
          <label>模式<select id="regMode" ${dis}>${Object.entries(REGISTER_MODE_LABELS).map(([v, l]) => `<option value="${v}" ${mode === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label>注册总数<input id="regTotal" type="number" min="1" value="${Number(reg.total || 10)}" ${dAttr("total")}></label>
          <label>线程数<input id="regThreads" type="number" min="1" max="20" value="${Number(reg.threads || 3)}" ${dis}></label>
          <label>目标剩余额度<input id="regTargetQuota" type="number" min="1" value="${Number(reg.target_quota || 100)}" ${dAttr("target_quota")}></label>
          <label>目标可用账号<input id="regTargetAvailable" type="number" min="1" value="${Number(reg.target_available || 10)}" ${dAttr("target_available")}></label>
          <label>检查间隔（秒）<input id="regCheckInterval" type="number" min="1" value="${Number(reg.check_interval || 5)}" ${dAttr("check_interval")}></label>
          <label style="grid-column:1/-1">注册代理<input id="regProxy" value="${escapeHtml(String(reg.proxy || ""))}" placeholder="http://user:pass@host:port" ${dis}></label>
        </div>

        <div style="margin-top:16px;border-top:1px solid var(--border,#e2e8f0);padding-top:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div><strong>邮箱配置</strong><span class="muted" style="margin-left:8px">可配置多个 provider，按启用顺序轮换</span></div>
            <button class="secondary" type="button" id="regAddProvider" ${dis}>+ 添加提供商</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px">
            <label>请求超时（秒）<input id="regMailTimeout" type="number" min="1" value="${Number(mail.request_timeout || 30)}" ${dis}></label>
            <label>等待验证码超时<input id="regMailWaitTimeout" type="number" min="1" value="${Number(mail.wait_timeout || 30)}" ${dis}></label>
            <label>轮询间隔（秒）<input id="regMailWaitInterval" type="number" step="0.5" min="0.5" value="${Number(mail.wait_interval || 2)}" ${dis}></label>
          </div>
          <div id="providersList">
            ${providers.map((prov, idx) => `
              <div class="provider-card" data-provider-idx="${idx}" style="border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:12px;margin-bottom:10px;background:var(--surface,#f8fafc)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                  <label style="flex-direction:row;align-items:center;gap:6px;margin:0"><input type="checkbox" class="prov-enable" data-idx="${idx}" ${prov.enable !== false ? "checked" : ""} ${dis}> 启用</label>
                  <div style="display:flex;gap:6px;align-items:center">
                    <span class="muted" style="font-size:12px">#${idx + 1}</span>
                    <button class="tiny" type="button" data-delete-provider="${idx}" ${dis || providers.length <= 1 ? "disabled" : ""}>删除</button>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:flex-end">
                  <label>类型<select class="prov-type" data-idx="${idx}" ${dis}>
                    ${MAIL_PROVIDER_TYPES.map((t) => `<option value="${t.value}" ${prov.type === t.value ? "selected" : ""}>${t.label}</option>`).join("")}
                  </select></label>
                  ${renderProviderFields(prov, idx, dis)}
                </div>
              </div>
            `).join("")}
            ${providers.length === 0 ? `<div class="empty" style="padding:20px;text-align:center">暂无邮箱提供商，点击「添加提供商」开始配置。</div>` : ""}
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="primary" type="submit" ${dis}>保存配置</button>
          <button class="secondary" type="button" id="regStart" ${enabled ? "disabled" : ""}>启动</button>
          <button class="secondary" type="button" id="regStop" ${enabled ? "" : "disabled"}>停止</button>
          <button class="secondary" type="button" id="regReset" ${dis}>重置</button>
        </div>
      </form>

      <div id="regStatsGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:14px">
        ${renderRegisterStatsCards(reg)}
      </div>

      <div id="regLogsHost">${renderRegisterLogsBlock(reg)}</div>
    </div>
  `;

  // Event bindings
  $("#regForm").addEventListener("submit", saveRegisterConfig);
  $("#regStart").addEventListener("click", () => registerLifecycle("start"));
  $("#regStop").addEventListener("click", () => registerLifecycle("stop"));
  $("#regReset").addEventListener("click", () => registerLifecycle("reset"));
  // Mode changes only re-evaluate which numeric fields are enabled. We do
  // *not* re-render the whole form so anything the admin is currently typing
  // in other inputs is preserved.
  $("#regMode")?.addEventListener("change", (event) => {
    const newMode = String(event.target.value || "total");
    if (state.register) state.register.mode = newMode;
    applyModeDisabledState(newMode);
  });
  $("#regAddProvider")?.addEventListener("click", () => {
    syncFormToState();
    if (!state.register) state.register = {};
    if (!state.register.mail) state.register.mail = {};
    const providers = Array.isArray(state.register.mail.providers) ? [...state.register.mail.providers] : [];
    providers.push({ type: "tempmail_lol", enable: true, ...getProviderDefaults("tempmail_lol") });
    state.register.mail.providers = providers;
    renderRegister();
  });
  $$("[data-delete-provider]").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncFormToState();
      const idx = Number(btn.dataset.deleteProvider);
      const providers = [...(state.register?.mail?.providers || [])];
      providers.splice(idx, 1);
      state.register.mail.providers = providers;
      renderRegister();
    });
  });
  $$(".prov-type").forEach((sel) => {
    sel.addEventListener("change", () => {
      syncFormToState();
      const idx = Number(sel.dataset.idx);
      const providers = [...(state.register?.mail?.providers || [])];
      const oldProv = providers[idx] || {};
      providers[idx] = { type: sel.value, enable: oldProv.enable !== false, ...getProviderDefaults(sel.value) };
      state.register.mail.providers = providers;
      renderRegister();
    });
  });
}

function collectRegisterMailConfig() {
  const providers = [];
  $$(".provider-card").forEach((card) => {
    const idx = Number(card.dataset.providerIdx);
    const enableBox = $(`.prov-enable[data-idx="${idx}"]`, card);
    const typeSelect = $(`.prov-type[data-idx="${idx}"]`, card);
    const prov = { type: typeSelect?.value || "tempmail_lol", enable: enableBox?.checked !== false };
    $$(".prov-field", card).forEach((field) => {
      const key = field.dataset.key;
      if (key === "domain") {
        prov[key] = field.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      } else if (key === "expiry_time") {
        prov[key] = Number(field.value || 0);
      } else {
        prov[key] = field.value;
      }
    });
    $$(".prov-check", card).forEach((check) => {
      prov[check.dataset.key] = check.checked;
    });
    providers.push(prov);
  });
  return {
    request_timeout: Number($("#regMailTimeout")?.value || 30),
    wait_timeout: Number($("#regMailWaitTimeout")?.value || 30),
    wait_interval: Number($("#regMailWaitInterval")?.value || 2),
    providers
  };
}

// Capture the current values from the rendered register form back into
// state.register. Used right before any structural re-render (add / delete
// provider, provider-type change) so the admin's unsaved edits survive.
function syncFormToState() {
  if (!$("#regForm")) return;
  if (!state.register) state.register = {};
  const reg = state.register;
  if ($("#regMode")) reg.mode = $("#regMode").value;
  if ($("#regTotal")) reg.total = Number($("#regTotal").value || 0);
  if ($("#regThreads")) reg.threads = Number($("#regThreads").value || 0);
  if ($("#regTargetQuota")) reg.target_quota = Number($("#regTargetQuota").value || 0);
  if ($("#regTargetAvailable")) reg.target_available = Number($("#regTargetAvailable").value || 0);
  if ($("#regCheckInterval")) reg.check_interval = Number($("#regCheckInterval").value || 0);
  if ($("#regProxy")) reg.proxy = $("#regProxy").value;
  reg.mail = collectRegisterMailConfig();
}

// Update only the `disabled` attribute on numeric mode-sensitive inputs when
// the mode dropdown changes, leaving all other inputs and their values
// untouched (so the admin doesn't lose work-in-progress edits).
function applyModeDisabledState(mode) {
  const reg = state.register || {};
  const enabled = Boolean(reg.enabled);
  const map = { regTotal: "total", regTargetQuota: "target_quota", regTargetAvailable: "target_available", regCheckInterval: "check_interval" };
  for (const [id, field] of Object.entries(map)) {
    const input = $(`#${id}`);
    if (input) input.disabled = registerFieldDisabled(field, mode, enabled);
  }
}

async function saveRegisterConfig(event) {
  event.preventDefault();
  const mail = collectRegisterMailConfig();
  const payload = {
    mode: $("#regMode").value,
    total: Number($("#regTotal").value || 0),
    threads: Number($("#regThreads").value || 0),
    proxy: $("#regProxy").value.trim(),
    target_quota: Number($("#regTargetQuota")?.value || 100),
    target_available: Number($("#regTargetAvailable")?.value || 10),
    check_interval: Number($("#regCheckInterval")?.value || 5),
    mail
  };
  try {
    const data = await api("/api/admin/upstream/register", { method: "POST", body: JSON.stringify(payload) });
    state.register = data.register || null;
    toast("配置已保存"); renderRegister();
  } catch (error) { toast(error.message); }
}

async function registerLifecycle(action) {
  if (action === "reset" && !window.confirm("确认重置？")) return;
  try {
    const data = await api(`/api/admin/upstream/register/${action}`, { method: "POST" });
    state.register = data.register || null;
    toast({ start: "已启动", stop: "已停止", reset: "已重置" }[action] || "OK");
    if (action === "start") startRegisterPolling();
    if (action === "stop") stopRegisterPolling();
    renderRegister();
  } catch (error) { toast(error.message); }
}


// ===================== Users =====================

function renderUsers() {
  $("#panel").innerHTML = `
    <div class="card">
      <h2>用户管理</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>用户</th><th>角色</th><th>状态</th><th>积分</th><th>增减</th><th>注册时间</th><th></th></tr></thead>
          <tbody>
            ${state.users.map((user) => `
              <tr data-user-id="${escapeHtml(user.id)}">
                <td><strong>${escapeHtml(user.name || user.email)}</strong><br><span class="muted">${escapeHtml(user.email)}</span></td>
                <td><select class="role-input" ${user.id === state.user.id ? "disabled" : ""}><option value="user" ${user.role === "user" ? "selected" : ""}>用户</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>管理员</option></select></td>
                <td><select class="status-input" ${user.id === state.user.id ? "disabled" : ""}><option value="active" ${user.status === "active" ? "selected" : ""}>启用</option><option value="disabled" ${user.status === "disabled" ? "selected" : ""}>停用</option></select></td>
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
  $$(".save-user").forEach((btn) => { btn.addEventListener("click", () => saveUser(btn.closest("tr"))); });
}

// ===================== Redeem =====================

function renderRedeem() {
  const codes = state.redeemCodes || [];
  const filter = state.redeemFilter || "";
  const lastBatch = state.lastBatch;
  $("#panel").innerHTML = `
    <div class="grid">
      <section class="card">
        <h2>批量生成卡密</h2>
        <form id="redeemCreateForm" class="form">
          <label>数量<input id="redeemCount" type="number" min="1" max="1000" value="10" required></label>
          <label>每张积分<input id="redeemCredits" type="number" min="1" max="100000" value="100" required></label>
          <label>有效期（天，留空永不过期）<input id="redeemDays" type="number" min="0" max="3650" placeholder="不填则永不过期"></label>
          <button class="primary" type="submit">生成卡密</button>
        </form>
        ${lastBatch ? `
          <div class="redeem-last-batch">
            <h3>最新批次 (${lastBatch.codes.length} 张 · 每张 ${lastBatch.credits} 积分)</h3>
            <div class="redeem-actions">
              <button class="secondary" id="redeemCopyBtn" type="button">复制</button>
              <button class="secondary" id="redeemDownloadBtn" type="button">下载</button>
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
            <thead><tr><th>卡密</th><th>积分</th><th>状态</th><th>使用者</th><th>创建</th><th></th></tr></thead>
            <tbody>
              ${codes.length ? codes.map((code) => `
                <tr>
                  <td><code>${escapeHtml(code.code)}</code></td>
                  <td>${Number(code.credits || 0)}</td>
                  <td><span class="status ${code.status === "used" ? "" : code.status === "disabled" ? "failed" : ""}">${escapeHtml(code.status)}</span></td>
                  <td class="muted">${escapeHtml(code.usedByUserEmail || "-")}</td>
                  <td class="muted">${fmt(code.createdAt)}</td>
                  <td>${code.status === "unused" ? `<button class="tiny redeem-disable" data-code="${escapeHtml(code.code)}" type="button">禁用</button>` : ""}</td>
                </tr>
              `).join("") : `<tr><td colspan="6" class="empty">暂无卡密</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
  $("#redeemCreateForm").addEventListener("submit", createRedeemBatch);
  $$("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", async () => { state.redeemFilter = btn.dataset.filter; await loadPanel(); renderRedeem(); });
  });
  $$(".redeem-disable").forEach((btn) => { btn.addEventListener("click", () => disableRedeemCode(btn.dataset.code)); });
  if (lastBatch) {
    $("#redeemCopyBtn").addEventListener("click", () => { navigator.clipboard.writeText(lastBatch.codes.join("\n")).then(() => toast("已复制"), () => toast("复制失败")); });
    $("#redeemDownloadBtn").addEventListener("click", () => {
      const blob = new Blob([lastBatch.codes.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `redeem-codes-${lastBatch.batchId}.txt`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
  }
}

async function createRedeemBatch(event) {
  event.preventDefault();
  const count = Number($("#redeemCount").value || 0);
  const credits = Number($("#redeemCredits").value || 0);
  const expiresInDays = Number($("#redeemDays").value || 0);
  if (!count || !credits) { toast("请填写数量和积分"); return; }
  try {
    const result = await api("/api/admin/redeem-codes", { method: "POST", body: JSON.stringify({ count, credits, expiresInDays: expiresInDays || undefined }) });
    state.lastBatch = result; toast(`已生成 ${result.codes.length} 张`); await loadPanel(); renderRedeem();
  } catch (error) { toast(error.message); }
}

async function disableRedeemCode(code) {
  if (!confirm(`禁用卡密 ${code}？`)) return;
  try { await api(`/api/admin/redeem-codes/${encodeURIComponent(code)}/disable`, { method: "POST" }); toast("已禁用"); await loadPanel(); renderRedeem(); }
  catch (error) { toast(error.message); }
}


// ===================== Transactions =====================

const TX_TYPE_LABELS = {
  register_bonus: "注册赠送", checkin: "签到", consume_generate: "生图消耗",
  consume_edit: "编辑消耗", consume: "消耗", refund_failure: "失败退款",
  refund_partial: "部分退款", topup_redeem: "卡密充值", topup_payment: "支付充值",
  admin_adjust: "管理员调整", credit: "积分变动"
};
function txLabel(type) { return TX_TYPE_LABELS[type] || type; }

function renderTransactions() {
  const txs = state.transactions || [];
  $("#panel").innerHTML = `
    <div class="card">
      <h2>积分流水</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>用户</th><th>类型</th><th>变动</th><th>余额</th><th>备注</th><th>时间</th></tr></thead>
          <tbody>
            ${txs.length ? txs.map((tx) => `
              <tr>
                <td><strong>${escapeHtml(tx.userEmail || tx.userName || tx.userId)}</strong></td>
                <td>${escapeHtml(txLabel(tx.type))}</td>
                <td class="${tx.delta >= 0 ? "tx-pos" : "tx-neg"}">${tx.delta >= 0 ? "+" : ""}${tx.delta}</td>
                <td>${tx.balanceAfter}</td>
                <td class="muted">${escapeHtml(tx.note || "")}</td>
                <td class="muted">${fmt(tx.createdAt)}</td>
              </tr>
            `).join("") : `<tr><td colspan="6" class="empty">暂无流水</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===================== Payments =====================

function renderPayments() {
  const payments = state.payments || [];
  $("#panel").innerHTML = `
    <div class="card">
      <h2>支付订单</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>订单号</th><th>用户</th><th>金额</th><th>积分</th><th>状态</th><th>时间</th></tr></thead>
          <tbody>
            ${payments.length ? payments.map((p) => `
              <tr>
                <td><code>${escapeHtml(p.id)}</code></td>
                <td><strong>${escapeHtml(p.userEmail || p.userId)}</strong></td>
                <td>${(p.amountCents / 100).toFixed(2)} ${escapeHtml(p.currency)}</td>
                <td>${p.credits}</td>
                <td><span class="status ${p.status === "paid" ? "" : p.status === "failed" ? "failed" : ""}">${escapeHtml(p.status)}</span></td>
                <td class="muted">${fmt(p.createdAt)}</td>
              </tr>
            `).join("") : `<tr><td colspan="6" class="empty">暂无订单</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===================== Settings (simplified) =====================

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
            <label><input type="radio" name="activeUpstream" value="chatgpt2api" ${active === "chatgpt2api" ? "checked" : ""}> chatgpt2api</label>
            <label><input type="radio" name="activeUpstream" value="cpa" ${active === "cpa" ? "checked" : ""}> CPA (OpenAI 兼容)</label>
          </fieldset>

          <fieldset class="upstream-group">
            <legend>${active === "cpa" ? "CPA" : "chatgpt2api"} 上游配置</legend>
            ${active === "cpa" ? `
              <label>API Key<input id="cpaApiKeyInput" type="password" placeholder="${escapeHtml(upstreams.cpa?.apiKeyMask || "不修改则留空")}"></label>
              <label>API 地址<input id="cpaApiBaseUrlInput" value="${escapeHtml(upstreams.cpa?.apiBaseUrl || "")}" placeholder="https://your-cpa.example.com/v1"></label>
              <label>模型<input id="cpaModelInput" value="${escapeHtml(upstreams.cpa?.model || "")}" placeholder="gpt-image-2"></label>
              <div class="upstream-actions">
                <button class="tiny" type="button" data-test-upstream="cpa">测试连通</button>
                <button class="tiny secondary" type="button" id="clearCpaKeyBtn">清除 Key</button>
                <span class="muted upstream-test-result" data-test-result="cpa"></span>
              </div>
            ` : `
              <label>API Key<input id="apiKeyInput" type="password" placeholder="${escapeHtml(upstreams.chatgpt2api?.apiKeyMask || "不修改则留空")}"></label>
              <label>API 地址<input id="apiBaseUrlInput" value="${escapeHtml(upstreams.chatgpt2api?.apiBaseUrl || "")}" placeholder="http://chatgpt2api:80/v1"></label>
              <label>模型<input id="modelInput" value="${escapeHtml(upstreams.chatgpt2api?.model || settings.model || "gpt-image-2")}"></label>
              <div class="upstream-actions">
                <button class="tiny" type="button" data-test-upstream="chatgpt2api">测试连通</button>
                <button class="tiny secondary" type="button" id="clearKeyBtn">清除 Key</button>
                <span class="muted upstream-test-result" data-test-result="chatgpt2api"></span>
              </div>
            `}
          </fieldset>

          <fieldset class="upstream-group">
            <legend>基本设置</legend>
            <label><input id="allowRegistrationInput" type="checkbox" ${settings.allowRegistration ? "checked" : ""}> 开放注册</label>
            <label><input id="requireApprovalInput" type="checkbox" ${settings.requireApproval ? "checked" : ""}> 新用户需审核</label>
            <label>每张图消耗积分<input id="generationCreditCostInput" type="number" min="0" value="${Number(settings.generationCreditCost ?? 1)}"></label>
          </fieldset>

          <details class="advanced-toggle">
            <summary>更多设置</summary>
            <fieldset class="upstream-group" style="margin-top:10px">
              <label>注册送积分<input id="defaultCreditsInput" type="number" min="0" value="${Number(settings.defaultCredits ?? 10)}"></label>
              <label>单次最大张数<input id="maxImagesInput" type="number" min="1" max="4" value="${Number(settings.maxImagesPerRequest ?? 1)}"></label>
              ${active === "cpa" ? `
                <p class="muted">chatgpt2api 上游（备用）</p>
                <label>API Key<input id="apiKeyInput" type="password" placeholder="${escapeHtml(upstreams.chatgpt2api?.apiKeyMask || "留空不修改")}"></label>
                <label>API 地址<input id="apiBaseUrlInput" value="${escapeHtml(upstreams.chatgpt2api?.apiBaseUrl || "")}" placeholder="http://chatgpt2api:80/v1"></label>
                <label>模型<input id="modelInput" value="${escapeHtml(upstreams.chatgpt2api?.model || settings.model || "gpt-image-2")}"></label>
              ` : `
                <p class="muted">CPA 上游（备用）</p>
                <label>API Key<input id="cpaApiKeyInput" type="password" placeholder="${escapeHtml(upstreams.cpa?.apiKeyMask || "留空不修改")}"></label>
                <label>API 地址<input id="cpaApiBaseUrlInput" value="${escapeHtml(upstreams.cpa?.apiBaseUrl || "")}" placeholder="https://..."></label>
                <label>模型<input id="cpaModelInput" value="${escapeHtml(upstreams.cpa?.model || "")}" placeholder="gpt-image-2"></label>
              `}
            </fieldset>
          </details>

          <button class="primary" type="submit">保存设置</button>
        </form>
      </section>
    </div>
  `;
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#clearKeyBtn")?.addEventListener("click", clearKey);
  $("#clearCpaKeyBtn")?.addEventListener("click", clearCpaKey);
  document.querySelectorAll("[data-test-upstream]").forEach((btn) => {
    btn.addEventListener("click", () => testUpstream(btn.dataset.testUpstream));
  });
}


// ===================== Data loading =====================

async function loadPanel() {
  if (state.view === "logs") {
    try {
      const params = new URLSearchParams();
      const filter = state.logsFilter || {};
      if (filter.type) params.set("type", filter.type);
      if (filter.start_date) params.set("start_date", filter.start_date);
      if (filter.end_date) params.set("end_date", filter.end_date);
      const query = params.toString();
      const logsData = await api(`/api/admin/upstream/logs${query ? `?${query}` : ""}`);
      state.logs = Array.isArray(logsData.items) ? logsData.items : [];
      state.logsError = "";
    } catch (error) {
      // Surface the real upstream error instead of silently showing an empty
      // table — typical failure is `Upstream (chatgpt2api) is not configured`
      // (503) or a bad CHATGPT2API_AUTH_KEY (401). Without this the admin
      // just sees "暂无记录" with no diagnostic.
      state.logs = [];
      state.logsError = String(error?.message || error || "上游调用日志加载失败");
      toast(state.logsError);
    }
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
    } catch (error) { state.accounts = []; toast(error.message); }
  } else if (state.view === "register") {
    try {
      const data = await api("/api/admin/upstream/register");
      state.register = data.register || null;
      // Only poll when the register loop is actually running. Polling while
      // stopped would replace the form's stats / logs sections every 2s with
      // identical data and was previously also clobbering admin-edited form
      // inputs (the function ignored its preserveFocus flag).
      if (state.register?.enabled) startRegisterPolling();
      else stopRegisterPolling();
    } catch (error) { state.register = null; toast(error.message); }
  } else {
    state.settings = await api("/api/admin/settings");
  }
}

// ===================== Auth & actions =====================

async function login(event) {
  event.preventDefault();
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: $("#emailInput").value, password: $("#passwordInput").value }) });
    await bootstrap();
  } catch (error) { toast(error.message); }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => null);
  state.user = null; renderLogin();
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
    toast("已保存"); await loadPanel(); renderUsers();
  } catch (error) { toast(error.message); }
}

async function saveSettings(event) {
  event.preventDefault();
  const activeUpstreamInput = document.querySelector('input[name="activeUpstream"]:checked');
  try {
    state.settings = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({
        openaiApiKey: ($("#apiKeyInput")?.value || "").trim(),
        apiBaseUrl: ($("#apiBaseUrlInput")?.value || "").trim(),
        model: ($("#modelInput")?.value || "").trim(),
        cpaApiKey: ($("#cpaApiKeyInput")?.value || "").trim(),
        cpaApiBaseUrl: ($("#cpaApiBaseUrlInput")?.value || "").trim(),
        cpaModel: ($("#cpaModelInput")?.value || "").trim(),
        activeUpstream: activeUpstreamInput?.value || "chatgpt2api",
        defaultCredits: Number($("#defaultCreditsInput")?.value || 0),
        generationCreditCost: Number($("#generationCreditCostInput")?.value || 0),
        maxImagesPerRequest: Number($("#maxImagesInput")?.value || 1),
        allowRegistration: $("#allowRegistrationInput")?.checked || false,
        requireApproval: $("#requireApprovalInput")?.checked || false
      })
    });
    toast("设置已保存"); renderSettings();
  } catch (error) { toast(error.message); }
}

async function clearKey() {
  try {
    state.settings = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ clearApiKey: true }) });
    toast("Key 已清除"); renderSettings();
  } catch (error) { toast(error.message); }
}

async function clearCpaKey() {
  try {
    state.settings = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ clearCpaApiKey: true }) });
    toast("Key 已清除"); renderSettings();
  } catch (error) { toast(error.message); }
}

async function testUpstream(upstream) {
  const resultEl = document.querySelector(`[data-test-result="${upstream}"]`);
  if (resultEl) { resultEl.textContent = "测试中…"; resultEl.classList.remove("failed", "ok"); }
  try {
    const data = await api("/api/admin/settings/test", { method: "POST", body: JSON.stringify({ upstream }) });
    if (resultEl) { resultEl.textContent = data.ok ? `✓ ${data.message || "连通"}` : `✗ ${data.message || `HTTP ${data.status}`}`; resultEl.classList.add(data.ok ? "ok" : "failed"); }
  } catch (error) { if (resultEl) { resultEl.textContent = `✗ ${error.message}`; resultEl.classList.add("failed"); } }
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
  } catch (error) { toast(error.message); renderLogin(); }
}

$("#logoutBtn").addEventListener("click", logout);
bootstrap();
