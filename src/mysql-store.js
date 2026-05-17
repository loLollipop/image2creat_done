let mysql;
try {
  mysql = require("mysql2/promise");
} catch (error) {
  throw new Error("Missing dependency mysql2. Run: npm.cmd install");
}

const crypto = require("crypto");

let pool;
let defaultModel = "gpt-image-2";

function newId(prefix = "") {
  return `${prefix}${crypto.randomBytes(12).toString("hex")}`;
}

async function recordCreditTransaction(connection, entry) {
  await connection.execute(
    `INSERT INTO credit_transactions
       (id, user_id, type, delta, balance_after, ref_type, ref_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id || newId("tx_"),
      entry.userId,
      entry.type,
      entry.delta,
      Math.max(0, Number(entry.balanceAfter) || 0),
      entry.refType || null,
      entry.refId || null,
      entry.note ? String(entry.note).slice(0, 255) : null,
      entry.createdAt || new Date()
    ]
  );
}

function intEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(process.env[name]).toLowerCase());
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll("`", "``")}\``;
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: intEnv("MYSQL_PORT", 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio",
    connectionLimit: intEnv("MYSQL_CONNECTION_LIMIT", 10)
  };
}

function getPool() {
  if (!pool) {
    throw new Error("Database has not been initialized");
  }
  return pool;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function normalizeActiveUpstream(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "cpa" ? "cpa" : "chatgpt2api";
}

function mapSettings(row = {}) {
  return {
    // chatgpt2api preset (legacy columns)
    openaiApiKey: row.openai_api_key || "",
    apiBaseUrl: row.api_base_url || process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "",
    model: row.model || defaultModel,
    // CPA preset (CLIProxyAPI-compatible OpenAI bearer key)
    cpaApiKey: row.cpa_api_key || "",
    cpaApiBaseUrl: row.cpa_api_base_url || process.env.CPA_API_BASE_URL || "",
    cpaModel: row.cpa_model || process.env.CPA_IMAGE_MODEL || "",
    activeUpstream: normalizeActiveUpstream(row.active_upstream || process.env.ACTIVE_UPSTREAM),
    defaultCredits: Number(row.default_credits ?? 10),
    generationCreditCost: Number(row.generation_credit_cost ?? 1),
    allowRegistration: Boolean(row.allow_registration ?? 1),
    requireApproval: Boolean(row.require_approval ?? 0),
    maxImagesPerRequest: Number(row.max_images_per_request ?? 1)
  };
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: {
      salt: row.password_salt,
      iterations: Number(row.password_iterations),
      hash: row.password_hash
    },
    role: row.role,
    status: row.status,
    avatarFilename: row.avatar_filename || "",
    credits: Number(row.credits || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapGeneration(row) {
  if (!row) return null;
  let usage = null;
  if (row.usage_json) {
    try {
      usage = JSON.parse(row.usage_json);
    } catch {
      usage = null;
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id || null,
    operationType: row.operation_type || "generate",
    sourceGenerationId: row.source_generation_id || null,
    prompt: row.prompt,
    model: row.model,
    size: row.size,
    quality: row.quality,
    background: row.background,
    outputFormat: row.output_format,
    filename: row.filename,
    isPublic: Boolean(row.is_public ?? 0),
    revisedPrompt: row.revised_prompt || "",
    usage,
    upstreamUsed: row.upstream_used || "",
    createdAt: toIso(row.created_at)
  };
}

function mapGenerationRequest(row) {
  if (!row) return null;
  let generationIds = [];
  if (row.generation_ids) {
    try {
      generationIds = JSON.parse(row.generation_ids);
    } catch {
      generationIds = [];
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    prompt: row.prompt,
    ipAddress: row.ip_address || "",
    userAgent: row.user_agent || "",
    isPublic: Boolean(row.is_public ?? 0),
    status: row.status,
    errorMessage: row.error_message || "",
    firstGenerationId: row.first_generation_id || "",
    generationIds,
    model: row.model || "",
    filename: row.filename || "",
    upstreamUsed: row.upstream_used || "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function createDatabaseIfNeeded(config) {
  if (process.env.MYSQL_CREATE_DATABASE === "false") return;
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: false
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function runMigrations() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      openai_api_key TEXT NULL,
      api_base_url VARCHAR(255) NOT NULL DEFAULT '',
      model VARCHAR(80) NOT NULL,
      cpa_api_key TEXT NULL,
      cpa_api_base_url VARCHAR(255) NOT NULL DEFAULT '',
      cpa_model VARCHAR(80) NOT NULL DEFAULT '',
      active_upstream VARCHAR(16) NOT NULL DEFAULT 'chatgpt2api',
      default_credits INT UNSIGNED NOT NULL DEFAULT 10,
      generation_credit_cost INT UNSIGNED NOT NULL DEFAULT 1,
      allow_registration TINYINT(1) NOT NULL DEFAULT 1,
      require_approval TINYINT(1) NOT NULL DEFAULT 0,
      max_images_per_request TINYINT UNSIGNED NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [settingsApiBaseColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'api_base_url'");
  if (!settingsApiBaseColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN api_base_url VARCHAR(255) NOT NULL DEFAULT '' AFTER openai_api_key");
  }

  const [settingsCostColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'generation_credit_cost'");
  if (!settingsCostColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN generation_credit_cost INT UNSIGNED NOT NULL DEFAULT 1 AFTER default_credits");
  }

  const [settingsCpaKeyColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'cpa_api_key'");
  if (!settingsCpaKeyColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN cpa_api_key TEXT NULL AFTER model");
  }
  const [settingsCpaBaseColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'cpa_api_base_url'");
  if (!settingsCpaBaseColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN cpa_api_base_url VARCHAR(255) NOT NULL DEFAULT '' AFTER cpa_api_key");
  }
  const [settingsCpaModelColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'cpa_model'");
  if (!settingsCpaModelColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN cpa_model VARCHAR(80) NOT NULL DEFAULT '' AFTER cpa_api_base_url");
  }
  const [settingsActiveColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'active_upstream'");
  if (!settingsActiveColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN active_upstream VARCHAR(16) NOT NULL DEFAULT 'chatgpt2api' AFTER cpa_model");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_salt VARCHAR(64) NOT NULL,
      password_iterations INT UNSIGNED NOT NULL,
      password_hash VARCHAR(128) NOT NULL,
      role VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL,
      avatar_filename VARCHAR(255) NULL,
      credits INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_users_status (status),
      INDEX idx_users_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [userAvatarColumns] = await db.execute("SHOW COLUMNS FROM users LIKE 'avatar_filename'");
  if (!userAvatarColumns.length) {
    await db.query("ALTER TABLE users ADD COLUMN avatar_filename VARCHAR(255) NULL AFTER status");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      INDEX idx_sessions_user_id (user_id),
      INDEX idx_sessions_expires_at (expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS generations (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      conversation_id VARCHAR(32) NULL,
      operation_type VARCHAR(16) NOT NULL DEFAULT 'generate',
      source_generation_id VARCHAR(32) NULL,
      prompt TEXT NOT NULL,
      model VARCHAR(80) NOT NULL,
      size VARCHAR(20) NOT NULL,
      quality VARCHAR(20) NOT NULL,
      background VARCHAR(20) NOT NULL,
      output_format VARCHAR(20) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      is_public TINYINT(1) NOT NULL DEFAULT 0,
      revised_prompt TEXT NULL,
      usage_json LONGTEXT NULL,
      upstream_used VARCHAR(16) NOT NULL DEFAULT '',
      created_at DATETIME(3) NOT NULL,
      INDEX idx_generations_user_created (user_id, created_at),
      INDEX idx_generations_created_at (created_at),
      INDEX idx_generations_conversation (conversation_id),
      INDEX idx_generations_source (source_generation_id),
      CONSTRAINT fk_generations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [generationColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'is_public'");
  if (!generationColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER filename");
  }

  const [generationUpstreamColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'upstream_used'");
  if (!generationUpstreamColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN upstream_used VARCHAR(16) NOT NULL DEFAULT '' AFTER usage_json");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_daily_usage (
      user_id VARCHAR(32) NOT NULL,
      usage_date DATE NOT NULL,
      free_used INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id, usage_date),
      CONSTRAINT fk_daily_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_checkins (
      user_id VARCHAR(32) NOT NULL,
      checkin_date DATE NOT NULL,
      credits_awarded INT UNSIGNED NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id, checkin_date),
      CONSTRAINT fk_user_checkins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS generation_requests (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      prompt TEXT NOT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      is_public TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(24) NOT NULL,
      error_message TEXT NULL,
      first_generation_id VARCHAR(32) NULL,
      generation_ids TEXT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_generation_requests_created (created_at),
      INDEX idx_generation_requests_user_created (user_id, created_at),
      INDEX idx_generation_requests_status (status),
      CONSTRAINT fk_generation_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      type VARCHAR(32) NOT NULL,
      delta INT NOT NULL,
      balance_after INT UNSIGNED NOT NULL,
      ref_type VARCHAR(32) NULL,
      ref_id VARCHAR(64) NULL,
      note VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_credit_tx_user_created (user_id, created_at),
      INDEX idx_credit_tx_type (type),
      INDEX idx_credit_tx_ref (ref_type, ref_id),
      CONSTRAINT fk_credit_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS redeem_codes (
      code VARCHAR(64) NOT NULL PRIMARY KEY,
      credits INT UNSIGNED NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'unused',
      batch_id VARCHAR(32) NULL,
      note VARCHAR(255) NULL,
      expires_at DATETIME(3) NULL,
      used_by_user_id VARCHAR(32) NULL,
      used_at DATETIME(3) NULL,
      created_by_user_id VARCHAR(32) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_redeem_codes_status (status),
      INDEX idx_redeem_codes_batch (batch_id),
      INDEX idx_redeem_codes_used_by (used_by_user_id),
      CONSTRAINT fk_redeem_codes_used_by FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // === Conversations ===
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_conversations_user_updated (user_id, updated_at),
      CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Add conversation_id column to generations (nullable for backward compat)
  const [genConvCol] = await db.execute("SHOW COLUMNS FROM generations LIKE 'conversation_id'");
  if (!genConvCol.length) {
    await db.query("ALTER TABLE generations ADD COLUMN conversation_id VARCHAR(32) NULL AFTER user_id");
    await db.query("ALTER TABLE generations ADD INDEX idx_generations_conversation (conversation_id)");
  }

  const [genOperationCol] = await db.execute("SHOW COLUMNS FROM generations LIKE 'operation_type'");
  if (!genOperationCol.length) {
    await db.query("ALTER TABLE generations ADD COLUMN operation_type VARCHAR(16) NOT NULL DEFAULT 'generate' AFTER conversation_id");
  }

  const [genSourceCol] = await db.execute("SHOW COLUMNS FROM generations LIKE 'source_generation_id'");
  if (!genSourceCol.length) {
    await db.query("ALTER TABLE generations ADD COLUMN source_generation_id VARCHAR(32) NULL AFTER operation_type");
    await db.query("ALTER TABLE generations ADD INDEX idx_generations_source (source_generation_id)");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      provider_order_id VARCHAR(128) NULL,
      amount_cents INT UNSIGNED NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
      credits INT UNSIGNED NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      raw_payload LONGTEXT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      paid_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_payments_user_created (user_id, created_at),
      INDEX idx_payments_status (status),
      INDEX idx_payments_provider_order (provider, provider_order_id),
      CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(
    `INSERT IGNORE INTO app_settings
      (id, openai_api_key, api_base_url, model,
       cpa_api_key, cpa_api_base_url, cpa_model, active_upstream,
       default_credits, generation_credit_cost, allow_registration, require_approval, max_images_per_request)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "",
      process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "",
      process.env.IMAGE_MODEL || defaultModel,
      process.env.CPA_API_KEY || "",
      process.env.CPA_API_BASE_URL || "",
      process.env.CPA_IMAGE_MODEL || "",
      normalizeActiveUpstream(process.env.ACTIVE_UPSTREAM),
      intEnv("DEFAULT_CREDITS", 10),
      intEnv("GENERATION_CREDIT_COST", 1),
      boolEnv("ALLOW_REGISTRATION", true) ? 1 : 0,
      boolEnv("REQUIRE_APPROVAL", false) ? 1 : 0,
      intEnv("MAX_IMAGES_PER_REQUEST", 1)
    ]
  );

  const envApiBaseUrl = process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "";
  if (envApiBaseUrl) {
    await db.execute(
      "UPDATE app_settings SET api_base_url = ? WHERE id = 1 AND api_base_url = ''",
      [envApiBaseUrl.replace(/\/+$/, "")]
    );
  }

  const envCpaBaseUrl = (process.env.CPA_API_BASE_URL || "").trim();
  if (envCpaBaseUrl) {
    await db.execute(
      "UPDATE app_settings SET cpa_api_base_url = ? WHERE id = 1 AND cpa_api_base_url = ''",
      [envCpaBaseUrl.replace(/\/+$/, "")]
    );
  }

  const envCpaModel = (process.env.CPA_IMAGE_MODEL || "").trim();
  if (envCpaModel) {
    await db.execute(
      "UPDATE app_settings SET cpa_model = ? WHERE id = 1 AND cpa_model = ''",
      [envCpaModel.slice(0, 80)]
    );
  }
}

async function initializeDatabase(options = {}) {
  defaultModel = options.defaultModel || defaultModel;
  const config = mysqlConfig();
  await createDatabaseIfNeeded(config);
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    charset: "utf8mb4"
  });
  await runMigrations();
  await deleteExpiredSessions();
}

async function getSettings() {
  const [rows] = await getPool().execute("SELECT * FROM app_settings WHERE id = 1 LIMIT 1");
  return mapSettings(rows[0]);
}

async function updateSettings(patch) {
  const columns = [];
  const values = [];
  const mapping = {
    openaiApiKey: "openai_api_key",
    apiBaseUrl: "api_base_url",
    model: "model",
    cpaApiKey: "cpa_api_key",
    cpaApiBaseUrl: "cpa_api_base_url",
    cpaModel: "cpa_model",
    activeUpstream: "active_upstream",
    defaultCredits: "default_credits",
    generationCreditCost: "generation_credit_cost",
    allowRegistration: "allow_registration",
    requireApproval: "require_approval",
    maxImagesPerRequest: "max_images_per_request"
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (Object.hasOwn(patch, key)) {
      columns.push(`${column} = ?`);
      values.push(patch[key]);
    }
  }

  if (columns.length) {
    values.push(1);
    await getPool().execute(`UPDATE app_settings SET ${columns.join(", ")} WHERE id = ?`, values);
  }
  return getSettings();
}

async function countUsers() {
  const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM users");
  return Number(rows[0]?.count || 0);
}

async function countAdmins() {
  const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
  return Number(rows[0]?.count || 0);
}

async function getUserByEmail(email) {
  const [rows] = await getPool().execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return mapUser(rows[0]);
}

async function getUserById(id) {
  const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return mapUser(rows[0]);
}

async function createUser(user) {
  const createdAt = new Date();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO users
        (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash.salt,
        user.passwordHash.iterations,
        user.passwordHash.hash,
        user.role,
        user.status,
        user.credits,
        createdAt,
        createdAt
      ]
    );
    if (Number(user.credits) > 0) {
      await recordCreditTransaction(connection, {
        userId: user.id,
        type: "register_bonus",
        delta: Number(user.credits),
        balanceAfter: Number(user.credits),
        refType: "user",
        refId: user.id,
        note: "Signup bonus credits",
        createdAt
      });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => null);
    throw error;
  } finally {
    connection.release();
  }
  return getUserById(user.id);
}

async function listUsers() {
  const [rows] = await getPool().execute("SELECT * FROM users ORDER BY created_at DESC");
  return rows.map(mapUser);
}

async function updateUser(id, patch) {
  const columns = [];
  const values = [];
  const mapping = {
    name: "name",
    role: "role",
    status: "status",
    credits: "credits"
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (Object.hasOwn(patch, key)) {
      columns.push(`${column} = ?`);
      values.push(patch[key]);
    }
  }

  if (columns.length) {
    columns.push("updated_at = ?");
    values.push(new Date(), id);
    await getPool().execute(`UPDATE users SET ${columns.join(", ")} WHERE id = ?`, values);
  }
  return getUserById(id);
}

async function updateUserProfile(id, patch) {
  const columns = [];
  const values = [];
  if (Object.hasOwn(patch, "name")) {
    columns.push("name = ?");
    values.push(patch.name);
  }
  if (Object.hasOwn(patch, "avatarFilename")) {
    columns.push("avatar_filename = ?");
    values.push(patch.avatarFilename || null);
  }
  if (patch.passwordHash) {
    columns.push("password_salt = ?");
    values.push(patch.passwordHash.salt);
    columns.push("password_iterations = ?");
    values.push(patch.passwordHash.iterations);
    columns.push("password_hash = ?");
    values.push(patch.passwordHash.hash);
  }
  if (columns.length) {
    columns.push("updated_at = ?");
    values.push(new Date(), id);
    await getPool().execute(`UPDATE users SET ${columns.join(", ")} WHERE id = ?`, values);
  }
  return getUserById(id);
}

async function reserveCredits(userId, amount, meta = {}) {
  const value = Number(amount) || 0;
  if (value <= 0) return true;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT credits FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );
    if (!rows.length || Number(rows[0].credits) < value) {
      await connection.rollback();
      return false;
    }
    const balanceAfter = Number(rows[0].credits) - value;
    await connection.execute(
      "UPDATE users SET credits = ?, updated_at = ? WHERE id = ?",
      [balanceAfter, new Date(), userId]
    );
    await recordCreditTransaction(connection, {
      userId,
      type: meta.type || "consume",
      delta: -value,
      balanceAfter,
      refType: meta.refType,
      refId: meta.refId,
      note: meta.note
    });
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback().catch(() => null);
    throw error;
  } finally {
    connection.release();
  }
}

async function addCredits(userId, amount, meta = {}) {
  const value = Number(amount) || 0;
  if (value <= 0) return 0;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT credits FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );
    if (!rows.length) {
      await connection.rollback();
      return 0;
    }
    const balanceAfter = Number(rows[0].credits) + value;
    await connection.execute(
      "UPDATE users SET credits = ?, updated_at = ? WHERE id = ?",
      [balanceAfter, new Date(), userId]
    );
    await recordCreditTransaction(connection, {
      userId,
      type: meta.type || "credit",
      delta: value,
      balanceAfter,
      refType: meta.refType,
      refId: meta.refId,
      note: meta.note
    });
    await connection.commit();
    return balanceAfter;
  } catch (error) {
    await connection.rollback().catch(() => null);
    throw error;
  } finally {
    connection.release();
  }
}

async function adjustCredits(userId, delta, meta = {}) {
  const amount = Number(delta) || 0;
  if (!amount) return getUserById(userId);
  if (amount > 0) {
    await addCredits(userId, amount, { type: "admin_adjust", ...meta });
  } else {
    const deduction = Math.abs(amount);
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT credits FROM users WHERE id = ? FOR UPDATE",
        [userId]
      );
      const current = Number(rows[0]?.credits || 0);
      const actual = Math.min(deduction, current);
      const balanceAfter = current - actual;
      await connection.execute(
        "UPDATE users SET credits = ?, updated_at = ? WHERE id = ?",
        [balanceAfter, new Date(), userId]
      );
      if (actual > 0) {
        await recordCreditTransaction(connection, {
          userId,
          type: meta.type || "admin_adjust",
          delta: -actual,
          balanceAfter,
          refType: meta.refType,
          refId: meta.refId,
          note: meta.note
        });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => null);
      throw error;
    } finally {
      connection.release();
    }
  }
  return getUserById(userId);
}

async function hasCheckedInToday(userId) {
  const [rows] = await getPool().execute(
    "SELECT user_id FROM user_checkins WHERE user_id = ? AND checkin_date = CURRENT_DATE() LIMIT 1",
    [userId]
  );
  return rows.length > 0;
}

async function checkInToday(userId, creditAmount = 1) {
  const amount = Math.max(1, Number(creditAmount) || 1);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [insertResult] = await connection.execute(
      "INSERT IGNORE INTO user_checkins (user_id, checkin_date, credits_awarded) VALUES (?, CURRENT_DATE(), ?)",
      [userId, amount]
    );
    if (insertResult.affectedRows === 0) {
      const [rows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
      await connection.rollback();
      return { checkedIn: false, credits: Number(rows[0]?.credits || 0) };
    }
    const [userRows] = await connection.execute(
      "SELECT credits FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );
    const balanceAfter = Number(userRows[0]?.credits || 0) + amount;
    await connection.execute(
      "UPDATE users SET credits = ?, updated_at = ? WHERE id = ?",
      [balanceAfter, new Date(), userId]
    );
    await recordCreditTransaction(connection, {
      userId,
      type: "checkin",
      delta: amount,
      balanceAfter,
      refType: "checkin_date",
      refId: new Date().toISOString().slice(0, 10),
      note: "Daily check-in bonus"
    });
    await connection.commit();
    return { checkedIn: true, credits: balanceAfter };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function reserveDailyFreeGeneration(userId, freeLimit) {
  const limit = Math.max(0, Number(freeLimit) || 0);
  if (!limit) return false;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT free_used FROM user_daily_usage WHERE user_id = ? AND usage_date = CURRENT_DATE() FOR UPDATE",
      [userId]
    );
    const used = Number(rows[0]?.free_used || 0);
    if (!rows.length) {
      await connection.execute(
        "INSERT INTO user_daily_usage (user_id, usage_date, free_used) VALUES (?, CURRENT_DATE(), 1)",
        [userId]
      );
      await connection.commit();
      return true;
    }
    if (used >= limit) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      "UPDATE user_daily_usage SET free_used = free_used + 1 WHERE user_id = ? AND usage_date = CURRENT_DATE()",
      [userId]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function refundDailyFreeGeneration(userId) {
  await getPool().execute(
    "UPDATE user_daily_usage SET free_used = GREATEST(free_used - 1, 0) WHERE user_id = ? AND usage_date = CURRENT_DATE()",
    [userId]
  );
}

async function getDailyFreeUsed(userId) {
  const [rows] = await getPool().execute(
    "SELECT free_used FROM user_daily_usage WHERE user_id = ? AND usage_date = CURRENT_DATE() LIMIT 1",
    [userId]
  );
  return Number(rows[0]?.free_used || 0);
}

async function getUserCredits(userId) {
  const [rows] = await getPool().execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
  return Number(rows[0]?.credits || 0);
}

async function createSession(tokenHash, userId, expiresAt) {
  await getPool().execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [tokenHash, userId, expiresAt, new Date()]
  );
}

async function deleteSession(tokenHash) {
  if (!tokenHash) return;
  await getPool().execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

async function touchSession(tokenHash, expiresAt) {
  await getPool().execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", [expiresAt, tokenHash]);
}

async function getSessionUser(tokenHash) {
  const [rows] = await getPool().execute(
    `SELECT u.*
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
      LIMIT 1`,
    [tokenHash, new Date()]
  );
  return mapUser(rows[0]);
}

async function deleteExpiredSessions() {
  await getPool().execute("DELETE FROM sessions WHERE expires_at <= ?", [new Date()]);
}

async function insertGenerations(generations) {
  if (!generations.length) return;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const generation of generations) {
      await connection.execute(
        `INSERT INTO generations
          (id, user_id, conversation_id, operation_type, source_generation_id, prompt, model, size, quality, background, output_format, filename, is_public, revised_prompt, usage_json, upstream_used, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generation.id,
          generation.userId,
          generation.conversationId || null,
          generation.operationType || "generate",
          generation.sourceGenerationId || null,
          generation.prompt,
          generation.model,
          generation.size,
          generation.quality,
          generation.background,
          generation.outputFormat,
          generation.filename,
          generation.isPublic ? 1 : 0,
          generation.revisedPrompt || "",
          generation.usage ? JSON.stringify(generation.usage) : null,
          generation.upstreamUsed || "",
          new Date(generation.createdAt)
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function insertGenerationRequest(request) {
  const createdAt = new Date();
  await getPool().execute(
    `INSERT INTO generation_requests
      (id, user_id, prompt, ip_address, user_agent, is_public, status, error_message, first_generation_id, generation_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.id,
      request.userId,
      request.prompt,
      request.ipAddress || "",
      request.userAgent || "",
      request.isPublic ? 1 : 0,
      request.status || "pending",
      request.errorMessage || null,
      request.firstGenerationId || null,
      request.generationIds ? JSON.stringify(request.generationIds) : null,
      createdAt,
      createdAt
    ]
  );
}

async function updateGenerationRequest(id, patch) {
  const columns = [];
  const values = [];
  const mapping = {
    status: "status",
    errorMessage: "error_message",
    firstGenerationId: "first_generation_id"
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (Object.hasOwn(patch, key)) {
      columns.push(`${column} = ?`);
      values.push(patch[key]);
    }
  }
  if (Object.hasOwn(patch, "generationIds")) {
    columns.push("generation_ids = ?");
    values.push(JSON.stringify(patch.generationIds || []));
  }
  if (!columns.length) return;
  columns.push("updated_at = ?");
  values.push(new Date(), id);
  await getPool().execute(`UPDATE generation_requests SET ${columns.join(", ")} WHERE id = ?`, values);
}

async function listGenerationRequests(limit = 100) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename, g.upstream_used
       FROM generation_requests gr
       LEFT JOIN users u ON u.id = gr.user_id
       LEFT JOIN generations g ON g.id = gr.first_generation_id
      ORDER BY gr.created_at DESC
      LIMIT ${normalizedLimit}`
  );
  return rows.map(mapGenerationRequest);
}

async function listGenerationsForUser(user, limit = 60) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 60));
  const sql =
    user.role === "admin"
      ? `SELECT * FROM generations ORDER BY created_at DESC LIMIT ${normalizedLimit}`
      : `SELECT * FROM generations WHERE user_id = ? ORDER BY created_at DESC LIMIT ${normalizedLimit}`;
  const params = user.role === "admin" ? [] : [user.id];
  const [rows] = await getPool().execute(sql, params);
  return rows.map(mapGeneration);
}

async function listPublicGenerations(limit = 60) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 60));
  const [rows] = await getPool().execute(
    `SELECT * FROM generations WHERE is_public = 1 ORDER BY created_at DESC LIMIT ${normalizedLimit}`
  );
  return rows.map(mapGeneration);
}

async function getGenerationById(id) {
  const [rows] = await getPool().execute("SELECT * FROM generations WHERE id = ? LIMIT 1", [id]);
  return mapGeneration(rows[0]);
}

async function countTodayGenerations() {
  const [rows] = await getPool().execute(
    "SELECT COUNT(*) AS count FROM generations WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)"
  );
  return Number(rows[0]?.count || 0);
}

// ----------------------------------------------------------------------------
// Conversations
// ----------------------------------------------------------------------------

function mapConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function createConversation(userId, title = "") {
  const id = newId("conv_");
  const now = new Date();
  await getPool().execute(
    `INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, userId, title.slice(0, 255), now, now]
  );
  return { id, userId, title, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

async function listConversations(userId, limit = 50) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const [rows] = await getPool().execute(
    `SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ${normalizedLimit}`,
    [userId]
  );
  return rows.map(mapConversation);
}

async function getConversationById(id) {
  const [rows] = await getPool().execute("SELECT * FROM conversations WHERE id = ?", [id]);
  return mapConversation(rows[0]);
}

async function updateConversation(id, patch) {
  const cols = [];
  const vals = [];
  if (patch.title !== undefined) { cols.push("title = ?"); vals.push(String(patch.title).slice(0, 255)); }
  if (!cols.length) return;
  cols.push("updated_at = ?");
  vals.push(new Date());
  vals.push(id);
  await getPool().execute(`UPDATE conversations SET ${cols.join(", ")} WHERE id = ?`, vals);
}

async function deleteConversation(id) {
  // Also clear conversation_id on associated generations (don't delete the images)
  await getPool().execute("UPDATE generations SET conversation_id = NULL WHERE conversation_id = ?", [id]);
  await getPool().execute("DELETE FROM conversations WHERE id = ?", [id]);
}

async function touchConversation(id) {
  await getPool().execute("UPDATE conversations SET updated_at = ? WHERE id = ?", [new Date(), id]);
}

async function listGenerationsForConversation(conversationId, limit = 100) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT * FROM generations WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ${normalizedLimit}`,
    [conversationId]
  );
  return rows.map(mapGeneration);
}

// ----------------------------------------------------------------------------
// Credit transactions (ledger)
// ----------------------------------------------------------------------------

function mapCreditTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    type: row.type,
    delta: Number(row.delta || 0),
    balanceAfter: Number(row.balance_after || 0),
    refType: row.ref_type || "",
    refId: row.ref_id || "",
    note: row.note || "",
    createdAt: toIso(row.created_at)
  };
}

async function listCreditTransactionsForUser(userId, limit = 50) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  const [rows] = await getPool().execute(
    `SELECT * FROM credit_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ${normalizedLimit}`,
    [userId]
  );
  return rows.map(mapCreditTransaction);
}

async function listAllCreditTransactions(limit = 200) {
  const normalizedLimit = Math.max(1, Math.min(2000, Number(limit) || 200));
  const [rows] = await getPool().execute(
    `SELECT t.*, u.name AS user_name, u.email AS user_email
       FROM credit_transactions t
       LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC
       LIMIT ${normalizedLimit}`
  );
  return rows.map(mapCreditTransaction);
}

// ----------------------------------------------------------------------------
// Redeem codes
// ----------------------------------------------------------------------------

function mapRedeemCode(row) {
  if (!row) return null;
  return {
    code: row.code,
    credits: Number(row.credits || 0),
    status: row.status,
    batchId: row.batch_id || "",
    note: row.note || "",
    expiresAt: toIso(row.expires_at),
    usedByUserId: row.used_by_user_id || "",
    usedByUserEmail: row.used_by_user_email || "",
    usedAt: toIso(row.used_at),
    createdByUserId: row.created_by_user_id || "",
    createdAt: toIso(row.created_at)
  };
}

const REDEEM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRedeemCode(length = 16) {
  const buffer = crypto.randomBytes(length);
  const chars = new Array(length);
  for (let i = 0; i < length; i += 1) {
    chars[i] = REDEEM_CODE_ALPHABET[buffer[i] % REDEEM_CODE_ALPHABET.length];
  }
  // Format like AAAA-AAAA-AAAA-AAAA for readability.
  const segments = [];
  for (let i = 0; i < chars.length; i += 4) {
    segments.push(chars.slice(i, i + 4).join(""));
  }
  return segments.join("-");
}

async function createRedeemCodes({ count, credits, expiresAt, note, createdByUserId }) {
  const total = Math.max(1, Math.min(1000, Number(count) || 1));
  const credit = Math.max(1, Number(credits) || 1);
  const batchId = newId("batch_");
  const codes = [];
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    while (codes.length < total) {
      const candidate = generateRedeemCode(16);
      try {
        await connection.execute(
          `INSERT INTO redeem_codes
             (code, credits, status, batch_id, note, expires_at, created_by_user_id, created_at)
           VALUES (?, ?, 'unused', ?, ?, ?, ?, ?)`,
          [
            candidate,
            credit,
            batchId,
            note ? String(note).slice(0, 255) : null,
            expiresAt ? new Date(expiresAt) : null,
            createdByUserId || null,
            new Date()
          ]
        );
        codes.push(candidate);
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") continue;
        throw error;
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => null);
    throw error;
  } finally {
    connection.release();
  }
  return { batchId, codes, credits: credit };
}

async function listRedeemCodes({ status, batchId, limit = 200 } = {}) {
  const filters = [];
  const params = [];
  if (status) {
    filters.push("rc.status = ?");
    params.push(status);
  }
  if (batchId) {
    filters.push("rc.batch_id = ?");
    params.push(batchId);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const normalizedLimit = Math.max(1, Math.min(2000, Number(limit) || 200));
  const [rows] = await getPool().execute(
    `SELECT rc.*, u.email AS used_by_user_email
       FROM redeem_codes rc
       LEFT JOIN users u ON u.id = rc.used_by_user_id
       ${where}
       ORDER BY rc.created_at DESC
       LIMIT ${normalizedLimit}`,
    params
  );
  return rows.map(mapRedeemCode);
}

async function disableRedeemCode(code) {
  await getPool().execute(
    "UPDATE redeem_codes SET status = 'disabled' WHERE code = ? AND status = 'unused'",
    [code]
  );
}

async function redeemCode(rawCode, userId) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) {
    return { ok: false, error: "code_invalid" };
  }
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [codeRows] = await connection.execute(
      "SELECT * FROM redeem_codes WHERE code = ? FOR UPDATE",
      [code]
    );
    if (!codeRows.length) {
      await connection.rollback();
      return { ok: false, error: "code_not_found" };
    }
    const row = codeRows[0];
    if (row.status === "used") {
      await connection.rollback();
      return { ok: false, error: "code_used" };
    }
    if (row.status === "disabled") {
      await connection.rollback();
      return { ok: false, error: "code_disabled" };
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await connection.rollback();
      return { ok: false, error: "code_expired" };
    }
    const credits = Number(row.credits) || 0;
    const [userRows] = await connection.execute(
      "SELECT credits FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );
    if (!userRows.length) {
      await connection.rollback();
      return { ok: false, error: "user_not_found" };
    }
    const balanceAfter = Number(userRows[0].credits) + credits;
    const now = new Date();
    await connection.execute(
      "UPDATE users SET credits = ?, updated_at = ? WHERE id = ?",
      [balanceAfter, now, userId]
    );
    await connection.execute(
      "UPDATE redeem_codes SET status = 'used', used_by_user_id = ?, used_at = ? WHERE code = ?",
      [userId, now, code]
    );
    await recordCreditTransaction(connection, {
      userId,
      type: "topup_redeem",
      delta: credits,
      balanceAfter,
      refType: "redeem_code",
      refId: code,
      note: row.note || "Redeem code topup",
      createdAt: now
    });
    await connection.commit();
    return { ok: true, credits, balanceAfter, code };
  } catch (error) {
    await connection.rollback().catch(() => null);
    throw error;
  } finally {
    connection.release();
  }
}

// ----------------------------------------------------------------------------
// Payments (skeleton: real provider integration lands in PR2)
// ----------------------------------------------------------------------------

function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email || "",
    provider: row.provider,
    providerOrderId: row.provider_order_id || "",
    amountCents: Number(row.amount_cents || 0),
    currency: row.currency || "CNY",
    credits: Number(row.credits || 0),
    status: row.status,
    paidAt: toIso(row.paid_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function createPayment({ userId, provider, amountCents, credits, ipAddress, userAgent }) {
  const id = newId("pay_");
  await getPool().execute(
    `INSERT INTO payments
       (id, user_id, provider, amount_cents, currency, credits, status, ip_address, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'CNY', ?, 'pending', ?, ?, ?, ?)`,
    [
      id,
      userId,
      provider,
      Math.max(0, Number(amountCents) || 0),
      Math.max(0, Number(credits) || 0),
      ipAddress || null,
      userAgent ? String(userAgent).slice(0, 512) : null,
      new Date(),
      new Date()
    ]
  );
  return getPaymentById(id);
}

async function getPaymentById(id) {
  const [rows] = await getPool().execute(
    `SELECT p.*, u.email AS user_email FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id = ? LIMIT 1`,
    [id]
  );
  return mapPayment(rows[0]);
}

async function listPayments({ status, limit = 200 } = {}) {
  const filters = [];
  const params = [];
  if (status) {
    filters.push("p.status = ?");
    params.push(status);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const normalizedLimit = Math.max(1, Math.min(2000, Number(limit) || 200));
  const [rows] = await getPool().execute(
    `SELECT p.*, u.email AS user_email FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${normalizedLimit}`,
    params
  );
  return rows.map(mapPayment);
}

async function markPaymentPaid({ paymentId, providerOrderId, rawPayload }) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT * FROM payments WHERE id = ? FOR UPDATE",
      [paymentId]
    );
    if (!rows.length) {
      await connection.rollback();
      return { ok: false, error: "payment_not_found" };
    }
    const payment = rows[0];
    if (payment.status === "paid") {
      await connection.rollback();
      return { ok: true, alreadyPaid: true, payment: mapPayment(payment) };
    }
    if (payment.status !== "pending") {
      await connection.rollback();
      return { ok: false, error: "payment_status_invalid", status: payment.status };
    }
    const now = new Date();
    await connection.execute(
      `UPDATE payments
          SET status = 'paid',
              provider_order_id = ?,
              raw_payload = ?,
              paid_at = ?,
              updated_at = ?
        WHERE id = ?`,
      [
        providerOrderId || payment.provider_order_id || null,
        rawPayload ? String(rawPayload).slice(0, 65000) : payment.raw_payload || null,
        now,
        now,
        paymentId
      ]
    );
    const credits = Number(payment.credits) || 0;
    let balanceAfter = null;
    if (credits > 0) {
      const [userRows] = await connection.execute(
        "SELECT credits FROM users WHERE id = ? FOR UPDATE",
        [payment.user_id]
      );
      balanceAfter = Number(userRows[0]?.credits || 0) + credits;
      await connection.execute(
        "UPDATE users SET credits = ?, updated_at = ? WHERE id = ?",
        [balanceAfter, now, payment.user_id]
      );
      await recordCreditTransaction(connection, {
        userId: payment.user_id,
        type: "topup_payment",
        delta: credits,
        balanceAfter,
        refType: "payment",
        refId: paymentId,
        note: `${payment.provider} payment`,
        createdAt: now
      });
    }
    await connection.commit();
    return { ok: true, payment: await getPaymentById(paymentId), balanceAfter };
  } catch (error) {
    await connection.rollback().catch(() => null);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  initializeDatabase,
  getSettings,
  updateSettings,
  countUsers,
  countAdmins,
  getUserByEmail,
  getUserById,
  createUser,
  listUsers,
  updateUser,
  updateUserProfile,
  reserveCredits,
  addCredits,
  adjustCredits,
  hasCheckedInToday,
  checkInToday,
  reserveDailyFreeGeneration,
  refundDailyFreeGeneration,
  getDailyFreeUsed,
  getUserCredits,
  createSession,
  deleteSession,
  touchSession,
  getSessionUser,
  insertGenerations,
  insertGenerationRequest,
  updateGenerationRequest,
  listGenerationRequests,
  listGenerationsForUser,
  listPublicGenerations,
  getGenerationById,
  countTodayGenerations,
  createConversation,
  listConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
  touchConversation,
  listGenerationsForConversation,
  listCreditTransactionsForUser,
  listAllCreditTransactions,
  createRedeemCodes,
  listRedeemCodes,
  redeemCode,
  disableRedeemCode,
  createPayment,
  getPaymentById,
  listPayments,
  markPaymentPaid
};
