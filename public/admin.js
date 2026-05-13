const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null,
  firstRun: false,
  view: "dashboard",
  settings: null,
  users: [],
  records: [],
  generations: [],
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
  showUpstreamTabs: false,
  upstreamConfig: null,
  upstreamConfigError: "",
  upstreamStorage: null,
  backups: [],
  backupState: null,
  backupSettings: null,
  backupsError: ""
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

function hideSidebar() {
  const sidebar = $("#adminSidebar");
  const overlay = $("#sidebarOverlay");
  if (sidebar) sidebar.classList.add("hidden");
  if (overlay) overlay.classList.remove("open");
}

function showSidebar() {
  const sidebar = $("#adminSidebar");
  const overlay = $("#sidebarOverlay");
  if (sidebar) sidebar.classList.remove("hidden");
  if (overlay) overlay.classList.remove("open");
}

function renderLogin() {
  hideSidebar();
  $("#adminApp").innerHTML = `
    <div style="max-width:420px;margin:80px auto;padding:0 16px">
      <div class="page-header" style="text-align:center">
        <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:grid;place-items:center;color:#fff;font-size:24px"><i class="ri-sparkling-2-fill"></i></div>
        <h1>后台管理</h1>
        <p class="desc">请使用管理员账号登录。</p>
      </div>
      <section class="card">
        <form id="loginForm" class="form">
          <label>邮箱<input id="emailInput" type="email" autocomplete="email" required></label>
          <label>密码<input id="passwordInput" type="password" autocomplete="current-password" required></label>
          <button class="primary" type="submit" style="width:100%;justify-content:center">登录后台</button>
          <a class="secondary" href="/" style="display:grid;place-items:center">回到前台</a>
        </form>
      </section>
    </div>
  `;
  $("#loginForm").addEventListener("submit", login);
}

function renderDenied() {
  hideSidebar();
  $("#logoutBtn").classList.remove("hidden");
  $("#adminApp").innerHTML = `
    <div style="max-width:420px;margin:80px auto;padding:0 16px;text-align:center">
      <div class="page-header">
        <h1>没有后台权限</h1>
        <p class="desc">当前账号 ${escapeHtml(state.user?.email || "")} 不是管理员。</p>
      </div>
      <section class="card">
        <button class="secondary" type="button" id="backHome" style="width:100%;justify-content:center">返回前台</button>
      </section>
    </div>
  `;
  $("#backHome").addEventListener("click", () => { window.location.href = "/"; });
}

// ===================== Main Admin Layout =====================

const UPSTREAM_VIEWS = ["accounts", "register", "upstream_settings", "logs", "backups", "settings"];

const NAV_ITEMS = [
  { section: "概览" },
  { view: "dashboard", label: "仪表盘", icon: "ri-dashboard-line" },
  { section: "业务管理" },
  { view: "generations", label: "生图记录", icon: "ri-image-line" },
  { view: "users", label: "用户管理", icon: "ri-user-line" },
  { view: "redeem", label: "卡密管理", icon: "ri-coupon-line" },
  { view: "transactions", label: "积分流水", icon: "ri-exchange-line" },
  { view: "payments", label: "支付订单", icon: "ri-bank-card-line" },
  { section: "上游管理" },
  { view: "accounts", label: "号池", icon: "ri-database-2-line" },
  { view: "logs", label: "调用日志", icon: "ri-file-list-line" },
  { view: "register", label: "注册机", icon: "ri-robot-line" },
  { view: "upstream_settings", label: "上游设置", icon: "ri-settings-4-line" },
  { view: "backups", label: "备份", icon: "ri-hard-drive-2-line" },
  { divider: true },
  { view: "settings", label: "接口设置", icon: "ri-tools-line" }
];

const VIEW_TITLES = {
  dashboard: "仪表盘",
  generations: "生图记录",
  users: "用户管理",
  redeem: "卡密管理",
  transactions: "积分流水",
  payments: "支付订单",
  accounts: "号池管理",
  logs: "调用日志",
  register: "注册机",
  upstream_settings: "上游设置",
  backups: "备份管理",
  settings: "接口设置"
};

function renderSidebar() {
  const nav = $("#sidebarNav");
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map((item) => {
    if (item.section) return `<div class="sidebar-section">${item.section}</div>`;
    if (item.divider) return `<div class="sidebar-divider"></div>`;
    return `<button class="sidebar-item ${state.view === item.view ? "active" : ""}" data-view="${item.view}"><i class="${item.icon}"></i> ${item.label}</button>`;
  }).join("");

  nav.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      stopRegisterPolling();
      state.view = btn.dataset.view;
      // close mobile sidebar
      const sidebar = $("#adminSidebar");
      const overlay = $("#sidebarOverlay");
      if (sidebar) sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("open");
      await loadPanel();
      renderAdmin();
    });
  });
}

function setupMobileMenu() {
  const menuBtn = $("#mobileMenuBtn");
  const sidebar = $("#adminSidebar");
  const overlay = $("#sidebarOverlay");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      sidebar?.classList.toggle("open");
      overlay?.classList.toggle("open");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar?.classList.remove("open");
      overlay.classList.remove("open");
    });
  }
}

function renderAdmin() {
  showSidebar();
  $("#logoutBtn").classList.remove("hidden");
  const title = VIEW_TITLES[state.view] || "后台管理";
  const topbarTitle = $("#topbarTitle");
  if (topbarTitle) topbarTitle.textContent = title;

  renderSidebar();
  setupMobileMenu();

  const isUpstreamView = UPSTREAM_VIEWS.includes(state.view);
  if (state.view === "dashboard") {
    renderDashboard();
  } else if (isUpstreamView) {
    $("#adminApp").innerHTML = `
      <div class="sub-tabs">
        <button class="secondary ${state.view === "accounts" ? "active" : ""}" data-view="accounts">号池</button>
        <button class="secondary ${state.view === "logs" ? "active" : ""}" data-view="logs">调用日志</button>
        <button class="secondary ${state.view === "register" ? "active" : ""}" data-view="register">注册机</button>
        <button class="secondary ${state.view === "upstream_settings" ? "active" : ""}" data-view="upstream_settings">上游设置</button>
        <button class="secondary ${state.view === "backups" ? "active" : ""}" data-view="backups">备份</button>
        <button class="secondary ${state.view === "settings" ? "active" : ""}" data-view="settings">接口设置</button>
      </div>
      <section id="panel"></section>
    `;
    $$("#adminApp [data-view]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        stopRegisterPolling();
        state.view = btn.dataset.view;
        await loadPanel();
        renderAdmin();
      });
    });
    renderPanel();
  } else {
    $("#adminApp").innerHTML = `<section id="panel"></section>`;
    renderPanel();
  }
}

function renderDashboard() {
  const users = state.users || [];
  const gens = state.generations || [];
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const totalGens = gens.length;
  const completedGens = gens.filter((g) => g.status === "completed").length;
  const totalAccounts = accounts.length;
  const healthyAccounts = accounts.filter((a) => !a.status || a.status === "active" || a.status === "ok").length;
  const totalCreditsUsed = txs.filter((t) => t.delta < 0).reduce((s, t) => s + Math.abs(t.delta), 0);

  $("#adminApp").innerHTML = `
    <div class="page-header">
      <span class="kicker">Dashboard</span>
      <h1>仪表盘</h1>
      <p class="desc">GPT Image Studio 运行概览。</p>
    </div>
    <div class="dash-stats">
      <div class="dash-stat">
        <div class="dash-stat-icon blue"><i class="ri-image-line"></i></div>
        <div class="dash-stat-body">
          <div class="dash-stat-label">生图总数</div>
          <div class="dash-stat-value">${totalGens.toLocaleString()}</div>
        </div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-icon green"><i class="ri-user-line"></i></div>
        <div class="dash-stat-body">
          <div class="dash-stat-label">活跃用户</div>
          <div class="dash-stat-value">${activeUsers} <span style="font-size:13px;color:var(--muted);font-weight:400">/ ${totalUsers}</span></div>
        </div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-icon purple"><i class="ri-database-2-line"></i></div>
        <div class="dash-stat-body">
          <div class="dash-stat-label">号池账号</div>
          <div class="dash-stat-value">${healthyAccounts} <span style="font-size:13px;color:var(--muted);font-weight:400">/ ${totalAccounts}</span></div>
        </div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-icon warn"><i class="ri-coin-line"></i></div>
        <div class="dash-stat-body">
          <div class="dash-stat-label">积分消耗</div>
          <div class="dash-stat-value">${totalCreditsUsed.toLocaleString()}</div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:16px">
      <div class="card">
        <h3 style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><i class="ri-image-line" style="color:var(--accent)"></i> 最近生图</h3>
        ${gens.length ? `
          <div class="table-wrap">
            <table style="min-width:auto">
              <thead><tr><th>时间</th><th>用户</th><th>提示词</th><th>状态</th></tr></thead>
              <tbody>
                ${gens.slice(0, 5).map((r) => `
                  <tr>
                    <td class="muted" style="white-space:nowrap">${fmt(r.createdAt)}</td>
                    <td>${escapeHtml(r.userName || r.userEmail || "")}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.prompt || "")}">${escapeHtml((r.prompt || "").slice(0, 50))}</td>
                    <td><span class="status ${r.status === "completed" ? "ok" : r.status === "failed" ? "failed" : ""}">${escapeHtml(r.status || "")}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px;text-align:right"><button class="tiny" data-view="generations">查看全部 →</button></div>
        ` : `<div class="empty" style="padding:24px">暂无生图记录</div>`}
      </div>
      <div class="card">
        <h3 style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><i class="ri-user-line" style="color:var(--green)"></i> 最新用户</h3>
        ${users.length ? `
          <div class="table-wrap">
            <table style="min-width:auto">
              <thead><tr><th>用户</th><th>状态</th><th>积分</th><th>注册时间</th></tr></thead>
              <tbody>
                ${users.slice(0, 5).map((u) => `
                  <tr>
                    <td><strong>${escapeHtml(u.name || u.email)}</strong></td>
                    <td><span class="status ${u.status === "active" ? "ok" : "failed"}">${u.status === "active" ? "启用" : "停用"}</span></td>
                    <td>${Number(u.credits || 0)}</td>
                    <td class="muted">${fmt(u.createdAt)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px;text-align:right"><button class="tiny" data-view="users">查看全部 →</button></div>
        ` : `<div class="empty" style="padding:24px">暂无用户</div>`}
      </div>
    </div>
  `;

  $$("#adminApp [data-view]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.view = btn.dataset.view;
      await loadPanel();
      renderAdmin();
    });
  });
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
  if (state.view === "generations") return renderGenerations();
  if (state.view === "logs") return renderUnifiedLogs();
  if (state.view === "users") return renderUsers();
  if (state.view === "redeem") return renderRedeem();
  if (state.view === "transactions") return renderTransactions();
  if (state.view === "payments") return renderPayments();
  if (state.view === "accounts") return renderAccounts();
  if (state.view === "register") return renderRegister();
  if (state.view === "upstream_settings") return renderUpstreamSettings();
  if (state.view === "backups") return renderBackups();
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
          <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;font-weight:600;margin-bottom:2px">Logs</div>
          <h2>日志管理</h2>
          <p class="muted">查看上游 chatgpt2api 的调用与账号管理日志。可按类型、日期筛选，支持批量删除。</p>
        </div>
        <div class="upstream-header-actions">
          <button class="secondary" type="button" id="logsRefreshBtn">刷新</button>
          <button class="secondary" type="button" id="logsDeleteBtn" ${selectedCount ? "" : "disabled"}>删除所选${selectedCount ? ` (${selectedCount})` : ""}</button>
        </div>
      </div>
      <form id="logsFilterForm" class="form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">
        <label style="flex:0 0 150px">日志类型
          <select id="logsTypeInput">
            <option value="call" ${(filter.type || "call") === "call" ? "selected" : ""}>调用日志</option>
            <option value="account" ${filter.type === "account" ? "selected" : ""}>账号管理日志</option>
          </select>
        </label>
        <label style="flex:1 1 160px">起始日期
          <input id="logsStartDateInput" type="date" value="${escapeHtml(filter.start_date || "")}">
        </label>
        <label style="flex:1 1 160px">结束日期
          <input id="logsEndDateInput" type="date" value="${escapeHtml(filter.end_date || "")}">
        </label>
        <button class="secondary" type="button" id="logsResetBtn">清除筛选</button>
        <button class="primary" type="submit">查询</button>
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
      type: $("#logsTypeInput")?.value || "call",
      start_date: $("#logsStartDateInput").value || "",
      end_date: $("#logsEndDateInput").value || ""
    };
    state.logsExpanded = new Set();
    state.logsSelected = new Set();
    await loadPanel();
    renderUnifiedLogs();
  });
  $("#logsResetBtn").addEventListener("click", async () => {
    state.logsFilter = { type: "call", start_date: "", end_date: "" };
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
          <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;font-weight:600;margin-bottom:2px">Account Pool</div>
          <h2>号池管理</h2>
          <p class="muted">管理 ChatGPT 账号池，支持筛选、批量刷新、导出 Token、移除异常账号。</p>
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
        <div>
          <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;font-weight:600;margin-bottom:2px">Register</div>
          <h2>ChatGPT 注册机</h2>
          <p class="muted">自动注册流程。可配置多个邮箱提供商，按启用顺序轮换。</p>
        </div>
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
    <div class="page-header">
      <span class="kicker">Users</span>
      <h1>用户管理</h1>
      <p class="desc">管理注册用户，调整角色、状态和积分。</p>
    </div>
    <div class="card">
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
  const unusedCount = codes.filter((c) => c.status === "unused").length;
  const usedCount = codes.filter((c) => c.status === "used").length;
  const disabledCount = codes.filter((c) => c.status === "disabled").length;
  $("#panel").innerHTML = `
    <div class="page-header">
      <span class="kicker">Redeem Codes</span>
      <h1>卡密管理</h1>
      <p class="desc">创建和管理兑换卡密。</p>
    </div>
    <div class="dash-stats" style="margin-bottom:20px">
      <div class="dash-stat">
        <div class="dash-stat-icon blue"><i class="ri-coupon-line"></i></div>
        <div class="dash-stat-body"><div class="dash-stat-label">总数</div><div class="dash-stat-value" style="font-size:22px">${codes.length}</div></div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-icon green"><i class="ri-checkbox-circle-line"></i></div>
        <div class="dash-stat-body"><div class="dash-stat-label">未使用</div><div class="dash-stat-value" style="font-size:22px">${unusedCount}</div></div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-icon warn"><i class="ri-check-double-line"></i></div>
        <div class="dash-stat-body"><div class="dash-stat-label">已使用</div><div class="dash-stat-value" style="font-size:22px">${usedCount}</div></div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-icon red"><i class="ri-close-circle-line"></i></div>
        <div class="dash-stat-body"><div class="dash-stat-label">已禁用</div><div class="dash-stat-value" style="font-size:22px">${disabledCount}</div></div>
      </div>
    </div>
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
    <div class="page-header">
      <span class="kicker">Transactions</span>
      <h1>积分流水</h1>
      <p class="desc">查看所有用户的积分变动记录。</p>
    </div>
    <div class="card">
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
    <div class="page-header">
      <span class="kicker">Payments</span>
      <h1>支付订单</h1>
      <p class="desc">查看所有支付记录和订单状态。</p>
    </div>
    <div class="card">
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

// ===================== Generations (生图记录) =====================

function renderGenerations() {
  const records = state.generations || [];
  const panel = $("#panel");
  if (!panel) return;
  panel.innerHTML = `
    <div class="page-header">
      <span class="kicker">Generations</span>
      <h1>生图记录</h1>
      <p class="desc">查看所有用户的生成记录，包括提示词、用户、IP 和状态信息。</p>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>时间</th><th>用户</th><th>提示词</th><th>模型</th><th>尺寸</th><th>状态</th><th>上游</th><th>IP</th><th>预览</th>
          </tr></thead>
          <tbody>
            ${records.length ? records.map((r) => `
              <tr>
                <td class="muted" style="white-space:nowrap">${fmt(r.createdAt)}</td>
                <td>${escapeHtml(r.userName || r.userEmail || r.userId || "")}</td>
                <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.prompt || "")}">${escapeHtml((r.prompt || "").slice(0, 80))}</td>
                <td>${escapeHtml(r.model || "")}</td>
                <td>${escapeHtml(r.size || "")}</td>
                <td><span class="status ${r.status === "completed" ? "ok" : r.status === "failed" ? "failed" : ""}">${escapeHtml(r.status || "")}</span></td>
                <td>${escapeHtml(r.upstream || "")}</td>
                <td class="muted" style="font-size:11px">${escapeHtml(r.ip || "")}</td>
                <td>${r.imageUrl ? `<a href="${escapeHtml(r.imageUrl)}" target="_blank" style="font-size:12px">查看</a>` : ""}</td>
              </tr>
            `).join("") : `<tr><td colspan="9" class="empty">暂无生图记录</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===================== Upstream Settings (上游设置) =====================

const LOG_LEVEL_OPTIONS = ["debug", "info", "warning", "error"];

function renderUpstreamSettings() {
  const target = $("#upstreamPanel") || $("#panel");
  if (!target) return;
  const cfg = state.upstreamConfig?.config || state.upstreamConfig || {};
  const storage = state.upstreamStorage;

  if (state.upstreamConfigError) {
    target.innerHTML = `<div class="card"><div class="upstream-header"><div><div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;font-weight:600;margin-bottom:2px">Settings</div><h2>上游设置</h2><p class="muted">管理 chatgpt2api 运行参数。</p></div></div><div class="empty" style="color:#e11d48">${escapeHtml(state.upstreamConfigError)}</div></div>`;
    return;
  }

  const logLevels = Array.isArray(cfg.log_levels) ? cfg.log_levels : [];
  const sensitiveWords = Array.isArray(cfg.sensitive_words) ? cfg.sensitive_words.join("\n") : "";
  const aiReview = cfg.ai_review || {};

  target.innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;font-weight:600;margin-bottom:2px">Settings</div>
          <h2>上游设置</h2>
          <p class="muted">管理 chatgpt2api 运行参数、代理、日志级别、敏感词和 AI 审核。</p>
        </div>
        <div class="upstream-header-actions"><button class="primary" type="button" id="upstreamSaveBtn">保存配置</button></div>
      </div>

      <form id="upstreamConfigForm" class="form">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
          <label>账号刷新间隔（分钟）
            <input id="ucfg_refresh_interval" type="number" min="1" value="${Number(cfg.refresh_account_interval_minute || 5)}" placeholder="5">
            <span class="muted" style="font-size:11px">控制账号自动刷新频率。</span>
          </label>
          <div>
            <label>全局代理
              <input id="ucfg_proxy" value="${escapeHtml(String(cfg.proxy || ""))}" placeholder="http://127.0.0.1:7890">
              <span class="muted" style="font-size:11px">留空表示不使用代理。</span>
            </label>
            <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
              <button class="secondary" type="button" id="proxyTestBtn" style="white-space:nowrap">测试代理</button>
              <span id="proxyTestResult" class="muted" style="font-size:12px"></span>
            </div>
          </div>
          <label>图片访问地址
            <input id="ucfg_base_url" value="${escapeHtml(String(cfg.base_url || ""))}" placeholder="https://example.com">
            <span class="muted" style="font-size:11px">图片结果的访问前缀地址。</span>
          </label>
          <label>图片自动清理（天）
            <input id="ucfg_image_retention" type="number" min="1" value="${Number(cfg.image_retention_days || 30)}" placeholder="30">
            <span class="muted" style="font-size:11px">自动删除多少天前的本地图片。</span>
          </label>
          <label>图片轮询超时（秒）
            <input id="ucfg_poll_timeout" type="number" min="1" value="${Number(cfg.image_poll_timeout_secs || 120)}" placeholder="120">
            <span class="muted" style="font-size:11px">等待上游图片结果的最长时间。</span>
          </label>
          <label>单账号图片并发
            <input id="ucfg_account_concurrency" type="number" min="1" value="${Number(cfg.image_account_concurrency || 3)}" placeholder="3">
            <span class="muted" style="font-size:11px">每个账号同时处理的图片请求数量。</span>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px">
          <label style="flex-direction:row;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="ucfg_auto_remove_invalid" ${cfg.auto_remove_invalid_accounts ? "checked" : ""}> 自动移除异常账号
          </label>
          <label style="flex-direction:row;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="ucfg_auto_remove_limited" ${cfg.auto_remove_rate_limited_accounts ? "checked" : ""}> 自动移除限流账号
          </label>
        </div>

        <div style="margin-top:16px;border-top:1px solid var(--border,#e2e8f0);padding-top:14px">
          <div style="margin-bottom:8px"><strong>控制台日志级别</strong><span class="muted" style="margin-left:8px;font-size:12px">不选择时使用默认 info / warning / error。</span></div>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            ${LOG_LEVEL_OPTIONS.map((level) => `<label style="flex-direction:row;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="ucfg-log-level" data-level="${level}" ${logLevels.includes(level) ? "checked" : ""}> ${level}</label>`).join("")}
          </div>
        </div>

        <div style="margin-top:14px">
          <label>全局附加指令
            <textarea id="ucfg_system_prompt" rows="3" style="font-family:monospace;font-size:12px;resize:vertical" placeholder="每次请求都会作为 system 消息注入">${escapeHtml(String(cfg.global_system_prompt || ""))}</textarea>
            <span class="muted" style="font-size:11px">可用于审核用户提示词、统一约束模型行为或固定角色设定。</span>
          </label>
        </div>

        <div style="margin-top:14px">
          <label>敏感词（每行一个）
            <textarea id="ucfg_sensitive_words" rows="3" style="font-family:monospace;font-size:12px;resize:vertical" placeholder="一行一个，命中即拒绝">${escapeHtml(sensitiveWords)}</textarea>
            <span class="muted" style="font-size:11px">只要用户请求包含任意敏感词就直接拒绝。</span>
          </label>
        </div>

        <div style="margin-top:16px;border-top:1px solid var(--border,#e2e8f0);padding-top:14px">
          <div style="margin-bottom:10px">
            <label style="flex-direction:row;align-items:center;gap:8px;cursor:pointer;font-weight:600">
              <input type="checkbox" id="ucfg_ai_review_enabled" ${aiReview.enabled ? "checked" : ""}> 启用 AI 审核
            </label>
            <p class="muted" style="font-size:12px;margin-top:4px">开启后会在请求进入生图账号前先调用审核模型，审核不通过会直接拒绝。</p>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
            <label>Base URL<input id="ucfg_ai_review_base_url" value="${escapeHtml(String(aiReview.base_url || ""))}" placeholder="https://api.openai.com"></label>
            <label>API Key<input id="ucfg_ai_review_api_key" value="${escapeHtml(String(aiReview.api_key || ""))}" placeholder="sk-..."></label>
            <label>Model<input id="ucfg_ai_review_model" value="${escapeHtml(String(aiReview.model || ""))}" placeholder="gpt-4o-mini"></label>
          </div>
          <div style="margin-top:10px">
            <label>审核提示词<textarea id="ucfg_ai_review_prompt" rows="2" style="font-family:monospace;font-size:12px;resize:vertical" placeholder="判断用户请求是否允许。只回答 ALLOW 或 REJECT。">${escapeHtml(String(aiReview.prompt || ""))}</textarea></label>
          </div>
        </div>
      </form>

      ${storage ? `
        <div style="margin-top:20px;border-top:1px solid var(--border,#e2e8f0);padding-top:14px">
          <h3>存储信息</h3>
          <pre style="background:var(--surface,#f8fafc);padding:12px;border-radius:8px;font-size:12px;overflow-x:auto">${escapeHtml(JSON.stringify(storage, null, 2))}</pre>
        </div>
      ` : ""}
    </div>
  `;

  $("#upstreamSaveBtn")?.addEventListener("click", saveUpstreamConfig);
  $("#proxyTestBtn")?.addEventListener("click", testUpstreamProxy);
}

function collectUpstreamConfig() {
  const cfg = state.upstreamConfig?.config || state.upstreamConfig || {};
  const updated = { ...cfg };
  updated.refresh_account_interval_minute = Number($("#ucfg_refresh_interval")?.value) || 5;
  updated.proxy = ($("#ucfg_proxy")?.value || "").trim();
  updated.base_url = ($("#ucfg_base_url")?.value || "").trim();
  updated.image_retention_days = Number($("#ucfg_image_retention")?.value) || 30;
  updated.image_poll_timeout_secs = Number($("#ucfg_poll_timeout")?.value) || 120;
  updated.image_account_concurrency = Number($("#ucfg_account_concurrency")?.value) || 3;
  updated.auto_remove_invalid_accounts = !!$("#ucfg_auto_remove_invalid")?.checked;
  updated.auto_remove_rate_limited_accounts = !!$("#ucfg_auto_remove_limited")?.checked;

  const logLevels = [];
  $$(".ucfg-log-level").forEach((cb) => { if (cb.checked) logLevels.push(cb.dataset.level); });
  updated.log_levels = logLevels;

  updated.global_system_prompt = ($("#ucfg_system_prompt")?.value || "").trim();
  const wordsRaw = ($("#ucfg_sensitive_words")?.value || "").trim();
  updated.sensitive_words = wordsRaw ? wordsRaw.split("\n").map((w) => w.trim()).filter(Boolean) : [];

  updated.ai_review = {
    enabled: !!$("#ucfg_ai_review_enabled")?.checked,
    base_url: ($("#ucfg_ai_review_base_url")?.value || "").trim(),
    api_key: ($("#ucfg_ai_review_api_key")?.value || "").trim(),
    model: ($("#ucfg_ai_review_model")?.value || "").trim(),
    prompt: ($("#ucfg_ai_review_prompt")?.value || "").trim()
  };
  return updated;
}

async function saveUpstreamConfig() {
  try {
    const body = collectUpstreamConfig();
    const data = await api("/api/admin/upstream/settings", { method: "POST", body: JSON.stringify(body) });
    state.upstreamConfig = data;
    toast("上游配置已保存");
    renderUpstreamSettings();
  } catch (error) { toast(error.message); }
}

async function testUpstreamProxy() {
  const resultEl = $("#proxyTestResult");
  if (resultEl) resultEl.textContent = "测试中…";
  try {
    const proxy = ($("#ucfg_proxy")?.value || "").trim();
    const data = await api("/api/admin/upstream/proxy/test", { method: "POST", body: JSON.stringify({ url: proxy }) });
    const r = data.result || data;
    if (resultEl) {
      if (r.ok) {
        resultEl.textContent = `代理可用：HTTP ${r.status}，用时 ${r.latency_ms} ms`;
        resultEl.style.color = "#059669";
      } else {
        resultEl.textContent = `代理不可用：${r.error || "未知错误"}`;
        resultEl.style.color = "#e11d48";
      }
    }
  } catch (error) { if (resultEl) { resultEl.textContent = `测试失败: ${error.message}`; resultEl.style.color = "#e11d48"; } }
}

// ===================== Backups (备份) =====================

const BACKUP_INCLUDE_LABELS = [
  { key: "config", label: "系统配置" },
  { key: "register", label: "注册配置" },
  { key: "logs", label: "调度与调用日志" },
  { key: "accounts_snapshot", label: "账号快照" },
  { key: "images", label: "图片文件目录" }
];

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value, idx = 0;
  while (size >= 1024 && idx < units.length - 1) { size /= 1024; idx++; }
  return `${size >= 10 || idx === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[idx]}`;
}

function renderBackups() {
  const target = $("#upstreamPanel") || $("#panel");
  if (!target) return;
  const backups = state.backups || [];
  const bs = state.backupState || {};
  const settings = state.backupSettings || {};
  const include = settings.include || {};
  const statusLabel = bs.running ? "备份中" : bs.last_status === "success" ? "最近成功" : bs.last_status === "error" ? "最近失败" : "未执行";
  const statusClass = bs.running ? "warn" : bs.last_status === "success" ? "ok" : bs.last_status === "error" ? "failed" : "";

  target.innerHTML = `
    <div class="card">
      <div class="upstream-header">
        <div>
          <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;font-weight:600;margin-bottom:2px">Backup</div>
          <h2>R2 备份管理</h2>
          <p class="muted">将关键数据定时备份到 Cloudflare R2，支持可选加密、轮替、手动执行与历史清理。</p>
        </div>
        <div class="upstream-header-actions">
          <span class="status ${statusClass}">${statusLabel}</span>
        </div>
      </div>
      ${state.backupsError ? `<div class="empty" style="color:#e11d48">${escapeHtml(state.backupsError)}</div>` : ""}

      <div style="background:var(--surface,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#57534e">
        账号与用户密钥会从当前存储后端导出逻辑快照，不依赖底层是 json、sqlite、postgres 还是 git。图片目录默认不备份，避免备份体积过大。
      </div>

      <form id="backupSettingsForm" class="form">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
          <label style="flex-direction:row;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="bk_enabled" ${settings.enabled ? "checked" : ""}> 启用定时备份
          </label>
          <label style="flex-direction:row;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="bk_encrypt" ${settings.encrypt ? "checked" : ""}> 启用备份加密
          </label>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px">
          <label>Cloudflare Account ID<input id="bk_account_id" value="${escapeHtml(String(settings.account_id || ""))}"></label>
          <label>Bucket 名称<input id="bk_bucket" value="${escapeHtml(String(settings.bucket || ""))}"></label>
          <label>Access Key ID<input id="bk_access_key_id" value="${escapeHtml(String(settings.access_key_id || ""))}"></label>
          <label>Secret Access Key<input id="bk_secret_access_key" type="password" value="${escapeHtml(String(settings.secret_access_key || ""))}"></label>
          <label>备份前缀<input id="bk_prefix" value="${escapeHtml(String(settings.prefix || ""))}" placeholder="backups"><span class="muted" style="font-size:11px">R2 内对象前缀，例如 backups/prod。</span></label>
          <label>定时备份间隔（分钟）<input id="bk_interval" type="number" min="1" value="${Number(settings.interval_minutes || 360)}" placeholder="360"><span class="muted" style="font-size:11px">服务启动后会按此间隔自动执行。</span></label>
          <label>保留备份数量<input id="bk_rotation" type="number" min="0" value="${Number(settings.rotation_keep || 10)}" placeholder="10"><span class="muted" style="font-size:11px">成功上传后自动删除更旧的备份。0 = 不轮替。</span></label>
          <label>加密口令<input id="bk_passphrase" type="password" value="${escapeHtml(String(settings.passphrase || ""))}" placeholder="${settings.encrypt ? "启用加密后必填" : "留空"}"><span class="muted" style="font-size:11px">请妥善保管，否则无法解密备份内容。</span></label>
        </div>

        <div style="margin-top:16px;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:14px">
          <div style="margin-bottom:8px"><strong>备份内容</strong><span class="muted" style="margin-left:8px;font-size:12px">按组件勾选需要进入备份包的数据。</span></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">
            ${BACKUP_INCLUDE_LABELS.map((it) => `<label style="flex-direction:row;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="bk-include" data-key="${it.key}" ${include[it.key] !== false ? "checked" : ""}> ${it.label}</label>`).join("")}
          </div>
        </div>
      </form>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:16px;background:var(--surface,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:14px;font-size:13px">
        <div><div class="muted" style="font-size:11px">最近开始</div><div style="margin-top:4px;font-weight:500">${fmt(bs.last_started_at) || "—"}</div></div>
        <div><div class="muted" style="font-size:11px">最近完成</div><div style="margin-top:4px;font-weight:500">${fmt(bs.last_finished_at) || "—"}</div></div>
        <div><div class="muted" style="font-size:11px">最近对象</div><div style="margin-top:4px;font-weight:500;word-break:break-all">${escapeHtml(bs.last_object_key || "—")}</div></div>
        ${bs.last_error ? `<div style="grid-column:1/-1"><div class="muted" style="font-size:11px;color:#e11d48">最近错误</div><div style="margin-top:4px;padding:8px;background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;color:#be123c;word-break:break-all">${escapeHtml(bs.last_error)}</div></div>` : ""}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;justify-content:flex-end">
        <button class="secondary" type="button" id="backupTestBtn">测试连接</button>
        <button class="secondary" type="button" id="backupRefreshBtn">刷新列表</button>
        <button class="secondary" type="button" id="backupRunBtn" ${bs.running ? "disabled" : ""}>${bs.running ? "备份中…" : "立即备份"}</button>
        <button class="primary" type="button" id="backupSaveBtn">保存配置</button>
      </div>
      <div id="backupTestResult" class="muted" style="margin-top:8px;text-align:right"></div>

      <div style="margin-top:20px;border-top:1px solid var(--border,#e2e8f0);padding-top:14px">
        <div style="margin-bottom:10px"><strong>历史备份</strong><span class="muted" style="margin-left:8px;font-size:12px">支持查看对象信息并直接删除远端备份。</span></div>
        ${backups.length === 0 ? `<div class="empty">暂无远端备份记录。保存配置并执行一次手动备份后会出现在这里。</div>` : `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${backups.map((b) => `
              <div class="backup-item" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:12px;background:#fff">
                <div style="min-width:0;flex:1">
                  <div style="font-weight:500;word-break:break-all">${escapeHtml(b.name || b.key || "")}${b.encrypted ? ` <span class="status muted" style="font-size:11px">已加密</span>` : ""}</div>
                  <div class="muted" style="font-size:12px;margin-top:4px">大小 ${formatBytes(b.size || 0)} · 更新时间 ${fmt(b.updated_at || b.created_at || b.createdAt || b.timestamp)} · key ${escapeHtml(b.key || "")}</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="tiny secondary" data-backup-download="${escapeHtml(b.key || b.name || "")}">下载</button>
                  <button class="tiny secondary" data-backup-detail="${escapeHtml(b.key || b.name || "")}">查看详情</button>
                  <button class="tiny" style="color:#e11d48" data-backup-delete="${escapeHtml(b.key || b.name || "")}">删除</button>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      </div>
    </div>
  `;

  $("#backupRunBtn")?.addEventListener("click", runBackup);
  $("#backupTestBtn")?.addEventListener("click", testBackupConnection);
  $("#backupRefreshBtn")?.addEventListener("click", async () => {
    try { await loadPanel(); renderBackups(); toast("已刷新"); } catch (e) { toast(e.message); }
  });
  $("#backupSaveBtn")?.addEventListener("click", saveBackupSettings);
  target.querySelectorAll("[data-backup-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteBackup(btn.dataset.backupDelete));
  });
  target.querySelectorAll("[data-backup-detail]").forEach((btn) => {
    btn.addEventListener("click", () => showBackupDetail(btn.dataset.backupDetail));
  });
  target.querySelectorAll("[data-backup-download]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.open(`/api/admin/upstream/backups/download?key=${encodeURIComponent(btn.dataset.backupDownload)}`, "_blank");
    });
  });
}

async function saveBackupSettings() {
  try {
    const body = {};
    body.enabled = !!$("#bk_enabled")?.checked;
    body.encrypt = !!$("#bk_encrypt")?.checked;
    body.account_id = ($("#bk_account_id")?.value || "").trim();
    body.bucket = ($("#bk_bucket")?.value || "").trim();
    body.access_key_id = ($("#bk_access_key_id")?.value || "").trim();
    body.secret_access_key = ($("#bk_secret_access_key")?.value || "").trim();
    body.prefix = ($("#bk_prefix")?.value || "").trim();
    body.interval_minutes = Number($("#bk_interval")?.value) || 360;
    body.rotation_keep = Number($("#bk_rotation")?.value) || 10;
    body.passphrase = ($("#bk_passphrase")?.value || "").trim();
    const include = {};
    $$(".bk-include").forEach((cb) => { include[cb.dataset.key] = cb.checked; });
    body.include = include;
    await api("/api/admin/upstream/backups/settings", { method: "POST", body: JSON.stringify(body) });
    toast("备份配置已保存");
    await loadPanel();
    renderBackups();
  } catch (error) { toast(error.message); }
}

async function runBackup() {
  try {
    await api("/api/admin/upstream/backups/run", { method: "POST" });
    toast("备份任务已启动");
    await loadPanel();
    renderBackups();
  } catch (error) { toast(error.message); }
}

async function testBackupConnection() {
  const resultEl = $("#backupTestResult");
  if (resultEl) resultEl.textContent = "测试中…";
  try {
    const data = await api("/api/admin/upstream/backups/test", { method: "POST" });
    const r = data.result || data;
    if (resultEl) {
      if (r.ok) {
        resultEl.textContent = `连接正常：${r.message || "成功"}`;
        resultEl.style.color = "#059669";
      } else {
        resultEl.textContent = `连接失败：${r.error || "未知错误"}`;
        resultEl.style.color = "#e11d48";
      }
    }
  } catch (error) {
    if (resultEl) { resultEl.textContent = `测试失败: ${error.message}`; resultEl.style.color = "#e11d48"; }
  }
}

async function deleteBackup(key) {
  if (!confirm(`确定要删除备份 ${key} 吗？`)) return;
  try {
    await api("/api/admin/upstream/backups/delete", { method: "POST", body: JSON.stringify({ key }) });
    toast("备份已删除");
    await loadPanel();
    renderBackups();
  } catch (error) { toast(error.message); }
}

async function showBackupDetail(key) {
  try {
    const data = await api(`/api/admin/upstream/backups/detail?key=${encodeURIComponent(key)}`);
    const d = data.item || data;
    const lines = [];
    if (d.name) lines.push(`对象名称: ${d.name}`);
    if (d.created_at) lines.push(`创建时间: ${d.created_at}`);
    if (d.trigger) lines.push(`触发方式: ${d.trigger}`);
    if (d.app_version) lines.push(`应用版本: ${d.app_version}`);
    if (d.storage_backend) lines.push(`存储后端: ${d.storage_backend}`);
    if (d.size) lines.push(`大小: ${formatBytes(d.size)}`);
    if (d.encrypted !== undefined) lines.push(`已加密: ${d.encrypted ? "是" : "否"}`);
    if (d.contents) lines.push(`\n包含内容:\n${JSON.stringify(d.contents, null, 2)}`);
    alert(lines.join("\n") || JSON.stringify(d, null, 2));
  } catch (error) { toast(error.message); }
}



// ===================== Settings (simplified) =====================

function renderSettings() {
  const settings = state.settings || {};
  const upstreams = settings.upstreams || { chatgpt2api: {}, cpa: {} };
  const active = settings.activeUpstream || "chatgpt2api";
  $("#panel").innerHTML = `
    <div class="page-header">
      <span class="kicker">Settings</span>
      <h1>接口设置</h1>
      <p class="desc">配置上游 API 接口、注册选项和积分策略。</p>
    </div>
    <div class="grid">
      <section class="card">
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
  if (state.view === "dashboard") {
    try {
      const [usersData, gensData, accData, txData] = await Promise.all([
        api("/api/admin/users").catch(() => ({ users: [] })),
        api("/api/admin/generations").catch(() => ({ records: [] })),
        api("/api/admin/upstream/accounts").catch(() => ({ items: [] })),
        api("/api/admin/credit-transactions").catch(() => ({ transactions: [] }))
      ]);
      state.users = usersData.users || [];
      state.generations = gensData.records || [];
      state.accounts = accData.items || [];
      state.transactions = txData.transactions || [];
    } catch (error) { console.warn("dashboard load error:", error); }
  } else if (state.view === "generations") {
    try {
      const data = await api("/api/admin/generations");
      state.generations = data.records || [];
    } catch (error) { state.generations = []; toast(error.message); }
  } else if (state.view === "logs") {
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
      if (state.register?.enabled) startRegisterPolling();
      else stopRegisterPolling();
    } catch (error) { state.register = null; toast(error.message); }
  } else if (state.view === "upstream_settings") {
    try {
      const [configData, storageData] = await Promise.all([
        api("/api/admin/upstream/settings"),
        api("/api/admin/upstream/storage").catch(() => null)
      ]);
      state.upstreamConfig = configData;
      state.upstreamStorage = storageData;
      state.upstreamConfigError = "";
    } catch (error) {
      state.upstreamConfig = null;
      state.upstreamConfigError = String(error?.message || error || "上游设置加载失败");
      toast(state.upstreamConfigError);
    }
  } else if (state.view === "backups") {
    try {
      const data = await api("/api/admin/upstream/backups");
      state.backups = data.items || [];
      state.backupState = data.state || null;
      state.backupSettings = data.settings || null;
      state.backupsError = "";
    } catch (error) {
      state.backups = [];
      state.backupsError = String(error?.message || error || "备份信息加载失败");
      toast(state.backupsError);
    }
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
