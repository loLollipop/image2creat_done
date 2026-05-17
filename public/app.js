const DEFAULT_ALLOWED_IMAGE_SIZES = ["auto", "1024x1024", "1024x1536", "1536x1024"];
const MAX_EDIT_UPLOAD_BYTES = 8 * 1024 * 1024;

const state = {
  lang: localStorage.getItem("lang") || "zh",
  user: null,
  settings: null,
  firstRun: false,
  view: "landing",
  history: [],
  allGenerations: [],
  activeConversationId: null,
  generating: false,
  funIndex: 0,
  funTimer: null,
  thinkingStartTime: null,
  draftPrompt: "",
  generationOptions: {
    size: "auto",
    quality: "auto",
    background: "auto",
    outputFormat: "png"
  },
  imageCount: "1",
  pendingTurns: new Set(),
  references: [],
  publishToSquare: false,
  publicGallery: [],
  checkin: {
    checkedInToday: false,
    credit: 1
  },
  authMode: "login",
  libraryTag: "all",
  librarySearch: "",
  promptItems: [],
  promptVisible: 20,
  promptLoading: true,
  pendingAction: null,
  stats: {
    todayGenerated: 4200
  }
};

const i18n = {
  zh: {
    brand: "Image Studio",
    promptLibrary: "提示词库",
    myWorks: "我的作品",
    login: "登录",
    logout: "退出",
    headPre: "用想象力",
    headItalic: "创造",
    headPost: "世界",
    desc: "用 GPT Image 将你的创意变为精美图片，只需描述你脑海中的画面。",
    reviews: "生成后会自动保存到你的图库",
    todayGeneratedPrefix: "今日已生成",
    todayGeneratedSuffix: "张图片",
    newChat: "新聊天",
    recentTitle: "最近创作",
    recentSubtitle: "来自你的灵感",
    examplesLabel: "灵感示例",
    viewMore: "查看更多",
    placeholder: "描述你想创作的图片...",
    startCreate: "开始创作",
    create: "生成",
    generating: "生成中...",
    reference: "参考图",
    options: "参数",
    size: "尺寸",
    quality: "质量",
    background: "背景",
    format: "格式",
    retry: "再次生成",
    download: "保存",
    edit: "重新编辑",
    editImage: "编辑",
    openEditor: "继续修改",
    emptyWorks: "还没有生成记录",
    uploadEditImage: "上传或从作品中选择图片",
    copy: "复制提示词",
    use: "去生成",
    libraryBadge: "精选提示词库",
    libraryTitle: "发现无尽创意",
    librarySubtitle: "搜索风格、场景或用途，一键带入生成台。",
    librarySearchLabel: "检索",
    search: "搜索",
    all: "全部",
    noResults: "没有找到匹配的提示词",
    preview: "预览",
    totalPrompts: "精选提示词",
    totalSources: "数据源",
    loadMore: "加载更多灵感",
    loadingPrompts: "正在加载提示词库...",
    loginTitle: "登录以继续创作",
    registerTitle: "注册账号",
    authGift: "注册登录以继续创作",
    authContinue: "注册登录以继续创作",
    authBonus: "注册赠送 10 积分，每日签到 +1 积分",
    email: "邮箱",
    password: "密码",
    name: "昵称",
    profile: "个人信息",
    userId: "用户 ID",
    username: "用户名",
    currentPassword: "当前密码",
    newPassword: "新密码",
    confirmPassword: "确认新密码",
    changeAvatar: "更换头像",
    avatarHint: "支持 JPG、PNG、WebP",
    profileSaveSuccess: "资料已更新",
    passwordMismatch: "两次输入的新密码不一致",
    passwordIncomplete: "如需修改密码，请填写当前密码和新密码",
    submitLogin: "登录",
    submitRegister: "注册",
    switchToRegister: "还没有账号？注册",
    switchToLogin: "已有账号？登录",
    skip: "暂不登录",
    creditsTitle: "每日签到",
    creditsBalance: "当前积分",
    oneCredit: "每次生成消耗积分",
    contactInput: "微信号 / QQ / 邮箱 / 手机号",
    messageInput: "留言内容（选填）",
    submit: "提交",
    received: "已收到",
    receivedDesc: "管理员会尽快联系你",
    close: "关闭",
    adminTitle: "后台管理",
    settings: "接口配置",
    users: "用户",
    apiKey: "OpenAI API Key",
    apiBaseUrl: "API 地址",
    model: "模型",
    defaultCredits: "默认额度",
    generationCost: "每张图消耗积分",
    maxImages: "单次张数",
    allowRegistration: "开放注册",
    requireApproval: "注册后需启用",
    save: "保存",
    clearKey: "清除 Key",
    currentKey: "当前 Key",
    noKey: "当前未配置 Key",
    publishToSquare: "公开到广场",
    imageCount: "张数",
    creditsRemain: "剩余",
    modeGenerate: "文生图",
    modeEdit: "图生图",
    reuseConfig: "复用",
    regenerateTurn: "重新生成",
    continueEditAction: "继续编辑",
    publishImageAction: "公开",
    lightboxAction: "查看",
    retryImageAction: "重试",
    deleteTurn: "删除该轮",
    confirmDeleteTurn: "确认删除该轮生成？",
    confirmRegenerateTurn: "重新生成该轮全部图片？",
    referenceCount: "{n} 张参考图",
    turnImageError: "生成失败",
    turnQueued: "排队中",
    turnGenerating: "生成中",
    turnPartialError: "其中 {n} 张未成功",
    publicSuccess: "已公开到广场",
    role: "角色",
    status: "状态",
    credits: "积分",
    checkinToday: "签到领取积分",
    checkedIn: "今日已签到",
    checkinReward: "每天签到可获得 1 积分",
    noticeTitle: "内容合规管理公告",
    noticeSubtitle: "为营造健康、积极、向上的平台环境，我们现已全面升级内容安全审核机制",
    noticeCore: "核心管控规范",
    noticePrivacy: "隐私承诺",
    noticeTogether: "共同守护：感谢您的理解与配合。清朗的网络空间需要我们每一个人共同维护。",
    noticeAck: "我已了解",
    active: "启用",
    disabled: "停用",
    user: "用户",
    adminRole: "管理员",
    redeemTitle: "卡密兑换",
    redeemDesc: "输入卡密兑换积分（仅 A-Z 与 2-9，大小写不敏感，连字符可省略）",
    redeemPlaceholder: "AAAA-AAAA-AAAA-AAAA",
    redeemSubmit: "兑换",
    redeemSuccess: "兑换成功",
    redeemEmpty: "请输入卡密",
    historyLink: "积分流水",
    funMsgs: [
      "正在调配完美的色彩...",
      "撒上一些像素灵感...",
      "AI 画笔正在起步...",
      "将光影和构图融合在一起...",
      "正在召唤你的想象...",
      "杰作正在生长...",
      "创意正在酝酿中...",
      "添加最后的点睛之笔..."
    ]
  },
  en: {
    brand: "Image Studio",
    promptLibrary: "Prompts",
    myWorks: "My Works",
    login: "Login",
    logout: "Logout",
    headPre: "Create with",
    headItalic: "imagination",
    headPost: "",
    desc: "Transform your ideas into polished visuals with GPT Image. Just describe what you see in your mind.",
    reviews: "Generated images are saved to your gallery",
    todayGeneratedPrefix: "Today generated",
    todayGeneratedSuffix: "images",
    newChat: "New Chat",
    recentTitle: "Recent Creations",
    recentSubtitle: "Your creative history",
    examplesLabel: "Inspiration",
    viewMore: "View more",
    placeholder: "Describe the image you want to create...",
    startCreate: "Start creating",
    create: "Create",
    generating: "Creating...",
    reference: "Reference",
    options: "Options",
    size: "Size",
    quality: "Quality",
    background: "Background",
    format: "Format",
    retry: "Regenerate",
    download: "Save",
    edit: "Edit prompt",
    editImage: "Edit",
    openEditor: "Continue editing",
    emptyWorks: "No generated images yet",
    uploadEditImage: "Upload or choose an image",
    copy: "Copy prompt",
    use: "Generate",
    libraryBadge: "Curated Prompt Library",
    libraryTitle: "Discover Endless Creativity",
    librarySubtitle: "Search styles, scenes, and use cases, then send one straight to the composer.",
    librarySearchLabel: "Library",
    search: "Search",
    all: "All",
    noResults: "No matching prompts found",
    preview: "Preview",
    totalPrompts: "Curated Prompts",
    totalSources: "Data Sources",
    loadMore: "Load More Inspiration",
    loadingPrompts: "Loading prompt library...",
    loginTitle: "Login to continue",
    registerTitle: "Create account",
    authGift: "Sign in to continue creating",
    authContinue: "Sign in to continue creating",
    authBonus: "10 bonus credits on signup + 1 daily check-in credit",
    email: "Email",
    password: "Password",
    name: "Name",
    profile: "Profile",
    userId: "User ID",
    username: "Username",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    changeAvatar: "Change avatar",
    avatarHint: "Supports JPG, PNG, and WebP",
    profileSaveSuccess: "Profile updated",
    passwordMismatch: "The new passwords do not match",
    passwordIncomplete: "To change your password, fill in both the current and new password",
    submitLogin: "Login",
    submitRegister: "Register",
    switchToRegister: "Need an account? Register",
    switchToLogin: "Already have an account? Login",
    skip: "Skip",
    creditsTitle: "Daily Check-in",
    creditsBalance: "Balance",
    oneCredit: "Credits per image",
    contactInput: "WeChat / Email / Phone",
    messageInput: "Message (optional)",
    submit: "Submit",
    received: "Received",
    receivedDesc: "Admin will contact you soon",
    close: "Close",
    adminTitle: "Admin",
    settings: "Settings",
    users: "Users",
    apiKey: "OpenAI API Key",
    apiBaseUrl: "API Base URL",
    model: "Model",
    defaultCredits: "Default credits",
    generationCost: "Credits per image",
    maxImages: "Images per request",
    allowRegistration: "Allow registration",
    requireApproval: "Require approval",
    save: "Save",
    clearKey: "Clear key",
    currentKey: "Current key",
    noKey: "No key configured",
    publishToSquare: "Publish to square",
    imageCount: "Count",
    creditsRemain: "Credits",
    modeGenerate: "Text to image",
    modeEdit: "Image to image",
    reuseConfig: "Reuse",
    regenerateTurn: "Regenerate",
    continueEditAction: "Continue editing",
    publishImageAction: "Publish",
    lightboxAction: "View",
    retryImageAction: "Retry",
    deleteTurn: "Delete turn",
    confirmDeleteTurn: "Delete this generation turn?",
    confirmRegenerateTurn: "Regenerate all images in this turn?",
    referenceCount: "{n} reference image(s)",
    turnImageError: "Generation failed",
    turnQueued: "Queued",
    turnGenerating: "Generating",
    turnPartialError: "{n} image(s) failed",
    publicSuccess: "Published to public gallery",
    role: "Role",
    status: "Status",
    credits: "Credits",
    checkinToday: "Check in",
    checkedIn: "Checked in today",
    checkinReward: "Daily check-in gives 1 credit",
    noticeTitle: "Content Safety Notice",
    noticeSubtitle: "To keep this platform healthy, positive, and safe, content safety review has been upgraded.",
    noticeCore: "Core Rules",
    noticePrivacy: "Privacy Promise",
    noticeTogether: "Together: Thank you for your understanding. A safer creative space depends on all of us.",
    noticeAck: "I understand",
    active: "Active",
    disabled: "Disabled",
    user: "User",
    adminRole: "Admin",
    redeemTitle: "Redeem Code",
    redeemDesc: "Enter a redeem code to top up credits (uppercase letters and digits 2-9; dashes optional)",
    redeemPlaceholder: "AAAA-AAAA-AAAA-AAAA",
    redeemSubmit: "Redeem",
    redeemSuccess: "Redeem successful",
    redeemEmpty: "Please enter a redeem code",
    historyLink: "Credit history",
    funMsgs: [
      "Mixing the perfect palette...",
      "Sprinkling pixel inspiration...",
      "The AI brush is warming up...",
      "Blending light and composition...",
      "Conjuring your vision...",
      "Growing your masterpiece...",
      "Brewing creativity...",
      "Adding finishing touches..."
    ]
  }
};

const fallbackPrompts = [
  {
    id: 1,
    tag: "product",
    icon: "ri-shopping-bag-3-line",
    title: { zh: "高端产品图", en: "Premium Product Shot" },
    prompt: {
      zh: "一张高端无线充电器产品摄影，哑光黑色机身，柔和棚拍灯光，浅灰背景，精致阴影，商业广告质感，超清细节",
      en: "A premium product photo of a matte black wireless charger, soft studio lighting, light gray background, refined shadows, commercial advertising style, ultra-detailed"
    },
    colors: "linear-gradient(135deg, #0f172a, #64748b)"
  },
  {
    id: 2,
    tag: "poster",
    icon: "ri-layout-4-line",
    title: { zh: "活动海报", en: "Event Poster" },
    prompt: {
      zh: "未来感 AI 创作活动海报，干净排版，强烈视觉焦点，黑白主调点缀电光蓝，高级平面设计，适合社交媒体",
      en: "A futuristic AI creativity event poster, clean typography, strong focal point, black and white palette with electric blue accents, premium graphic design"
    },
    colors: "linear-gradient(135deg, #111827, #2563eb)"
  },
  {
    id: 3,
    tag: "photo",
    icon: "ri-camera-lens-line",
    title: { zh: "生活方式摄影", en: "Lifestyle Photo" },
    prompt: {
      zh: "清晨咖啡桌上的极简工作场景，笔记本电脑、手机和一束花，自然窗光，温暖但不过度复古，真实摄影质感",
      en: "A minimal morning workspace on a coffee table with laptop, phone, and flowers, natural window light, warm but modern, realistic photography"
    },
    colors: "linear-gradient(135deg, #0f766e, #f59e0b)"
  },
  {
    id: 4,
    tag: "character",
    icon: "ri-user-smile-line",
    title: { zh: "角色设定", en: "Character Design" },
    prompt: {
      zh: "一位未来城市中的年轻发明家角色设定，全身像，功能性服装，背包设备，清晰轮廓，电影概念艺术风格",
      en: "A young inventor in a future city, full-body character design, functional clothing, backpack device, clean silhouette, cinematic concept art"
    },
    colors: "linear-gradient(135deg, #7c3aed, #ec4899)"
  },
  {
    id: 5,
    tag: "ui",
    icon: "ri-window-line",
    title: { zh: "应用界面概念", en: "App Interface Concept" },
    prompt: {
      zh: "一款 AI 图片生成应用的移动端界面概念，白色玻璃拟态卡片，底部输入框，图片瀑布流，现代 iOS 风格，高级 UI 截图",
      en: "A mobile interface concept for an AI image generation app, white glass cards, bottom composer, image feed, modern iOS style, polished UI screenshot"
    },
    colors: "linear-gradient(135deg, #38bdf8, #6366f1)"
  },
  {
    id: 6,
    tag: "illustration",
    icon: "ri-brush-line",
    title: { zh: "童书插画", en: "Storybook Illustration" },
    prompt: {
      zh: "温柔的童书插画，一只纸船漂在星光河流上，柔软笔触，梦幻但清晰，留白充足，适合封面",
      en: "A gentle storybook illustration of a paper boat floating on a starlit river, soft brushwork, dreamy but clear, generous negative space, cover art"
    },
    colors: "linear-gradient(135deg, #8b5cf6, #fbbf24)"
  }
];

const tags = ["all", "ui", "photo", "poster", "portrait", "illustration", "anime", "product", "3d", "landscape", "character", "other", "logo", "fashion", "cyberpunk", "infographic", "food"];
const tagLabels = {
  zh: {
    all: "全部",
    ui: "UI/界面",
    photo: "摄影",
    poster: "海报插画",
    portrait: "人像摄影",
    illustration: "插画艺术",
    anime: "二次元",
    product: "产品电商",
    "3d": "3D 渲染",
    landscape: "风景城市",
    character: "角色设计",
    other: "其他",
    logo: "Logo 设计",
    fashion: "时尚",
    cyberpunk: "赛博朋克",
    infographic: "信息图",
    food: "美食"
  },
  en: {
    all: "All",
    ui: "UI",
    photo: "Photo",
    poster: "Poster",
    portrait: "Portrait",
    illustration: "Illustration",
    anime: "Anime",
    product: "E-commerce",
    "3d": "3D Render",
    landscape: "Landscape",
    character: "Character",
    other: "Other",
    logo: "Logo",
    fashion: "Fashion",
    cyberpunk: "Cyberpunk",
    infographic: "Infographic",
    food: "Food"
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  app: $("#app"),
  homeView: $("#homeView"),
  chatView: $("#chatView"),
  libraryView: $("#libraryView"),
  modalLayer: $("#modalLayer"),
  toastLayer: $("#toastLayer"),
  brandBtn: $("#brandBtn"),
  startCreateBtn: $("#startCreateBtn"),
  promptLibraryBtn: $("#promptLibraryBtn"),
  langBtn: $("#langBtn"),
  loginBtn: $("#loginBtn"),
  userMenuWrap: $("#userMenuWrap"),
  userMenuButton: $("#userMenuButton"),
  userMenuPanel: $("#userMenuPanel"),
  userMenuAvatar: $("#userMenuAvatar"),
  userMenuSummaryAvatar: $("#userMenuSummaryAvatar"),
  userMenuName: $("#userMenuName"),
  userMenuEmail: $("#userMenuEmail"),
  userMenuId: $("#userMenuId"),
  userMenuCredits: $("#userMenuCredits"),
  profileBtn: $("#profileBtn"),
  userCreditsBtn: $("#userCreditsBtn"),
  userWorksBtn: $("#userWorksBtn"),
  userLogoutBtn: $("#userLogoutBtn"),
  apiStatus: $("#apiStatus"),
  todayGeneratedText: $("#todayGeneratedText"),
  stickyComposerMount: $("#stickyComposerMount"),
  workspaceNewBtn: $("#workspaceNewBtn"),
  workspaceConvList: $("#workspaceConvList"),
  workspaceThread: $("#workspaceThread"),
  generationStatus: $("#generationStatus"),
  funMessage: $("#funMessage"),
  historyList: $("#historyList"),
  exampleGrid: $("#exampleGrid"),
  openLibraryInlineBtn: $("#openLibraryInlineBtn"),
  librarySearchForm: $("#librarySearchForm"),
  librarySearchInput: $("#librarySearchInput"),
  tagFilters: $("#tagFilters"),
  promptGrid: $("#promptGrid"),
  composerTemplate: $("#composerTemplate"),
  turnTemplate: $("#turnTemplate"),
  turnImageTemplate: $("#turnImageTemplate")
};

let heroVideoWatchdog = null;

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

function text(key) {
  return i18n[state.lang][key] || i18n.zh[key] || key;
}

function local(value) {
  if (value && typeof value === "object") return value[state.lang] || value.zh || value.en || "";
  return value || "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function truncate(value, length = 120) {
  const textValue = String(value || "");
  return textValue.length > length ? `${textValue.slice(0, length)}...` : textValue;
}

function showToast(message, icon = "ri-information-line") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="${icon}"></i><span>${escapeHtml(message)}</span>`;
  elements.toastLayer.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function applyI18n(root = document) {
  $$("[data-i18n]", root).forEach((node) => {
    node.textContent = text(node.dataset.i18n);
  });
  $$(".prompt-box").forEach((node) => {
    node.placeholder = text("placeholder");
  });
  elements.langBtn.textContent = state.lang === "zh" ? "中/EN" : "EN/中";
  updateDailyMetric();
}

function formatDailyCount(value) {
  const count = Math.max(0, Number(value) || 0);
  return `${count.toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US")}${count >= 1000 ? "+" : ""}`;
}

function updateDailyMetric() {
  if (!elements.todayGeneratedText) return;
  elements.todayGeneratedText.textContent = `${text("todayGeneratedPrefix")} ${formatDailyCount(state.stats.todayGenerated)} ${text("todayGeneratedSuffix")}`;
}

function getDisplayName(user = state.user) {
  if (!user) return "";
  const name = String(user.name || "").trim();
  if (name) return name;
  const email = String(user.email || "").trim();
  return email ? email.split("@")[0] : (state.lang === "zh" ? "用户" : "User");
}

function getAvatarMarkup(user = state.user) {
  const label = getDisplayName(user);
  const avatarUrl = String(user?.avatarUrl || "").trim();
  if (avatarUrl) {
    return `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(label)}">`;
  }
  const initial = Array.from(label)[0] || "U";
  return `<span>${escapeHtml(initial.toUpperCase())}</span>`;
}

function closeUserMenu() {
  elements.userMenuPanel?.classList.add("hidden");
  elements.userMenuButton?.setAttribute("aria-expanded", "false");
}

function toggleUserMenu(forceOpen) {
  if (!elements.userMenuPanel || !elements.userMenuButton || elements.userMenuWrap?.classList.contains("hidden")) return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : elements.userMenuPanel.classList.contains("hidden");
  elements.userMenuPanel.classList.toggle("hidden", !shouldOpen);
  elements.userMenuButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function updateNav() {
  const loggedIn = Boolean(state.user);
  elements.loginBtn.classList.toggle("hidden", loggedIn);
  elements.userMenuWrap?.classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    const displayName = getDisplayName();
    if (elements.userMenuAvatar) elements.userMenuAvatar.innerHTML = getAvatarMarkup();
    if (elements.userMenuSummaryAvatar) elements.userMenuSummaryAvatar.innerHTML = getAvatarMarkup();
    if (elements.userMenuName) elements.userMenuName.textContent = displayName;
    if (elements.userMenuEmail) elements.userMenuEmail.textContent = state.user.email || "";
    if (elements.userMenuId) elements.userMenuId.textContent = `${text("userId")}: ${state.user.id}`;
    if (elements.userMenuCredits) elements.userMenuCredits.textContent = String(state.user.credits ?? 0);
  } else {
    closeUserMenu();
  }

  const hasApiKey = Boolean(state.settings?.hasApiKey);
  elements.apiStatus.textContent = hasApiKey
    ? "gpt-image-2"
    : state.lang === "zh"
      ? "后台未配置 API Key"
      : "API key not configured";
  elements.apiStatus.style.color = hasApiKey ? "#64748b" : "#b42318";
}

function setView(view) {
  state.view = view;
  elements.homeView.classList.toggle("hidden", view !== "landing");
  elements.chatView.classList.toggle("hidden", view !== "workspace");
  elements.libraryView.classList.toggle("hidden", view !== "library");
  if (view === "library") renderLibrary();
  if (view === "landing") requestAnimationFrame(playHeroVideo);
  updateNav();
}

function clearComposerReferences() {
  for (const reference of state.references) {
    if (reference?.url?.startsWith("blob:")) URL.revokeObjectURL(reference.url);
  }
  state.references = [];
}

function setComposerReference({ url = "", imageData = "", name = "", sourceGenerationId = null, conversationId = null } = {}) {
  clearComposerReferences();
  const resolvedUrl = url || imageData;
  if (!resolvedUrl) return;
  state.references = [{
    url: resolvedUrl,
    imageData: imageData || (resolvedUrl.startsWith("data:") ? resolvedUrl : ""),
    name: name || "image-reference",
    sourceGenerationId: sourceGenerationId || null,
    conversationId: conversationId || null
  }];
}

function getLatestSuccessfulHistoryItem() {
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const item = state.history[index];
    if (item?.status === "done" && item.images?.[0]) return item;
  }
  return null;
}

function getConversationFallbackReference() {
  const latestItem = getLatestSuccessfulHistoryItem();
  if (!latestItem) return null;
  return {
    url: latestItem.images[0],
    name: `generation-${latestItem.id}`,
    sourceGenerationId: latestItem.id,
    conversationId: latestItem.conversationId || state.activeConversationId || null
  };
}

function seedComposerReferenceFromHistory() {
  const latestReference = getConversationFallbackReference();
  if (!latestReference) {
    clearComposerReferences();
    return;
  }
  setComposerReference(latestReference);
}

function openWorkspace(options = {}) {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  setView("workspace");
  if (options.prompt) {
    state.draftPrompt = options.prompt;
    syncComposers();
  }
  scrollToBottom(false);
}

function renderAll() {
  applyI18n();
  updateNav();
  renderExamples();
  renderHistory();
  renderConvList();
  if (state.view === "library") renderLibrary();
  renderComposers();
  setView(state.view);
}

function renderComposers() {
  if (!elements.stickyComposerMount.children.length) {
    elements.stickyComposerMount.appendChild(createComposer(true));
  }
  syncComposers();
  syncReferences();
}

function createComposer(sticky) {
  const fragment = elements.composerTemplate.content.cloneNode(true);
  const form = $(".composer", fragment);
  const textarea = $(".prompt-box", form);
  const referenceInput = $(".reference-input", form);
  const referenceRow = $(".reference-row", form);
  const optionsToggle = $(".options-toggle", form);
  const publicInput = $(".public-input", form);
  const advanced = $(".advanced-options", form);
  const imageCountInput = $(".image-count-input", form);

  form.dataset.sticky = sticky ? "1" : "0";
  textarea.addEventListener("input", () => {
    state.draftPrompt = textarea.value;
    syncComposers(form);
  });
  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.shiftKey) return;
    event.preventDefault();
    form.requestSubmit();
  });
  // Paste an image directly into the prompt box to attach it as the next
  // reference. Mirrors the paste-to-upload behaviour in
  // chatgpt2api/web/src/app/image/components/image-composer.tsx.
  textarea.addEventListener("paste", async (event) => {
    const items = event.clipboardData?.items;
    if (!items?.length) return;
    for (const item of items) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      try {
        const dataUrl = await blobToDataUrl(file);
        setComposerReference({
          url: dataUrl,
          imageData: dataUrl,
          name: file.name || "clipboard.png",
          sourceGenerationId: null,
          conversationId: state.activeConversationId || null
        });
        syncReferences(form);
        syncComposers(form);
        showToast(state.lang === "zh" ? "已从剪贴板载入图片" : "Image pasted from clipboard", "ri-image-add-line");
      } catch (error) {
        showToast(error.message || "Paste failed", "ri-error-warning-line");
      }
      return;
    }
  });
  referenceInput.addEventListener("change", async () => {
    const files = [...(referenceInput.files || [])];
    const file = files[0];
    if (!file) return;
    if (files.length > 1) {
      referenceInput.value = "";
      showToast(state.lang === "zh" ? "图生图一次只能上传 1 张图片" : "Image editing supports only 1 upload at a time.", "ri-error-warning-line");
      return;
    }
    if (!String(file.type || "").startsWith("image/")) {
      referenceInput.value = "";
      showToast(state.lang === "zh" ? "请上传图片文件" : "Please upload an image file.", "ri-error-warning-line");
      return;
    }
    if (file.size > MAX_EDIT_UPLOAD_BYTES) {
      referenceInput.value = "";
      showToast(state.lang === "zh" ? "单张图片不能超过 8 MiB" : "Each image must be 8 MiB or smaller.", "ri-error-warning-line");
      return;
    }
    const dataUrl = await blobToDataUrl(file);
    setComposerReference({ url: dataUrl, imageData: dataUrl, name: file.name, sourceGenerationId: null });
    referenceInput.value = "";
    syncReferences(form);
    openWorkspace({ prompt: textarea.value.trim(), preserveReference: true });
    showToast(state.lang === "zh" ? "已载入图片，请描述你想修改的内容" : "Image attached. Describe how you want to modify it.", "ri-image-add-line");
  });
  optionsToggle.addEventListener("click", () => {
    advanced.classList.toggle("hidden");
    optionsToggle.classList.toggle("active", !advanced.classList.contains("hidden"));
  });
  publicInput.addEventListener("change", () => {
    state.publishToSquare = publicInput.checked;
    syncComposers(form);
  });
  if (imageCountInput) {
    imageCountInput.addEventListener("change", () => {
      state.imageCount = imageCountInput.value || "1";
      syncComposers(form);
    });
  }
  $$(".advanced-options select", form).forEach((select) => {
    select.addEventListener("change", () => {
      state.generationOptions = getComposerOptions(form);
      updateCustomSizeVisibility(form);
      syncComposers(form);
    });
  });
  $$(".custom-size-row input", form).forEach((input) => {
    input.addEventListener("input", () => {
      state.generationOptions = getComposerOptions(form);
      syncComposers(form);
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitGeneration(form);
  });
  applyI18n(form);
  return fragment;
}

function getAllowedImageSizes() {
  const allowedSizes = state.settings?.allowedImageSizes;
  return Array.isArray(allowedSizes) && allowedSizes.length ? allowedSizes : DEFAULT_ALLOWED_IMAGE_SIZES;
}

function normalizeSelectedImageSize(value) {
  const allowedSizes = getAllowedImageSizes();
  const normalizedValue = String(value || "auto");
  return allowedSizes.includes(normalizedValue) ? normalizedValue : (allowedSizes[0] || "auto");
}

function getComposerOptions(form) {
  const sizeValue = normalizeSelectedImageSize($(".size-input", form).value);
  return {
    size: sizeValue,
    sizeMode: sizeValue,
    customWidth: "",
    customHeight: "",
    quality: $(".quality-input", form).value,
    background: $(".background-input", form).value,
    outputFormat: $(".format-input", form).value,
    isPublic: $(".public-input", form).checked,
    imageCount
  };
}

function updateCustomSizeVisibility(form) {
  const row = $(".custom-size-row", form);
  if (!row) return;
  row.classList.toggle("hidden", $(".size-input", form).value !== "custom");
}

function syncComposers(sourceForm) {
  const isImageEdit = state.references.length > 0;
  const maxImages = Math.max(1, Number(state.settings?.maxImagesPerRequest) || 1);
  const effectiveMax = isImageEdit ? 1 : maxImages;
  const desiredCount = String(Math.min(effectiveMax, Math.max(1, Number(state.imageCount) || 1)));
  state.imageCount = desiredCount;
  $$(".composer").forEach((form) => {
    if (form !== sourceForm) {
      $(".prompt-box", form).value = state.draftPrompt;
      const mode = state.generationOptions.sizeMode || state.generationOptions.size;
      $(".size-input", form).value = normalizeSelectedImageSize(mode);
      $(".quality-input", form).value = state.generationOptions.quality;
      $(".background-input", form).value = state.generationOptions.background;
      $(".format-input", form).value = state.generationOptions.outputFormat;
      $(".public-input", form).checked = state.publishToSquare;
    }
    updateCustomSizeVisibility(form);
    $(".model-label", form).textContent = "gpt-image-2";
    const activeReference = state.references[0] || getConversationFallbackReference();
    const isImageEdit = Boolean(activeReference?.url);
    const actionText = isImageEdit
      ? (state.lang === "zh" ? "修改" : "Edit")
      : text("create");
    const submitLabel = $(".send-button span", form);
    if (submitLabel) submitLabel.textContent = actionText;
    const qualityInput = $(".quality-input", form);
    const backgroundInput = $(".background-input", form);
    const formatInput = $(".format-input", form);
    if (qualityInput) qualityInput.disabled = isImageEdit;
    if (backgroundInput) backgroundInput.disabled = isImageEdit;
    if (formatInput) formatInput.disabled = isImageEdit;
    $(".send-button", form).disabled = state.generating || !state.settings?.hasApiKey;

    // Sync image-count selector.
    const countInput = $(".image-count-input", form);
    const countContainer = $(".composer-count", form);
    if (countInput) {
      const allowedValues = [];
      for (let i = 1; i <= effectiveMax; i += 1) allowedValues.push(String(i));
      const currentOptions = [...countInput.options].map((opt) => opt.value);
      if (currentOptions.join("|") !== allowedValues.join("|")) {
        countInput.innerHTML = allowedValues.map((value) => `<option value="${value}">${value}</option>`).join("");
      }
      countInput.value = desiredCount;
      countInput.disabled = isImageEdit || effectiveMax <= 1;
    }
    if (countContainer) {
      countContainer.classList.toggle("muted", isImageEdit || effectiveMax <= 1);
    }

    // Sync credits quota chip.
    const quotaValue = $(".composer-quota-value", form);
    if (quotaValue) {
      if (state.user && Number.isFinite(state.user.credits)) {
        quotaValue.textContent = String(state.user.credits);
      } else {
        quotaValue.textContent = "--";
      }
    }
  });
}

function renderReferences(row) {
  row.innerHTML = state.references.map((reference, index) => `
    <div class="reference-thumb">
      <img src="${reference.url}" alt="${escapeHtml(reference.name)}">
      <button type="button" data-remove-reference="${index}"><i class="ri-close-line"></i></button>
    </div>
  `).join("");
  row.classList.toggle("hidden", state.references.length === 0);
  $$("[data-remove-reference]", row).forEach((button) => {
    button.addEventListener("click", () => {
      clearComposerReferences();
      $$(".reference-row").forEach(renderReferences);
      syncComposers();
    });
  });
}

function syncReferences(sourceForm) {
  $$(".reference-row").forEach((row) => {
    if (!sourceForm || row !== $(".reference-row", sourceForm)) renderReferences(row);
  });
}

async function submitGeneration(form, options = {}) {
  const { forceGenerate = false } = options;
  const prompt = $(".prompt-box", form).value.trim();
  if (!prompt) return;
  const attachedReference = forceGenerate ? null : (state.references[0] || getConversationFallbackReference());
  const isImageEdit = Boolean(attachedReference?.url);
  if (!state.user) {
    state.draftPrompt = prompt;
    state.pendingAction = isImageEdit
      ? {
          type: "edit",
          prompt,
          imageUrl: attachedReference.url,
          imageData: attachedReference.imageData || "",
          sourceGenerationId: attachedReference.sourceGenerationId || null,
          conversationId: attachedReference.conversationId || state.activeConversationId || null,
          isPublic: state.publishToSquare
        }
      : {
          type: "generate",
          prompt,
          conversationId: state.activeConversationId || null
        };
    openAuthModal("login");
    return;
  }
  if (!state.settings?.hasApiKey) {
    showToast(state.lang === "zh" ? "请先在后台配置 OpenAI API Key" : "Configure the OpenAI API key first", "ri-key-2-line");
    return;
  }
  if (state.generating) return;

  state.draftPrompt = "";
  state.generationOptions = getComposerOptions(form);
  state.publishToSquare = state.generationOptions.isPublic;
  const requestedCount = Math.max(1, Math.min(8, Number(state.generationOptions.imageCount) || 1));
  // image-to-image always returns 1 image at the upstream so we clamp.
  const effectiveCount = isImageEdit ? 1 : requestedCount;
  const tempTurnId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const referenceUrls = state.references.map((reference) => reference.url);
  const referenceData = state.references.map((reference) => reference.imageData || reference.url).filter(Boolean);
  const baseItem = {
    requestId: tempTurnId,
    conversationId: state.activeConversationId,
    operationType: isImageEdit ? "edit" : "generate",
    sourceGenerationId: attachedReference?.sourceGenerationId || null,
    prompt,
    isPublic: state.publishToSquare,
    options: { ...state.generationOptions },
    references: attachedReference?.url ? [attachedReference.url] : []
  };
  const placeholderItems = [];
  for (let i = 0; i < effectiveCount; i += 1) {
    placeholderItems.push({
      ...baseItem,
      id: `${tempTurnId}_${i}`,
      images: [],
      status: "generating",
      placeholderIndex: i
    });
  }
  state.history.push(...placeholderItems);
  state.pendingTurns.add(tempTurnId);
  state.generating = true;
  state.lastTurnConfig = {
    prompt,
    operationType: baseItem.operationType,
    options: { ...state.generationOptions },
    isPublic: state.publishToSquare,
    references: state.references.map((reference) => ({ ...reference }))
  };
  startFunMessages();
  renderAll();
  setView("workspace");
  scrollToBottom();

  try {
    const data = isImageEdit
      ? await api("/api/images/edit", {
          method: "POST",
          body: JSON.stringify({
            prompt,
            imageData: attachedReference.imageData || await imageReferenceForEdit(attachedReference.url),
            maskData: "",
            size: baseItem.options.size,
            isPublic: baseItem.isPublic,
            conversationId: attachedReference.conversationId || state.activeConversationId,
            sourceGenerationId: attachedReference.sourceGenerationId || null
          })
        })
      : await api("/api/images/generate", {
          method: "POST",
          body: JSON.stringify({
            prompt,
            size: baseItem.options.size,
            quality: baseItem.options.quality,
            background: baseItem.options.background,
            outputFormat: baseItem.options.outputFormat,
            isPublic: baseItem.isPublic,
            conversationId: state.activeConversationId,
            sourceGenerationId: null,
            n: effectiveCount
          })
        });
    const newGenerations = (data.generations || []).map(historyItemFromGeneration);
    if (!newGenerations.length) throw new Error("No image was returned");
    // All generations in this response belong to the same logical turn — tag them
    // with the server requestId (falling back to the placeholder id) so the
    // renderer groups them into one card.
    const serverRequestId = newGenerations[0].requestId || tempTurnId;
    for (const generation of newGenerations) {
      generation.requestId = serverRequestId;
      generation.references = referenceUrls;
    }
    const placeholderIds = new Set(placeholderItems.map((entry) => entry.id));
    state.activeConversationId = data.conversationId || state.activeConversationId;
    // Replace placeholders with the actual generations, preserving order.
    const replaced = [];
    let inserted = false;
    for (const entry of state.history) {
      if (placeholderIds.has(entry.id)) {
        if (!inserted) {
          replaced.push(...newGenerations);
          inserted = true;
        }
      } else {
        replaced.push(entry);
      }
    }
    if (!inserted) replaced.push(...newGenerations);
    state.history = dedupeHistoryById(replaced);
    state.pendingTurns.delete(tempTurnId);
    state.allGenerations = dedupeHistoryById([
      ...newGenerations,
      ...state.allGenerations
    ]).sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    state.user.credits = data.credits;
    state.stats.todayGenerated += newGenerations.length;
    updateDailyMetric();
    await loadConversations();
    if (item.isPublic) await loadPublicGallery();
    setComposerReference({
      url: generation.images[0],
      name: `generation-${generation.id}`,
      sourceGenerationId: generation.id,
      conversationId: generation.conversationId || state.activeConversationId || null
    });
    if (isImageEdit) {
      showToast(state.lang === "zh" ? "已更新图片，可继续修改" : "Image updated. You can keep iterating.", "ri-magic-line");
    } else {
      showToast(state.lang === "zh" ? "已生成，可继续修改" : "Created. You can keep iterating.", "ri-sparkling-2-fill");
    }
  } catch (error) {
    const errorMessage = error.message || String(error);
    state.history = state.history.map((entry) =>
      entry.requestId === tempTurnId
        ? { ...entry, status: "error", error: errorMessage }
        : entry
    );
    if (!state.references.length) seedComposerReferenceFromHistory();
    if (/credit|额度|积分|Not enough/i.test(error.message)) openCreditsModal();
    else showToast(error.message, "ri-error-warning-line");
  } finally {
    state.generating = false;
    stopFunMessages();
    renderAll();
    scrollToBottom();
  }
}

function startFunMessages() {
  stopFunMessages();
  state.thinkingStartTime = Date.now();
  elements.generationStatus.classList.remove("hidden");
  updateThinkingTime();
  state.funTimer = setInterval(updateThinkingTime, 1000);
}

function updateThinkingTime() {
  if (!state.thinkingStartTime) return;
  const elapsed = Math.floor((Date.now() - state.thinkingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;
  const label = state.lang === "zh" ? "思考中" : "Thinking";
  elements.funMessage.textContent = `${label} ${timeStr}`;
}

function stopFunMessages() {
  if (state.funTimer) clearInterval(state.funTimer);
  state.funTimer = null;
  state.thinkingStartTime = null;
  elements.generationStatus.classList.add("hidden");
}

function scrollToBottom(smooth = true) {
  const target = elements.workspaceThread;
  setTimeout(() => {
    if (target) {
      target.scrollTo({ top: target.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      return;
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, 80);
}

function historyItemFromGeneration(generation) {
  return {
    id: generation.id,
    requestId: generation.requestId || null,
    conversationId: generation.conversationId || null,
    operationType: generation.operationType || "generate",
    sourceGenerationId: generation.sourceGenerationId || null,
    prompt: generation.prompt,
    images: [generation.imageUrl],
    status: "done",
    time: generation.createdAt,
    model: generation.model,
    isPublic: Boolean(generation.isPublic),
    references: [],
    options: {
      size: generation.size,
      quality: generation.quality,
      background: generation.background,
      outputFormat: generation.outputFormat
    }
  };
}

function dedupeHistoryById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function loadHistory() {
  if (!state.user) {
    state.history = [];
    state.allGenerations = [];
    return;
  }
  try {
    const data = await api("/api/images/history");
    const items = (data.generations || []).map(historyItemFromGeneration);
    state.allGenerations = [...items].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    if (state.activeConversationId) {
      state.history = items
        .filter((item) => item.conversationId === state.activeConversationId)
        .sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
    }
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  }
}

// Group the flat history into turn cards (each request that fired N images
// renders as one card with N images). Mirrors `derive selectors` in
// chatgpt2api/web/src/store/image-conversations.ts.
function groupHistoryIntoTurns(items) {
  const turns = [];
  const byKey = new Map();
  for (const entry of items) {
    const key = entry.requestId || `solo_${entry.id}`;
    let turn = byKey.get(key);
    if (!turn) {
      turn = {
        id: key,
        requestId: entry.requestId || null,
        prompt: entry.prompt,
        operationType: entry.operationType || "generate",
        sourceGenerationId: entry.sourceGenerationId || null,
        options: entry.options || {},
        references: entry.references || [],
        isPublic: Boolean(entry.isPublic),
        time: entry.time,
        conversationId: entry.conversationId || null,
        items: [],
        status: "queued",
        error: null
      };
      byKey.set(key, turn);
      turns.push(turn);
    }
    turn.items.push(entry);
    if (entry.references?.length && !turn.references.length) {
      turn.references = entry.references;
    }
  }
  for (const turn of turns) {
    const statuses = turn.items.map((entry) => entry.status);
    const errors = turn.items
      .filter((entry) => entry.status === "error" && entry.error)
      .map((entry) => entry.error);
    if (statuses.every((status) => status === "done")) {
      turn.status = "done";
    } else if (statuses.every((status) => status === "error")) {
      turn.status = "error";
      turn.error = errors[0] || null;
    } else if (statuses.some((status) => status === "error")) {
      turn.status = "partial";
      turn.error = errors[0] || null;
    } else if (statuses.some((status) => status === "generating")) {
      turn.status = "generating";
    } else {
      turn.status = statuses[0] || "queued";
    }
  }
  return turns;
}

function renderHistory() {
  // Update sidebar username
  const sidebarUserName = document.getElementById("sidebarUserName");
  if (sidebarUserName) sidebarUserName.textContent = state.user?.name || state.user?.email || "";

  if (!state.history.length) {
    elements.historyList.innerHTML = `
      <section class="workspace-empty-state">
        <div class="empty-state-icon"><i class="ri-sparkling-2-fill"></i></div>
        <h2>${escapeHtml(state.lang === "zh" ? "有什么可以帮忙的？" : "What can I help with?")}</h2>
        <p>${escapeHtml(state.lang === "zh" ? "描述你想生成的图片，或上传图片继续修改" : "Describe the image you want, or upload one to keep editing")}</p>
      </section>
    `;
    return;
  }
  const turns = groupHistoryIntoTurns(state.history);
  elements.historyList.innerHTML = "";
  let lastDate = "";
  for (const turn of turns) {
    const date = formatDate(turn.time);
    if (date && date !== lastDate) {
      const separator = document.createElement("div");
      separator.className = "date-separator";
      separator.textContent = date;
      elements.historyList.appendChild(separator);
      lastDate = date;
    }
    elements.historyList.appendChild(renderTurnCard(turn));
  }
}

  $$("[data-retry]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      state.draftPrompt = button.dataset.retry;
      clearComposerReferences();
      syncComposers();
      syncReferences();
      const form = $(".composer", elements.stickyComposerMount);
      submitGeneration(form, { forceGenerate: true });
    });
  });
  $$("[data-edit]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      state.draftPrompt = button.dataset.edit;
      clearComposerReferences();
      syncComposers();
      syncReferences();
      $(".prompt-box", $(".composer", elements.stickyComposerMount) || document)?.focus();
    });
  });
  $$("[data-edit-image]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.editImage);
      if (item?.images?.[0]) openImageEditor(item.images[0], item.id, item.conversationId || null);
    });
    const generations = (data.generations || []).map(historyItemFromGeneration);
    if (!generations.length) throw new Error("No image was returned");
    const replacement = generations[0];
    // Keep the new row in this turn by re-using the same requestId on the client.
    replacement.requestId = turn.requestId || turn.id;
    state.history = state.history.map((item) =>
      item.id === entry.id ? replacement : item
    );
    state.allGenerations = dedupeHistoryById([replacement, ...state.allGenerations])
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    state.user.credits = data.credits;
    showToast(state.lang === "zh" ? "已重试" : "Retried", "ri-refresh-line");
  } catch (error) {
    state.history = state.history.map((item) =>
      item.id === entry.id ? { ...item, status: "error", error: error.message } : item
    );
    showToast(error.message, "ri-error-warning-line");
  } finally {
    renderAll();
  }
}

function renderExamples() {
  elements.exampleGrid.innerHTML = getPromptSource().slice(0, 4).map(promptCardHtml).join("");
  bindPromptCards(elements.exampleGrid);
}

function renderLibrary() {
  elements.librarySearchInput.value = state.librarySearch;
  const counts = getTagCounts();
  elements.tagFilters.innerHTML = tags
    .filter((tag) => tag === "all" || counts[tag])
    .map((tag) => `
    <button type="button" class="${state.libraryTag === tag ? "active" : ""}" data-tag="${tag}">
      ${escapeHtml(tagLabels[state.lang][tag] || tag)}
      <span>${tag === "all" ? getPromptSource().length : counts[tag]}</span>
    </button>
  `).join("");
  $$("[data-tag]", elements.tagFilters).forEach((button) => {
    button.addEventListener("click", () => {
      state.libraryTag = button.dataset.tag;
      state.promptVisible = 20;
      renderLibrary();
    });
  });

  const query = state.librarySearch.trim().toLowerCase();
  const source = getPromptSource();
  const filtered = source.filter((prompt) => {
    const matchesTag = state.libraryTag === "all" || prompt.tag === state.libraryTag;
    const promptTags = Array.isArray(prompt.tags) ? prompt.tags : [prompt.tag].filter(Boolean);
    const matchesTags = state.libraryTag === "all" || promptTags.includes(state.libraryTag);
    const haystack = `${prompt.title} ${prompt.prompt} ${promptTags.join(" ")} ${prompt.author || ""}`.toLowerCase();
    return (matchesTag || matchesTags) && (!query || haystack.includes(query));
  });
  const visible = filtered.slice(0, state.promptVisible);
  const sourceCount = getSourceCount(source);
  const stats = `
    <div class="library-stats">
      <div><strong>${source.length.toLocaleString()}+</strong><span>${text("totalPrompts")}</span></div>
      <div class="stat-divider"></div>
      <div><strong>${sourceCount}</strong><span>${text("totalSources")}</span></div>
    </div>
  `;
  elements.promptGrid.innerHTML = state.promptLoading
    ? `<div class="empty-message">${text("loadingPrompts")}</div>`
    : filtered.length
      ? `${visible.map(promptCardHtml).join("")}${visible.length < filtered.length ? `<div class="load-more-wrap"><button id="loadMorePrompts" type="button">${text("loadMore")} <span>(${visible.length}/${filtered.length})</span></button></div>` : ""}`
      : `<div class="empty-message">${text("noResults")}</div>`;
  const statsTarget = $(".library-stats");
  if (statsTarget) statsTarget.remove();
  $(".library-hero").insertAdjacentHTML("beforeend", stats);
  $("#loadMorePrompts")?.addEventListener("click", () => {
    state.promptVisible += 20;
    renderLibrary();
  });
  bindPromptCards(elements.promptGrid);
}

function getSourceCount(source) {
  const origins = new Set();
  source.forEach((prompt) => {
    if (prompt.source) origins.add(prompt.source);
    if (!prompt.sourceUrl) return;
    try {
      origins.add(new URL(prompt.sourceUrl).hostname.replace(/^www\./, ""));
    } catch {
      origins.add(prompt.sourceUrl);
    }
  });
  return Math.max(1, origins.size);
}

function promptCardHtml(prompt) {
  const promptText = prompt.prompt;
  const title = prompt.title;
  const tagsHtml = (prompt.tags || [prompt.tag].filter(Boolean)).slice(0, 3).map((tag) => `
    <span>${escapeHtml(tagLabels[state.lang][tag] || tag)}</span>
  `).join("");
  const art = prompt.image
    ? `<img src="${escapeHtml(prompt.image)}" loading="lazy" decoding="async" fetchpriority="low" alt="${escapeHtml(title)}" onerror="this.parentElement.classList.add('image-error')">`
    : `<i class="${prompt.icon || "ri-image-line"}"></i>`;
  return `
    <article class="prompt-card" style="--art-bg:${prompt.colors || "linear-gradient(135deg,#64748b,#cbd5e1)"}">
      <div class="card-art">${art}<em><i class="ri-user-line"></i>${escapeHtml(prompt.author || "@open")}</em></div>
      <h3>${escapeHtml(title)}</h3>
      <div class="prompt-tags">${tagsHtml}</div>
      <p>${escapeHtml(promptText)}</p>
      <div class="card-actions">
        <button type="button" data-copy-prompt="${prompt.id}"><i class="ri-file-copy-line"></i>${text("copy")}</button>
        <button class="use-button" type="button" data-use-prompt="${prompt.id}">${text("use")} <i class="ri-arrow-right-line"></i></button>
      </div>
    </article>
  `;
}

function bindPromptCards(root) {
  $$("[data-copy-prompt]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = getPromptSource().find((item) => item.id === Number(button.dataset.copyPrompt));
      await copyText(prompt.prompt);
      showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
    });
  });
  $$("[data-use-prompt]", root).forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = getPromptSource().find((item) => item.id === Number(button.dataset.usePrompt));
      openWorkspace({ prompt: prompt.prompt });
      showToast(state.lang === "zh" ? "已进入创作工作区" : "Sent to the workspace", "ri-arrow-right-line");
    });
  });
}

function openLightbox(imageUrl = "", caption = "") {
  if (!imageUrl) return;
  let overlay = document.querySelector(".image-lightbox");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "image-lightbox";
    overlay.innerHTML = `
      <button type="button" class="image-lightbox-close" aria-label="close"><i class="ri-close-line"></i></button>
      <div class="image-lightbox-stage">
        <img class="image-lightbox-img" alt="">
        <p class="image-lightbox-caption"></p>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest(".image-lightbox-close")) {
        overlay.classList.remove("open");
      }
    });
  }
  $(".image-lightbox-img", overlay).src = imageUrl;
  $(".image-lightbox-caption", overlay).textContent = truncate(caption || "", 240);
  overlay.classList.add("open");
}

async function openImageEditor(imageUrl = "", sourceGenerationId = "", conversationId = null) {
  if (conversationId && conversationId !== state.activeConversationId) {
    const switched = await switchToConversation(conversationId);
    if (!switched) return;
  } else if (!conversationId && sourceGenerationId && state.activeConversationId && !state.history.find((entry) => entry.id === sourceGenerationId)) {
    state.activeConversationId = null;
    state.history = [];
  }
  setComposerReference({
    url: imageUrl,
    name: sourceGenerationId ? `generation-${sourceGenerationId}` : "conversation-image",
    sourceGenerationId: sourceGenerationId || null,
    conversationId: conversationId || state.activeConversationId || null
  });
  openWorkspace({ prompt: "", imageUrl, sourceGenerationId, conversationId });
  showToast(state.lang === "zh" ? "已选中图片，请在输入框描述修改需求" : "Image selected. Describe the changes in the composer.", "ri-magic-line");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function imageReferenceForEdit(src) {
  if (!src) return "";
  if (src.startsWith("data:")) return src;
  try {
    const response = await fetch(src, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Image fetch failed");
    return await blobToDataUrl(await response.blob());
  } catch {
    return src;
  }
}

function getPromptSource() {
  return state.promptItems.length ? state.promptItems : fallbackPrompts.map((prompt) => ({
    ...prompt,
    title: local(prompt.title),
    prompt: local(prompt.prompt),
    tags: [prompt.tag]
  }));
}

function getTagCounts() {
  const counts = {};
  for (const prompt of getPromptSource()) {
    const promptTags = prompt.tags || [prompt.tag].filter(Boolean);
    for (const tag of promptTags) counts[tag] = (counts[tag] || 0) + 1;
  }
  return counts;
}

async function loadPromptLibrary() {
  state.promptLoading = true;
  if (state.view === "library") renderLibrary();
  try {
    const data = await fetch("/prompts.json", { cache: "force-cache" }).then((response) => response.json());
    state.promptItems = (data.prompts || []).map((prompt) => ({
      ...prompt,
      colors: prompt.colors || tagColor(prompt.tags?.[0] || prompt.tag || "other")
    }));
  } catch (error) {
    showToast(state.lang === "zh" ? "提示词库加载失败，已使用内置示例" : "Prompt library failed, using fallback", "ri-error-warning-line");
  } finally {
    state.promptLoading = false;
    renderAll();
  }
}

function setupHeroVideo() {
  const video = $(".hero-video-layer video");
  if (!video) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    video.pause();
    video.removeAttribute("autoplay");
    return;
  }
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.addEventListener("pause", () => playHeroVideo());
  video.addEventListener("stalled", restartHeroVideo);
  video.addEventListener("suspend", () => playHeroVideo());
  window.addEventListener("focus", () => playHeroVideo());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) playHeroVideo();
  });
  if (!heroVideoWatchdog) {
    let lastTime = -1;
    let stillTicks = 0;
    heroVideoWatchdog = window.setInterval(() => {
      const currentVideo = $(".hero-video-layer video");
      if (!currentVideo || elements.homeView.classList.contains("hidden") || document.hidden) return;
      if (currentVideo.paused) {
        playHeroVideo();
        return;
      }
      const currentTime = Number(currentVideo.currentTime || 0);
      if (Math.abs(currentTime - lastTime) < 0.01) {
        stillTicks += 1;
        if (stillTicks >= 2) restartHeroVideo();
      } else {
        stillTicks = 0;
      }
      lastTime = currentTime;
    }, 1400);
  }
  restartHeroVideo();
}

function playHeroVideo() {
  const video = $(".hero-video-layer video");
  if (!video || elements.homeView.classList.contains("hidden")) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  if (video.readyState === 0) video.load();
  video.play().catch(() => null);
}

function restartHeroVideo() {
  const video = $(".hero-video-layer video");
  if (!video || elements.homeView.classList.contains("hidden")) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  try {
    if (video.readyState < 2) video.load();
    video.currentTime = 0.05;
  } catch {
    video.load();
  }
  playHeroVideo();
}

async function loadStats() {
  try {
    const data = await api("/api/stats/today");
    state.stats.todayGenerated = Number(data.todayGenerated ?? data.count ?? state.stats.todayGenerated);
    updateDailyMetric();
  } catch {
    updateDailyMetric();
  }
}

async function loadPublicGallery() {
  try {
    const data = await api("/api/images/public?limit=60");
    state.publicGallery = (data.generations || []).map((generation) => ({
      id: generation.id,
      prompt: generation.prompt,
      images: [generation.imageUrl],
      status: "done",
      time: generation.createdAt,
      model: generation.model,
      isPublic: Boolean(generation.isPublic)
    }));
  } catch {
    state.publicGallery = [];
  }
}

function tagColor(tag) {
  const colors = {
    ui: "linear-gradient(135deg, #38bdf8, #6366f1)",
    photo: "linear-gradient(135deg, #0f766e, #f59e0b)",
    poster: "linear-gradient(135deg, #111827, #2563eb)",
    portrait: "linear-gradient(135deg, #7c3aed, #ec4899)",
    illustration: "linear-gradient(135deg, #8b5cf6, #fbbf24)",
    anime: "linear-gradient(135deg, #f472b6, #a78bfa)",
    product: "linear-gradient(135deg, #0f172a, #64748b)",
    "3d": "linear-gradient(135deg, #f97316, #0f172a)",
    landscape: "linear-gradient(135deg, #22c55e, #38bdf8)",
    character: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
    logo: "linear-gradient(135deg, #111827, #fbbf24)",
    fashion: "linear-gradient(135deg, #db2777, #fb7185)",
    cyberpunk: "linear-gradient(135deg, #0f172a, #a855f7)",
    infographic: "linear-gradient(135deg, #059669, #2563eb)",
    food: "linear-gradient(135deg, #dc2626, #f59e0b)"
  };
  return colors[tag] || "linear-gradient(135deg,#64748b,#cbd5e1)";
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function openModal(html) {
  elements.modalLayer.innerHTML = html;
  elements.modalLayer.classList.remove("hidden");
  $(".close-modal", elements.modalLayer)?.addEventListener("click", closeModal);
  elements.modalLayer.addEventListener("click", onModalBackdrop);
  applyI18n(elements.modalLayer);
}

function onModalBackdrop(event) {
  if (event.target === elements.modalLayer) closeModal();
}

function closeModal() {
  elements.modalLayer.classList.add("hidden");
  elements.modalLayer.innerHTML = "";
  elements.modalLayer.removeEventListener("click", onModalBackdrop);
}

function openMyWorksModal() {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  openModal(`
    <section class="modal works-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="works-head">
        <div>
          <h2>${text("myWorks")}</h2>
          <p>${state.lang === "zh" ? "查看最近生成记录，继续编辑或再次生成。" : "Review recent generations, edit, or regenerate."}</p>
        </div>
        <button class="ghost-button works-refresh" type="button" data-works-refresh><i class="ri-refresh-line"></i></button>
      </div>
      <div id="worksGrid" class="works-grid"><div class="empty-message">${text("loadingPrompts")}</div></div>
    </section>
  `);
  $("[data-works-refresh]", elements.modalLayer).addEventListener("click", () => loadMyWorks(true));
  loadMyWorks(false);
}

async function loadMyWorks(forceReload = false) {
  const grid = $("#worksGrid", elements.modalLayer);
  if (!grid) return;
  grid.innerHTML = `<div class="empty-message">${text("loadingPrompts")}</div>`;
  if (forceReload) await loadHistory();
  const items = [...state.allGenerations]
    .filter((item) => item.status === "done" && item.images?.[0])
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  if (!items.length) {
    grid.innerHTML = `<div class="empty-message">${text("emptyWorks")}</div>`;
    return;
  }
  grid.innerHTML = items.map((item) => `
    <article class="work-card" data-work-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.images[0])}" loading="lazy" decoding="async" alt="${escapeHtml(truncate(item.prompt, 80))}">
      <div class="work-body">
        <p>${escapeHtml(truncate(item.prompt, 92))}</p>
        <span>${escapeHtml(formatDate(item.time))}${item.isPublic ? ` · ${text("publishToSquare")}` : ""}</span>
        <div class="work-actions">
          <a href="${escapeHtml(item.images[0])}" download="${escapeHtml(item.id)}.png"><i class="ri-download-line"></i>${text("download")}</a>
          <button type="button" data-work-retry="${escapeHtml(item.id)}"><i class="ri-refresh-line"></i>${text("retry")}</button>
          <button type="button" data-work-editor="${escapeHtml(item.id)}"><i class="ri-magic-line"></i>${text("openEditor")}</button>
        </div>
      </div>
    </article>
  `).join("");
  $$("[data-work-retry]", grid).forEach((button) => {
    button.addEventListener("click", async () => {
      const item = state.allGenerations.find((entry) => String(entry.id) === button.dataset.workRetry);
      if (!item) return;
      closeModal();
      if (item.conversationId) {
        const switched = await switchToConversation(item.conversationId);
        if (!switched) return;
      } else {
        state.activeConversationId = null;
        state.history = [];
      }
      openWorkspace({ prompt: item.prompt });
      setTimeout(() => submitGeneration($(".composer", elements.stickyComposerMount)), 80);
    });
  });
  $$("[data-work-editor]", grid).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.allGenerations.find((entry) => String(entry.id) === button.dataset.workEditor);
      if (!item?.images?.[0]) return;
      closeModal();
      openImageEditor(item.images[0], item.id, item.conversationId || null);
    });
  });
}

function openComplianceNotice() {
  const storageKey = "imageStudioComplianceNoticeV1";
  if (localStorage.getItem(storageKey) === "seen") return;
  openModal(`
    <section class="modal compliance-modal" role="dialog" aria-modal="true" aria-labelledby="complianceTitle">
      <button class="close-modal compliance-close" type="button" aria-label="${text("close")}"><i class="ri-close-line"></i></button>
      <div class="compliance-icon"><i class="ri-shield-check-line"></i></div>
      <div class="compliance-title">
        <h2 id="complianceTitle"><i class="ri-megaphone-fill"></i>${text("noticeTitle")}</h2>
        <p>${text("noticeSubtitle")}</p>
      </div>
      <div class="notice-card danger">
        <h3><span></span>${text("noticeCore")}</h3>
        <ul>
          <li><strong>严禁违规内容：</strong>平台（含“酒馆”等交互工具）严禁涉及低俗色情、暴力血腥、网络诈骗、政治敏感及其他违反法律法规的对话。</li>
          <li><strong>敏感词拦截：</strong>系统已启用内容安全审计功能，自动拦截不当言论及有害信息。</li>
          <li><strong>违规严厉处置：</strong>针对违规账号，我们将视情节严重程度采取：<em>警告 → 限制功能 → 临时封禁 → 永久销号 → 移送公安。</em></li>
        </ul>
      </div>
      <div class="notice-card privacy">
        <h3><i class="ri-shield-user-line"></i>${text("noticePrivacy")}</h3>
        <p><strong>信息安全：</strong>我们承诺！您的信息仅在系统内部加密存储，并严格用于系统运行及合规与安全保障相关用途。我们不会向任何个人或第三方出售、提供或披露您的数据。</p>
      </div>
      <div class="notice-card together">
        <p><strong>${text("noticeTogether").split("：")[0]}：</strong>${text("noticeTogether").split("：").slice(1).join("：") || text("noticeTogether")}</p>
      </div>
      <div class="compliance-actions">
        <button class="modal-primary" type="button" data-compliance-ack>${text("noticeAck")}</button>
      </div>
    </section>
  `);

  const markSeen = () => {
    localStorage.setItem(storageKey, "seen");
    closeModal();
  };
  $("[data-compliance-ack]", elements.modalLayer).addEventListener("click", markSeen);
  $(".compliance-close", elements.modalLayer).addEventListener("click", () => {
    localStorage.setItem(storageKey, "seen");
  });
}

function openAuthModal(mode = state.authMode) {
  state.authMode = mode;
  const isRegister = mode === "register";
  openModal(`
    <section class="modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-sparkling-2-fill"></i>
        <h2>${isRegister ? text("registerTitle") : text("loginTitle")}</h2>
        <p><i class="ri-gift-line"></i> ${text("authGift")}</p>
        <p class="auth-bonus"><i class="ri-flashlight-line"></i> ${text("authBonus")}</p>
      </div>
      <div class="auth-tabs">
        <button type="button" class="${!isRegister ? "active" : ""}" data-auth-mode="login">${text("submitLogin")}</button>
        <button type="button" class="${isRegister ? "active" : ""}" data-auth-mode="register">${text("submitRegister")}</button>
      </div>
      <form id="authForm" class="modal-form">
        ${isRegister ? `<label>${text("name")}<input id="authName" autocomplete="name"></label>` : ""}
        <label>${text("email")}<input id="authEmail" type="email" autocomplete="email" required></label>
        <label>${text("password")}<input id="authPassword" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required></label>
        <button class="modal-primary" type="submit">${isRegister ? text("submitRegister") : text("submitLogin")}</button>
        <button class="link-button" type="button" data-auth-mode="${isRegister ? "login" : "register"}">
          ${isRegister ? text("switchToLogin") : text("switchToRegister")}
        </button>
        <button class="link-button" type="button" data-close-auth>${text("skip")}</button>
      </form>
    </section>
  `);
  $$("[data-auth-mode]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => openAuthModal(button.dataset.authMode));
  });
  $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
  $("#authForm").addEventListener("submit", submitAuth);
}

async function submitAuth(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    const payload = {
      email: $("#authEmail").value,
      password: $("#authPassword").value,
      name: $("#authName")?.value || ""
    };
    const data = await api(`/api/auth/${state.authMode}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (data.pendingApproval) {
      showToast(state.lang === "zh" ? "账号已创建，等待管理员启用" : "Account created, waiting for approval", "ri-time-line");
      closeModal();
      return;
    }
    state.user = data.user;
    const me = await api("/api/auth/me");
    state.settings = me.settings;
    state.firstRun = me.firstRun;
    state.checkin = me.checkin || state.checkin;
    await loadHistory();
    await loadConversations();
    closeModal();
    renderAll();
    if (state.pendingAction?.type === "edit") {
      const pending = state.pendingAction;
      state.pendingAction = null;
      if (pending.conversationId) state.activeConversationId = pending.conversationId;
      state.publishToSquare = Boolean(pending.isPublic);
      openWorkspace({
        prompt: pending.prompt,
        imageUrl: pending.imageUrl,
        imageData: pending.imageData,
        sourceGenerationId: pending.sourceGenerationId || null,
        conversationId: pending.conversationId || null
      });
    } else if (state.pendingAction?.type === "generate") {
      const pending = state.pendingAction;
      state.pendingAction = null;
      if (pending.conversationId) state.activeConversationId = pending.conversationId;
      openWorkspace({ prompt: pending.prompt });
    } else if (state.draftPrompt) {
      const prompt = state.draftPrompt;
      state.draftPrompt = "";
      openWorkspace({ prompt });
    } else {
      setView("landing");
      window.scrollTo({ top: 0, behavior: "auto" });
      restartHeroVideo();
    }
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  } finally {
    submit.disabled = false;
  }
}

async function logout() {
  closeUserMenu();
  await api("/api/auth/logout", { method: "POST" }).catch(() => null);
  state.user = null;
  state.history = [];
  state.allGenerations = [];
  state.activeConversationId = null;
  state.pendingAction = null;
  state.draftPrompt = "";
  state.publishToSquare = false;
  state.generationOptions = {
    size: "auto",
    quality: "auto",
    background: "auto",
    outputFormat: "png"
  };
  clearComposerReferences();
  state.checkin = { checkedInToday: false, credit: state.settings?.checkinCredit || 1 };
  renderAll();
  setView("landing");
  window.scrollTo({ top: 0, behavior: "auto" });
  restartHeroVideo();
}

function openCreditsModal() {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  const credits = state.user?.credits ?? 0;
  const checkedIn = Boolean(state.checkin?.checkedInToday);
  const checkinCredit = Number(state.checkin?.credit || state.settings?.checkinCredit || 1);
  const generationCost = Number(state.settings?.generationCreditCost ?? 1);
  openModal(`
    <section class="modal credits-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-sparkling-2-fill"></i>
        <h2>${text("creditsTitle")}</h2>
        <p>${text("creditsBalance")}: <strong data-credits-balance>${credits}</strong> · ${text("oneCredit")}: <strong>${generationCost}</strong></p>
      </div>
      <div class="checkin-card">
        <i class="ri-calendar-check-line"></i>
        <strong>+${checkinCredit}</strong>
        <span>${text("checkinReward")}</span>
      </div>
      <button class="modal-primary" type="button" data-checkin ${checkedIn ? "disabled" : ""}>
        ${checkedIn ? text("checkedIn") : text("checkinToday")}
      </button>
      <form class="redeem-form" data-redeem-form>
        <h3>${text("redeemTitle")}</h3>
        <p class="muted">${text("redeemDesc")}</p>
        <div class="redeem-row">
          <input data-redeem-input type="text" maxlength="64" autocomplete="off" placeholder="${escapeHtml(text("redeemPlaceholder"))}">
          <button class="modal-primary" type="submit">${text("redeemSubmit")}</button>
        </div>
      </form>
      <div class="topup-channels">
        <h3>充值渠道</h3>
        <a class="topup-link" href="https://pay.ldxp.cn/shop/GGbond" target="_blank" rel="noopener">
          <i class="ri-store-2-line"></i> 去链动小铺购买卡密
        </a>
        <a class="topup-link" href="#" onclick="navigator.clipboard.writeText('Jerrylove_Bom');this.querySelector('.topup-hint').textContent='已复制微信号';return false;">
          <i class="ri-wechat-line"></i> 联系客服充值（微信：Jerrylove_Bom）
          <span class="topup-hint"></span>
        </a>
      </div>
      <button class="modal-secondary" type="button" data-history>${text("historyLink")}</button>
      <button class="modal-secondary" type="button" data-close-auth>${text("close")}</button>
    </section>
  `);
  $("[data-checkin]", elements.modalLayer).addEventListener("click", submitCheckin);
  $("[data-redeem-form]", elements.modalLayer).addEventListener("submit", submitRedeem);
  $("[data-history]", elements.modalLayer).addEventListener("click", () => openCreditHistoryModal({ returnToCredits: true }));
  $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
}

async function submitRedeem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = $("[data-redeem-input]", form);
  const code = String(input?.value || "").trim();
  if (!code) {
    showToast(text("redeemEmpty"), "ri-error-warning-line");
    return;
  }
  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    const data = await api("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    state.user = { ...state.user, credits: data.credits };
    updateNav();
    showToast(`${text("redeemSuccess")} +${data.added}`, "ri-coin-line");
    if (input) input.value = "";
    const balanceNode = $("[data-credits-balance]", elements.modalLayer);
    if (balanceNode) balanceNode.textContent = String(data.credits);
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  } finally {
    if (button) button.disabled = false;
  }
}

async function openCreditHistoryModal(options = {}) {
  const { returnToCredits = false } = options;
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  let transactions = [];
  try {
    const data = await api("/api/credits/history?limit=100");
    transactions = data.transactions || [];
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
    return;
  }
  const rows = transactions.length
    ? transactions.map((tx) => `
        <tr>
          <td>${formatTransactionType(tx.type)}</td>
          <td class="num ${tx.delta >= 0 ? "pos" : "neg"}">${tx.delta >= 0 ? "+" : ""}${tx.delta}</td>
          <td class="num">${tx.balanceAfter}</td>
          <td class="muted">${escapeHtml(tx.note || "")}</td>
          <td class="muted">${escapeHtml(formatTimestamp(tx.createdAt))}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" class="muted">${state.lang === "zh" ? "暂无流水" : "No transactions yet"}</td></tr>`;
  openModal(`
    <section class="modal credits-history-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-history-line"></i>
        <h2>${text("historyLink")}</h2>
      </div>
      <div class="credit-history-table-wrap">
        <table class="credit-history-table">
          <thead>
            <tr>
              <th>${state.lang === "zh" ? "类型" : "Type"}</th>
              <th>${state.lang === "zh" ? "变动" : "Δ"}</th>
              <th>${state.lang === "zh" ? "余额" : "Balance"}</th>
              <th>${state.lang === "zh" ? "备注" : "Note"}</th>
              <th>${state.lang === "zh" ? "时间" : "Time"}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button class="modal-secondary" type="button" data-close-auth>${text("close")}</button>
    </section>
  `);
  $("[data-close-auth]", elements.modalLayer).addEventListener("click", returnToCredits ? openCreditsModal : closeModal);
}

function openProfileModal() {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  openModal(`
    <section class="modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-user-settings-line"></i>
        <h2>${text("profile")}</h2>
      </div>
      <form id="profileForm" class="modal-form profile-modal-grid">
        <div class="profile-avatar-row">
          <div id="profileAvatarPreview" class="avatar-face avatar-face-lg" aria-hidden="true"></div>
          <div class="profile-avatar-text">
            <strong id="profileDisplayName">${escapeHtml(getDisplayName())}</strong>
            <label class="profile-avatar-upload">
              <i class="ri-image-edit-line"></i>
              <span>${text("changeAvatar")}</span>
              <input id="profileAvatarInput" type="file" accept="image/*">
            </label>
            <p class="profile-hint">${text("avatarHint")}</p>
          </div>
        </div>
        <div class="profile-static-grid">
          <label>${text("email")}<input type="text" value="${escapeHtml(state.user.email || "")}" readonly></label>
          <label>${text("userId")}<input type="text" value="${escapeHtml(state.user.id || "")}" readonly></label>
        </div>
        <div class="profile-edit-grid">
          <p class="profile-section-title">${text("profile")}</p>
          <label>${text("username")}<input id="profileNameInput" type="text" maxlength="60" value="${escapeHtml(state.user.name || "")}" required></label>
        </div>
        <div class="profile-password-grid">
          <p class="profile-section-title">${text("password")}</p>
          <label>${text("currentPassword")}<input id="profileCurrentPasswordInput" type="password" autocomplete="current-password"></label>
          <label>${text("newPassword")}<input id="profileNewPasswordInput" type="password" autocomplete="new-password"></label>
          <label>${text("confirmPassword")}<input id="profileConfirmPasswordInput" type="password" autocomplete="new-password"></label>
        </div>
        <button class="modal-primary" type="submit">${text("save")}</button>
      </form>
    </section>
  `);
  const preview = $("#profileAvatarPreview", elements.modalLayer);
  const avatarInput = $("#profileAvatarInput", elements.modalLayer);
  const nameInput = $("#profileNameInput", elements.modalLayer);
  const displayName = $("#profileDisplayName", elements.modalLayer);
  const syncPreview = () => {
    const nextName = nameInput?.value || state.user?.name || "";
    if (displayName) displayName.textContent = nextName || getDisplayName();
    if (!preview) return;
    preview.innerHTML = getAvatarMarkup({
      ...state.user,
      name: nextName,
      avatarUrl: avatarInput?.dataset.imageData || state.user?.avatarUrl || ""
    });
  };
  syncPreview();
  nameInput?.addEventListener("input", syncPreview);
  avatarInput?.addEventListener("change", async () => {
    const file = avatarInput.files?.[0];
    if (!file) {
      delete avatarInput.dataset.imageData;
      syncPreview();
      return;
    }
    avatarInput.dataset.imageData = await blobToDataUrl(file);
    syncPreview();
  });
  $("#profileForm", elements.modalLayer)?.addEventListener("submit", submitProfileUpdate);
}

async function submitProfileUpdate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const name = String($("#profileNameInput", form)?.value || "").trim();
  const currentPassword = String($("#profileCurrentPasswordInput", form)?.value || "");
  const newPassword = String($("#profileNewPasswordInput", form)?.value || "");
  const confirmPassword = String($("#profileConfirmPasswordInput", form)?.value || "");
  const avatarData = String($("#profileAvatarInput", form)?.dataset.imageData || "");
  if (!name) {
    showToast(state.lang === "zh" ? "请输入用户名" : "Please enter a username", "ri-error-warning-line");
    return;
  }
  const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);
  if (wantsPasswordChange && (!currentPassword || !newPassword)) {
    showToast(text("passwordIncomplete"), "ri-error-warning-line");
    return;
  }
  if (newPassword && newPassword !== confirmPassword) {
    showToast(text("passwordMismatch"), "ri-error-warning-line");
    return;
  }
  if (submit) submit.disabled = true;
  try {
    const payload = { name };
    if (avatarData) payload.avatarData = avatarData;
    if (wantsPasswordChange) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }
    const data = await api("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    state.user = data.user;
    closeModal();
    renderAll();
    showToast(text("profileSaveSuccess"), "ri-checkbox-circle-line");
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  } finally {
    if (submit) submit.disabled = false;
  }
}

function formatTransactionType(type) {
  const labelsZh = {
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
  const labelsEn = {
    register_bonus: "Signup bonus",
    checkin: "Check-in",
    consume_generate: "Image generate",
    consume_edit: "Image edit",
    consume: "Consume",
    refund_failure: "Refund (failure)",
    refund_partial: "Refund (partial)",
    topup_redeem: "Redeem code",
    topup_payment: "Payment",
    admin_adjust: "Admin adjust",
    credit: "Credit change"
  };
  const map = state.lang === "zh" ? labelsZh : labelsEn;
  return escapeHtml(map[type] || type);
}

function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

async function submitCheckin(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const data = await api("/api/checkin", { method: "POST" });
    state.user = data.user || { ...state.user, credits: data.credits };
    state.checkin = data.checkin || { checkedInToday: true, credit: state.checkin?.credit || 1 };
    showToast(data.checkedIn
      ? (state.lang === "zh" ? `签到成功，获得 ${data.awarded} 积分` : `Checked in, +${data.awarded} credit`)
      : text("checkedIn"), "ri-calendar-check-line");
    updateNav();
    openCreditsModal();
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
    button.disabled = false;
  }
}

async function openAdminModal() {
  if (state.user?.role !== "admin") return;
  openModal(`
    <section class="modal admin-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-settings-3-line"></i>
        <h2>${text("adminTitle")}</h2>
      </div>
      <div class="admin-grid">
        <div class="admin-card">
          <h3>${text("settings")}</h3>
          <form id="settingsForm" class="admin-form">
        <label>${text("apiKey")}<input id="apiKeyInput" type="password" placeholder="Your API key"></label>
        <label>${text("apiBaseUrl")}<input id="apiBaseUrlInput" placeholder="AI API base URL"></label>
            <label>${text("model")}<input id="modelInput" placeholder="gpt-image-2"></label>
            <label>${text("defaultCredits")}<input id="defaultCreditsInput" type="number" min="0"></label>
            <label>${text("generationCost")}<input id="generationCreditCostInput" type="number" min="0"></label>
            <label>${text("maxImages")}<input id="maxImagesInput" type="number" min="1" max="4"></label>
            <label class="admin-switch"><input id="allowRegistrationInput" type="checkbox">${text("allowRegistration")}</label>
            <label class="admin-switch"><input id="requireApprovalInput" type="checkbox">${text("requireApproval")}</label>
            <button class="modal-primary" type="submit">${text("save")}</button>
            <button id="clearApiKeyBtn" class="modal-secondary" type="button">${text("clearKey")}</button>
            <p id="apiKeyMask" style="color:#8b94a1;font-size:12px;margin:0"></p>
          </form>
        </div>
        <div class="admin-card">
          <h3>${text("users")}</h3>
          <div class="users-table-wrap">
            <table class="users-table">
              <thead>
                <tr>
                  <th>${text("user")}</th>
                  <th>${text("role")}</th>
                  <th>${text("status")}</th>
                  <th>${text("credits")}</th>
                  <th>+/-</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="usersBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `);
  await loadAdminSettings();
  await loadUsers();
}

async function loadAdminSettings() {
  const settings = await api("/api/admin/settings");
  state.settings = settings;
  $("#apiBaseUrlInput").value = settings.apiBaseUrl || "";
  $("#modelInput").value = settings.model || "gpt-image-2";
  $("#defaultCreditsInput").value = settings.defaultCredits ?? 10;
  $("#generationCreditCostInput").value = settings.generationCreditCost ?? 1;
  $("#maxImagesInput").value = settings.maxImagesPerRequest ?? 1;
  $("#allowRegistrationInput").checked = Boolean(settings.allowRegistration);
  $("#requireApprovalInput").checked = Boolean(settings.requireApproval);
  $("#apiKeyMask").textContent = settings.apiKeyMask
    ? `${text("currentKey")}: ${settings.apiKeyMask}`
    : text("noKey");
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#clearApiKeyBtn").addEventListener("click", clearApiKey);
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = await api("/api/admin/settings", {
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
  state.settings = settings;
  $("#apiKeyInput").value = "";
  $("#apiKeyMask").textContent = settings.apiKeyMask
    ? `${text("currentKey")}: ${settings.apiKeyMask}`
    : text("noKey");
  showToast(state.lang === "zh" ? "已保存" : "Saved", "ri-checkbox-circle-line");
  updateNav();
  syncComposers();
}

async function clearApiKey() {
  const settings = await api("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify({ clearApiKey: true })
  });
  state.settings = settings;
  $("#apiKeyMask").textContent = text("noKey");
  showToast(state.lang === "zh" ? "已清除" : "Cleared", "ri-delete-bin-line");
  updateNav();
  syncComposers();
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  const body = $("#usersBody");
  body.innerHTML = data.users.map((user) => `
    <tr data-user-id="${user.id}">
      <td class="user-cell"><strong>${escapeHtml(user.name || user.email)}</strong><span>${escapeHtml(user.email)}</span></td>
      <td>
        <select class="role-input" ${user.id === state.user.id ? "disabled" : ""}>
          <option value="user" ${user.role === "user" ? "selected" : ""}>${text("user")}</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>${text("adminRole")}</option>
        </select>
      </td>
      <td>
        <select class="status-input" ${user.id === state.user.id ? "disabled" : ""}>
          <option value="active" ${user.status === "active" ? "selected" : ""}>${text("active")}</option>
          <option value="disabled" ${user.status === "disabled" ? "selected" : ""}>${text("disabled")}</option>
        </select>
      </td>
      <td><input class="credits-input" type="number" min="0" value="${Number(user.credits || 0)}"></td>
      <td><input class="credit-delta-input" type="number" step="1" value="0"></td>
      <td><button class="tiny-button save-user" type="button"><i class="ri-save-line"></i>${text("save")}</button></td>
    </tr>
  `).join("");
  $$(".save-user", body).forEach((button) => {
    button.addEventListener("click", () => saveUser(button.closest("tr")));
  });
}

async function saveUser(row) {
  const id = row.dataset.userId;
  const user = await api(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      role: $(".role-input", row).value,
      status: $(".status-input", row).value,
      credits: Number($(".credits-input", row).value || 0),
      creditDelta: Number($(".credit-delta-input", row).value || 0)
    })
  });
  if (id === state.user.id) state.user = user.user;
  showToast(state.lang === "zh" ? "用户已保存" : "User saved", "ri-save-line");
  updateNav();
}

async function bootstrap() {
  renderComposers();
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
    state.settings = data.settings;
    state.firstRun = data.firstRun;
    state.checkin = data.checkin || state.checkin;
    await loadHistory();
    await loadStats();
    await loadPublicGallery();
    await loadConversations();
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  }
  renderAll();
  setupHeroVideo();
  if (state.view === "landing") {
    setTimeout(openComplianceNotice, 260);
  }
}

function bindGlobalEvents() {
  elements.brandBtn.addEventListener("click", () => {
    setView("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
    restartHeroVideo();
  });
  elements.startCreateBtn?.addEventListener("click", () => openWorkspace());
  elements.workspaceNewBtn?.addEventListener("click", startNewConversation);
  elements.promptLibraryBtn.addEventListener("click", () => setView("library"));
  elements.openLibraryInlineBtn.addEventListener("click", () => setView("library"));
  elements.langBtn.addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    localStorage.setItem("lang", state.lang);
    renderAll();
  });
  elements.loginBtn.addEventListener("click", () => openAuthModal("login"));
  elements.userMenuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleUserMenu();
  });
  elements.profileBtn?.addEventListener("click", () => {
    closeUserMenu();
    openProfileModal();
  });
  elements.userCreditsBtn?.addEventListener("click", () => {
    closeUserMenu();
    openCreditHistoryModal({ returnToCredits: false });
  });
  elements.userWorksBtn?.addEventListener("click", () => {
    closeUserMenu();
    openMyWorksModal();
  });
  elements.userLogoutBtn?.addEventListener("click", () => {
    closeUserMenu();
    logout();
  });
  document.addEventListener("click", (event) => {
    if (!elements.userMenuWrap || elements.userMenuWrap.classList.contains("hidden")) return;
    if (elements.userMenuWrap.contains(event.target)) return;
    closeUserMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeUserMenu();
  });
  elements.librarySearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.librarySearch = elements.librarySearchInput.value;
    state.promptVisible = 20;
    renderLibrary();
  });
}

bindGlobalEvents();
bootstrap();
loadPromptLibrary();



// ===================== Conversation Sidebar =====================

const convSidebar = $("#convSidebar");
const convOverlay = $("#convOverlay");
const convList = $("#convList");
const convSidebarBtn = $("#convSidebarBtn");
const convSidebarClose = $("#convSidebarClose");
const convNewBtn = $("#convNewBtn");

let conversations = [];

function openConvSidebar() {
  convSidebar.classList.add("open");
  convSidebar.classList.remove("hidden");
  convOverlay.classList.remove("hidden");
  loadConversations();
}

function closeConvSidebar() {
  convSidebar.classList.remove("open");
  convOverlay.classList.add("hidden");
}

function startNewConversation() {
  state.activeConversationId = null;
  state.history = [];
  state.draftPrompt = "";
  state.pendingAction = null;
  clearComposerReferences();
  renderAll();
  closeConvSidebar();
  openWorkspace();
}

function conversationGroupLabel(date) {
  const target = new Date(date || 0);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startToday - startTarget) / 86400000);
  if (diffDays <= 0) return state.lang === "zh" ? "今天" : "Today";
  if (diffDays === 1) return state.lang === "zh" ? "昨天" : "Yesterday";
  if (diffDays < 7) return state.lang === "zh" ? "近 7 天" : "Last 7 days";
  return state.lang === "zh" ? "更早" : "Earlier";
}

function groupedConversations() {
  const groups = new Map();
  for (const conversation of conversations) {
    const label = conversationGroupLabel(conversation.updatedAt || conversation.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(conversation);
  }
  return [...groups.entries()];
}

function bindConversationListEvents(root) {
  $$("[data-conv-id]", root).forEach((btn) => {
    btn.addEventListener("click", (event) => {
      if (event.target.closest("[data-del-conv]")) return;
      switchToConversation(btn.dataset.convId);
    });
  });
  $$("[data-del-conv]", root).forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!confirm(state.lang === "zh" ? "确认删除此对话？" : "Delete this conversation?")) return;
      try {
        await api(`/api/conversations/${btn.dataset.delConv}`, { method: "DELETE" });
        if (state.activeConversationId === btn.dataset.delConv) {
          state.activeConversationId = null;
          state.history = [];
          state.draftPrompt = "";
          clearComposerReferences();
          renderAll();
        }
        await loadConversations();
      } catch (error) {
        showToast(error.message, "ri-error-warning-line");
      }
    });
  });
}

function renderConversationList(root) {
  if (!root) return;
  const groups = groupedConversations();
  root.innerHTML = groups.length
    ? groups.map(([label, items]) => `
        <section class="conv-group">
          <h3 class="conv-group-title">${escapeHtml(label)}</h3>
          <div class="conv-group-items">
            ${items.map((conversation) => `
              <button class="conv-list-item ${conversation.id === state.activeConversationId ? "active" : ""}" type="button" data-conv-id="${conversation.id}">
                <i class="ri-chat-3-line"></i>
                <span class="conv-title">${escapeHtml(conversation.title || (state.lang === "zh" ? "新对话" : "New chat"))}</span>
                <span class="conv-del" data-del-conv="${conversation.id}" title="删除"><i class="ri-delete-bin-line"></i></span>
              </button>
            `).join("")}
          </div>
        </section>
      `).join("")
    : `<div class="conv-empty">${escapeHtml(state.lang === "zh" ? "暂无对话记录" : "No conversations yet")}</div>`;
  bindConversationListEvents(root);
}

function renderConvList() {
  renderConversationList(convList);
  renderConversationList(elements.workspaceConvList);
}

async function loadConversations() {
  if (!state.user) {
    conversations = [];
    renderConvList();
    return;
  }
  try {
    const data = await api("/api/conversations");
    conversations = data.conversations || [];
  } catch {
    conversations = [];
  }
  renderConvList();
}

async function switchToConversation(convId) {
  const previousConversationId = state.activeConversationId;
  const previousHistory = [...state.history];
  closeConvSidebar();
  try {
    const data = await api(`/api/conversations/${convId}`);
    state.activeConversationId = convId;
    state.history = (data.messages || []).map(historyItemFromGeneration);
    state.draftPrompt = "";
    seedComposerReferenceFromHistory();
    renderAll();
    setView("workspace");
    scrollToBottom();
    return true;
  } catch (error) {
    state.activeConversationId = previousConversationId;
    state.history = previousHistory;
    renderConvList();
    showToast(error.message, "ri-error-warning-line");
    return false;
  }
}

convSidebarBtn?.addEventListener("click", openConvSidebar);
convSidebarClose?.addEventListener("click", closeConvSidebar);
convOverlay?.addEventListener("click", closeConvSidebar);
convNewBtn?.addEventListener("click", startNewConversation);
