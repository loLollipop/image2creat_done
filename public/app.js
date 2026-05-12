// ===== GPT Image Studio - Conversation-based UI =====
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  user: null,
  settings: null,
  conversations: [],
  activeConversationId: null,
  messages: [], // messages for active conversation
  generating: false,
  funIndex: 0,
  funTimer: null
};

const funMessages = [
  "正在调配完美的色彩...",
  "AI 画笔正在起步...",
  "将光影和构图融合在一起...",
  "正在召唤你的想象...",
  "杰作正在生长...",
  "创意正在酝酿中...",
  "添加最后的点睛之笔..."
];

// ===== API helper =====
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toastLayer").appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== Elements =====
const els = {
  sidebar: $("#sidebar"),
  sidebarToggle: $("#sidebarToggle"),
  sidebarOverlay: $("#sidebarOverlay"),
  chatSidebarToggle: $("#chatSidebarToggle"),
  newChatBtn: $("#newChatBtn"),
  conversationList: $("#conversationList"),
  creditsBtn: $("#creditsBtn"),
  creditsText: $("#creditsText"),
  loginBtn: $("#loginBtn"),
  logoutBtn: $("#logoutBtn"),
  welcomeView: $("#welcomeView"),
  chatView: $("#chatView"),
  chatTitle: $("#chatTitle"),
  chatTitleEdit: $("#chatTitleEdit"),
  messageList: $("#messageList"),
  generationStatus: $("#generationStatus"),
  funMessage: $("#funMessage"),
  welcomeForm: $("#welcomeForm"),
  welcomeInput: $("#welcomeInput"),
  chatForm: $("#chatForm"),
  chatInput: $("#chatInput"),
  sizeSelect: $("#sizeSelect"),
  qualitySelect: $("#qualitySelect"),
  modalLayer: $("#modalLayer"),
  toastLayer: $("#toastLayer")
};

// ===== Sidebar toggle =====
function openSidebar() { els.sidebar.classList.add("open"); els.sidebarOverlay.classList.remove("hidden"); }
function closeSidebar() { els.sidebar.classList.remove("open"); els.sidebarOverlay.classList.add("hidden"); }

els.sidebarToggle.addEventListener("click", openSidebar);
els.chatSidebarToggle?.addEventListener("click", openSidebar);
els.sidebarOverlay.addEventListener("click", closeSidebar);

// ===== Textarea auto-resize =====
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}
els.welcomeInput.addEventListener("input", () => autoResize(els.welcomeInput));
els.chatInput.addEventListener("input", () => autoResize(els.chatInput));

// ===== Navigation =====
function updateNav() {
  const loggedIn = Boolean(state.user);
  els.loginBtn.classList.toggle("hidden", loggedIn);
  els.logoutBtn.classList.toggle("hidden", !loggedIn);
  els.creditsBtn.classList.toggle("hidden", !loggedIn);
  els.creditsText.textContent = state.user ? `${state.user.credits} 积分` : "0";
}

// ===== Conversation list rendering =====
function renderConversationList() {
  const items = state.conversations || [];
  els.conversationList.innerHTML = items.map((conv) => `
    <div class="conv-item ${conv.id === state.activeConversationId ? "active" : ""}" data-conv-id="${escapeHtml(conv.id)}">
      <i class="ri-chat-3-line" style="flex-shrink:0;opacity:0.5"></i>
      <span class="conv-title">${escapeHtml(conv.title || "新对话")}</span>
      <button class="conv-delete" data-delete-conv="${escapeHtml(conv.id)}" title="删除"><i class="ri-delete-bin-line"></i></button>
    </div>
  `).join("");

  // Bind click
  $$(".conv-item", els.conversationList).forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".conv-delete")) return;
      switchConversation(el.dataset.convId);
      closeSidebar();
    });
  });
  $$(".conv-delete", els.conversationList).forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteConv;
      if (!confirm("确认删除此对话？")) return;
      try {
        await api(`/api/conversations/${id}`, { method: "DELETE" });
        state.conversations = state.conversations.filter((c) => c.id !== id);
        if (state.activeConversationId === id) {
          state.activeConversationId = null;
          state.messages = [];
          showWelcome();
        }
        renderConversationList();
      } catch (err) { showToast(err.message); }
    });
  });
}

// ===== View switching =====
function showWelcome() {
  els.welcomeView.classList.remove("hidden");
  els.chatView.classList.add("hidden");
  state.activeConversationId = null;
  state.messages = [];
  renderConversationList();
}

function showChat() {
  els.welcomeView.classList.add("hidden");
  els.chatView.classList.remove("hidden");
  renderConversationList();
}

// ===== Switch to a conversation =====
async function switchConversation(convId) {
  state.activeConversationId = convId;
  state.messages = [];
  showChat();
  renderMessages();
  try {
    const data = await api(`/api/conversations/${convId}`);
    state.messages = (data.messages || []).map(mapGenToMessage);
    els.chatTitle.textContent = data.conversation?.title || "新对话";
    renderMessages();
    scrollToBottom();
  } catch (err) {
    showToast(err.message);
    showWelcome();
  }
}

function mapGenToMessage(gen) {
  return {
    id: gen.id,
    role: "assistant",
    prompt: gen.prompt,
    imageUrl: gen.imageUrl,
    status: "done",
    time: gen.createdAt,
    error: null
  };
}

// ===== Render messages =====
function renderMessages() {
  els.messageList.innerHTML = state.messages.map((msg) => {
    if (msg.role === "user") {
      return `
        <div class="msg-card msg-user">
          <div class="msg-avatar user"><i class="ri-user-line"></i></div>
          <div class="msg-body"><div class="msg-prompt">${escapeHtml(msg.prompt)}</div></div>
        </div>
      `;
    }
    // Assistant message (image result)
    const imageHtml = msg.status === "generating"
      ? `<div class="msg-image-wrap" style="padding:40px;text-align:center"><div class="typing-indicator"><span></span><span></span><span></span></div><p style="margin-top:12px;color:var(--muted);font-size:13px">生成中...</p></div>`
      : msg.status === "error"
        ? `<div class="msg-error">${escapeHtml(msg.error || "生成失败")}</div>`
        : msg.imageUrl
          ? `<div class="msg-image-wrap"><img src="${escapeHtml(msg.imageUrl)}" alt="${escapeHtml(msg.prompt)}" loading="lazy"></div>`
          : "";
    const actionsHtml = msg.status === "done" && msg.imageUrl ? `
      <div class="msg-actions">
        <a href="${escapeHtml(msg.imageUrl)}" download="${escapeHtml(msg.id)}.png"><i class="ri-download-line"></i> 下载</a>
        <button type="button" data-retry-prompt="${escapeHtml(msg.prompt)}"><i class="ri-refresh-line"></i> 重新生成</button>
      </div>
    ` : "";
    return `
      <div class="msg-card">
        <div class="msg-user">
          <div class="msg-avatar ai"><i class="ri-sparkling-2-fill"></i></div>
          <div class="msg-body">
            ${imageHtml}
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Bind retry buttons
  $$("[data-retry-prompt]", els.messageList).forEach((btn) => {
    btn.addEventListener("click", () => {
      els.chatInput.value = btn.dataset.retryPrompt;
      autoResize(els.chatInput);
      els.chatInput.focus();
    });
  });
}

function scrollToBottom() {
  setTimeout(() => els.messageList.scrollTo({ top: els.messageList.scrollHeight, behavior: "smooth" }), 60);
}

// ===== Fun messages during generation =====
function startFunMessages() {
  state.funIndex = 0;
  els.generationStatus.classList.remove("hidden");
  els.funMessage.textContent = funMessages[0];
  state.funTimer = setInterval(() => {
    state.funIndex = (state.funIndex + 1) % funMessages.length;
    els.funMessage.textContent = funMessages[state.funIndex];
  }, 2500);
}

function stopFunMessages() {
  if (state.funTimer) clearInterval(state.funTimer);
  state.funTimer = null;
  els.generationStatus.classList.add("hidden");
}

// ===== Submit generation =====
async function submitGeneration(prompt) {
  if (!prompt.trim() || state.generating) return;
  if (!state.user) { openAuthModal(); return; }

  state.generating = true;

  // Add user message
  const userMsg = { id: `u_${Date.now()}`, role: "user", prompt, status: "done" };
  state.messages.push(userMsg);

  // Add placeholder assistant message
  const tempId = `tmp_${Date.now()}`;
  const assistantMsg = { id: tempId, role: "assistant", prompt, imageUrl: null, status: "generating", error: null };
  state.messages.push(assistantMsg);

  renderMessages();
  scrollToBottom();
  startFunMessages();

  try {
    const payload = {
      prompt,
      conversationId: state.activeConversationId || undefined,
      size: els.sizeSelect?.value || "auto",
      quality: els.qualitySelect?.value || "auto",
      n: 1
    };
    const data = await api("/api/images/generate", { method: "POST", body: JSON.stringify(payload) });
    const gen = data.generations[0];

    // Update active conversation
    if (data.conversationId && !state.activeConversationId) {
      state.activeConversationId = data.conversationId;
      showChat();
      els.chatTitle.textContent = prompt.slice(0, 40) || "新对话";
      // Refresh conversation list
      await loadConversations();
    }

    // Update assistant message
    const idx = state.messages.findIndex((m) => m.id === tempId);
    if (idx >= 0) {
      state.messages[idx] = { ...state.messages[idx], id: gen.id, imageUrl: gen.imageUrl, status: "done" };
    }

    state.user.credits = data.credits;
    updateNav();
    showToast("图片已生成");
  } catch (err) {
    const idx = state.messages.findIndex((m) => m.id === tempId);
    if (idx >= 0) {
      state.messages[idx] = { ...state.messages[idx], status: "error", error: err.message };
    }
    showToast(err.message);
  } finally {
    state.generating = false;
    stopFunMessages();
    renderMessages();
    scrollToBottom();
  }
}

// ===== Form submissions =====
els.welcomeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const prompt = els.welcomeInput.value.trim();
  if (!prompt) return;
  els.welcomeInput.value = "";
  autoResize(els.welcomeInput);
  // Switch to chat view immediately
  showChat();
  els.chatTitle.textContent = prompt.slice(0, 40);
  submitGeneration(prompt);
});

els.chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const prompt = els.chatInput.value.trim();
  if (!prompt) return;
  els.chatInput.value = "";
  autoResize(els.chatInput);
  submitGeneration(prompt);
});

// Enter to submit (Shift+Enter for newline)
[els.welcomeInput, els.chatInput].forEach((textarea) => {
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      textarea.closest("form").requestSubmit();
    }
  });
});

// ===== Example chips =====
$$("[data-example]").forEach((btn) => {
  btn.addEventListener("click", () => {
    els.welcomeInput.value = btn.dataset.example;
    autoResize(els.welcomeInput);
    els.welcomeInput.focus();
  });
});

// ===== New chat button =====
els.newChatBtn.addEventListener("click", () => {
  showWelcome();
  closeSidebar();
  els.welcomeInput.focus();
});

// ===== Rename conversation =====
els.chatTitleEdit.addEventListener("click", () => {
  if (!state.activeConversationId) return;
  const current = els.chatTitle.textContent;
  const input = document.createElement("input");
  input.className = "rename-input";
  input.value = current;
  els.chatTitle.replaceWith(input);
  input.focus();
  input.select();

  const finish = async () => {
    const newTitle = input.value.trim() || current;
    const h2 = document.createElement("h2");
    h2.id = "chatTitle";
    h2.className = "chat-title";
    h2.textContent = newTitle;
    input.replaceWith(h2);
    // Re-bind reference
    els.chatTitle = h2;
    if (newTitle !== current && state.activeConversationId) {
      try {
        await api(`/api/conversations/${state.activeConversationId}`, { method: "PATCH", body: JSON.stringify({ title: newTitle }) });
        const conv = state.conversations.find((c) => c.id === state.activeConversationId);
        if (conv) conv.title = newTitle;
        renderConversationList();
      } catch (err) { showToast(err.message); }
    }
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } if (e.key === "Escape") { input.value = current; input.blur(); } });
});

// ===== Auth =====
function openAuthModal(mode = "login") {
  const isReg = mode === "register";
  els.modalLayer.innerHTML = `
    <section class="modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <h2>${isReg ? "注册账号" : "登录"}</h2>
      <form id="authForm">
        ${isReg ? `<label>昵称<input id="authName" autocomplete="name"></label>` : ""}
        <label>邮箱<input id="authEmail" type="email" required></label>
        <label>密码<input id="authPassword" type="password" required></label>
        <button class="modal-primary" type="submit">${isReg ? "注册" : "登录"}</button>
        <button class="modal-secondary" type="button" data-switch-auth="${isReg ? "login" : "register"}">${isReg ? "已有账号？登录" : "还没有账号？注册"}</button>
      </form>
    </section>
  `;
  els.modalLayer.classList.remove("hidden");
  $(".close-modal", els.modalLayer).addEventListener("click", closeModal);
  els.modalLayer.addEventListener("click", (e) => { if (e.target === els.modalLayer) closeModal(); });
  $("[data-switch-auth]", els.modalLayer).addEventListener("click", () => openAuthModal(isReg ? "login" : "register"));
  $("#authForm", els.modalLayer).addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type='submit']", els.modalLayer);
    btn.disabled = true;
    try {
      const payload = { email: $("#authEmail").value, password: $("#authPassword").value, name: $("#authName")?.value || "" };
      await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
      await bootstrap();
      closeModal();
    } catch (err) { showToast(err.message); }
    finally { btn.disabled = false; }
  });
}

function closeModal() {
  els.modalLayer.classList.add("hidden");
  els.modalLayer.innerHTML = "";
}

els.loginBtn.addEventListener("click", () => openAuthModal("login"));
els.logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  state.conversations = [];
  state.messages = [];
  state.activeConversationId = null;
  updateNav();
  showWelcome();
  renderConversationList();
});

// ===== Credits modal =====
els.creditsBtn.addEventListener("click", () => {
  if (!state.user) return;
  els.modalLayer.innerHTML = `
    <section class="modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <h2>积分</h2>
      <p>当前余额: <strong>${state.user.credits}</strong></p>
      <form id="redeemForm">
        <label>卡密兑换<input id="redeemInput" placeholder="输入卡密" maxlength="64"></label>
        <button class="modal-primary" type="submit">兑换</button>
      </form>
      <button class="modal-secondary" type="button" id="checkinBtn">签到领取积分</button>
    </section>
  `;
  els.modalLayer.classList.remove("hidden");
  $(".close-modal", els.modalLayer).addEventListener("click", closeModal);
  els.modalLayer.addEventListener("click", (e) => { if (e.target === els.modalLayer) closeModal(); });
  $("#redeemForm", els.modalLayer).addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = $("#redeemInput").value.trim();
    if (!code) return;
    try {
      const data = await api("/api/redeem", { method: "POST", body: JSON.stringify({ code }) });
      state.user.credits = data.credits;
      updateNav();
      showToast(`兑换成功 +${data.added}`);
      closeModal();
    } catch (err) { showToast(err.message); }
  });
  $("#checkinBtn", els.modalLayer).addEventListener("click", async () => {
    try {
      const data = await api("/api/checkin", { method: "POST" });
      state.user = data.user || { ...state.user, credits: data.credits };
      updateNav();
      showToast("签到成功");
      closeModal();
    } catch (err) { showToast(err.message); }
  });
});

// ===== Load conversations =====
async function loadConversations() {
  if (!state.user) { state.conversations = []; return; }
  try {
    const data = await api("/api/conversations");
    state.conversations = data.conversations || [];
  } catch { state.conversations = []; }
  renderConversationList();
}

// ===== Bootstrap =====
async function bootstrap() {
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
    state.settings = data.settings;
  } catch {
    state.user = null;
    state.settings = null;
  }
  updateNav();
  if (state.user) {
    await loadConversations();
  }
  showWelcome();
}

bootstrap();
