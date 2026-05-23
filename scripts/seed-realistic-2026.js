const mysql = require("mysql2/promise");

const TOTAL_CLIENTS = 140;
const SEED_EMAIL_MARK = ".lumina2026@";

const START_DATE = "2026-01-01";
const END_DATE = "2026-05-30";

const firstNames = [
  "Анна", "Олена", "Ірина", "Марія", "Софія", "Вікторія", "Катерина", "Анастасія",
  "Юлія", "Дарина", "Олександра", "Наталія", "Христина", "Вероніка", "Тетяна",
  "Аліна", "Марина", "Єлизавета", "Карина", "Діана", "Лілія", "Валерія",
  "Андрій", "Олександр", "Дмитро", "Максим", "Владислав", "Богдан", "Іван",
  "Роман", "Артем", "Михайло", "Назар", "Віталій", "Тарас", "Денис", "Павло"
];

const lastNames = [
  "Мельник", "Шевченко", "Коваль", "Бондар", "Савчук", "Гнатюк", "Ткаченко",
  "Кравченко", "Петренко", "Мороз", "Лисенко", "Романенко", "Ковальчук",
  "Бойко", "Поліщук", "Павленко", "Клименко", "Захарченко", "Кириленко",
  "Дорош", "Остапенко", "Марченко", "Левченко", "Сидоренко", "Гончар",
  "Приходько", "Кравець", "Іваненко", "Мартинюк", "Семенюк"
];

const domains = ["gmail.com", "ukr.net", "i.ua", "outlook.com"];
const phoneCodes = ["050", "063", "066", "067", "068", "093", "095", "096", "097", "098"];

const translit = {
  "а":"a","б":"b","в":"v","г":"h","ґ":"g","д":"d","е":"e","є":"ye","ж":"zh","з":"z",
  "и":"y","і":"i","ї":"yi","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p",
  "р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch",
  "ь":"","ю":"yu","я":"ya"," ":""
};

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .split("")
    .map(ch => translit[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

function toDate(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function randomDate(start, end) {
  const s = toDate(start).getTime();
  const e = toDate(end).getTime();
  return formatDate(new Date(s + Math.random() * (e - s)));
}

function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

function makeTimeRange(durationMinutes) {
  const open = 9 * 60;
  const close = 20 * 60;
  const duration = Math.min(Math.max(Number(durationMinutes) || 60, 60), 240);
  const starts = [];

  for (let t = open; t + duration <= close; t += 30) {
    starts.push(t);
  }

  const start = randomItem(starts);

  return {
    startTime: minutesToTime(start),
    endTime: minutesToTime(start + duration)
  };
}

function randomDateTimeBefore(dateString, maxDaysBack = 10) {
  const d = toDate(dateString);
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysBack));

  if (d < toDate(START_DATE)) {
    d.setTime(toDate(START_DATE).getTime());
  }

  const hour = 9 + Math.floor(Math.random() * 9);
  const minute = Math.random() > 0.5 ? "30" : "00";

  return `${formatDate(d)} ${String(hour).padStart(2, "0")}:${minute}:00`;
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

  const names = entries.map(([key]) => `\`${key}\``).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await connection.execute(
    `INSERT INTO \`${table}\` (${names}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
}

async function deleteOldSeed(connection) {
  const [clients] = await connection.execute(
    `
    SELECT id
    FROM users
    WHERE role = 'client'
      AND email LIKE ?
    `,
    [`%${SEED_EMAIL_MARK}%`]
  );

  const clientIds = clients.map(row => row.id);

  if (!clientIds.length) {
    console.log("Старих тестових клієнтів не знайдено.");
    return;
  }

  const clientPlaceholders = clientIds.map(() => "?").join(",");

  const [bookings] = await connection.execute(
    `SELECT id FROM bookings WHERE client_id IN (${clientPlaceholders})`,
    clientIds
  );

  const bookingIds = bookings.map(row => row.id);

  if (bookingIds.length) {
    const bookingPlaceholders = bookingIds.map(() => "?").join(",");

    await connection.execute(
      `DELETE FROM payments WHERE booking_id IN (${bookingPlaceholders})`,
      bookingIds
    ).catch(() => {});

    await connection.execute(
      `DELETE FROM booking_services WHERE booking_id IN (${bookingPlaceholders})`,
      bookingIds
    ).catch(() => {});

    await connection.execute(
      `DELETE FROM bookings WHERE id IN (${bookingPlaceholders})`,
      bookingIds
    );
  }

  await connection.execute(
    `DELETE FROM users WHERE id IN (${clientPlaceholders})`,
    clientIds
  );

  console.log(`Видалено старих тестових клієнтів: ${clientIds.length}`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "lumina_user",
    password: process.env.DB_PASSWORD || "12345",
    database: process.env.DB_NAME || "lumina"
  });

  try {
    await connection.beginTransaction();

    await deleteOldSeed(connection);

    const [services] = await connection.execute(`
      SELECT id, name, price, duration_minutes
      FROM services
      WHERE status = 'active'
        AND COALESCE(site_visible, 1) = 1
        AND category = 'main'
      ORDER BY id
    `);

    const [halls] = await connection.execute(`
      SELECT id, name
      FROM halls
      WHERE status = 'available'
        AND name <> 'Без залу / виїзна зйомка'
      ORDER BY id
    `);

    const [photographers] = await connection.execute(`
      SELECT users.id, users.full_name
      FROM users
      LEFT JOIN photographer_profiles
        ON photographer_profiles.photographer_id = users.id
      WHERE users.role = 'photographer'
        AND users.status = 'active'
        AND COALESCE(photographer_profiles.site_visible, 1) = 1
      ORDER BY users.id
    `);

    if (!services.length) throw new Error("Немає активних основних послуг.");
    if (!halls.length) throw new Error("Немає доступних залів.");
    if (!photographers.length) throw new Error("Немає активних фотографів.");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usedSlots = new Set();

    let paidCount = 0;
    let unpaidCount = 0;

    for (let i = 1; i <= TOTAL_CLIENTS; i++) {
      const firstName = randomItem(firstNames);
      const lastName = randomItem(lastNames);
      const fullName = `${firstName} ${lastName}`;

      const emailName = `${slug(firstName)}.${slug(lastName)}.${100 + i}.lumina2026`;
      const email = `${emailName}@${randomItem(domains)}`;
      const phone = `${randomItem(phoneCodes)}${String(1000000 + Math.floor(Math.random() * 8999999))}`;

      let service;
      let hall;
      let photographer;
      let bookingDate;
      let startTime;
      let endTime;

      let attempts = 0;

      do {
        service = randomItem(services);
        hall = randomItem(halls);
        photographer = randomItem(photographers);
        bookingDate = randomDate(START_DATE, END_DATE);

        const timeRange = makeTimeRange(service.duration_minutes);
        startTime = timeRange.startTime;
        endTime = timeRange.endTime;

        attempts++;

        if (attempts > 300) {
          throw new Error("Не вдалося підібрати унікальний час для бронювання.");
        }
      } while (
        usedSlots.has(`hall:${hall.id}:${bookingDate}:${startTime}`) ||
        usedSlots.has(`photographer:${photographer.id}:${bookingDate}:${startTime}`)
      );

      usedSlots.add(`hall:${hall.id}:${bookingDate}:${startTime}`);
      usedSlots.add(`photographer:${photographer.id}:${bookingDate}:${startTime}`);

      const price = Number(service.price || 0) || 1500;
      const createdAt = randomDateTimeBefore(bookingDate, 18);

      const isPaid = toDate(bookingDate) <= today;

      const clientId = await insertDynamic(connection, "users", {
        role: "client",
        full_name: fullName,
        email,
        phone,
        password_hash: "$2b$10$9zW4E7bPr0uyY0YdtJz7lOS6jVY3Lw7Tqzwdx6kt6Q1Yqkz0V9JxS",
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
        comment: "",
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
          comment: "",
          created_at: randomDateTimeBefore(bookingDate, 5)
        }).catch(() => {});
        paidCount++;
      } else {
        unpaidCount++;
      }

      console.log(
        `${i}/${TOTAL_CLIENTS}: ${fullName} | ${service.name} | ${bookingDate} | ${hall.name} | ${photographer.full_name} | ${isPaid ? "оплачено" : "не оплачено"}`
      );
    }

    await connection.commit();

    console.log("");
    console.log("Готово.");
    console.log(`Створено клієнтів: ${TOTAL_CLIENTS}`);
    console.log(`Створено бронювань: ${TOTAL_CLIENTS}`);
    console.log(`Оплачених до сьогоднішньої дати включно: ${paidCount}`);
    console.log(`Неоплачених після сьогоднішньої дати до 30.05.2026: ${unpaidCount}`);
    console.log("Коментарі у бронюваннях і оплатах порожні.");
  } catch (error) {
    await connection.rollback();
    console.error("Помилка:", error.message);
  } finally {
    await connection.end();
  }
}

main();
