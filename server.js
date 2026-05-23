const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const JWT_SECRET =
  process.env.JWT_SECRET || "lumina_secret_key_2026_change_later";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(express.static("public/html"));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "lumina_user",
  password: process.env.DB_PASSWORD || "12345",
  database: process.env.DB_NAME || "lumina",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const STUDIO_OPEN = "09:00:00";
const STUDIO_CLOSE = "20:00:00";
const MIN_BOOKING_BUFFER_HOURS = 2;
const MAX_BOOKINGS_PER_CLIENT_PER_DAY = 3;

const BOOKING_STATUSES = [
  "new",
  "confirmed",
  "paid",
  "completed",
  "cancelled"
];

const CALLBACK_STATUSES = ["new", "processed"];
const USER_STATUSES = ["active", "inactive", "blocked"];
const SERVICE_STATUSES = ["active", "inactive"];
const SERVICE_CATEGORIES = ["main", "additional"];
const SCHEDULE_SLOT_TYPES = ["working", "break", "blocked", "day_off"];

function normalizeServiceKey(serviceName) {
  return String(serviceName || "").trim().toLowerCase();
}

const SERVICES_WITHOUT_PHOTOGRAPHER = new Set([
  "Оренда залу для стороннього фотографа",
  "Оренда студії для стороннього фотографа",
  "Погодинна оренда залу"
].map(normalizeServiceKey));

const OUTDOOR_SERVICES = new Set([
  "Виїзна фотосесія в межах міста",
  "Виїзна фотосесія за межами міста",
  "Репортажна зйомка подій"
].map(normalizeServiceKey));

const SERVICE_CATALOG = {
  "Портретна фотосесія": { price: 2500, duration: 60, category: "main" },
  "Індивідуальна студійна фотосесія": { price: 2800, duration: 60, category: "main" },
  "Сімейна фотосесія": { price: 3500, duration: 90, category: "main" },
  "Дитяча фотосесія": { price: 3000, duration: 60, category: "main" },
  "Love Story фотосесія": { price: 3200, duration: 90, category: "main" },
  "Весільна фотозйомка": { price: 10000, duration: 480, category: "main" },
  "Фотосесія вагітності": { price: 3000, duration: 60, category: "main" },
  "Newborn-фотосесія": { price: 4000, duration: 120, category: "main" },
  "Предметна фотозйомка": { price: 2500, duration: 60, category: "main" },
  "Контент-зйомка для брендів": { price: 5000, duration: 120, category: "main" },
  "Каталожна фотозйомка": { price: 4500, duration: 120, category: "main" },
  "Виїзна фотосесія в межах міста": { price: 3500, duration: 90, category: "main" },
  "Виїзна фотосесія за межами міста": { price: 5000, duration: 120, category: "main" },
  "Репортажна зйомка подій": { price: 6000, duration: 180, category: "main" },
  "Погодинна оренда залу": { price: 1000, duration: 60, category: "main" },
  "Оренда залу для стороннього фотографа": { price: 1200, duration: 60, category: "main" },
  "Оренда студії для стороннього фотографа": { price: 1200, duration: 60, category: "main" },

  "Оренда додаткового світла": { price: 500, duration: 60, category: "additional" },
  "Оренда реквізиту": { price: 400, duration: 60, category: "additional" },
  "Макіяж перед фотосесією": { price: 800, duration: 60, category: "additional" },
  "Зачіска перед фотосесією": { price: 700, duration: 60, category: "additional" },
  "Послуги стиліста": { price: 1000, duration: 60, category: "additional" },
  "Професійна ретуш фотографій": { price: 1000, duration: 0, category: "additional" },
  "Термінова обробка фото": { price: 1200, duration: 0, category: "additional" },
  "Друк фотографій": { price: 300, duration: 0, category: "additional" },
  "Створення фотокниги": { price: 2500, duration: 0, category: "additional" },
  "Бекстейдж-відео": { price: 1500, duration: 60, category: "additional" },
  "Підбір локації для виїзної зйомки": { price: 600, duration: 0, category: "additional" },
  "Додаткові фото в обробці": { price: 500, duration: 0, category: "additional" }
};

/* =========================================================
   ЗАГАЛЬНІ ФУНКЦІЇ
========================================================= */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeNullableString(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toMoney(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.round(number * 100) / 100;
}

function toPositiveInt(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return fallback;
  return number;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeBookingDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDate(value);
  }

  return String(value || "").trim().slice(0, 10);
}

function assertValidBookingDate(value) {
  const bookingDate = normalizeBookingDate(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bookingDate);

  if (!match) {
    throw new Error("Некоректний формат дати.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const checkDate = new Date(year, month - 1, day);

  if (
    checkDate.getFullYear() !== year ||
    checkDate.getMonth() !== month - 1 ||
    checkDate.getDate() !== day
  ) {
    throw new Error("Вказано неіснуючу дату.");
  }

  return bookingDate;
}

function normalizeTime(time) {
  const value = String(time || "").trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);

  if (!match) {
    throw new Error("Некоректний формат часу.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new Error("Некоректне значення часу.");
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timeToMinutes(time) {
  const normalizedTime = normalizeTime(time);
  const [hours, minutes] = normalizedTime.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  if (
    !Number.isInteger(totalMinutes) ||
    totalMinutes < 0 ||
    totalMinutes >= 24 * 60
  ) {
    throw new Error("Некоректний час після розрахунку тривалості.");
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function addMinutesToTime(time, minutes) {
  const total = timeToMinutes(time) + Number(minutes || 0);
  return minutesToTime(total);
}

function buildLocalDateTime(dateValue, timeValue) {
  const bookingDate = assertValidBookingDate(dateValue);
  const normalizedTime = normalizeTime(timeValue);

  const [year, month, day] = bookingDate.split("-").map(Number);
  const [hours, minutes, seconds] = normalizedTime.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds, 0);
}

function isWithinWorkingHours(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const open = timeToMinutes(STUDIO_OPEN);
  const close = timeToMinutes(STUDIO_CLOSE);

  return start >= open && end <= close && end > start;
}

function isPastDateTime(bookingDate, startTime) {
  return buildLocalDateTime(bookingDate, startTime) < new Date();
}

function isTooSoon(bookingDate, startTime) {
  const now = new Date();
  const bookingDateTime = buildLocalDateTime(bookingDate, startTime);
  const diffMs = bookingDateTime - now;
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours < MIN_BOOKING_BUFFER_HOURS;
}

function isRealStudioHall(hallName) {
  if (!hallName) return false;

  const name = String(hallName).trim().toLowerCase();

  if (!name) return false;
  if (name.includes("без залу")) return false;
  if (name.includes("виїзна")) return false;

  return true;
}

function isHallRentalWithoutPhotographer(serviceName) {
  return SERVICES_WITHOUT_PHOTOGRAPHER.has(
    normalizeServiceKey(serviceName)
  );
}

function isOutdoorService(serviceName) {
  return OUTDOOR_SERVICES.has(normalizeServiceKey(serviceName));
}

function serviceNeedsPhotographer(serviceName) {
  return !isHallRentalWithoutPhotographer(serviceName);
}

function getServiceDefaults(serviceName) {
  const name = String(serviceName || "").trim();
  return SERVICE_CATALOG[name] || {
    price: 0,
    duration: 60,
    category: "main"
  };
}

function checkDuplicateServices(additionalServices, mainService) {
  if (!Array.isArray(additionalServices)) return;

  const normalized = additionalServices.map(normalizeServiceKey);

  if (normalized.some((item) => !item)) {
    throw new Error("У додаткових послугах є порожнє значення.");
  }

  const unique = new Set(normalized);

  if (unique.size !== normalized.length) {
    throw new Error("Додаткові послуги містять дублікати.");
  }

  if (normalized.includes(normalizeServiceKey(mainService))) {
    throw new Error("Основну послугу не можна дублювати серед додаткових.");
  }
}

/* =========================================================
   AUTH
========================================================= */

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Потрібно увійти в систему."
    });
  }

  req.user = user;
  next();
}

function requireRole(roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Недостатньо прав доступу."
      });
    }

    next();
  };
}

/* =========================================================
   ІНФРАСТРУКТУРА БАЗИ
========================================================= */

async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  return Number(rows[0].count) > 0;
}

async function tableExists(tableName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );

  return Number(rows[0].count) > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [tableName, indexName]
  );

  return Number(rows[0].count) > 0;
}

async function ensureExtraTablesAndColumns() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS callback_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      callback_name VARCHAR(100) NOT NULL,
      callback_phone VARCHAR(30) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP NULL
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS photographer_schedule (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      photographer_id BIGINT UNSIGNED NOT NULL,
      work_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      slot_type VARCHAR(30) NOT NULL,
      comment TEXT NULL
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS booking_resource_locks (
      resource_type VARCHAR(30) NOT NULL,
      resource_id BIGINT UNSIGNED NOT NULL,
      booking_date DATE NOT NULL,
      PRIMARY KEY (resource_type, resource_id, booking_date)
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS photographer_profiles (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      photographer_id BIGINT UNSIGNED NOT NULL,
      experience VARCHAR(100) NULL,
      bio TEXT NULL,
      image_url TEXT NULL,
      display_order INT NOT NULL DEFAULT 0,
      site_visible TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_photographer_profiles_photographer_id (photographer_id)
    ) ENGINE=InnoDB
  `);

  if (!(await columnExists("services", "image_url"))) {
    await pool.execute(`
      ALTER TABLE services
      ADD COLUMN image_url TEXT NULL AFTER description
    `);
  }

  if (!(await columnExists("services", "site_visible"))) {
    await pool.execute(`
      ALTER TABLE services
      ADD COLUMN site_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER image_url
    `);
  }

  if (!(await columnExists("services", "display_order"))) {
    await pool.execute(`
      ALTER TABLE services
      ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER site_visible
    `);
  }

  if (!(await columnExists("callback_requests", "status"))) {
    await pool.execute(`
      ALTER TABLE callback_requests
      ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'new'
    `);
  }

  if (!(await columnExists("callback_requests", "processed_at"))) {
    await pool.execute(`
      ALTER TABLE callback_requests
      ADD COLUMN processed_at TIMESTAMP NULL
    `);
  }

  if (!(await indexExists("bookings", "idx_bookings_photographer_date_time"))) {
    await pool.execute(`
      CREATE INDEX idx_bookings_photographer_date_time
      ON bookings (photographer_id, booking_date, start_time, end_time)
    `);
  }

  if (!(await indexExists("bookings", "idx_bookings_hall_date_time"))) {
    await pool.execute(`
      CREATE INDEX idx_bookings_hall_date_time
      ON bookings (hall_id, booking_date, start_time, end_time)
    `);
  }

  if (!(await indexExists("bookings", "idx_bookings_client_date_time"))) {
    await pool.execute(`
      CREATE INDEX idx_bookings_client_date_time
      ON bookings (client_id, booking_date, start_time, end_time)
    `);
  }

  if (!(await indexExists("photographer_schedule", "idx_schedule_photographer_date_time"))) {
    await pool.execute(`
      CREATE INDEX idx_schedule_photographer_date_time
      ON photographer_schedule (photographer_id, work_date, start_time, end_time)
    `);
  }

  if (!(await indexExists("booking_services", "idx_booking_services_booking"))) {
    await pool.execute(`
      CREATE INDEX idx_booking_services_booking
      ON booking_services (booking_id)
    `);
  }

  if (!(await indexExists("booking_services", "idx_booking_services_service"))) {
    await pool.execute(`
      CREATE INDEX idx_booking_services_service
      ON booking_services (service_id)
    `);
  }

  if (await tableExists("payments")) {
    if (!(await indexExists("payments", "idx_payments_booking"))) {
      await pool.execute(`
        CREATE INDEX idx_payments_booking
        ON payments (booking_id)
      `);
    }
  }

  await pool.execute(`
    UPDATE services
    SET display_order = id
    WHERE display_order = 0
  `);

  await pool.execute(`
    INSERT INTO photographer_profiles (
      photographer_id,
      experience,
      bio,
      image_url,
      display_order,
      site_visible
    )
    SELECT
      users.id,
      NULL,
      NULL,
      NULL,
      users.id,
      1
    FROM users
    LEFT JOIN photographer_profiles
      ON photographer_profiles.photographer_id = users.id
    WHERE users.role = 'photographer'
      AND photographer_profiles.id IS NULL
  `);
}

/* =========================================================
   ENUM ДОПОМІЖНІ ФУНКЦІЇ
========================================================= */

async function getEnumValues(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SHOW COLUMNS FROM \`${tableName}\` LIKE ?`,
    [columnName]
  );

  if (!rows.length) return [];

  const type = String(rows[0].Type || "");
  const match = /^enum\((.*)\)$/i.exec(type);

  if (!match) return [];

  return match[1]
    .split(",")
    .map((item) => item.trim().replace(/^'/, "").replace(/'$/, ""));
}

function pickEnumValue(values, preferred, fallback = null) {
  if (values.includes(preferred)) return preferred;
  if (fallback && values.includes(fallback)) return fallback;
  return values[0] || null;
}

/* =========================================================
   БАЗОВІ РОУТИ
========================================================= */

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.get("/api/test", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "API працює і MySQL підключено"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "API працює, але MySQL не підключено",
      error: error.message
    });
  }
});

/* =========================================================
   РЕЄСТРАЦІЯ
========================================================= */

app.post("/api/register", async (req, res) => {
  const {
    fullName,
    phone,
    email,
    password,
    confirmPassword
  } = req.body;

  try {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizeNullableString(phone);

    if (
      !fullName ||
      !normalizedPhone ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Заповніть ім'я, телефон, email і пароль."
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Введіть коректну email-адресу."
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Пароль має містити мінімум 6 символів."
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Паролі не співпадають."
      });
    }

    const [existingEmail] = await pool.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Користувач з таким email вже існує."
      });
    }

    const [existingPhone] = await pool.execute(
      "SELECT id FROM users WHERE phone = ? LIMIT 1",
      [normalizedPhone]
    );

    if (existingPhone.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Користувач з таким телефоном вже існує."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO users
        (role, full_name, email, phone, password_hash, status)
       VALUES
        ('client', ?, ?, ?, ?, 'active')`,
      [fullName, normalizedEmail, normalizedPhone, passwordHash]
    );

    res.json({
      success: true,
      message: "Реєстрація успішна. Тепер ви можете увійти.",
      userId: result.insertId
    });
  } catch (error) {
    console.error("Помилка реєстрації:", error);

    res.status(500).json({
      success: false,
      message: "Помилка сервера під час реєстрації.",
      error: error.message
    });
  }
});

/* =========================================================
   ВХІД
========================================================= */

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Введіть email і пароль."
      });
    }

    const [users] = await pool.execute(
      `SELECT
         id,
         role,
         full_name,
         email,
         phone,
         password_hash,
         status
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: "Неправильний email або пароль."
      });
    }

    const user = users[0];

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Користувач заблокований або неактивний."
      });
    }

    let passwordIsValid = false;

    if (user.password_hash && user.password_hash.startsWith("$2")) {
      passwordIsValid = await bcrypt.compare(password, user.password_hash);
    } else {
      passwordIsValid = password === user.password_hash;

      if (passwordIsValid) {
        const newPasswordHash = await bcrypt.hash(password, 10);

        await pool.execute(
          "UPDATE users SET password_hash = ? WHERE id = ?",
          [newPasswordHash, user.id]
        );
      }
    }

    if (!passwordIsValid) {
      return res.status(401).json({
        success: false,
        message: "Неправильний email або пароль."
      });
    }

    const token = createToken(user);

    res.json({
      success: true,
      message: "Вхід виконано успішно.",
      token,
      user: {
        id: user.id,
        role: user.role,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error("Помилка входу:", error);

    res.status(500).json({
      success: false,
      message: "Помилка сервера під час входу.",
      error: error.message
    });
  }
});

/* =========================================================
   ПОТОЧНИЙ КОРИСТУВАЧ
========================================================= */

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT
         id,
         role,
         full_name,
         email,
         phone,
         instagram,
         status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "Користувача не знайдено."
      });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Не вдалося отримати дані користувача.",
      error: error.message
    });
  }
});

/* =========================================================
   ПУБЛІЧНІ ПОСЛУГИ
========================================================= */

app.get("/api/services/public", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         name,
         category,
         description,
         price,
         duration_minutes,
         image_url,
         display_order
       FROM services
       WHERE status = 'active'
         AND COALESCE(site_visible, 1) = 1
       ORDER BY display_order ASC, id ASC`
    );

    res.json({
      success: true,
      services: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Не вдалося отримати список послуг.",
      error: error.message
    });
  }
});

/* =========================================================
   АДМІН: CRUD ПОСЛУГ
========================================================= */

app.get(
  "/api/admin/services",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
           id,
           name,
           category,
           description,
           price,
           duration_minutes,
           status,
           image_url,
           site_visible,
           display_order,
           created_at
         FROM services
         ORDER BY display_order ASC, id ASC`
      );

      res.json({
        success: true,
        services: rows
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося отримати послуги.",
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/services",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const {
      name,
      category,
      description,
      price,
      durationMinutes,
      status,
      imageUrl,
      siteVisible,
      displayOrder
    } = req.body;

    try {
      const serviceName = String(name || "").trim();

      if (!serviceName) {
        return res.status(400).json({
          success: false,
          message: "Назва послуги є обов'язковою."
        });
      }

      const safeCategory = SERVICE_CATEGORIES.includes(category)
        ? category
        : "main";

      const safeStatus = SERVICE_STATUSES.includes(status)
        ? status
        : "active";

      const [existing] = await pool.execute(
        "SELECT id FROM services WHERE name = ? LIMIT 1",
        [serviceName]
      );

      if (existing.length) {
        return res.status(409).json({
          success: false,
          message: "Послуга з такою назвою вже існує."
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO services
          (
            name,
            category,
            description,
            price,
            duration_minutes,
            status,
            image_url,
            site_visible,
            display_order
          )
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serviceName,
          safeCategory,
          normalizeNullableString(description),
          toMoney(price, 0),
          toPositiveInt(durationMinutes, 0),
          safeStatus,
          normalizeNullableString(imageUrl),
          siteVisible === false || siteVisible === 0 ? 0 : 1,
          toPositiveInt(displayOrder, 0)
        ]
      );

      res.json({
        success: true,
        message: "Послугу додано.",
        serviceId: result.insertId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося додати послугу.",
        error: error.message
      });
    }
  }
);

app.put(
  "/api/admin/services/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const serviceId = req.params.id;
    const {
      name,
      category,
      description,
      price,
      durationMinutes,
      status,
      imageUrl,
      siteVisible,
      displayOrder
    } = req.body;

    try {
      const [existingRows] = await pool.execute(
        "SELECT id FROM services WHERE id = ? LIMIT 1",
        [serviceId]
      );

      if (!existingRows.length) {
        return res.status(404).json({
          success: false,
          message: "Послугу не знайдено."
        });
      }

      const serviceName = String(name || "").trim();

      if (!serviceName) {
        return res.status(400).json({
          success: false,
          message: "Назва послуги є обов'язковою."
        });
      }

      const [duplicate] = await pool.execute(
        "SELECT id FROM services WHERE name = ? AND id != ? LIMIT 1",
        [serviceName, serviceId]
      );

      if (duplicate.length) {
        return res.status(409).json({
          success: false,
          message: "Інша послуга з такою назвою вже існує."
        });
      }

      const safeCategory = SERVICE_CATEGORIES.includes(category)
        ? category
        : "main";

      const safeStatus = SERVICE_STATUSES.includes(status)
        ? status
        : "active";

      await pool.execute(
        `UPDATE services
         SET
           name = ?,
           category = ?,
           description = ?,
           price = ?,
           duration_minutes = ?,
           status = ?,
           image_url = ?,
           site_visible = ?,
           display_order = ?
         WHERE id = ?`,
        [
          serviceName,
          safeCategory,
          normalizeNullableString(description),
          toMoney(price, 0),
          toPositiveInt(durationMinutes, 0),
          safeStatus,
          normalizeNullableString(imageUrl),
          siteVisible === false || siteVisible === 0 ? 0 : 1,
          toPositiveInt(displayOrder, 0),
          serviceId
        ]
      );

      res.json({
        success: true,
        message: "Послугу оновлено.",
        serviceId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося оновити послугу.",
        error: error.message
      });
    }
  }
);

app.delete(
  "/api/admin/services/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const serviceId = req.params.id;

    try {
      const [existing] = await pool.execute(
        "SELECT id FROM services WHERE id = ? LIMIT 1",
        [serviceId]
      );

      if (!existing.length) {
        return res.status(404).json({
          success: false,
          message: "Послугу не знайдено."
        });
      }

      await pool.execute(
        `UPDATE services
         SET status = 'inactive',
             site_visible = 0
         WHERE id = ?`,
        [serviceId]
      );

      res.json({
        success: true,
        message: "Послугу приховано та деактивовано.",
        serviceId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося деактивувати послугу.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   ПУБЛІЧНІ ФОТОГРАФИ
========================================================= */

app.get("/api/photographers/public", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         users.id,
         users.full_name,
         photographer_profiles.experience,
         photographer_profiles.bio,
         photographer_profiles.image_url,
         photographer_profiles.display_order
       FROM users
       LEFT JOIN photographer_profiles
         ON photographer_profiles.photographer_id = users.id
       WHERE users.role = 'photographer'
         AND users.status = 'active'
         AND COALESCE(photographer_profiles.site_visible, 1) = 1
       ORDER BY photographer_profiles.display_order ASC, users.full_name ASC`
    );

    res.json({
      success: true,
      photographers: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Не вдалося отримати фотографів.",
      error: error.message
    });
  }
});

/* =========================================================
   АДМІН: CRUD ФОТОГРАФІВ
========================================================= */

app.get(
  "/api/admin/photographers",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
           users.id,
           users.full_name,
           users.email,
           users.phone,
           users.instagram,
           users.status,
           photographer_profiles.experience,
           photographer_profiles.bio,
           photographer_profiles.image_url,
           photographer_profiles.site_visible,
           photographer_profiles.display_order
         FROM users
         LEFT JOIN photographer_profiles
           ON photographer_profiles.photographer_id = users.id
         WHERE users.role = 'photographer'
         ORDER BY users.full_name ASC`
      );

      res.json({
        success: true,
        photographers: rows
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося отримати фотографів.",
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/photographers",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const {
      fullName,
      email,
      phone,
      instagram,
      password,
      status,
      experience,
      bio,
      imageUrl,
      siteVisible,
      displayOrder
    } = req.body;

    let connection;

    try {
      const safeFullName = String(fullName || "").trim();
      const safeEmail = normalizeEmail(email);
      const safePhone = normalizeNullableString(phone);

      if (!safeFullName) {
        return res.status(400).json({
          success: false,
          message: "Ім'я фотографа є обов'язковим."
        });
      }

      if (safeEmail && !isValidEmail(safeEmail)) {
        return res.status(400).json({
          success: false,
          message: "Введіть коректний email фотографа."
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      if (safeEmail) {
        const [emailRows] = await connection.execute(
          "SELECT id FROM users WHERE email = ? LIMIT 1",
          [safeEmail]
        );

        if (emailRows.length) {
          throw new Error("Користувач з таким email вже існує.");
        }
      }

      if (safePhone) {
        const [phoneRows] = await connection.execute(
          "SELECT id FROM users WHERE phone = ? LIMIT 1",
          [safePhone]
        );

        if (phoneRows.length) {
          throw new Error("Користувач з таким телефоном вже існує.");
        }
      }

      const passwordHash = password
        ? await bcrypt.hash(String(password), 10)
        : null;

      const safeStatus = USER_STATUSES.includes(status)
        ? status
        : "active";

      const [userResult] = await connection.execute(
        `INSERT INTO users
          (
            role,
            full_name,
            email,
            phone,
            instagram,
            password_hash,
            status
          )
         VALUES
          ('photographer', ?, ?, ?, ?, ?, ?)`,
        [
          safeFullName,
          safeEmail || null,
          safePhone,
          normalizeNullableString(instagram),
          passwordHash,
          safeStatus
        ]
      );

      const photographerId = userResult.insertId;

      await connection.execute(
        `INSERT INTO photographer_profiles
          (
            photographer_id,
            experience,
            bio,
            image_url,
            site_visible,
            display_order
          )
         VALUES
          (?, ?, ?, ?, ?, ?)`,
        [
          photographerId,
          normalizeNullableString(experience),
          normalizeNullableString(bio),
          normalizeNullableString(imageUrl),
          siteVisible === false || siteVisible === 0 ? 0 : 1,
          toPositiveInt(displayOrder, 0)
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Фотографа додано.",
        photographerId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося додати фотографа."
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

app.put(
  "/api/admin/photographers/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const photographerId = req.params.id;
    const {
      fullName,
      email,
      phone,
      instagram,
      password,
      status,
      experience,
      bio,
      imageUrl,
      siteVisible,
      displayOrder
    } = req.body;

    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [existingRows] = await connection.execute(
        `SELECT id
         FROM users
         WHERE id = ?
           AND role = 'photographer'
         LIMIT 1`,
        [photographerId]
      );

      if (!existingRows.length) {
        throw new Error("Фотографа не знайдено.");
      }

      const safeFullName = String(fullName || "").trim();
      const safeEmail = normalizeEmail(email);
      const safePhone = normalizeNullableString(phone);

      if (!safeFullName) {
        throw new Error("Ім'я фотографа є обов'язковим.");
      }

      if (safeEmail && !isValidEmail(safeEmail)) {
        throw new Error("Введіть коректний email фотографа.");
      }

      if (safeEmail) {
        const [emailRows] = await connection.execute(
          "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1",
          [safeEmail, photographerId]
        );

        if (emailRows.length) {
          throw new Error("Інший користувач з таким email вже існує.");
        }
      }

      if (safePhone) {
        const [phoneRows] = await connection.execute(
          "SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1",
          [safePhone, photographerId]
        );

        if (phoneRows.length) {
          throw new Error("Інший користувач з таким телефоном вже існує.");
        }
      }

      const safeStatus = USER_STATUSES.includes(status)
        ? status
        : "active";

      await connection.execute(
        `UPDATE users
         SET
           full_name = ?,
           email = ?,
           phone = ?,
           instagram = ?,
           status = ?
         WHERE id = ?`,
        [
          safeFullName,
          safeEmail || null,
          safePhone,
          normalizeNullableString(instagram),
          safeStatus,
          photographerId
        ]
      );

      if (password) {
        const passwordHash = await bcrypt.hash(String(password), 10);

        await connection.execute(
          "UPDATE users SET password_hash = ? WHERE id = ?",
          [passwordHash, photographerId]
        );
      }

      await connection.execute(
        `INSERT INTO photographer_profiles
          (
            photographer_id,
            experience,
            bio,
            image_url,
            site_visible,
            display_order
          )
         VALUES
          (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           experience = VALUES(experience),
           bio = VALUES(bio),
           image_url = VALUES(image_url),
           site_visible = VALUES(site_visible),
           display_order = VALUES(display_order)`,
        [
          photographerId,
          normalizeNullableString(experience),
          normalizeNullableString(bio),
          normalizeNullableString(imageUrl),
          siteVisible === false || siteVisible === 0 ? 0 : 1,
          toPositiveInt(displayOrder, 0)
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Дані фотографа оновлено.",
        photographerId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося оновити фотографа."
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

app.delete(
  "/api/admin/photographers/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const photographerId = req.params.id;

    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        `SELECT id
         FROM users
         WHERE id = ?
           AND role = 'photographer'
         LIMIT 1`,
        [photographerId]
      );

      if (!rows.length) {
        throw new Error("Фотографа не знайдено.");
      }

      await connection.execute(
        `UPDATE users
         SET status = 'inactive'
         WHERE id = ?`,
        [photographerId]
      );

      await connection.execute(
        `UPDATE photographer_profiles
         SET site_visible = 0
         WHERE photographer_id = ?`,
        [photographerId]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Фотографа деактивовано.",
        photographerId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося деактивувати фотографа."
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

/* =========================================================
   АДМІН: ГРАФІК ФОТОГРАФІВ
========================================================= */

app.get(
  "/api/admin/photographers/:id/schedule",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const photographerId = req.params.id;
    const dateFrom = req.query.dateFrom || null;
    const dateTo = req.query.dateTo || null;

    try {
      let query = `
        SELECT
          id,
          photographer_id,
          work_date,
          start_time,
          end_time,
          slot_type,
          comment
        FROM photographer_schedule
        WHERE photographer_id = ?
      `;

      const params = [photographerId];

      if (dateFrom) {
        query += " AND work_date >= ?";
        params.push(assertValidBookingDate(dateFrom));
      }

      if (dateTo) {
        query += " AND work_date <= ?";
        params.push(assertValidBookingDate(dateTo));
      }

      query += " ORDER BY work_date ASC, start_time ASC";

      const [rows] = await pool.execute(query, params);

      res.json({
        success: true,
        schedule: rows
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося отримати графік фотографа."
      });
    }
  }
);

app.post(
  "/api/admin/photographers/:id/schedule",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const photographerId = req.params.id;
    const {
      workDate,
      startTime,
      endTime,
      slotType,
      comment
    } = req.body;

    let connection;

    try {
      if (!SCHEDULE_SLOT_TYPES.includes(slotType)) {
        return res.status(400).json({
          success: false,
          message: "Некоректний тип слота графіка."
        });
      }

      const safeDate = assertValidBookingDate(workDate);
      const safeStart = slotType === "day_off"
        ? STUDIO_OPEN
        : normalizeTime(startTime);
      const safeEnd = slotType === "day_off"
        ? STUDIO_CLOSE
        : normalizeTime(endTime);

      if (timeToMinutes(safeEnd) <= timeToMinutes(safeStart)) {
        return res.status(400).json({
          success: false,
          message: "Час завершення має бути пізніше часу початку."
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [photographerRows] = await connection.execute(
        `SELECT id
         FROM users
         WHERE id = ?
           AND role = 'photographer'
           AND status = 'active'
         LIMIT 1`,
        [photographerId]
      );

      if (!photographerRows.length) {
        throw new Error("Активного фотографа не знайдено.");
      }

      const [dayOffRows] = await connection.execute(
        `SELECT id
         FROM photographer_schedule
         WHERE photographer_id = ?
           AND work_date = ?
           AND slot_type = 'day_off'
         LIMIT 1`,
        [photographerId, safeDate]
      );

      if (dayOffRows.length && slotType !== "day_off") {
        throw new Error("На цю дату вже встановлено вихідний фотографа.");
      }

      if (slotType === "day_off") {
        const [anyRows] = await connection.execute(
          `SELECT id
           FROM photographer_schedule
           WHERE photographer_id = ?
             AND work_date = ?
           LIMIT 1`,
          [photographerId, safeDate]
        );

        if (anyRows.length) {
          throw new Error("На цю дату вже є записи графіка. Спочатку видаліть їх.");
        }
      } else {
        const [sameTypeOverlap] = await connection.execute(
          `SELECT id
           FROM photographer_schedule
           WHERE photographer_id = ?
             AND work_date = ?
             AND slot_type = ?
             AND NOT (end_time <= ? OR start_time >= ?)
           LIMIT 1`,
          [photographerId, safeDate, slotType, safeStart, safeEnd]
        );

        if (sameTypeOverlap.length) {
          throw new Error("У графіку вже є накладений слот такого ж типу.");
        }
      }

      const [result] = await connection.execute(
        `INSERT INTO photographer_schedule
          (
            photographer_id,
            work_date,
            start_time,
            end_time,
            slot_type,
            comment
          )
         VALUES
          (?, ?, ?, ?, ?, ?)`,
        [
          photographerId,
          safeDate,
          safeStart,
          safeEnd,
          slotType,
          normalizeNullableString(comment)
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Слот графіка додано.",
        scheduleId: result.insertId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося додати слот графіка."
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

app.delete(
  "/api/admin/photographer-schedule/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const scheduleId = req.params.id;

    try {
      await pool.execute(
        "DELETE FROM photographer_schedule WHERE id = ?",
        [scheduleId]
      );

      res.json({
        success: true,
        message: "Слот графіка видалено.",
        scheduleId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося видалити слот графіка.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   ПУБЛІЧНІ ЗАЛИ
========================================================= */

app.get("/api/halls/public", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         name,
         description,
         capacity,
         price_per_hour
       FROM halls
       WHERE status = 'available'
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      halls: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Не вдалося отримати зали.",
      error: error.message
    });
  }
});

/* =========================================================
   ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ БРОНЮВАННЯ
========================================================= */

async function getBookingClientId(connection, req, data) {
  if (req.user.role === "client") {
    const fullName = data.clientName || req.user.fullName;
    const phone = data.clientPhone || req.user.phone || null;
    const instagram = data.clientInstagram || null;

    await connection.execute(
      `UPDATE users
       SET full_name = ?,
           phone = ?,
           instagram = ?
       WHERE id = ?`,
      [
        fullName,
        normalizeNullableString(phone),
        normalizeNullableString(instagram),
        req.user.id
      ]
    );

    return req.user.id;
  }

  if (req.user.role === "admin") {
    if (data.clientId) {
      const [clientRows] = await connection.execute(
        `SELECT id
         FROM users
         WHERE id = ?
           AND role = 'client'
         LIMIT 1`,
        [data.clientId]
      );

      if (!clientRows.length) {
        throw new Error("Обраного клієнта не знайдено.");
      }

      return clientRows[0].id;
    }

    const fullName = data.clientName || "Клієнт без імені";
    const phone = normalizeNullableString(data.clientPhone);
    const email = normalizeEmail(data.clientEmail);
    const instagram = normalizeNullableString(data.clientInstagram);

    if (!phone && !email) {
      throw new Error("Для бронювання клієнта потрібен телефон або email.");
    }

    if (email) {
      const [existingByEmail] = await connection.execute(
        `SELECT id
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [email]
      );

      if (existingByEmail.length) {
        return existingByEmail[0].id;
      }
    }

    if (phone) {
      const [existingByPhone] = await connection.execute(
        `SELECT id
         FROM users
         WHERE phone = ?
         LIMIT 1`,
        [phone]
      );

      if (existingByPhone.length) {
        return existingByPhone[0].id;
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO users
        (
          role,
          full_name,
          email,
          phone,
          instagram,
          status
        )
       VALUES
        ('client', ?, ?, ?, ?, 'active')`,
      [
        fullName,
        email || null,
        phone,
        instagram
      ]
    );

    return result.insertId;
  }

  throw new Error("Недостатньо прав для створення бронювання.");
}

async function findOrCreateHall(connection, hallName) {
  const name = String(hallName || "").trim();

  if (!name) {
    return null;
  }

  if (!isRealStudioHall(name)) {
    return null;
  }

  const [existing] = await connection.execute(
    `SELECT id, status
     FROM halls
     WHERE name = ?
     LIMIT 1`,
    [name]
  );

  if (existing.length) {
    if (existing[0].status !== "available") {
      throw new Error(`Зал "${name}" зараз недоступний.`);
    }

    return existing[0].id;
  }

  const [result] = await connection.execute(
    `INSERT INTO halls
      (
        name,
        description,
        capacity,
        price_per_hour,
        status
      )
     VALUES
      (?, 'Автоматично додано із заявки сайту', 0, 0.00, 'available')`,
    [name]
  );

  return result.insertId;
}

async function findExistingHallForAvailability(connection, hallName) {
  const name = String(hallName || "").trim();

  if (!name || !isRealStudioHall(name)) {
    return null;
  }

  const [rows] = await connection.execute(
    `SELECT id
     FROM halls
     WHERE name = ?
       AND status = 'available'
     LIMIT 1`,
    [name]
  );

  return rows.length ? rows[0].id : null;
}

async function findPhotographerByName(connection, photographerName) {
  const name = String(photographerName || "").trim();

  if (!name || name === "Порадьте фотографа") {
    return null;
  }

  const [rows] = await connection.execute(
    `SELECT id, status
     FROM users
     WHERE role = 'photographer'
       AND full_name = ?
     LIMIT 1`,
    [name]
  );

  if (!rows.length) {
    throw new Error("Такого фотографа немає в системі.");
  }

  if (rows[0].status !== "active") {
    throw new Error(`Фотограф "${name}" зараз недоступний.`);
  }

  return rows[0].id;
}

async function findPhotographerById(connection, photographerId) {
  if (!photographerId) return null;

  const [rows] = await connection.execute(
    `SELECT id, status
     FROM users
     WHERE role = 'photographer'
       AND id = ?
     LIMIT 1`,
    [photographerId]
  );

  if (!rows.length) {
    throw new Error("Такого фотографа немає в системі.");
  }

  if (rows[0].status !== "active") {
    throw new Error("Обраний фотограф зараз недоступний.");
  }

  return rows[0].id;
}

async function findServiceByName(connection, serviceName) {
  const name = String(serviceName || "").trim();

  const [rows] = await connection.execute(
    `SELECT
       id,
       name,
       category,
       price,
       duration_minutes,
       status
     FROM services
     WHERE name = ?
     LIMIT 1`,
    [name]
  );

  return rows[0] || null;
}

async function findOrCreateService(connection, serviceName, category) {
  const name = String(serviceName || "").trim();

  if (!name) {
    throw new Error("Назва послуги відсутня.");
  }

  if (name.toLowerCase().includes("аерозйомка")) {
    throw new Error("Аерозйомка тимчасово недоступна.");
  }

  const existing = await findServiceByName(connection, name);

  if (existing) {
    if (existing.status !== "active") {
      throw new Error(`Послуга "${name}" зараз недоступна.`);
    }

    return {
      id: existing.id,
      name: existing.name,
      category: existing.category,
      price: Number(existing.price || 0),
      duration_minutes: Number(existing.duration_minutes || 0),
      status: existing.status
    };
  }

  const defaults = getServiceDefaults(name);
  const safeCategory = SERVICE_CATEGORIES.includes(category)
    ? category
    : defaults.category || "main";

  const [result] = await connection.execute(
    `INSERT INTO services
      (
        name,
        category,
        description,
        price,
        duration_minutes,
        status,
        site_visible,
        display_order
      )
     VALUES
      (?, ?, 'Автоматично додано із заявки сайту', ?, ?, 'active', 1, 0)`,
    [
      name,
      safeCategory,
      Number(defaults.price || 0),
      Number(defaults.duration || 0)
    ]
  );

  return {
    id: result.insertId,
    name,
    category: safeCategory,
    price: Number(defaults.price || 0),
    duration_minutes: Number(defaults.duration || 0),
    status: "active"
  };
}

async function getBookableServiceDurationMinutes(connection, serviceName) {
  const service = await findServiceByName(connection, serviceName);

  if (service) {
    if (service.status !== "active") {
      throw new Error("Обрана послуга зараз недоступна.");
    }

    const duration = Number(service.duration_minutes || 0);

    if (duration > 0) {
      return duration;
    }
  }

  const defaults = getServiceDefaults(serviceName);
  const fallbackDuration = Number(defaults.duration || 0);

  if (!fallbackDuration || fallbackDuration <= 0) {
    throw new Error("Для цієї послуги не задано коректну тривалість.");
  }

  return fallbackDuration;
}

/* =========================================================
   ПЕРЕВІРКИ КОНФЛІКТІВ
========================================================= */

async function checkPhotographerSchedule(
  connection,
  photographerId,
  bookingDate,
  startTime,
  endTime
) {
  if (!photographerId) return;

  const [scheduleRows] = await connection.execute(
    `SELECT
       id,
       start_time,
       end_time,
       slot_type,
       comment
     FROM photographer_schedule
     WHERE photographer_id = ?
       AND work_date = ?`,
    [photographerId, bookingDate]
  );

  if (!scheduleRows.length) {
    return;
  }

  const hasDayOff = scheduleRows.some(
    (row) => row.slot_type === "day_off"
  );

  if (hasDayOff) {
    throw new Error("У вибраного фотографа вихідний у цей день.");
  }

  const hasBlockedOverlap = scheduleRows.some((row) => {
    if (!["blocked", "break"].includes(row.slot_type)) {
      return false;
    }

    return !(
      timeToMinutes(row.end_time) <= timeToMinutes(startTime) ||
      timeToMinutes(row.start_time) >= timeToMinutes(endTime)
    );
  });

  if (hasBlockedOverlap) {
    throw new Error("У вибраного фотографа цей час заблокований або перерва.");
  }

  const workingSlots = scheduleRows.filter(
    (row) => row.slot_type === "working"
  );

  if (workingSlots.length) {
    const fitsWorkingSlot = workingSlots.some((row) => {
      return (
        timeToMinutes(startTime) >= timeToMinutes(row.start_time) &&
        timeToMinutes(endTime) <= timeToMinutes(row.end_time)
      );
    });

    if (!fitsWorkingSlot) {
      throw new Error("Вибраний час не входить у робочий графік фотографа.");
    }
  }
}

async function checkPhotographerBookingConflict(
  connection,
  photographerId,
  bookingDate,
  startTime,
  endTime,
  excludeBookingId = null
) {
  if (!photographerId) return;

  let query = `
    SELECT id
    FROM bookings
    WHERE photographer_id = ?
      AND booking_date = ?
      AND status != 'cancelled'
      AND NOT (end_time <= ? OR start_time >= ?)
  `;

  const params = [
    photographerId,
    bookingDate,
    startTime,
    endTime
  ];

  if (excludeBookingId) {
    query += " AND id != ?";
    params.push(excludeBookingId);
  }

  const [rows] = await connection.execute(query, params);

  if (rows.length) {
    throw new Error("Цей фотограф уже зайнятий у вибраний час.");
  }
}

async function checkHallBookingConflict(
  connection,
  hallId,
  hallName,
  bookingDate,
  startTime,
  endTime,
  excludeBookingId = null
) {
  if (!hallId || !isRealStudioHall(hallName)) return;

  let query = `
    SELECT id
    FROM bookings
    WHERE hall_id = ?
      AND booking_date = ?
      AND status != 'cancelled'
      AND NOT (end_time <= ? OR start_time >= ?)
  `;

  const params = [
    hallId,
    bookingDate,
    startTime,
    endTime
  ];

  if (excludeBookingId) {
    query += " AND id != ?";
    params.push(excludeBookingId);
  }

  const [rows] = await connection.execute(query, params);

  if (rows.length) {
    throw new Error("Цей зал уже зайнятий у вибраний час.");
  }
}

async function checkClientBookingConflict(
  connection,
  clientId,
  bookingDate,
  startTime,
  endTime,
  excludeBookingId = null
) {
  if (!clientId) return;

  let query = `
    SELECT id
    FROM bookings
    WHERE client_id = ?
      AND booking_date = ?
      AND status != 'cancelled'
      AND NOT (end_time <= ? OR start_time >= ?)
  `;

  const params = [
    clientId,
    bookingDate,
    startTime,
    endTime
  ];

  if (excludeBookingId) {
    query += " AND id != ?";
    params.push(excludeBookingId);
  }

  const [rows] = await connection.execute(query, params);

  if (rows.length) {
    throw new Error("У клієнта вже є інше бронювання на цей час.");
  }
}

async function checkClientDailyLimit(
  connection,
  clientId,
  bookingDate,
  excludeBookingId = null
) {
  let query = `
    SELECT COUNT(*) AS cnt
    FROM bookings
    WHERE client_id = ?
      AND booking_date = ?
      AND status != 'cancelled'
  `;

  const params = [clientId, bookingDate];

  if (excludeBookingId) {
    query += " AND id != ?";
    params.push(excludeBookingId);
  }

  const [rows] = await connection.execute(query, params);

  if (Number(rows[0].cnt) >= MAX_BOOKINGS_PER_CLIENT_PER_DAY) {
    throw new Error(
      `На одну дату можна створити не більше ${MAX_BOOKINGS_PER_CLIENT_PER_DAY} бронювань.`
    );
  }
}

async function lockBookingResources(
  connection,
  {
    bookingDate,
    clientId,
    photographerId,
    hallId,
    hallName
  }
) {
  const safeDate = assertValidBookingDate(bookingDate);

  const resources = [];

  if (clientId) {
    resources.push(["client", clientId]);
  }

  if (photographerId) {
    resources.push(["photographer", photographerId]);
  }

  if (hallId && isRealStudioHall(hallName)) {
    resources.push(["hall", hallId]);
  }

  for (const [resourceType, resourceId] of resources) {
    await connection.execute(
      `INSERT IGNORE INTO booking_resource_locks
        (resource_type, resource_id, booking_date)
       VALUES
        (?, ?, ?)`,
      [resourceType, resourceId, safeDate]
    );

    await connection.execute(
      `SELECT resource_type
       FROM booking_resource_locks
       WHERE resource_type = ?
         AND resource_id = ?
         AND booking_date = ?
       FOR UPDATE`,
      [resourceType, resourceId, safeDate]
    );
  }
}

async function validateBookingAvailability(connection, options) {
  const {
    bookingDate,
    startTime,
    endTime,
    hallId,
    hallName,
    photographerId,
    clientId,
    serviceName,
    excludeBookingId = null
  } = options;

  const safeBookingDate = assertValidBookingDate(bookingDate);
  const safeStartTime = normalizeTime(startTime);
  const safeEndTime = normalizeTime(endTime);

  if (!isWithinWorkingHours(safeStartTime, safeEndTime)) {
    throw new Error("Lumina працює з 09:00 до 20:00. Оберіть інший час.");
  }

  if (isPastDateTime(safeBookingDate, safeStartTime)) {
    throw new Error("Не можна створити бронювання на минулу дату або час.");
  }

  if (isTooSoon(safeBookingDate, safeStartTime)) {
    throw new Error(
      `Бронювання можливе мінімум за ${MIN_BOOKING_BUFFER_HOURS} години до початку.`
    );
  }

  const duration = timeToMinutes(safeEndTime) - timeToMinutes(safeStartTime);

  if (duration <= 0) {
    throw new Error("Час завершення має бути пізніше часу початку.");
  }

  if (duration > 660) {
    throw new Error("Тривалість бронювання не може перевищувати 11 годин.");
  }

  if (
    isHallRentalWithoutPhotographer(serviceName) &&
    photographerId
  ) {
    throw new Error("Для цієї послуги фотограф студії не потрібен.");
  }

  await checkPhotographerSchedule(
    connection,
    photographerId,
    safeBookingDate,
    safeStartTime,
    safeEndTime
  );

  await checkPhotographerBookingConflict(
    connection,
    photographerId,
    safeBookingDate,
    safeStartTime,
    safeEndTime,
    excludeBookingId
  );

  await checkHallBookingConflict(
    connection,
    hallId,
    hallName,
    safeBookingDate,
    safeStartTime,
    safeEndTime,
    excludeBookingId
  );

  await checkClientBookingConflict(
    connection,
    clientId,
    safeBookingDate,
    safeStartTime,
    safeEndTime,
    excludeBookingId
  );
}

/* =========================================================
   ВІЛЬНІ ДАТИ
========================================================= */

app.get("/api/available-dates", async (req, res) => {
  const {
    service,
    photographer,
    photographerId,
    hall
  } = req.query;

  try {
    if (!service) {
      return res.status(400).json({
        success: false,
        message: "Оберіть послугу."
      });
    }

    const needsPhotographer = serviceNeedsPhotographer(service);
    const rentalWithoutPhotographer =
      isHallRentalWithoutPhotographer(service);
    const outdoor = isOutdoorService(service);

    if (
      needsPhotographer &&
      !photographer &&
      !photographerId
    ) {
      return res.status(400).json({
        success: false,
        message: "Для перегляду вільних дат оберіть фотографа."
      });
    }

    if (!outdoor && (!hall || !isRealStudioHall(hall))) {
      return res.status(400).json({
        success: false,
        message: "Оберіть зал."
      });
    }

    if (
      rentalWithoutPhotographer &&
      (!hall || !isRealStudioHall(hall))
    ) {
      return res.status(400).json({
        success: false,
        message: "Для оренди студії потрібно обрати зал."
      });
    }

    const durationMinutes = await getBookableServiceDurationMinutes(
      pool,
      service
    );

    let selectedPhotographerId = null;

    if (needsPhotographer) {
      if (photographerId) {
        selectedPhotographerId = await findPhotographerById(
          pool,
          photographerId
        );
      } else {
        selectedPhotographerId = await findPhotographerByName(
          pool,
          photographer
        );
      }

      if (!selectedPhotographerId) {
        return res.status(404).json({
          success: false,
          message: "Фотографа не знайдено."
        });
      }
    }

    let hallId = null;

    if (!outdoor) {
      hallId = await findExistingHallForAvailability(pool, hall);

      if (!hallId) {
        return res.status(404).json({
          success: false,
          message: "Зал не знайдено або він недоступний."
        });
      }
    }

    const availableDates = [];
    const unavailableDates = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openMinutes = timeToMinutes(STUDIO_OPEN);
    const closeMinutes = timeToMinutes(STUDIO_CLOSE);
    const stepMinutes = 30;

    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + dayOffset);

      const dateStr = formatLocalDate(checkDate);
      let hasAvailableSlot = false;

      for (
        let startMinutes = openMinutes;
        startMinutes + durationMinutes <= closeMinutes;
        startMinutes += stepMinutes
      ) {
        const startTime = minutesToTime(startMinutes);
        const endTime = minutesToTime(startMinutes + durationMinutes);

        try {
          await validateBookingAvailability(pool, {
            bookingDate: dateStr,
            startTime,
            endTime,
            hallId,
            hallName: hall,
            photographerId: selectedPhotographerId,
            clientId: null,
            serviceName: service
          });

          hasAvailableSlot = true;
          break;
        } catch (error) {
          // слот недоступний
        }
      }

      if (hasAvailableSlot) {
        availableDates.push(dateStr);
      } else {
        unavailableDates.push(dateStr);
      }
    }

    res.json({
      success: true,
      availableDates,
      unavailableDates,
      durationMinutes
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Не вдалося отримати вільні дати."
    });
  }
});

/* =========================================================
   ВІЛЬНІ ГОДИНИ
========================================================= */

app.get("/api/available-times", async (req, res) => {
  const {
    service,
    bookingDate,
    photographer,
    photographerId,
    hall
  } = req.query;

  try {
    if (!service || !bookingDate) {
      return res.status(400).json({
        success: false,
        message: "Оберіть послугу та дату."
      });
    }

    const needsPhotographer = serviceNeedsPhotographer(service);
    const rentalWithoutPhotographer =
      isHallRentalWithoutPhotographer(service);
    const outdoor = isOutdoorService(service);

    if (
      needsPhotographer &&
      !photographer &&
      !photographerId
    ) {
      return res.status(400).json({
        success: false,
        message: "Для перегляду вільних годин оберіть фотографа."
      });
    }

    if (!outdoor && (!hall || !isRealStudioHall(hall))) {
      return res.status(400).json({
        success: false,
        message: "Оберіть зал."
      });
    }

    if (
      rentalWithoutPhotographer &&
      (!hall || !isRealStudioHall(hall))
    ) {
      return res.status(400).json({
        success: false,
        message: "Для оренди студії потрібно обрати зал."
      });
    }

    const durationMinutes = await getBookableServiceDurationMinutes(
      pool,
      service
    );

    let selectedPhotographerId = null;

    if (needsPhotographer) {
      if (photographerId) {
        selectedPhotographerId = await findPhotographerById(
          pool,
          photographerId
        );
      } else {
        selectedPhotographerId = await findPhotographerByName(
          pool,
          photographer
        );
      }

      if (!selectedPhotographerId) {
        return res.status(404).json({
          success: false,
          message: "Фотографа не знайдено."
        });
      }
    }

    let hallId = null;

    if (!outdoor) {
      hallId = await findExistingHallForAvailability(pool, hall);

      if (!hallId) {
        return res.status(404).json({
          success: false,
          message: "Зал не знайдено або він недоступний."
        });
      }
    }

    const safeDate = assertValidBookingDate(bookingDate);

    const openMinutes = timeToMinutes(STUDIO_OPEN);
    const closeMinutes = timeToMinutes(STUDIO_CLOSE);
    const stepMinutes = 30;

    const slots = [];

    for (
      let startMinutes = openMinutes;
      startMinutes + durationMinutes <= closeMinutes;
      startMinutes += stepMinutes
    ) {
      const startTime = minutesToTime(startMinutes);
      const endTime = minutesToTime(startMinutes + durationMinutes);

      try {
        await validateBookingAvailability(pool, {
          bookingDate: safeDate,
          startTime,
          endTime,
          hallId,
          hallName: hall,
          photographerId: selectedPhotographerId,
          clientId: null,
          serviceName: service
        });

        slots.push({
          startTime: startTime.slice(0, 5),
          endTime: endTime.slice(0, 5),
          label: `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`
        });
      } catch (error) {
        // слот недоступний
      }
    }

    res.json({
      success: true,
      durationMinutes,
      slots
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Не вдалося отримати вільні години."
    });
  }
});

/* =========================================================
   СТВОРЕННЯ БРОНЮВАННЯ
========================================================= */

app.post(
  "/api/bookings",
  requireAuth,
  requireRole(["client", "admin"]),
  async (req, res) => {
    const data = req.body;
    let connection;

    try {
      if (!data.service || !data.bookingDate || !data.bookingTime) {
        return res.status(400).json({
          success: false,
          message: "Оберіть послугу, дату і час."
        });
      }

      checkDuplicateServices(
        data.additionalServices,
        data.service
      );

      const needsPhotographer = serviceNeedsPhotographer(data.service);
      const rentalWithoutPhotographer =
        isHallRentalWithoutPhotographer(data.service);
      const outdoor = isOutdoorService(data.service);

      if (!outdoor && (!data.hall || !isRealStudioHall(data.hall))) {
        return res.status(400).json({
          success: false,
          message: "Оберіть зал."
        });
      }

      if (
        rentalWithoutPhotographer &&
        (!data.hall || !isRealStudioHall(data.hall))
      ) {
        return res.status(400).json({
          success: false,
          message: "Для оренди студії потрібно обрати зал."
        });
      }

      if (
        req.user.role === "client" &&
        needsPhotographer &&
        !data.photographer &&
        !data.photographerId
      ) {
        return res.status(400).json({
          success: false,
          message: "Для цієї послуги потрібно обрати фотографа."
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const clientId = await getBookingClientId(
        connection,
        req,
        data
      );

      let hallId = null;

      if (!outdoor) {
        hallId = await findOrCreateHall(connection, data.hall);
      }

      let photographerId = null;

      if (needsPhotographer) {
        if (data.photographerId) {
          photographerId = await findPhotographerById(
            connection,
            data.photographerId
          );
        } else if (data.photographer) {
          photographerId = await findPhotographerByName(
            connection,
            data.photographer
          );
        }
      }

      const selectedServices = [
        {
          name: data.service,
          category: "main"
        }
      ];

      if (Array.isArray(data.additionalServices)) {
        data.additionalServices.forEach((serviceName) => {
          selectedServices.push({
            name: serviceName,
            category: "additional"
          });
        });
      }

      const serviceRows = [];
      let totalAmount = 0;

      for (const item of selectedServices) {
        const service = await findOrCreateService(
          connection,
          item.name,
          item.category
        );

        serviceRows.push(service);
        totalAmount += Number(service.price || 0);
      }

      const durationMinutes = await getBookableServiceDurationMinutes(
        connection,
        data.service
      );

      const startTime = normalizeTime(data.bookingTime);
      const endTime = addMinutesToTime(startTime, durationMinutes);

      await lockBookingResources(connection, {
        bookingDate: data.bookingDate,
        clientId,
        photographerId,
        hallId,
        hallName: data.hall
      });

      await checkClientDailyLimit(
        connection,
        clientId,
        data.bookingDate
      );

      await validateBookingAvailability(connection, {
        bookingDate: data.bookingDate,
        startTime,
        endTime,
        hallId,
        hallName: data.hall,
        photographerId,
        clientId,
        serviceName: data.service
      });

      const [bookingResult] = await connection.execute(
        `INSERT INTO bookings
          (
            client_id,
            photographer_id,
            hall_id,
            booking_date,
            start_time,
            end_time,
            status,
            prepayment_amount,
            total_amount,
            comment
          )
         VALUES
          (?, ?, ?, ?, ?, ?, 'new', 0.00, ?, ?)`,
        [
          clientId,
          photographerId,
          hallId,
          data.bookingDate,
          startTime,
          endTime,
          toMoney(totalAmount, 0),
          normalizeNullableString(data.message)
        ]
      );

      const bookingId = bookingResult.insertId;

      for (const service of serviceRows) {
        await connection.execute(
          `INSERT INTO booking_services
            (
              booking_id,
              service_id,
              quantity,
              price_at_moment
            )
           VALUES
            (?, ?, 1, ?)`,
          [
            bookingId,
            service.id,
            toMoney(service.price, 0)
          ]
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: "Заявку на бронювання збережено.",
        bookingId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося зберегти бронювання."
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

/* =========================================================
   КЛІЄНТ: СКАСУВАННЯ
========================================================= */

app.patch(
  "/api/bookings/:id/cancel-client",
  requireAuth,
  requireRole(["client"]),
  async (req, res) => {
    const bookingId = req.params.id;

    try {
      const [rows] = await pool.execute(
        `SELECT
           id,
           status,
           booking_date,
           start_time
         FROM bookings
         WHERE id = ?
           AND client_id = ?
         LIMIT 1`,
        [bookingId, req.user.id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: "Бронювання не знайдено або не належить вам."
        });
      }

      const booking = rows[0];

      if (booking.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Бронювання вже скасоване."
        });
      }

      if (booking.status === "completed") {
        return res.status(400).json({
          success: false,
          message: "Не можна скасувати завершене бронювання."
        });
      }

      const bookingDateTime = buildLocalDateTime(
        booking.booking_date,
        booking.start_time
      );

      const now = new Date();
      const diffHours =
        (bookingDateTime - now) / (1000 * 60 * 60);

      if (diffHours < 24) {
        return res.status(400).json({
          success: false,
          message:
            "Скасування можливе не пізніше ніж за 24 години до початку. Зверніться до адміністратора."
        });
      }

      await pool.execute(
        `UPDATE bookings
         SET status = 'cancelled'
         WHERE id = ?`,
        [bookingId]
      );

      res.json({
        success: true,
        message: "Бронювання скасовано.",
        bookingId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося скасувати бронювання.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   CALLBACK
========================================================= */

app.post("/api/callback", async (req, res) => {
  const {
    callbackName,
    callbackPhone
  } = req.body;

  try {
    if (!callbackName || !callbackPhone) {
      return res.status(400).json({
        success: false,
        message: "Заповніть ім'я і телефон."
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO callback_requests
        (
          callback_name,
          callback_phone,
          status
        )
       VALUES
        (?, ?, 'new')`,
      [
        String(callbackName).trim(),
        String(callbackPhone).trim()
      ]
    );

    res.json({
      success: true,
      message: "Запит на дзвінок збережено.",
      callbackId: result.insertId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Не вдалося зберегти заявку на дзвінок.",
      error: error.message
    });
  }
});

/* =========================================================
   АДМІН: ПОШУК КЛІЄНТІВ
========================================================= */

app.get(
  "/api/admin/clients/search",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();

      if (!q) {
        return res.json({
          success: true,
          clients: []
        });
      }

      const like = `%${q}%`;

      const [rows] = await pool.execute(
        `SELECT
           users.id,
           users.full_name,
           users.email,
           users.phone,
           users.instagram,
           users.status,
           COUNT(DISTINCT bookings.id) AS bookings_count,
           COALESCE(SUM(
             CASE
               WHEN bookings.status != 'cancelled'
               THEN bookings.total_amount
               ELSE 0
             END
           ), 0) AS total_booked_amount
         FROM users
         LEFT JOIN bookings
           ON bookings.client_id = users.id
         WHERE users.role = 'client'
           AND (
             users.full_name LIKE ?
             OR users.email LIKE ?
             OR users.phone LIKE ?
             OR users.instagram LIKE ?
           )
         GROUP BY
           users.id,
           users.full_name,
           users.email,
           users.phone,
           users.instagram,
           users.status
         ORDER BY users.full_name ASC
         LIMIT 30`,
        [like, like, like, like]
      );

      res.json({
        success: true,
        clients: rows
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося виконати пошук клієнтів.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   АДМІН: КАРТКА КЛІЄНТА
========================================================= */

app.get(
  "/api/admin/clients/:id/summary",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const clientId = req.params.id;

    try {
      const [clientRows] = await pool.execute(
        `SELECT
           id,
           full_name,
           email,
           phone,
           instagram,
           status,
           created_at
         FROM users
         WHERE id = ?
           AND role = 'client'
         LIMIT 1`,
        [clientId]
      );

      if (!clientRows.length) {
        return res.status(404).json({
          success: false,
          message: "Клієнта не знайдено."
        });
      }

      const [bookings] = await pool.execute(
        `SELECT
           bookings.id AS booking_id,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.total_amount,
           bookings.comment,
           halls.name AS hall_name,
           photographer.full_name AS photographer_name,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'main'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS main_service,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'additional'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS additional_services,
           COALESCE(payments_summary.paid_amount, 0) AS paid_amount,
           GREATEST(
             bookings.total_amount - COALESCE(payments_summary.paid_amount, 0),
             0
           ) AS amount_due
         FROM bookings
         LEFT JOIN halls
           ON halls.id = bookings.hall_id
         LEFT JOIN users AS photographer
           ON photographer.id = bookings.photographer_id
         LEFT JOIN booking_services
           ON booking_services.booking_id = bookings.id
         LEFT JOIN services
           ON services.id = booking_services.service_id
         LEFT JOIN (
           SELECT
             booking_id,
             SUM(
               CASE
                 WHEN payment_status = 'paid'
                 THEN amount
                 ELSE 0
               END
             ) AS paid_amount
           FROM payments
           GROUP BY booking_id
         ) AS payments_summary
           ON payments_summary.booking_id = bookings.id
         WHERE bookings.client_id = ?
         GROUP BY
           bookings.id,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.total_amount,
           bookings.comment,
           halls.name,
           photographer.full_name,
           payments_summary.paid_amount
         ORDER BY bookings.booking_date DESC, bookings.start_time DESC`,
        [clientId]
      );

      const [totalsRows] = await pool.execute(
        `SELECT
           COUNT(*) AS bookings_count,
           COALESCE(SUM(
             CASE
               WHEN status != 'cancelled'
               THEN total_amount
               ELSE 0
             END
           ), 0) AS total_services_amount
         FROM bookings
         WHERE client_id = ?`,
        [clientId]
      );

      const [paidRows] = await pool.execute(
        `SELECT
           COALESCE(SUM(payments.amount), 0) AS paid_amount
         FROM payments
         JOIN bookings
           ON bookings.id = payments.booking_id
         WHERE bookings.client_id = ?
           AND payments.payment_status = 'paid'`,
        [clientId]
      );

      const totalServicesAmount =
        Number(totalsRows[0].total_services_amount || 0);
      const paidAmount =
        Number(paidRows[0].paid_amount || 0);

      res.json({
        success: true,
        client: clientRows[0],
        bookings,
        totals: {
          bookingsCount: Number(totalsRows[0].bookings_count || 0),
          totalServicesAmount,
          paidAmount,
          amountDue: Math.max(totalServicesAmount - paidAmount, 0)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося отримати картку клієнта.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   АДМІН: УСІ БРОНЮВАННЯ
========================================================= */

app.get(
  "/api/bookings",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
           bookings.id AS booking_id,
           clients.id AS client_id,
           clients.full_name AS client_name,
           clients.phone AS client_phone,
           clients.email AS client_email,
           clients.instagram AS client_instagram,
           halls.name AS hall_name,
           photographer.full_name AS photographer_name,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.prepayment_amount,
           bookings.total_amount,
           bookings.comment,
           bookings.created_at,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'main'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS main_service,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'additional'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS additional_services,
           GROUP_CONCAT(services.name SEPARATOR ', ') AS services,
           COALESCE(payments_summary.paid_amount, 0) AS paid_amount,
           GREATEST(
             bookings.total_amount - COALESCE(payments_summary.paid_amount, 0),
             0
           ) AS amount_due,
           CASE
             WHEN COALESCE(payments_summary.paid_amount, 0) >= bookings.total_amount
                  AND bookings.total_amount > 0
             THEN 'paid'
             WHEN COALESCE(payments_summary.paid_amount, 0) > 0
             THEN 'partial'
             ELSE 'unpaid'
           END AS payment_state
         FROM bookings
         JOIN users AS clients
           ON clients.id = bookings.client_id
         LEFT JOIN halls
           ON halls.id = bookings.hall_id
         LEFT JOIN users AS photographer
           ON photographer.id = bookings.photographer_id
         LEFT JOIN booking_services
           ON booking_services.booking_id = bookings.id
         LEFT JOIN services
           ON services.id = booking_services.service_id
         LEFT JOIN (
           SELECT
             booking_id,
             SUM(
               CASE
                 WHEN payment_status = 'paid'
                 THEN amount
                 ELSE 0
               END
             ) AS paid_amount
           FROM payments
           GROUP BY booking_id
         ) AS payments_summary
           ON payments_summary.booking_id = bookings.id
         GROUP BY
           bookings.id,
           clients.id,
           clients.full_name,
           clients.phone,
           clients.email,
           clients.instagram,
           halls.name,
           photographer.full_name,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.prepayment_amount,
           bookings.total_amount,
           bookings.comment,
           bookings.created_at,
           payments_summary.paid_amount
         ORDER BY bookings.id DESC`
      );

      res.json(rows);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося отримати бронювання.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   КЛІЄНТ: МОЇ БРОНЮВАННЯ
========================================================= */

app.get(
  "/api/clients/me/bookings",
  requireAuth,
  requireRole(["client"]),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
           bookings.id AS booking_id,
           halls.name AS hall_name,
           photographer.full_name AS photographer_name,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.total_amount,
           bookings.comment,
           bookings.created_at,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'main'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS main_service,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'additional'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS additional_services,
           GROUP_CONCAT(services.name SEPARATOR ', ') AS services,
           COALESCE(payments_summary.paid_amount, 0) AS paid_amount,
           GREATEST(
             bookings.total_amount - COALESCE(payments_summary.paid_amount, 0),
             0
           ) AS amount_due,
           CASE
             WHEN COALESCE(payments_summary.paid_amount, 0) >= bookings.total_amount
                  AND bookings.total_amount > 0
             THEN 'paid'
             WHEN COALESCE(payments_summary.paid_amount, 0) > 0
             THEN 'partial'
             ELSE 'unpaid'
           END AS payment_state
         FROM bookings
         LEFT JOIN halls
           ON halls.id = bookings.hall_id
         LEFT JOIN users AS photographer
           ON photographer.id = bookings.photographer_id
         LEFT JOIN booking_services
           ON booking_services.booking_id = bookings.id
         LEFT JOIN services
           ON services.id = booking_services.service_id
         LEFT JOIN (
           SELECT
             booking_id,
             SUM(
               CASE
                 WHEN payment_status = 'paid'
                 THEN amount
                 ELSE 0
               END
             ) AS paid_amount
           FROM payments
           GROUP BY booking_id
         ) AS payments_summary
           ON payments_summary.booking_id = bookings.id
         WHERE bookings.client_id = ?
         GROUP BY
           bookings.id,
           halls.name,
           photographer.full_name,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.total_amount,
           bookings.comment,
           bookings.created_at,
           payments_summary.paid_amount
         ORDER BY bookings.booking_date DESC, bookings.start_time DESC`,
        [req.user.id]
      );

      res.json(rows);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося отримати бронювання клієнта.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   ФОТОГРАФ: МОЇ БРОНЮВАННЯ
========================================================= */

app.get(
  "/api/photographers/me/bookings",
  requireAuth,
  requireRole(["photographer"]),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
           bookings.id AS booking_id,
           clients.full_name AS client_name,
           clients.phone AS client_phone,
           clients.email AS client_email,
           halls.name AS hall_name,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.total_amount,
           bookings.comment,
           bookings.created_at,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'main'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS main_service,
           GROUP_CONCAT(
             CASE
               WHEN services.category = 'additional'
               THEN services.name
             END
             SEPARATOR ', '
           ) AS additional_services,
           GROUP_CONCAT(services.name SEPARATOR ', ') AS services
         FROM bookings
         JOIN users AS clients
           ON clients.id = bookings.client_id
         LEFT JOIN halls
           ON halls.id = bookings.hall_id
         LEFT JOIN booking_services
           ON booking_services.booking_id = bookings.id
         LEFT JOIN services
           ON services.id = booking_services.service_id
         WHERE bookings.photographer_id = ?
         GROUP BY
           bookings.id,
           clients.full_name,
           clients.phone,
           clients.email,
           halls.name,
           bookings.booking_date,
           bookings.start_time,
           bookings.end_time,
           bookings.status,
           bookings.total_amount,
           bookings.comment,
           bookings.created_at
         ORDER BY bookings.booking_date DESC, bookings.start_time DESC`,
        [req.user.id]
      );

      res.json(rows);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося отримати бронювання фотографа.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   АДМІН: РЕДАГУВАННЯ БРОНЮВАННЯ
========================================================= */

async function checkBookingEditable(connection, bookingId) {
  const [rows] = await connection.execute(
    `SELECT status
     FROM bookings
     WHERE id = ?
     LIMIT 1`,
    [bookingId]
  );

  if (!rows.length) {
    throw new Error("Бронювання не знайдено.");
  }

  if (rows[0].status === "cancelled") {
    throw new Error("Неможливо редагувати скасоване бронювання.");
  }

  if (rows[0].status === "completed") {
    throw new Error("Неможливо редагувати завершене бронювання.");
  }
}

app.put(
  "/api/bookings/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const bookingId = req.params.id;
    const data = req.body;
    let connection;

    try {
      if (
        !data.booking_date ||
        !data.start_time ||
        !data.end_time ||
        !data.status
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Дата, початок, завершення і статус є обов'язковими."
        });
      }

      if (!BOOKING_STATUSES.includes(data.status)) {
        return res.status(400).json({
          success: false,
          message: "Некоректний статус бронювання."
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      await checkBookingEditable(connection, bookingId);

      const [currentRows] = await connection.execute(
        `SELECT
           bookings.id,
           bookings.client_id,
           bookings.photographer_id,
           bookings.hall_id,
           halls.name AS hall_name,
           main_services.name AS main_service
         FROM bookings
         LEFT JOIN halls
           ON halls.id = bookings.hall_id
         LEFT JOIN booking_services
           ON booking_services.booking_id = bookings.id
         LEFT JOIN services AS main_services
           ON main_services.id = booking_services.service_id
          AND main_services.category = 'main'
         WHERE bookings.id = ?
         LIMIT 1`,
        [bookingId]
      );

      if (!currentRows.length) {
        throw new Error("Бронювання не знайдено.");
      }

      const currentBooking = currentRows[0];

      let hallId = currentBooking.hall_id;
      let hallName = currentBooking.hall_name;

      if (data.hall !== undefined) {
        hallName = data.hall;
        hallId = isOutdoorService(currentBooking.main_service)
          ? null
          : await findOrCreateHall(connection, data.hall);
      }

      let photographerId = currentBooking.photographer_id;

      if (isHallRentalWithoutPhotographer(currentBooking.main_service)) {
        photographerId = null;
      } else {
        if (data.photographer_id !== undefined) {
          photographerId = await findPhotographerById(
            connection,
            data.photographer_id
          );
        }

        if (data.photographer !== undefined) {
          photographerId = await findPhotographerByName(
            connection,
            data.photographer
          );
        }
      }

      const startTime = normalizeTime(data.start_time);
      const endTime = normalizeTime(data.end_time);

      await lockBookingResources(connection, {
        bookingDate: data.booking_date,
        clientId: currentBooking.client_id,
        photographerId,
        hallId,
        hallName
      });

      await checkClientDailyLimit(
        connection,
        currentBooking.client_id,
        data.booking_date,
        bookingId
      );

      await validateBookingAvailability(connection, {
        bookingDate: data.booking_date,
        startTime,
        endTime,
        hallId,
        hallName,
        photographerId,
        clientId: currentBooking.client_id,
        serviceName: currentBooking.main_service,
        excludeBookingId: bookingId
      });

      await connection.execute(
        `UPDATE bookings
         SET
           booking_date = ?,
           start_time = ?,
           end_time = ?,
           status = ?,
           total_amount = ?,
           comment = ?,
           hall_id = ?,
           photographer_id = ?
         WHERE id = ?`,
        [
          data.booking_date,
          startTime,
          endTime,
          data.status,
          toMoney(data.total_amount, 0),
          normalizeNullableString(data.comment),
          hallId,
          photographerId,
          bookingId
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Бронювання оновлено.",
        bookingId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося оновити бронювання."
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

/* =========================================================
   ЗМІНА СТАТУСУ БРОНЮВАННЯ
========================================================= */

app.patch(
  "/api/bookings/:id/status",
  requireAuth,
  requireRole(["admin", "photographer"]),
  async (req, res) => {
    const bookingId = req.params.id;
    const { status } = req.body;

    try {
      if (!BOOKING_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Некоректний статус бронювання."
        });
      }

      if (req.user.role === "photographer") {
        if (status !== "completed") {
          return res.status(403).json({
            success: false,
            message: "Фотограф може лише завершити зйомку."
          });
        }

        const [rows] = await pool.execute(
          `SELECT id
           FROM bookings
           WHERE id = ?
             AND photographer_id = ?
           LIMIT 1`,
          [bookingId, req.user.id]
        );

        if (!rows.length) {
          return res.status(403).json({
            success: false,
            message: "Це бронювання не належить цьому фотографу."
          });
        }
      }

      await pool.execute(
        `UPDATE bookings
         SET status = ?
         WHERE id = ?`,
        [status, bookingId]
      );

      res.json({
        success: true,
        message: "Статус бронювання змінено.",
        bookingId,
        status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося змінити статус бронювання.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   АДМІН: ПОЗНАЧИТИ ОПЛАЧЕНИМ
========================================================= */

app.patch(
  "/api/bookings/:id/mark-paid",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const bookingId = req.params.id;
    const {
      amount,
      paymentMethod
    } = req.body || {};

    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [bookingRows] = await connection.execute(
        `SELECT
           id,
           status,
           total_amount
         FROM bookings
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [bookingId]
      );

      if (!bookingRows.length) {
        throw new Error("Бронювання не знайдено.");
      }

      const booking = bookingRows[0];

      if (booking.status === "cancelled") {
        throw new Error("Не можна оплатити скасоване бронювання.");
      }

      const [paidRows] = await connection.execute(
        `SELECT
           COALESCE(SUM(amount), 0) AS paid_amount
         FROM payments
         WHERE booking_id = ?
           AND payment_status = 'paid'`,
        [bookingId]
      );

      const alreadyPaid = Number(paidRows[0].paid_amount || 0);
      const totalAmount = Number(booking.total_amount || 0);
      const dueAmount = Math.max(totalAmount - alreadyPaid, 0);

      if (dueAmount <= 0) {
        await connection.execute(
          `UPDATE bookings
           SET status = 'paid'
           WHERE id = ?`,
          [bookingId]
        );

        await connection.commit();

        return res.json({
          success: true,
          message: "Бронювання вже повністю оплачене.",
          bookingId,
          paidAmount: alreadyPaid,
          amountDue: 0
        });
      }

      const paymentAmount = amount !== undefined
        ? toMoney(amount, dueAmount)
        : dueAmount;

      if (paymentAmount <= 0) {
        throw new Error("Сума оплати має бути більшою за 0.");
      }

      if (paymentAmount > dueAmount) {
        throw new Error("Сума оплати не може перевищувати залишок до сплати.");
      }

      const methodEnumValues = await getEnumValues(
        connection,
        "payments",
        "payment_method"
      );

      const statusEnumValues = await getEnumValues(
        connection,
        "payments",
        "payment_status"
      );

      const safePaymentMethod =
        paymentMethod && methodEnumValues.includes(paymentMethod)
          ? paymentMethod
          : pickEnumValue(methodEnumValues, "cash");

      const safePaymentStatus =
        pickEnumValue(statusEnumValues, "paid");

      if (!safePaymentMethod || !safePaymentStatus) {
        throw new Error(
          "Не вдалося визначити значення ENUM для таблиці payments."
        );
      }

      await connection.execute(
        `INSERT INTO payments
          (
            booking_id,
            amount,
            payment_method,
            payment_status,
            payment_date
          )
         VALUES
          (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          bookingId,
          paymentAmount,
          safePaymentMethod,
          safePaymentStatus
        ]
      );

      const newPaidAmount = alreadyPaid + paymentAmount;
      const newAmountDue = Math.max(totalAmount - newPaidAmount, 0);

      if (newAmountDue <= 0) {
        await connection.execute(
          `UPDATE bookings
           SET status = 'paid'
           WHERE id = ?`,
          [bookingId]
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message:
          newAmountDue <= 0
            ? "Бронювання повністю оплачено."
            : "Часткову оплату збережено.",
        bookingId,
        paidAmount: newPaidAmount,
        amountDue: newAmountDue
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(400).json({
        success: false,
        message: error.message || "Не вдалося зберегти оплату."
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

/* =========================================================
   АДМІН: СКАСУВАТИ БРОНЮВАННЯ
========================================================= */

app.patch(
  "/api/bookings/:id/cancel",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const bookingId = req.params.id;

    try {
      await pool.execute(
        `UPDATE bookings
         SET status = 'cancelled'
         WHERE id = ?`,
        [bookingId]
      );

      res.json({
        success: true,
        message: "Бронювання скасовано.",
        bookingId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося скасувати бронювання.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   АДМІН: ВИДАЛИТИ БРОНЮВАННЯ
========================================================= */

app.delete(
  "/api/bookings/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const bookingId = req.params.id;
    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      await connection.execute(
        "DELETE FROM booking_services WHERE booking_id = ?",
        [bookingId]
      );

      if (await tableExists("payments")) {
        await connection.execute(
          "DELETE FROM payments WHERE booking_id = ?",
          [bookingId]
        );
      }

      await connection.execute(
        "DELETE FROM bookings WHERE id = ?",
        [bookingId]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Бронювання видалено.",
        bookingId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      res.status(500).json({
        success: false,
        message: "Не вдалося видалити бронювання.",
        error: error.message
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

/* =========================================================
   АДМІН: CALLBACKS
========================================================= */

app.get(
  "/api/callbacks",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
           id,
           callback_name,
           callback_phone,
           status,
           created_at,
           processed_at
         FROM callback_requests
         ORDER BY id DESC`
      );

      res.json(rows);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося отримати заявки на дзвінок.",
        error: error.message
      });
    }
  }
);

app.patch(
  "/api/callbacks/:id/status",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const callbackId = req.params.id;
    const { status } = req.body;

    try {
      if (!CALLBACK_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Некоректний статус заявки."
        });
      }

      await pool.execute(
        `UPDATE callback_requests
         SET
           status = ?,
           processed_at = CASE
             WHEN ? = 'processed'
             THEN CURRENT_TIMESTAMP
             ELSE NULL
           END
         WHERE id = ?`,
        [status, status, callbackId]
      );

      res.json({
        success: true,
        message: "Статус заявки змінено.",
        callbackId,
        status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося змінити статус заявки.",
        error: error.message
      });
    }
  }
);

app.delete(
  "/api/callbacks/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const callbackId = req.params.id;

    try {
      await pool.execute(
        "DELETE FROM callback_requests WHERE id = ?",
        [callbackId]
      );

      res.json({
        success: true,
        message: "Заявку видалено.",
        callbackId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Не вдалося видалити заявку.",
        error: error.message
      });
    }
  }
);

/* =========================================================
   ЗАПУСК СЕРВЕРА
========================================================= */

async function startServer() {
  try {
    await ensureExtraTablesAndColumns();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Помилка запуску сервера:", error);
  }
}

startServer();
