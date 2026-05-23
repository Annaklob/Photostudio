function redirectByRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (normalizedRole === "admin") {
    window.location.replace("admin.html");
    return;
  }

  if (normalizedRole === "photographer") {
    window.location.replace("photographer-panel.html");
    return;
  }

  if (normalizedRole === "client") {
    window.location.replace("client-panel.html");
    return;
  }

  window.location.replace("login.html");
}

function requirePanelRole(expectedRole) {
  const token = getToken();
  const user = getSavedUser();

  if (!token || !user) {
    goToLogin();
    throw new Error("Потрібна авторизація.");
  }

  const userRole = String(user.role || "").trim().toLowerCase();

  if (userRole !== expectedRole) {
    redirectByRole(userRole);
    throw new Error("Користувач відкрив не свій кабінет.");
  }

  return user;
}

const API_URL = "http://192.168.116.129:3000";

const userInfoEl   = document.getElementById("userInfo");
const logoutBtn    = document.getElementById("logoutBtn");
const refreshBtn   = document.getElementById("refreshBtn");
const bookingsBlock = document.getElementById("bookingsBlock");
const summaryCards = document.getElementById("summaryCards");


// Перевірка авторизації
const savedUser = (sessionStorage.getItem("luminaUser") || localStorage.getItem("luminaUser"));
if (!savedUser) { window.location.href = "login.html"; }
const user = JSON.parse(savedUser);
if (user.role !== "client") { console.warn("Відкрито не той кабінет."); window.location.href = "login.html"; }
userInfoEl.textContent = `${user.fullName || user.full_name} | клієнт`;

// ── УТИЛІТИ ────────────────────────────────────────────────────────────
function safe(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? safe(v) : d.toLocaleDateString("uk-UA");
}
function formatStatus(s) {
  return {new:"Очікує підтвердження",confirmed:"Підтверджено",paid:"Оплачено",completed:"Завершено",cancelled:"Скасовано"}[s] || s || "—";
}
function formatAmount(v) {
  const n = Number(v || 0);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}
function formatServices(b) {
  const main = b.main_service || b.services || "—";
  const extra = b.additional_services || "";
  if (!extra) return `<div class="service-main">${safe(main)}</div>`;
  return `<div class="service-main">${safe(main)}</div><div class="service-extra">Додатково: ${safe(extra)}</div>`;
}

// ── СКАСУВАННЯ ─────────────────────────────────────────────────────────
async function cancelBooking(bookingId) {
  if (!confirm("Ви впевнені, що хочете скасувати це бронювання?\n\nСкасування можливе не пізніше ніж за 24 години до початку зйомки.")) return;
  const token = (sessionStorage.getItem("luminaToken") || localStorage.getItem("luminaToken"));
  try {
    const resp = await fetch(`${API_URL}/api/bookings/${bookingId}/cancel-client`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await resp.json();
    if (!resp.ok) { showSiteAlert(data.message || "Не вдалося скасувати бронювання."); return; }
    showSiteAlert("Бронювання скасовано.");
    loadBookings();
  } catch (e) {
    showSiteAlert("Помилка з'єднання з сервером.");
  }
}

// ── ЗАВАНТАЖЕННЯ БРОНЮВАНЬ ─────────────────────────────────────────────
async function loadBookings() {
  bookingsBlock.innerHTML = "Завантаження...";
  summaryCards.style.display = "none";


  try {
    const token = (sessionStorage.getItem("luminaToken") || localStorage.getItem("luminaToken"));
    const resp  = await fetch(`${API_URL}/api/clients/me/bookings`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error("Не вдалося завантажити бронювання.");
    const bookings = await resp.json();

    if (!bookings.length) {
      bookingsBlock.innerHTML = `
        <div class="empty">
          У вас поки що немає бронювань. Перейдіть на головну сторінку сайту та створіть заявку.
        </div>`;
      return;
    }

    // ── Підрахунок підсумків ──────────────────────────────────────────
    let totalAmount = 0;
    let totalPaid   = 0;
    let activeCount = 0;

    bookings.forEach(b => {
      if (b.status !== "cancelled") {
        totalAmount += Number(b.total_amount || 0);
        totalPaid   += Number(b.paid_amount  || 0);
        activeCount++;
      }
    });

    const totalDue = Math.max(totalAmount - totalPaid, 0);

    // Підсумкові картки
    document.getElementById("sumTotal").textContent  = activeCount;
    document.getElementById("sumAmount").textContent = `${formatAmount(totalAmount)} грн`;
    document.getElementById("sumPaid").textContent   = `${formatAmount(totalPaid)} грн`;
    document.getElementById("sumDue").textContent    = `${formatAmount(totalDue)} грн`;
    summaryCards.style.display = "flex";


    // ── Таблиця ──────────────────────────────────────────────────────
    bookingsBlock.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>ID</th><th>Послуги</th><th>Зал</th><th>Фотограф</th>
            <th>Дата</th><th>Час</th><th>Статус</th>
            <th>Оплата</th><th>Коментар</th><th>Дія</th>
          </tr></thead>
          <tbody>
            ${bookings.map(b => {
              const paidAmount   = Number(b.paid_amount  || 0);
              const totalAmt     = Number(b.total_amount || 0);
              const amountDue    = Number(b.amount_due   || 0);
              const paymentState = b.payment_state || "unpaid";

              const paymentBadge = paymentState === "paid"
                ? `<span class="payment-badge paid">✓ Оплачено</span>`
                : paymentState === "partial"
                  ? `<span class="payment-badge partial">Часткова оплата</span>`
                  : `<span class="payment-badge unpaid">Очікує оплати</span>`;

              return `
                <tr>
                  <td>${safe(b.booking_id)}</td>
                  <td>${formatServices(b)}</td>
                  <td>${safe(b.hall_name)}</td>
                  <td>${safe(b.photographer_name)}</td>
                  <td>${formatDate(b.booking_date)}</td>
                  <td style="white-space:nowrap;">${safe(b.start_time ? String(b.start_time).slice(0,5) : "—")} – ${safe(b.end_time ? String(b.end_time).slice(0,5) : "—")}</td>
                  <td><span class="status ${safe(b.status)}">${formatStatus(b.status)}</span></td>
                  <td>
                    <div class="payment-info">
                      <div class="total">${formatAmount(totalAmt)} грн</div>
                      ${paidAmount > 0 ? `<div class="paid">✓ Оплачено: ${formatAmount(paidAmount)} грн</div>` : ""}
                      <div class="due ${amountDue > 0 ? 'positive' : 'zero'}">
                        ${amountDue > 0 ? `До сплати: ${formatAmount(amountDue)} грн` : b.status !== "cancelled" ? "✓ Закрито" : ""}
                      </div>
                      ${b.status !== "cancelled" ? paymentBadge : ""}
                    </div>
                  </td>
                  <td>${safe(b.comment)}</td>
                  <td>
                    ${(b.status === "new" || b.status === "confirmed")
                      ? `<button class="cancel-btn" onclick="cancelBooking(${b.booking_id})">Скасувати</button>`
                      : "—"}
                  </td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
`;

  } catch (e) {
    bookingsBlock.innerHTML = `<div class="error">Помилка завантаження бронювань. Спробуйте оновити сторінку.</div>`;
  }
}

logoutBtn.addEventListener("click", function() {
  localStorage.removeItem("luminaUser");
  localStorage.removeItem("luminaToken");
  window.location.href = "login.html";
});
refreshBtn.addEventListener("click", loadBookings);

// Перевіряємо чи токен ще дійсний
async function checkToken() {
  const token = (sessionStorage.getItem("luminaToken") || localStorage.getItem("luminaToken"));
  if (!token) { window.location.href = "login.html"; return; }
  try {
    const resp = await fetch(`${API_URL}/api/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!resp.ok) {
      localStorage.removeItem("luminaToken");
      localStorage.removeItem("luminaUser");
      window.location.href = "login.html";
    }
  } catch (e) {
    // мережева помилка — не викидаємо, просто завантажуємо
  }
}

checkToken().then(() => loadBookings());
