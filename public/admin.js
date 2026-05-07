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
  lastBatch: null
};

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
      <button class="secondary ${state.view === "settings" ? "active" : ""}" data-view="settings">接口设置</button>
    </div>
    <section id="panel"></section>
  `;
  $$("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.view = button.dataset.view;
      await loadPanel();
      renderAdmin();
      renderPanel();
    });
  });
  renderPanel();
}

function renderPanel() {
  if (state.view === "records") return renderRecords();
  if (state.view === "users") return renderUsers();
  if (state.view === "redeem") return renderRedeem();
  if (state.view === "transactions") return renderTransactions();
  if (state.view === "payments") return renderPayments();
  renderSettings();
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
                <th>状态</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              ${state.records.map((record) => `
                <tr>
                  <td>${record.imageUrl ? `<a href="${escapeHtml(record.imageUrl)}" target="_blank"><img class="thumb" src="${escapeHtml(record.imageUrl)}" alt=""></a>` : `<div class="thumb"></div>`}</td>
                  <td><strong>${escapeHtml(record.userName || record.userEmail || "未知用户")}</strong><br><span class="muted">${escapeHtml(record.userEmail || record.userId)}</span></td>
                  <td class="prompt-cell">${escapeHtml(record.prompt)}${record.errorMessage ? `<br><span class="muted">错误：${escapeHtml(record.errorMessage)}</span>` : ""}</td>
                  <td><strong>${escapeHtml(record.ipAddress || "-")}</strong><br><span class="muted">${escapeHtml(record.userAgent || "-")}</span></td>
                  <td>${record.isPublic ? "是" : "否"}</td>
                  <td><span class="status ${record.status === "failed" ? "failed" : ""}">${escapeHtml(record.status)}</span></td>
                  <td>${fmt(record.createdAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<div class="empty">暂无生图记录</div>`}
      </div>
    </div>
  `;
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
  $("#panel").innerHTML = `
    <div class="grid">
      <section class="card">
        <h2>接口设置</h2>
        <form id="settingsForm" class="form">
          <label>OpenAI API Key<input id="apiKeyInput" type="password" placeholder="${escapeHtml(settings.apiKeyMask || "不修改则留空")}"></label>
        <label>API 地址<input id="apiBaseUrlInput" value="${escapeHtml(settings.apiBaseUrl || "")}" placeholder="AI API base URL"></label>
          <label>模型<input id="modelInput" value="${escapeHtml(settings.model || "GPT-IMAGE-2")}"></label>
          <label>注册送积分<input id="defaultCreditsInput" type="number" min="0" value="${Number(settings.defaultCredits ?? 10)}"></label>
          <label>每张图消耗积分<input id="generationCreditCostInput" type="number" min="0" value="${Number(settings.generationCreditCost ?? 1)}"></label>
          <label>单次最大张数<input id="maxImagesInput" type="number" min="1" max="4" value="${Number(settings.maxImagesPerRequest ?? 1)}"></label>
          <label><input id="allowRegistrationInput" type="checkbox" ${settings.allowRegistration ? "checked" : ""}> 开放注册</label>
          <label><input id="requireApprovalInput" type="checkbox" ${settings.requireApproval ? "checked" : ""}> 新用户需要后台启用</label>
          <button class="primary" type="submit">保存设置</button>
          <button id="clearKeyBtn" class="secondary" type="button">清除 API Key</button>
        </form>
      </section>
      <section class="card">
        <h2>说明</h2>
        <p class="muted">前台生图会按“每张图消耗积分”扣除积分；用户每天可在前台签到领取 1 积分。用户积分可在用户管理中直接设置，也可以用增减积分输入框做临时加减。</p>
      </section>
    </div>
  `;
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#clearKeyBtn").addEventListener("click", clearKey);
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
  try {
    state.settings = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({
        openaiApiKey: $("#apiKeyInput").value.trim(),
        apiBaseUrl: $("#apiBaseUrlInput").value.trim(),
        model: $("#modelInput").value.trim(),
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
    toast("API Key 已清除");
    renderSettings();
  } catch (error) {
    toast(error.message);
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
