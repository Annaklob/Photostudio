const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const DEMO_TAG = "DEMO_DATA_2026";

const TOTAL_CLIENTS = 130;
const UNPAID_COUNT = 20;

const PAID_START_DATE = "2026-01-01";
const PAID_END_DATE = "2026-05-27";
const UNPAID_START_DATE = "2026-05-28";
const UNPAID_END_DATE = "2026-05-30";

const firstNames = [
  "Анна", "Олена", "Ірина", "Марія", "Софія", "Вікторія", "Катерина", "Анастасія",
  "Юлія", "Дарина", "Олександра", "Наталія", "Христина", "Вероніка", "Тетяна",
  "Андрій", "Олександр", "Дмитро", "Максим", "Владислав", "Богдан", "Іван",
  "Роман", "Артем", "Михайло", "Назар", "Віталій", "Тарас", "Єгор", "Денис"
];

const lastNames = [
  "Мельник", "Шевченко", "Коваль", "Бондар", "Савчук", "Гнатюк", "Ткаченко",
  "Кравченко", "Петренко", "Мороз", "Лисенко", "Романенко", "Ковальчук",
  "Бойко", "Поліщук", "Павленко", "Клименко", "Захарченко", "Кириленко",
  "Дорош", "Остапенко", "Марченко", "Левченко", "Сидоренко"
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function toDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function randomDate(start, end) {
  const startTime = toDate(start).getTime();
  const endTime = toDate(end).getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return formatDate(new Date(randomTime));
}

function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

function makeTimeRange(durationMinutes) {
  const open = 9 * 60;
  const close = 20 * 60;
  const duration = Math.min(Math.max(Number(durationMinutes) || 60, 60), 480);
  const maxStart = close - duration;
  const possibleStarts = [];

  for (let t = open; t <= maxStart; t += 30) {
    possibleStarts.push(t);
  }

  const start = randomItem(possibleStarts);
  const end = start + duration;

  return {
    startTime: minutesToTime(start),
    endTime: minutesToTime(end)
  };
}

function randomCreatedAt(bookingDate) {
  const date = toDate(bookingDate);
  date.setDate(date.getDate() - Math.floor(Math.random() * 14));
  if (date < toDate("2026-01-01")) return "2026-01-01 10:00:00";

  const hour = 8 + Math.floor(Math.random() * 11);
  const minute = Math.random() > 0.5 ? "30" : "00";

  return `${formatDate(date)} ${String(hour).padStart(2, "0")}:${minute}:00`;
}

function randomPaidAt(bookingDate) {
  const date = toDate(bookingDate);
  date.setDate(date.getDate() - Math.floor(Math.random() * 5));
  if (date < toDate("2026-01-01")) date.setTime(toDate("2026-01-01").getTime());

  const hour = 9 + Math.floor(Math.random() * 9);
  const minute = Math.random() > 0.5 ? "30" : "00";

  return `${formatDate(date)} ${String(hour).padStart(2, "0")}:${minute}:00`;
}

async function getColumns(connection, table) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map(row => row.Field));
}

async function insertDynamic(connection, table, data) {
  const columns = await getColumns(connection, table);

  const entries = Object.entries(data).filter(([key, value]) => {
    return columns.has(key) && value !== undefined;
  });

  if (!entries.length) {
    throw new Error(`Немає відповідних колонок для таблиці ${table}`);
  }

  const keys = entries.map(([key]) => `\`${key}\``);
  const placeholders = entries.map(() => "?");
  const values = entries.map(([, value]) => value);

  const [result] = await connection.execute(
    `INSERT INTO \`${table}\` (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values
  );

  return result.insertId;
}

async function deleteOldDemo(connection) {
  const [demoBookings] = await connection.execute(
    `SELECT id FROM bookings WHERE comment LIKE ?`,
    [`%${DEMO_TAG}%`]
  );

  const bookingIds = demoBookings.map(row => row.id);

  if (bookingIds.length) {
    const placeholders = bookingIds.map(() => "?").join(",");

    await connection.execute(
      `DELETE FROM payments WHERE booking_id IN (${placeholders})`,
      bookingIds
    ).catch(() => {});

    await connection.execute(
      `DELETE FROM booking_services WHERE booking_id IN (${placeholders})`,
      bookingIds
    ).catch(() => {});

    await connection.execute(
      `DELETE FROM bookings WHERE id IN (${placeholders})`,
      bookingIds
    );
  }

  await connection.execute(
    `DELETE FROM users WHERE email LIKE ? AND role = 'client'`,
    [`demo.client.2026.%@lumina.demo`]
  );

  console.log("Старі demo-дані видалено.");
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "lumina_user",
    password: process.env.DB_PASSWORD || "12345",
    database: process.env.DB_NAME || "lumina",
    multipleStatements: false
  });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (process.argv.includes("--reset")) {
      await deleteOldDemo(connection);
    } else {
      const [existing] = await connection.execute(
        `SELECT COUNT(*) AS count FROM users WHERE email LIKE ?`,
        [`demo.client.2026.%@lumina.demo`]
      );

      if (Number(existing[0].count) > 0) {
        throw new Error(
          "Demo-користувачі вже існують. Запусти скрипт з --reset, якщо хочеш перезаписати їх."
        );
      }
    }

    const [services] = await connection.execute(
      `
      SELECT id, name, price, duration_minutes, category
      FROM services
      WHERE status = 'active'
        AND COALESCE(site_visible, 1) = 1
        AND category = 'main'
      ORDER BY id
      `
    );

    const [halls] = await connection.execute(
      `
      SELECT id, name
      FROM halls
      WHERE status = 'available'
        AND name <> 'Без залу / виїзна зйомка'
      ORDER BY id
      `
    );

    const [photographers] = await connection.execute(
      `
      SELECT users.id, users.full_name
      FROM users
      LEFT JOIN photographer_profiles
        ON photographer_profiles.photographer_id = users.id
      WHERE users.role = 'photographer'
        AND users.status = 'active'
        AND COALESCE(photographer_profiles.site_visible, 1) = 1
      ORDER BY users.id
      `
    );

    if (!services.length) throw new Error("Немає активних основних послуг.");
    if (!halls.length) throw new Error("Немає доступних залів.");
    if (!photographers.length) throw new Error("Немає активних фотографів.");

    const passwordHash = await bcrypt.hash("client12345", 10);

    const paidCount = TOTAL_CLIENTS - UNPAID_COUNT;

    for (let i = 1; i <= TOTAL_CLIENTS; i++) {
      const isPaid = i <= paidCount;

      const firstName = randomItem(firstNames);
      const lastName = randomItem(lastNames);
      const fullName = `${firstName} ${lastName}`;
      const email = `demo.client.2026.${String(i).padStart(3, "0")}@lumina.demo`;
      const phone = `067${String(9000000 + i).padStart(7, "0")}`;

      const bookingDate = isPaid
        ? randomDate(PAID_START_DATE, PAID_END_DATE)
        : randomDate(UNPAID_START_DATE, UNPAID_END_DATE);

      const service = randomItem(services);
      const hall = randomItem(halls);
      const photographer = randomItem(photographers);

      const price = Number(service.price || 0) || (1200 + Math.floor(Math.random() * 9) * 300);
      const duration = Number(service.duration_minutes || 60) || 60;
      const { startTime, endTime } = makeTimeRange(duration);

      const createdAt = randomCreatedAt(bookingDate);

      const clientId = await insertDynamic(connection, "users", {
        role: "client",
        full_name: fullName,
        email,
        phone,
        password_hash: passwordHash,
        status: "active",
        created_at: createdAt
      });

      const bookingId = await insertDynamic(connection, "bookings", {
        client_id: clientId,
        photographer_id: photographer.id,
        hall_id: hall.id,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        status: isPaid ? "paid" : "confirmed",
        prepayment_amount: isPaid ? price : 0,
        total_amount: price,
        comment: `${DEMO_TAG}: тестове бронювання`,
        created_at: createdAt
      });

      await insertDynamic(connection, "booking_services", {
        booking_id: bookingId,
        service_id: service.id,
        service_name: service.name,
        price,
        amount: price,
        quantity: 1,
        created_at: createdAt
      }).catch(() => {});

      if (isPaid) {
        await insertDynamic(connection, "payments", {
          booking_id: bookingId,
          client_id: clientId,
          amount: price,
          paid_amount: price,
          payment_amount: price,
          method: "cash",
          payment_method: "cash",
          status: "paid",
          comment: `${DEMO_TAG}: повна оплата`,
          created_at: randomPaidAt(bookingDate)
        }).catch((error) => {
          console.log(`Попередження: оплату для бронювання ${bookingId} не додано: ${error.message}`);
        });
      }

      console.log(
        `${i}/${TOTAL_CLIENTS}: ${fullName}, ${bookingDate}, ${service.name}, ${isPaid ? "оплачено" : "не оплачено"}`
      );
    }

    await connection.commit();

    console.log("");
    console.log("Готово!");
    console.log(`Додано клієнтів: ${TOTAL_CLIENTS}`);
    console.log(`Оплачених бронювань до 27.05.2026: ${paidCount}`);
    console.log(`Неоплачених бронювань 28.05–30.05.2026: ${UNPAID_COUNT}`);
    console.log("");
    console.log("Пароль для всіх demo-клієнтів: client12345");
  } catch (error) {
    await connection.rollback();
    console.error("Помилка:", error.message);
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
