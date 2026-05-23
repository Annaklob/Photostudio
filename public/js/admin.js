
// ── КРАСИВЕ ВІКНО ПІДТВЕРДЖЕННЯ ──
function showConfirmModal({
  title = "Підтвердження",
  text = "Ви впевнені?",
  confirmText = "Підтвердити"
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const overlay = document.getElementById("confirmOverlay");
    const titleEl = document.getElementById("confirmTitle");
    const textEl = document.getElementById("confirmText");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    const okBtn = document.getElementById("confirmOkBtn");

    if (!modal || !overlay || !titleEl || !textEl || !cancelBtn || !okBtn) {
      resolve(window.confirm(text));
      return;
    }

    titleEl.textContent = title;
    textEl.textContent = text;
    okBtn.textContent = confirmText;

    modal.classList.add("active");

    function close(result) {
      modal.classList.remove("active");
      cancelBtn.removeEventListener("click", onCancel);
      okBtn.removeEventListener("click", onOk);
      overlay.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }

    function onCancel() {
      close(false);
    }

    function onOk() {
      close(true);
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        close(false);
      }
    }

    cancelBtn.addEventListener("click", onCancel);
    okBtn.addEventListener("click", onOk);
    overlay.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKeydown);
  });
}

const API_URL = "http://192.168.116.129:3000";

// ── DOM ──
const bookingsBlock  = document.getElementById("bookingsBlock");
const callbacksBlock = document.getElementById("callbacksBlock");
const bookingsCount  = document.getElementById("bookingsCount");
const callbacksCount = document.getElementById("callbacksCount");
const refreshBtn     = document.getElementById("refreshBtn");
const openCreateBtn  = document.getElementById("openCreateBtn");
const userInfoEl     = document.getElementById("userInfo");

const createModal            = document.getElementById("createModal");
const createOverlay          = document.getElementById("createOverlay");
const createClose            = document.getElementById("createClose");
const createForm             = document.getElementById("createForm");
const createClientSearch     = document.getElementById("createClientSearch");
const createClientSearchResults = document.getElementById("createClientSearchResults");
const createClientSearchHint = document.getElementById("createClientSearchHint");
const createClientName       = document.getElementById("createClientName");
const createClientPhone      = document.getElementById("createClientPhone");
const createClientEmail      = document.getElementById("createClientEmail");
const createClientInstagram  = document.getElementById("createClientInstagram");
const createService          = document.getElementById("createService");
const createHall             = document.getElementById("createHall");
const createPhotographer     = document.getElementById("createPhotographer");
const createPhotographerGroup = document.getElementById("createPhotographerGroup");
const createDate             = document.getElementById("createDate");
const createTime             = document.getElementById("createTime");
const createComment          = document.getElementById("createComment");
const createError            = document.getElementById("createError");
const createSaveBtn          = document.getElementById("createSaveBtn");

const editModal    = document.getElementById("editModal");
const editOverlay  = document.getElementById("editOverlay");
const editClose    = document.getElementById("editClose");
const editForm     = document.getElementById("editForm");
const editBookingId = document.getElementById("editBookingId");
const editDate     = document.getElementById("editDate");
const editStartTime = document.getElementById("editStartTime");
const editEndTime  = document.getElementById("editEndTime");
const editStatus   = document.getElementById("editStatus");
const editAmount   = document.getElementById("editAmount");
const editComment  = document.getElementById("editComment");

// ── СТАН ──
let currentBookings  = [];
let currentCallbacks = [];
let allServices      = [];
let allPhotographers = [];
let allHalls         = [];
let clientSearchTimer = null;
let currentFilter    = "all";
let scheduleWeekOffset = 0;
let currentSchedulePhotographerId = null;
let currentScheduleData = [];

const SERVICES_WITHOUT_PHOTOGRAPHER = new Set([
  "Погодинна оренда залу",
  "Оренда залу для стороннього фотографа",
  "Оренда студії для стороннього фотографа"
]);
const OUTDOOR_SERVICES = new Set([
  "Виїзна фотосесія в межах міста",
  "Виїзна фотосесія за межами міста",
  "Репортажна зйомка подій"
]);

// ── AUTH ──
function getToken() { return (sessionStorage.getItem("luminaToken") || localStorage.getItem("luminaToken")); }
function getSavedUser() { try { return JSON.parse((sessionStorage.getItem("luminaUser") || localStorage.getItem("luminaUser")) || "null"); } catch { return null; } }
function clearAuthData() { localStorage.removeItem("luminaToken"); localStorage.removeItem("luminaUser"); }
function goToLogin() {
  clearAuthData();
  window.location.replace("login.html");
}

function redirectByRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (normalizedRole === "client") {
    window.location.replace("client-panel.html");
    return;
  }

  if (normalizedRole === "photographer") {
    window.location.replace("photographer-panel.html");
    return;
  }

  window.location.replace("login.html");
}
function authHeaders(extra = {}) { return { ...extra, "Authorization": `Bearer ${getToken()}` }; }
function handleAuthError(resp) { if (resp.status === 401 || resp.status === 403) { goToLogin(); return true; } return false; }

const token = getToken();
const user  = getSavedUser();

if (!token || !user) {
  goToLogin();
  throw new Error("Потрібна авторизація.");
}

const userRole = String(user.role || "").trim().toLowerCase();

if (userRole !== "admin") {
  redirectByRole(userRole);
  throw new Error("Користувач не є адміністратором.");
}

if (userInfoEl) {
  userInfoEl.textContent = `${user.fullName || user.full_name || "Адміністратор"} | адмін`;
}

// ── УТИЛІТИ ──
function safe(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function formatDate(v) { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? safe(v) : d.toLocaleDateString("uk-UA"); }
function formatDateForInput(v) { if (!v) return ""; const d = new Date(v); return isNaN(d) ? String(v).slice(0,10) : d.toISOString().split("T")[0]; }
function formatDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return safe(v);
  return d.toLocaleString("uk-UA", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function formatTime(v) { return v ? String(v).slice(0,5) : "—"; }
function timeForInput(v) { return v ? String(v).slice(0,5) : ""; }
function formatAmount(v) { return Number(v||0).toLocaleString("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function formatBookingStatus(s) { return {new:"Очікує підтвердження",confirmed:"Підтверджено",paid:"Оплачено",completed:"Завершено",cancelled:"Скасовано"}[s] || "—"; }
function formatCallbackStatus(s) { return {new:"Нова заявка",processed:"Опрацьовано"}[s] || "—"; }
function formatServices(b) {
  const main = b.main_service || b.services || "—";
  const extra = b.additional_services;
  return `<div class="service-cell-main">${safe(main)}</div>${extra ? `<div class="service-cell-extra">Додатково: ${safe(extra)}</div>` : ""}`;
}
function showMsg(el, msg, isError = true) {
  el.textContent = msg;
  el.style.background = isError ? "#ffe8e5" : "#e9f7e8";
  el.style.color = isError ? "#8a1f15" : "#1f6f2a";
  el.classList.add("active");
}
function hideMsg(el) { el.textContent = ""; el.classList.remove("active"); }

// ── ДОХІД ──
function calcRevenue(bookings) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  let total = 0, month = 0, pending = 0, count = 0;

  bookings.forEach(b => {
    if (b.status === "cancelled") return;
    count++;
    const paid = Number(b.paid_amount || 0);
    total += paid;
    if (b.status === "confirmed") {
      pending += Number(b.amount_due || 0);
    }
    const created = new Date(b.created_at);
    if (!isNaN(created) && created.getMonth() === thisMonth && created.getFullYear() === thisYear) {
      month += paid;
    }
  });

  document.getElementById("revTotal").textContent    = formatAmount(total) + " грн";
  document.getElementById("revMonth").textContent    = formatAmount(month) + " грн";
  document.getElementById("revPending").textContent  = formatAmount(pending) + " грн";
  document.getElementById("revBookings").textContent = count;

  const monthName = now.toLocaleString("uk-UA", { month: "long", year: "numeric" });
  document.getElementById("revMonthLabel").textContent = `оплачено у ${monthName}`;
}

// ── ФІЛЬТРАЦІЯ ──
function applyFilter(type) {
  currentFilter = type;
  ["filterAll","filterToday","filterYesterday"].forEach(id => {
    document.getElementById(id).classList.remove("active");
  });
  if (type === "all")       document.getElementById("filterAll").classList.add("active");
  if (type === "today")     document.getElementById("filterToday").classList.add("active");
  if (type === "yesterday") document.getElementById("filterYesterday").classList.add("active");
  renderBookingsTable();
}

function getFilteredBookings() {
  if (currentFilter === "all") return currentBookings;

  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  if (currentFilter === "today") {
    return currentBookings.filter(b => {
      if (!b.created_at) return false;
      const d = new Date(b.created_at); d.setHours(0,0,0,0);
      return d.getTime() === today.getTime();
    });
  }

  if (currentFilter === "yesterday") {
    return currentBookings.filter(b => {
      if (!b.created_at) return false;
      const d = new Date(b.created_at); d.setHours(0,0,0,0);
      return d.getTime() === yesterday.getTime();
    });
  }

  if (currentFilter === "range") {
    const from = document.getElementById("filterDateFrom").value;
    const to   = document.getElementById("filterDateTo").value;
    return currentBookings.filter(b => {
      if (!b.created_at) return false;
      const d = new Date(b.created_at);
      const ds = d.toISOString().split("T")[0];
      if (from && ds < from) return false;
      if (to   && ds > to)   return false;
      return true;
    });
  }

  return currentBookings;
}

// ── КАТАЛОГИ ──
async function loadCatalogs() {
  try {
    const [sr, hr, pr] = await Promise.all([
      fetch(`${API_URL}/api/admin/services`, { headers: authHeaders() }),
      fetch(`${API_URL}/api/halls/public`),
      fetch(`${API_URL}/api/admin/photographers`, { headers: authHeaders() })
    ]);
    const [sd, hd, pd] = await Promise.all([sr.json(), hr.json(), pr.json()]);
    if (sd.success) { allServices = sd.services || []; populateServiceSelects(); renderServicesTable(); }
    if (hd.success) { allHalls = hd.halls || []; populateHallSelect(); }
    if (pd.success) {
      allPhotographers = pd.photographers || [];
      populatePhotographerSelect();
      renderPhotographersTable();
      populateSchedulePhotographerSelect();
    }
  } catch (e) { console.error("Помилка каталогів:", e); }
}

function populateServiceSelects() {
  // Лише активні послуги у формі бронювання
  const main = allServices.filter(s => s.category === "main" && s.status === "active");
  const add  = allServices.filter(s => s.category === "additional" && s.status === "active");
  createService.innerHTML = `<option value="">Оберіть основну послугу</option>` +
    main.map(s => `<option value="${safe(s.name)}">${safe(s.name)} — ${formatAmount(s.price)} грн / ${s.duration_minutes} хв</option>`).join("");
  const addEl = document.getElementById("createAdditionalServices");
  if (addEl) addEl.innerHTML = add.length
    ? add.map(s => `<label><input type="checkbox" name="createAdditionalServices" value="${safe(s.name)}"> ${safe(s.name)} — ${formatAmount(s.price)} грн</label>`).join("")
    : `<span style="color:#888;font-size:14px;">Немає додаткових послуг</span>`;
}

function populateHallSelect() {
  createHall.innerHTML = `<option value="">Оберіть зал</option>` +
    allHalls.map(h => `<option value="${safe(h.name)}">${safe(h.name)}</option>`).join("") +
    `<option value="Без залу / виїзна зйомка">Без залу / виїзна зйомка</option>`;
}

function populatePhotographerSelect() {
  const active = allPhotographers.filter(p => p.status === "active");
  createPhotographer.innerHTML = `<option value="">Фотограф ще не призначений</option>` +
    active.map(p => `<option value="${safe(p.full_name)}">${safe(p.full_name)}</option>`).join("");
}

function populateSchedulePhotographerSelect() {
  const sel = document.getElementById("schedulePhotographerSelect");
  sel.innerHTML = `<option value="">— Оберіть фотографа —</option>` +
    allPhotographers.map(p => `<option value="${p.id}">${safe(p.full_name)} ${p.status !== 'active' ? '(неактивний)' : ''}</option>`).join("");
}

// ── ТАБЛИЦЯ ПОСЛУГ ──
function renderServicesTable() {
  const el = document.getElementById("servicesListTab");
  if (!allServices.length) { el.innerHTML = `<div class="empty">Послуг немає.</div>`; return; }
  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="services-table" style="min-width:700px;">
        <thead><tr><th>ID</th><th>Назва</th><th>Категорія</th><th>Ціна (грн)</th><th>Хв</th><th>Фото</th><th>Статус</th><th>Видимість</th><th>Дії</th></tr></thead>
        <tbody>
          ${allServices.map(s => `
            <tr>
              <td>${s.id}</td>
              <td>${safe(s.name)}</td>
              <td>${s.category === "main" ? "Основна" : "Додаткова"}</td>
              <td><input class="inline-edit-price" type="number" min="0" step="0.01" value="${Number(s.price).toFixed(2)}" id="price-${s.id}"></td>
              <td><input class="inline-edit-price" type="number" min="0" value="${s.duration_minutes||0}" id="dur-${s.id}" style="width:70px;"></td>
              <td>
                <textarea
                  class="inline-service-images"
                  id="service-images-${s.id}"
                  placeholder="Кожне фото з нового рядка"
                >${safe(s.image_url || "")}</textarea>
              </td>
              <td><span class="status ${s.status==='active'?'confirmed':'cancelled'}">${s.status==='active'?'Активна':'Неактивна'}</span></td>
              <td><span class="status ${Number(s.site_visible)===1?'confirmed':'cancelled'}">${Number(s.site_visible)===1?'Видима':'Прихована'}</span></td>
              <td style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="small-btn small-save" onclick="saveServicePrice(${s.id})">Зберегти</button>
                ${Number(s.site_visible)===1
                  ? `<button class="small-btn small-hide" onclick="toggleServiceVisibility(${s.id}, 0)">Приховати</button>`
                  : `<button class="small-btn small-show" onclick="toggleServiceVisibility(${s.id}, 1)">Показати</button>`}
                ${s.status==='active'
                  ? `<button class="small-btn small-hide" onclick="toggleServiceStatus(${s.id},'inactive')" style="background:#fff3cd;color:#856404;">Деактивувати</button>`
                  : `<button class="small-btn small-show" onclick="toggleServiceStatus(${s.id},'active')">Активувати</button>`}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function saveServicePrice(id) {
  const service = allServices.find(s => s.id === id);
  if (!service) return;
  const price    = parseFloat(document.getElementById(`price-${id}`).value);
  const duration = parseInt(document.getElementById(`dur-${id}`).value);
  const imageUrl = document.getElementById(`service-images-${id}`)
    ? document.getElementById(`service-images-${id}`).value.trim()
    : "";
  try {
    const resp = await fetch(`${API_URL}/api/admin/services/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: service.name, category: service.category, description: service.description,
        imageUrl,
        price, durationMinutes: duration, status: service.status,
        siteVisible: service.site_visible, displayOrder: service.display_order
      })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    service.price = price; service.duration_minutes = duration; service.image_url = imageUrl;
    showSiteAlert(`Ціну послуги "${service.name}" змінено на ${price} грн.`);
    populateServiceSelects();
  } catch (e) { showSiteAlert("Помилка: " + e.message); }
}

async function toggleServiceVisibility(id, visible) {
  const service = allServices.find(s => s.id === id);
  if (!service) return;

  const confirmed = await showConfirmModal({
    title: visible === 0 ? "Приховати послугу?" : "Показати послугу?",
    text: visible === 0
      ? `Послуга "${service.name}" зникне зі сторінки сайту та з форми бронювання.`
      : `Послуга "${service.name}" знову з’явиться на сайті та у формі бронювання.`,
    confirmText: visible === 0 ? "Приховати" : "Показати"
  });

  if (!confirmed) return;
  try {
    const resp = await fetch(`${API_URL}/api/admin/services/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: service.name, category: service.category, description: service.description,
        imageUrl: service.image_url || "",
        price: service.price, durationMinutes: service.duration_minutes,
        status: service.status, siteVisible: visible, displayOrder: service.display_order
      })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    service.site_visible = visible;
    renderServicesTable();
    populateServiceSelects();
  } catch (e) { showSiteAlert("Помилка: " + e.message); }
}

async function toggleServiceStatus(id, newStatus) {
  const service = allServices.find(s => s.id === id);
  if (!service) return;

  const confirmed = await showConfirmModal({
    title: newStatus === "inactive" ? "Деактивувати послугу?" : "Активувати послугу?",
    text: newStatus === "inactive"
      ? `Послуга "${service.name}" стане неактивною і зникне із сайту та форми бронювання.`
      : `Послуга "${service.name}" знову стане активною.`,
    confirmText: newStatus === "inactive" ? "Деактивувати" : "Активувати"
  });

  if (!confirmed) return;
  try {
    const resp = await fetch(`${API_URL}/api/admin/services/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: service.name, category: service.category, description: service.description,
        imageUrl: service.image_url || "",
        price: service.price, durationMinutes: service.duration_minutes,
        status: newStatus, siteVisible: newStatus==='active' ? 1 : 0, displayOrder: service.display_order
      })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    service.status = newStatus;
    if (newStatus === 'inactive') service.site_visible = 0;
    renderServicesTable();
    populateServiceSelects();
  } catch (e) { showSiteAlert("Помилка: " + e.message); }
}

async function addService() {
  const msgEl = document.getElementById("addServiceMsg");
  const name  = document.getElementById("newServiceName").value.trim();
  const price = parseFloat(document.getElementById("newServicePrice").value) || 0;
  const dur   = parseInt(document.getElementById("newServiceDuration").value) || 0;
  const cat   = document.getElementById("newServiceCategory").value;
  const desc  = document.getElementById("newServiceDesc").value.trim();
  const imageUrl  = document.getElementById("newServiceImages")
    ? document.getElementById("newServiceImages").value.trim()
    : "";
  hideMsg(msgEl);
  if (!name) { showMsg(msgEl, "Введіть назву послуги."); return; }
  try {
    const resp = await fetch(`${API_URL}/api/admin/services`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, category: cat, description: desc, imageUrl, price, durationMinutes: dur, status: "active", siteVisible: 1, displayOrder: 0 })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    showMsg(msgEl, `Послугу "${name}" додано!`, false);
    ["newServiceName","newServicePrice","newServiceDuration","newServiceDesc","newServiceImages"].forEach(id => { document.getElementById(id).value = ""; });
    await loadCatalogs();
  } catch (e) { showMsg(msgEl, "Помилка: " + e.message); }
}

function switchServicesTab(tab, btn) {
  document.getElementById("servicesListTab").style.display = tab === "list" ? "" : "none";
  document.getElementById("servicesAddTab").style.display  = tab === "add"  ? "" : "none";
  btn.closest(".modal-box").querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ── ТАБЛИЦЯ ФОТОГРАФІВ ──
function renderPhotographersTable() {
  const el = document.getElementById("photographersListTab");
  if (!allPhotographers.length) { el.innerHTML = `<div class="empty">Фотографів немає.</div>`; return; }
  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="services-table" style="min-width:500px;">
        <thead><tr><th>Ім'я</th><th>Телефон</th><th>Email</th><th>Фото</th><th>Видимість</th><th>Статус</th><th>Дії</th></tr></thead>
        <tbody>
          ${allPhotographers.map(p => `
            <tr>
              <td><strong>${safe(p.full_name)}</strong></td>
              <td>${safe(p.phone)}</td>
              <td>${safe(p.email)}</td>
              <td>
                <div class="photographer-image-editor">
                  <input
                    type="url"
                    id="photographer-image-${p.id}"
                    value="${safe(p.image_url || "")}"
                    placeholder="https://...jpg"
                  >
                  <button
                    class="small-btn small-save"
                    onclick="savePhotographerImage(${p.id})"
                  >
                    Зберегти
                  </button>
                </div>
              </td>
              <td><span class="status ${Number(p.site_visible)===1?'confirmed':'cancelled'}">${Number(p.site_visible)===1?'На сайті':'Прихований'}</span></td>
              <td><span class="status ${p.status==='active'?'confirmed':'cancelled'}">${p.status==='active'?'Активний':'Неактивний'}</span></td>
              <td style="display:flex;gap:6px;flex-wrap:wrap;">
                ${Number(p.site_visible)===1
                  ? `<button class="small-btn small-hide" onclick="togglePhotographerVisibility(${p.id}, 0)">Приховати</button>`
                  : `<button class="small-btn small-show" onclick="togglePhotographerVisibility(${p.id}, 1)">Показати</button>`}
                ${p.status==='active'
                  ? `<button class="small-btn small-hide" onclick="togglePhotographerStatus(${p.id},'inactive')">Деактивувати</button>`
                  : `<button class="small-btn small-show" onclick="togglePhotographerStatus(${p.id},'active')">Активувати</button>`}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}


async function savePhotographerImage(id) {
  const ph = allPhotographers.find(p => p.id === id);
  if (!ph) return;

  const input = document.getElementById(`photographer-image-${id}`);
  const imageUrl = input ? input.value.trim() : "";

  try {
    const resp = await fetch(`${API_URL}/api/admin/photographers/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        fullName: ph.full_name,
        email: ph.email,
        phone: ph.phone,
        instagram: ph.instagram,
        status: ph.status,
        experience: ph.experience,
        bio: ph.bio,
        imageUrl,
        siteVisible: Number(ph.site_visible) === 1 ? 1 : 0,
        displayOrder: ph.display_order || 0
      })
    });

    if (handleAuthError(resp)) return;

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);

    ph.image_url = imageUrl;
    showSiteAlert("Фото фотографа збережено.");
  } catch (e) {
    showSiteAlert("Помилка: " + e.message);
  }
}

async function togglePhotographerVisibility(id, visible) {
  const ph = allPhotographers.find(p => p.id === id);
  if (!ph) return;

  const confirmed = await showConfirmModal({
    title: visible === 0 ? "Приховати фотографа?" : "Показати фотографа?",
    text: visible === 0
      ? `Фотограф "${ph.full_name}" зникне зі сторінки сайту.`
      : `Фотограф "${ph.full_name}" знову з’явиться на сторінці сайту.`,
    confirmText: visible === 0 ? "Приховати" : "Показати"
  });

  if (!confirmed) return;
  try {
    const resp = await fetch(`${API_URL}/api/admin/photographers/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        fullName: ph.full_name, email: ph.email, phone: ph.phone,
        instagram: ph.instagram, status: ph.status,
        experience: ph.experience, bio: ph.bio, imageUrl: ph.image_url,
        siteVisible: visible, displayOrder: ph.display_order||0
      })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    ph.site_visible = visible;
    renderPhotographersTable();
    populatePhotographerSelect();
  } catch (e) { showSiteAlert("Помилка: " + e.message); }
}

async function togglePhotographerStatus(id, newStatus) {
  const ph = allPhotographers.find(p => p.id === id);
  if (!ph) return;

  const confirmed = await showConfirmModal({
    title: newStatus === "inactive" ? "Деактивувати фотографа?" : "Активувати фотографа?",
    text: newStatus === "inactive"
      ? `Фотограф "${ph.full_name}" стане неактивним і зникне із сайту та форми бронювання.`
      : `Фотограф "${ph.full_name}" знову стане доступним на сайті та у формі бронювання.`,
    confirmText: newStatus === "inactive" ? "Деактивувати" : "Активувати"
  });

  if (!confirmed) return;
  try {
    const resp = await fetch(`${API_URL}/api/admin/photographers/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        fullName: ph.full_name, email: ph.email, phone: ph.phone,
        instagram: ph.instagram, status: newStatus,
        experience: ph.experience, bio: ph.bio, imageUrl: ph.image_url,
        siteVisible: newStatus==='active' ? 1 : 0, displayOrder: ph.display_order||0
      })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    ph.status = newStatus;
    if (newStatus === 'inactive') ph.site_visible = 0;
    renderPhotographersTable();
    populatePhotographerSelect();
  } catch (e) { showSiteAlert("Помилка: " + e.message); }
}

async function addPhotographer() {
  const msgEl    = document.getElementById("addPhotographerMsg");
  const fullName = document.getElementById("newPhotographerName").value.trim();
  const phone    = document.getElementById("newPhotographerPhone").value.trim();
  const email    = document.getElementById("newPhotographerEmail").value.trim();
  const password = document.getElementById("newPhotographerPassword").value;
  const experience = document.getElementById("newPhotographerExperience").value.trim();
  const instagram  = document.getElementById("newPhotographerInstagram").value.trim();
  const bio        = document.getElementById("newPhotographerBio").value.trim();
  const imageUrl   = document.getElementById("newPhotographerImageUrl").value.trim();
  hideMsg(msgEl);
  if (!fullName) { showMsg(msgEl, "Введіть ім'я фотографа."); return; }
  if (!password || password.length < 6) { showMsg(msgEl, "Пароль має бути мінімум 6 символів."); return; }
  try {
    const resp = await fetch(`${API_URL}/api/admin/photographers`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ fullName, phone, email, password, experience, instagram, bio, imageUrl, status: "active", siteVisible: 1, displayOrder: 0 })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    showMsg(msgEl, `Фотографа "${fullName}" додано!`, false);
    ["newPhotographerName","newPhotographerPhone","newPhotographerEmail","newPhotographerPassword","newPhotographerExperience","newPhotographerInstagram","newPhotographerBio","newPhotographerImageUrl"]
      .forEach(id => { document.getElementById(id).value = ""; });
    await loadCatalogs();
  } catch (e) { showMsg(msgEl, "Помилка: " + e.message); }
}

function switchPhotographersTab(tab, btn) {
  document.getElementById("photographersListTab").style.display = tab === "list" ? "" : "none";
  document.getElementById("photographersAddTab").style.display  = tab === "add"  ? "" : "none";
  btn.closest(".modal-box").querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ══════════════════════════════
// ГРАФІК ФОТОГРАФІВ
// ══════════════════════════════

function getWeekDates(offset) {
  const today = new Date(); today.setHours(0,0,0,0);
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek + offset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeScheduleDate(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 10);
  }

  return dateStr(d);
}

function shiftWeek(delta) {
  scheduleWeekOffset += delta;
  renderScheduleGrid();
}

async function loadSchedule() {
  const sel = document.getElementById("schedulePhotographerSelect");
  const id = sel.value;
  if (!id) {
    document.getElementById("scheduleContent").style.display = "none";
    document.getElementById("scheduleEmpty").style.display = "";
    currentSchedulePhotographerId = null;
    currentScheduleData = [];
    return;
  }
  currentSchedulePhotographerId = id;
  document.getElementById("scheduleEmpty").style.display = "none";

  const days = getWeekDates(scheduleWeekOffset);
  const from = dateStr(days[0]);
  // Load 4 weeks around current view to have data cached
  const to = dateStr(new Date(days[6].getTime() + 21 * 86400000));

  try {
    const resp = await fetch(
      `${API_URL}/api/admin/photographers/${id}/schedule?dateFrom=${from}&dateTo=${to}`,
      { headers: authHeaders() }
    );
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!data.success) throw new Error(data.message);
    currentScheduleData = data.schedule || [];
    document.getElementById("scheduleContent").style.display = "";
    renderScheduleGrid();
  } catch (e) {
    showSiteAlert("Помилка завантаження графіку: " + e.message);
  }
}

function renderScheduleGrid() {
  const days = getWeekDates(scheduleWeekOffset);
  const today = new Date(); today.setHours(0,0,0,0);

  // Week label
  const opts = { day:"2-digit", month:"long" };
  document.getElementById("scheduleWeekLabel").textContent =
    `${days[0].toLocaleDateString("uk-UA", opts)} — ${days[6].toLocaleDateString("uk-UA", { ...opts, year:"numeric" })}`;

  const dayNames = ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"];
  const slotTypeLabel = { working: "Робочий", break: "Перерва", blocked: "Заблоковано", day_off: "Вихідний" };

  const grid = document.getElementById("scheduleGrid");
  grid.innerHTML = days.map((d, i) => {
    const ds = dateStr(d);
    const isToday = d.getTime() === today.getTime();
    const slots = currentScheduleData.filter(s => {
      const sd = normalizeScheduleDate(s.work_date);
      return sd === ds;
    });

    const slotsHtml = slots.map(s => `
      <div class="schedule-slot ${safe(s.slot_type)}" title="${safe(s.comment||'')}">
        <span>${slotTypeLabel[s.slot_type]||s.slot_type} ${String(s.start_time||'').slice(0,5)}–${String(s.end_time||'').slice(0,5)}</span>
        <button class="schedule-slot-del" onclick="deleteScheduleSlot(${s.id})" title="Видалити">×</button>
      </div>`).join("");

    return `<div class="schedule-day${isToday?' today':''}">
      <div class="schedule-day-header">${dayNames[i]}</div>
      <div class="schedule-day-date">${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}</div>
      ${slotsHtml}
      <button class="schedule-add-slot" onclick="openAddSlotForm('${ds}', '${d.toLocaleDateString("uk-UA")}')">+ Додати</button>
    </div>`;
  }).join("");
}

function openAddSlotForm(date, label) {
  document.getElementById("scheduleAddDate").value = date;
  document.getElementById("scheduleAddDateLabel").textContent = label;
  hideMsg(document.getElementById("scheduleAddMsg"));
  document.getElementById("scheduleAddForm").style.display = "";
  document.getElementById("scheduleAddForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
  updateScheduleTimeFields();
}

document.getElementById("scheduleSlotType").addEventListener("change", updateScheduleTimeFields);

function updateScheduleTimeFields() {
  const type = document.getElementById("scheduleSlotType").value;
  document.getElementById("scheduleTimeFields").style.display = type === "day_off" ? "none" : "";
}

async function saveScheduleSlot() {
  const msgEl = document.getElementById("scheduleAddMsg");
  hideMsg(msgEl);
  const photographerId = currentSchedulePhotographerId;
  const workDate = document.getElementById("scheduleAddDate").value;
  const slotType = document.getElementById("scheduleSlotType").value;
  const comment  = document.getElementById("scheduleSlotComment").value.trim();
  const startTime = slotType === "day_off" ? "09:00" : document.getElementById("scheduleSlotStart").value;
  const endTime   = slotType === "day_off" ? "20:00" : document.getElementById("scheduleSlotEnd").value;

  if (!photographerId || !workDate) { showMsg(msgEl, "Оберіть фотографа і дату."); return; }

  try {
    const resp = await fetch(`${API_URL}/api/admin/photographers/${photographerId}/schedule`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workDate, startTime, endTime, slotType, comment })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    document.getElementById("scheduleAddForm").style.display = "none";
    document.getElementById("scheduleSlotComment").value = "";
    await loadSchedule();
  } catch (e) { showMsg(msgEl, "Помилка: " + e.message); }
}

async function deleteScheduleSlot(slotId) {
  const confirmed = await showConfirmModal({
    title: "Видалити запис?",
    text: "Цей запис буде прибрано з графіка фотографа.",
    confirmText: "Видалити"
  });

  if (!confirmed) return;
  try {
    const resp = await fetch(`${API_URL}/api/admin/photographer-schedule/${slotId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    currentScheduleData = currentScheduleData.filter(s => s.id !== slotId);
    renderScheduleGrid();
  } catch (e) { showSiteAlert("Помилка: " + e.message); }
}

function openScheduleModal() {
  scheduleWeekOffset = 0;
  document.getElementById("scheduleAddForm").style.display = "none";
  document.getElementById("scheduleModal").classList.add("active");
}

function closeScheduleModal() {
  document.getElementById("scheduleModal").classList.remove("active");
}

// ── ПОШУК КЛІЄНТА ──
async function searchClientBookings() {
  const q = document.getElementById("globalClientSearch").value.trim();
  const resultBlock = document.getElementById("clientSearchResult");
  if (!q) { resultBlock.innerHTML = `<div class="empty">Введіть дані для пошуку.</div>`; return; }
  resultBlock.innerHTML = `<div class="empty">Пошук...</div>`;
  try {
    const resp = await fetch(`${API_URL}/api/admin/clients/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!data.clients || !data.clients.length) { resultBlock.innerHTML = `<div class="empty">Клієнтів за запитом "${safe(q)}" не знайдено.</div>`; return; }
    if (data.clients.length === 1) { await showClientSummary(data.clients[0].id, resultBlock); return; }
    resultBlock.innerHTML = `
      <div class="empty" style="margin-bottom:12px;">Знайдено кілька клієнтів. Оберіть потрібного:</div>
      ${data.clients.map(c => `
        <button class="client-list-btn" onclick="showClientSummary(${c.id}, document.getElementById('clientSearchResult'))">
          <strong>${safe(c.full_name)}</strong> &nbsp;|&nbsp; ${safe(c.phone||"—")} &nbsp;|&nbsp; ${safe(c.email||"—")}
          <span style="color:#888;font-size:13px;margin-left:12px;">Бронювань: ${c.bookings_count} | Сума: ${formatAmount(c.total_booked_amount)} грн</span>
        </button>`).join("")}`;
  } catch (e) { resultBlock.innerHTML = `<div class="error">Помилка пошуку: ${e.message}</div>`; }
}

async function showClientSummary(clientId, container) {
  container.innerHTML = `<div class="empty">Завантаження даних клієнта...</div>`;
  try {
    const resp = await fetch(`${API_URL}/api/admin/clients/${clientId}/summary`, { headers: authHeaders() });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!data.success) throw new Error(data.message);
    const c = data.client, t = data.totals, bookings = data.bookings || [];
    const bookingsTable = bookings.length
      ? `<div style="overflow-x:auto;"><table style="min-width:900px;border-collapse:collapse;width:100%;">
          <thead style="background:var(--soft);"><tr>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">ID</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Послуга</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Зал</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Фотограф</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Дата</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Статус</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Сума</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Оплачено</th>
            <th style="padding:10px 12px;border-bottom:1px solid var(--border);">Залишок</th>
          </tr></thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);">${safe(b.booking_id)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);">${safe(b.main_service||"—")}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);">${safe(b.hall_name)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);">${safe(b.photographer_name)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);">${formatDate(b.booking_date)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);"><span class="status ${safe(b.status)}">${formatBookingStatus(b.status)}</span></td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);">${formatAmount(b.total_amount)} грн</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);color:#1f6f2a;font-weight:700;">${formatAmount(b.paid_amount)} грн</td>
                <td style="padding:10px 12px;border-bottom:1px solid var(--border);color:${Number(b.amount_due)>0?'#8a342c':'#1f6f2a'};font-weight:700;">${formatAmount(b.amount_due)} грн</td>
              </tr>`).join("")}
          </tbody>
        </table></div>`
      : `<div class="empty">У клієнта немає бронювань.</div>`;
    container.innerHTML = `
      <div class="client-card">
        <div class="client-card-name">${safe(c.full_name)}</div>
        <div class="client-card-meta">
          <span>📱 ${safe(c.phone||"—")}</span>
          <span>✉️ ${safe(c.email||"—")}</span>
          ${c.instagram ? `<span>📸 ${safe(c.instagram)}</span>` : ""}
          <span>Клієнт з ${formatDate(c.created_at)}</span>
        </div>
        <div class="client-totals">
          <div class="client-total-item"><div class="client-total-value">${t.bookingsCount}</div><div class="client-total-label">Бронювань</div></div>
          <div class="client-total-item"><div class="client-total-value">${formatAmount(t.totalServicesAmount)} грн</div><div class="client-total-label">Загальна сума</div></div>
          <div class="client-total-item"><div class="client-total-value" style="color:#1f6f2a;">${formatAmount(t.paidAmount)} грн</div><div class="client-total-label">Оплачено</div></div>
          <div class="client-total-item"><div class="client-total-value" style="color:${t.amountDue>0?'#8a342c':'#1f6f2a'};">${formatAmount(t.amountDue)} грн</div><div class="client-total-label">Залишок</div></div>
        </div>
        <div class="client-bookings-title">Історія бронювань</div>
        ${bookingsTable}
      </div>`;
  } catch (e) { container.innerHTML = `<div class="error">Помилка: ${e.message}</div>`; }
}

// ── БРОНЮВАННЯ ──
function payInlineHtml(bookingId, amountDue, totalAmount, paymentState) {
  if (paymentState === "paid") return `<button class="action-btn pay-btn" disabled>✓ Оплачено</button>`;
  const label = paymentState === "partial" ? `Доплата ${formatAmount(amountDue)} грн` : `Підтвердити оплату`;
  return `
    <div class="pay-inline">
      <select id="payMethod-${bookingId}">
        <option value="cash">Готівка</option>
        <option value="card">Картка</option>
        <option value="bank_transfer">Переказ</option>
      </select>
      <button class="pay-inline-btn" onclick="markPaidInline(${bookingId}, ${amountDue})">${label}</button>
    </div>`;
}

async function markPaidInline(bookingId, amountDue) {
  const methodEl = document.getElementById(`payMethod-${bookingId}`);
  const method   = methodEl ? methodEl.value : "cash";
  const confirmedPayment = await showConfirmModal({
    title: "Підтвердити оплату?",
    text: `Сума: ${formatAmount(amountDue)} грн. Метод: ${methodEl ? methodEl.options[methodEl.selectedIndex].text : "Готівка"}.`,
    confirmText: "Підтвердити"
  });

  if (!confirmedPayment) return;
  try {
    const resp = await fetch(`${API_URL}/api/bookings/${bookingId}/mark-paid`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ amount: amountDue, paymentMethod: method })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    showSiteAlert(data.message);
    await loadBookings();
  } catch (e) { showSiteAlert("Помилка: " + e.message); }
}

function bookingActions(booking) {
  const amountDue = Number(booking.amount_due || 0);
  const payState  = booking.payment_state || "unpaid";
  const payHtml = payInlineHtml(booking.booking_id, amountDue, Number(booking.total_amount||0), payState);
  if (booking.status === "completed") return `${payHtml}
    <button class="action-btn confirm-btn" disabled>Завершено</button>
    <button class="action-btn edit-btn" onclick="openEditModal(${booking.booking_id})">Редагувати</button>
    <button class="action-btn delete-btn" onclick="deleteBooking(${booking.booking_id})">Видалити</button>`;
  if (booking.status === "cancelled") return `<button class="action-btn cancel-btn" disabled>Скасовано</button>
    <button class="action-btn edit-btn" onclick="openEditModal(${booking.booking_id})">Редагувати</button>
    <button class="action-btn delete-btn" onclick="deleteBooking(${booking.booking_id})">Видалити</button>`;
  if (booking.status === "confirmed") return `${payHtml}
    <button class="action-btn confirm-btn" disabled>Підтверджено</button>
    <button class="action-btn edit-btn" onclick="openEditModal(${booking.booking_id})">Редагувати</button>
    <button class="action-btn cancel-btn" onclick="cancelBooking(${booking.booking_id})">Скасувати</button>
    <button class="action-btn delete-btn" onclick="deleteBooking(${booking.booking_id})">Видалити</button>`;
  return `${payHtml}
    <button class="action-btn confirm-btn" onclick="changeBookingStatus(${booking.booking_id},'confirmed')">Підтвердити</button>
    <button class="action-btn edit-btn" onclick="openEditModal(${booking.booking_id})">Редагувати</button>
    <button class="action-btn cancel-btn" onclick="cancelBooking(${booking.booking_id})">Скасувати</button>
    <button class="action-btn delete-btn" onclick="deleteBooking(${booking.booking_id})">Видалити</button>`;
}

function renderBookingsTable() {
  const bookings = getFilteredBookings();
  bookingsCount.textContent = `${bookings.length} заявок`;
  if (!bookings.length) { bookingsBlock.innerHTML = `<div class="empty">Немає бронювань за обраним фільтром.</div>`; return; }
  bookingsBlock.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>ID</th><th>Клієнт</th><th>Телефон</th><th>Email</th><th>Instagram</th>
          <th>Послуги</th><th>Зал</th><th>Фотограф</th><th>Дата сесії</th><th>Час</th>
          <th>Статус</th><th>Сума</th><th>Оплата</th><th>Коментар</th>
          <th>Створено</th><th>Дії</th>
        </tr></thead>
        <tbody>
          ${bookings.map(b => `
            <tr>
              <td>${safe(b.booking_id)}</td>
              <td>${safe(b.client_name)}</td>
              <td>${safe(b.client_phone)}</td>
              <td>${safe(b.client_email)}</td>
              <td>${safe(b.client_instagram)}</td>
              <td>${formatServices(b)}</td>
              <td>${safe(b.hall_name)}</td>
              <td>${safe(b.photographer_name || "Не призначено")}</td>
              <td>${formatDate(b.booking_date)}</td>
              <td>${formatTime(b.start_time)} – ${formatTime(b.end_time)}</td>
              <td><span class="status ${safe(b.status)}">${formatBookingStatus(b.status)}</span></td>
              <td>${formatAmount(b.total_amount)} грн</td>
              <td>
                <span class="payment-badge ${safe(b.payment_state||'unpaid')}">
                  ${b.payment_state==='paid'?'✓ Оплачено':b.payment_state==='partial'?`Часткова: ${formatAmount(b.paid_amount)} грн`:'Не оплачено'}
                </span>
                ${Number(b.amount_due)>0?`<br><small style="color:#888;">Залишок: ${formatAmount(b.amount_due)} грн</small>`:""}
              </td>
              <td>${safe(b.comment)}</td>
              <td class="created-at-cell">${formatDateTime(b.created_at)}</td>
              <td><div class="actions">${bookingActions(b)}</div></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function loadBookings() {
  try {
    const resp = await fetch(`${API_URL}/api/bookings`, { headers: authHeaders() });
    if (handleAuthError(resp)) return;
    if (!resp.ok) throw new Error("Не вдалося отримати бронювання");
    const bookings = await resp.json();
    currentBookings = bookings;
    calcRevenue(bookings);
    renderBookingsTable();
  } catch (e) {
    bookingsCount.textContent = "0 заявок";
    bookingsBlock.innerHTML = `<div class="error">Не вдалося завантажити бронювання. ${e.message}</div>`;
  }
}

async function loadCallbacks() {
  try {
    const resp = await fetch(`${API_URL}/api/callbacks`, { headers: authHeaders() });
    if (handleAuthError(resp)) return;
    if (!resp.ok) throw new Error();
    const callbacks = await resp.json();
    currentCallbacks = callbacks;
    callbacksCount.textContent = `${callbacks.length} заявок`;
    if (!callbacks.length) { callbacksBlock.innerHTML = `<div class="empty">Заявок немає.</div>`; return; }
    callbacksBlock.innerHTML = `
      <div class="table-wrap">
        <table style="min-width:950px;">
          <thead><tr><th>ID</th><th>Ім'я</th><th>Телефон</th><th>Статус</th><th>Створено</th><th>Опрацьовано</th><th>Дії</th></tr></thead>
          <tbody>
            ${callbacks.map(item => `
              <tr>
                <td>${safe(item.id)}</td>
                <td>${safe(item.callback_name)}</td>
                <td>${safe(item.callback_phone)}</td>
                <td><span class="status ${safe(item.status)}">${formatCallbackStatus(item.status)}</span></td>
                <td>${formatDateTime(item.created_at)}</td>
                <td>${formatDateTime(item.processed_at)}</td>
                <td><div class="actions">
                  ${item.status==="processed"
                    ?`<button class="action-btn confirm-btn" disabled>Опрацьовано</button>`
                    :`<button class="action-btn confirm-btn" onclick="markCallbackProcessed(${item.id})">Опрацьовано</button>`}
                  <button class="action-btn edit-btn" onclick="openCreateModalFromCallback(${item.id})">Створити бронювання</button>
                  <button class="action-btn delete-btn" onclick="deleteCallback(${item.id})">Видалити</button>
                </div></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    callbacksCount.textContent = "0 заявок";
    callbacksBlock.innerHTML = `<div class="error">Не вдалося завантажити заявки.</div>`;
  }
}

// ── МОДАЛКА СТВОРЕННЯ ──
function updateCreateServiceRules() {
  const service = createService.value;
  const withoutPhotographer = SERVICES_WITHOUT_PHOTOGRAPHER.has(service);
  const outdoor = OUTDOOR_SERVICES.has(service);
  if (withoutPhotographer) {
    createPhotographer.value = ""; createPhotographer.disabled = true;
    createPhotographerGroup.classList.add("is-hidden");
  } else {
    createPhotographer.disabled = false;
    createPhotographerGroup.classList.remove("is-hidden");
  }
  if (outdoor) { createHall.value = "Без залу / виїзна зйомка"; createHall.disabled = true; }
  else { createHall.disabled = false; }
}

function openCreateModal(defaultData = {}) {
  hideMsg(createError);
  createForm.reset();
  clearClientSearchResults();
  createClientSearch.value = "";
  setClientSearchHint("Можна знайти клієнта й автоматично підставити його дані у форму.");
  createClientName.value      = defaultData.name  || "";
  createClientPhone.value     = defaultData.phone || "";
  createClientEmail.value     = defaultData.email || "";
  createClientInstagram.value = defaultData.instagram || "";
  const today = new Date().toISOString().split("T")[0];
  createDate.min   = today;
  createDate.value = defaultData.date || today;
  createTime.value = defaultData.time || "10:00";
  updateCreateServiceRules();
  createModal.classList.add("active");
}

function openCreateModalFromCallback(callbackId) {
  const cb = currentCallbacks.find(i => String(i.id) === String(callbackId));
  openCreateModal({ name: cb?.callback_name || "", phone: cb?.callback_phone || "" });
}

function closeCreateModal() { createModal.classList.remove("active"); clearClientSearchResults(); }

function setClientSearchHint(msg, type = "") {
  createClientSearchHint.textContent = msg;
  createClientSearchHint.classList.remove("success","error");
  if (type) createClientSearchHint.classList.add(type);
}
function clearClientSearchResults() {
  createClientSearchResults.innerHTML = "";
  createClientSearchResults.classList.remove("active");
}
function fillClientFields(client) {
  createClientName.value      = client.full_name || "";
  createClientPhone.value     = client.phone     || "";
  createClientEmail.value     = client.email     || "";
  createClientInstagram.value = client.instagram || "";
  createClientSearch.value    = client.full_name || client.phone || client.email || "";
  clearClientSearchResults();
  setClientSearchHint("Дані клієнта знайдено та підставлено у форму.", "success");
}

async function searchClients(q) {
  try {
    const resp = await fetch(`${API_URL}/api/admin/clients/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    const clients = data.clients || [];
    clearClientSearchResults();
    if (!clients.length) { setClientSearchHint("Клієнтів за цим запитом не знайдено.", "error"); return; }
    clients.forEach(c => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "client-search-item";
      btn.innerHTML = `<span class="client-search-name">${safe(c.full_name)}</span><span class="client-search-meta">${[c.phone,c.email,c.instagram].filter(Boolean).join(" • ")}</span>`;
      btn.addEventListener("click", () => fillClientFields(c));
      createClientSearchResults.appendChild(btn);
    });
    createClientSearchResults.classList.add("active");
    setClientSearchHint("Оберіть клієнта зі списку.");
  } catch (e) { clearClientSearchResults(); setClientSearchHint(e.message || "Помилка пошуку.", "error"); }
}

createClientSearch.addEventListener("input", function() {
  clearTimeout(clientSearchTimer);
  clearClientSearchResults();
  const q = createClientSearch.value.trim();
  if (q.length < 2) { setClientSearchHint("Введіть щонайменше 2 символи."); return; }
  setClientSearchHint("Шукаю...");
  clientSearchTimer = setTimeout(() => searchClients(q), 350);
});

createService.addEventListener("change", updateCreateServiceRules);

createForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  hideMsg(createError);
  const additionalServices = Array.from(document.querySelectorAll('input[name="createAdditionalServices"]:checked')).map(i => i.value);
  const bookingData = {
    clientName: createClientName.value.trim(), clientPhone: createClientPhone.value.trim(),
    clientEmail: createClientEmail.value.trim(), clientInstagram: createClientInstagram.value.trim(),
    service: createService.value, additionalServices,
    hall: createHall.value,
    photographer: createPhotographer.disabled ? "" : createPhotographer.value,
    bookingDate: createDate.value, bookingTime: createTime.value,
    message: createComment.value.trim()
  };
  if (!bookingData.clientName || !bookingData.clientPhone) { showMsg(createError, "Заповніть ім'я клієнта і телефон."); return; }
  if (!bookingData.service || !bookingData.bookingDate || !bookingData.bookingTime) { showMsg(createError, "Оберіть послугу, дату і час бронювання."); return; }
  createSaveBtn.disabled = true; createSaveBtn.textContent = "Створення...";
  try {
    const resp = await fetch(`${API_URL}/api/bookings`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(bookingData)
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || "Не вдалося створити бронювання.");
    closeCreateModal(); await loadBookings();
  } catch (e) { showMsg(createError, e.message || "Не вдалося створити бронювання."); }
  finally { createSaveBtn.disabled = false; createSaveBtn.textContent = "Створити бронювання"; }
});

// ── МОДАЛКА РЕДАГУВАННЯ ──
function openEditModal(bookingId) {
  const b = currentBookings.find(i => String(i.booking_id) === String(bookingId));
  if (!b) { showSiteAlert("Бронювання не знайдено."); return; }
  editBookingId.value = b.booking_id;
  editDate.value      = formatDateForInput(b.booking_date);
  editStartTime.value = timeForInput(b.start_time);
  editEndTime.value   = timeForInput(b.end_time);
  editStatus.value    = b.status || "new";
  editAmount.value    = b.total_amount || 0;
  editComment.value   = b.comment || "";
  editModal.classList.add("active");
}
function closeEditModal() { editModal.classList.remove("active"); }

editForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  const id = editBookingId.value;
  try {
    const resp = await fetch(`${API_URL}/api/bookings/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        booking_date: editDate.value, start_time: editStartTime.value,
        end_time: editEndTime.value, status: editStatus.value,
        total_amount: editAmount.value, comment: editComment.value
      })
    });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || "Не вдалося оновити.");
    closeEditModal(); await loadBookings();
  } catch (e) { showSiteAlert(e.message); }
});

// ── ОПЕРАЦІЇ ──
async function changeBookingStatus(id, status) {
  try {
    const resp = await fetch(`${API_URL}/api/bookings/${id}/status`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    await loadBookings();
  } catch (e) { showSiteAlert(e.message); }
}

async function cancelBooking(id) {
  const confirmedCancel = await showConfirmModal({
    title: "Скасувати бронювання?",
    text: "Бронювання буде позначене як скасоване.",
    confirmText: "Скасувати"
  });

  if (!confirmedCancel) return;
  try {
    const resp = await fetch(`${API_URL}/api/bookings/${id}/cancel`, { method: "PATCH", headers: authHeaders() });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    await loadBookings();
  } catch (e) { showSiteAlert(e.message); }
}

async function deleteBooking(id) {
  const confirmedDelete = await showConfirmModal({
    title: "Видалити бронювання?",
    text: "Бронювання буде повністю видалене з бази. Цю дію не можна буде скасувати.",
    confirmText: "Видалити"
  });

  if (!confirmedDelete) return;
  try {
    const resp = await fetch(`${API_URL}/api/bookings/${id}`, { method: "DELETE", headers: authHeaders() });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    await loadBookings();
  } catch (e) { showSiteAlert(e.message); }
}

async function markCallbackProcessed(id) {
  const confirmedCallback = await showConfirmModal({
    title: "Опрацювати заявку?",
    text: "Заявка буде позначена як опрацьована.",
    confirmText: "Опрацювати"
  });

  if (!confirmedCallback) return;
  try {
    const resp = await fetch(`${API_URL}/api/callbacks/${id}/status`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status: "processed" }) });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    await loadCallbacks();
  } catch (e) { showSiteAlert(e.message); }
}

async function deleteCallback(id) {
  const confirmedDeleteCallback = await showConfirmModal({
    title: "Видалити заявку?",
    text: "Заявка на дзвінок буде видалена.",
    confirmText: "Видалити"
  });

  if (!confirmedDeleteCallback) return;
  try {
    const resp = await fetch(`${API_URL}/api/callbacks/${id}`, { method: "DELETE", headers: authHeaders() });
    if (handleAuthError(resp)) return;
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message);
    await loadCallbacks();
  } catch (e) { showSiteAlert(e.message); }
}

// ── ПОДІЇ ──
openCreateBtn.addEventListener("click", () => openCreateModal());

document.getElementById("openServicesBtn").addEventListener("click", () => {
  document.getElementById("servicesModal").classList.add("active");
});
document.getElementById("openPhotographersBtn").addEventListener("click", () => {
  document.getElementById("photographersModal").classList.add("active");
});
document.getElementById("openScheduleBtn").addEventListener("click", openScheduleModal);

document.getElementById("servicesOverlay").addEventListener("click", () => {
  document.getElementById("servicesModal").classList.remove("active");
});
document.getElementById("photographersOverlay").addEventListener("click", () => {
  document.getElementById("photographersModal").classList.remove("active");
});
document.getElementById("scheduleOverlay").addEventListener("click", closeScheduleModal);

createClose.addEventListener("click", closeCreateModal);
createOverlay.addEventListener("click", closeCreateModal);
editClose.addEventListener("click", closeEditModal);
editOverlay.addEventListener("click", closeEditModal);
refreshBtn.addEventListener("click", loadAllData);
document.getElementById("logoutBtn").addEventListener("click", () => { clearAuthData(); window.location.href = "login.html"; });

document.addEventListener("click", function(e) {
  if (!createClientSearch.contains(e.target) && !createClientSearchResults.contains(e.target)) clearClientSearchResults();
});
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    closeCreateModal(); closeEditModal(); closeScheduleModal();
    document.getElementById("servicesModal").classList.remove("active");
    document.getElementById("photographersModal").classList.remove("active");
  }
});

function loadAllData() { loadBookings(); loadCallbacks(); }

// ── СТАРТ ──
updateCreateServiceRules();
loadCatalogs();
loadAllData();


/* ── БЕЗПЕЧНЕ ОНОВЛЕННЯ ДАНИХ В АДМІНПАНЕЛІ ── */
function safeRefreshAdminData() {
  if (typeof loadData === "function") {
    loadData();
    return;
  }

  if (typeof loadAllData === "function") {
    loadAllData();
    return;
  }

  if (typeof loadDashboard === "function") {
    loadDashboard();
    return;
  }

  window.location.reload();
}

document.addEventListener("DOMContentLoaded", function () {
  const refreshBtn = document.getElementById("refreshBtn");

  if (refreshBtn && !refreshBtn.dataset.refreshBound) {
    refreshBtn.dataset.refreshBound = "1";
    refreshBtn.addEventListener("click", safeRefreshAdminData);
  }
});


/* ── ПРИХОВУВАННЯ ЗАЙВИХ КНОПОК ДЛЯ ОПЛАЧЕНИХ БРОНЮВАНЬ І ОБРОБЛЕНИХ ЗАЯВОК ── */
(function () {
  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function setButtonHidden(button, hidden) {
    if (!button) return;

    if (hidden) {
      button.dataset.autoHiddenAction = "1";
      button.style.display = "none";
      return;
    }

    if (button.dataset.autoHiddenAction === "1") {
      button.style.display = "";
      delete button.dataset.autoHiddenAction;
    }
  }

  function hasPaidStatus(row) {
    const statusElements = row.querySelectorAll(".status, .payment-status, .paid-status, td span");

    const hasPaidBadge = Array.from(statusElements).some((el) => {
      if (el.closest("button")) return false;

      const text = normalizeText(el.textContent);

      return text.includes("оплачено") && !text.includes("не оплачено");
    });

    const hasDisabledPaidButton = Array.from(row.querySelectorAll("button")).some((button) => {
      const text = normalizeText(button.textContent);

      return (
        text.includes("✓ оплачено") ||
        (button.disabled && text.includes("оплачено"))
      );
    });

    return hasPaidBadge || hasDisabledPaidButton;
  }

  function hasProcessedCallbackStatus(row) {
    const statusElements = row.querySelectorAll(".status, td span");

    const hasProcessedBadge = Array.from(statusElements).some((el) => {
      if (el.closest("button")) return false;

      const text = normalizeText(el.textContent);

      return (
        text.includes("оброблено") ||
        text.includes("виконано") ||
        text.includes("закрито")
      );
    });

    const hasDisabledProcessedButton = Array.from(row.querySelectorAll("button")).some((button) => {
      const text = normalizeText(button.textContent);

      return (
        button.disabled &&
        (
          text.includes("оброблено") ||
          text.includes("виконано") ||
          text.includes("закрито")
        )
      );
    });

    return hasProcessedBadge || hasDisabledProcessedButton;
  }

  function cleanBookingRow(row) {
    const isPaid = hasPaidStatus(row);

    row.querySelectorAll("button").forEach((button) => {
      const text = normalizeText(button.textContent);

      const shouldHide =
        isPaid &&
        (
          text.includes("підтвердити") ||
          text.includes("скасувати") ||
          text.includes("оплачено")
        );

      setButtonHidden(button, shouldHide);
    });
  }

  function cleanCallbackRow(row) {
    const isProcessed = hasProcessedCallbackStatus(row);

    row.querySelectorAll("button").forEach((button) => {
      const text = normalizeText(button.textContent);

      const shouldHide =
        isProcessed &&
        (
          text.includes("обробити") ||
          text.includes("оброблено") ||
          text.includes("передзвонити") ||
          text.includes("позначити")
        );

      setButtonHidden(button, shouldHide);
    });
  }

  function cleanAdminActionButtons() {
    const bookingsSection = document.getElementById("bookingsSection");

    if (bookingsSection) {
      bookingsSection.querySelectorAll("tbody tr").forEach(cleanBookingRow);
    }

    const callbacksSection = document.getElementById("callbacksSection");

    if (callbacksSection) {
      callbacksSection.querySelectorAll("tbody tr").forEach(cleanCallbackRow);
    }
  }

  let cleanTimer = null;

  function scheduleClean() {
    clearTimeout(cleanTimer);
    cleanTimer = setTimeout(cleanAdminActionButtons, 80);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      cleanAdminActionButtons();

      const observer = new MutationObserver(scheduleClean);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    cleanAdminActionButtons();

    const observer = new MutationObserver(scheduleClean);
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();


/* ── ПОКАЗНИКИ У МОДАЛЬНОМУ ВІКНІ ── */
document.addEventListener("DOMContentLoaded", function () {
  const openStatsBtn = document.getElementById("openStatsBtn");
  const statsModal = document.getElementById("statsModal");
  const statsModalBody = document.getElementById("statsModalBody");
  const statsModalClose = document.getElementById("statsModalClose");
  const statsModalOverlay = document.getElementById("statsModalOverlay");
  const revenueBlock = document.getElementById("revenueBlock");

  if (statsModalBody && revenueBlock && !statsModalBody.contains(revenueBlock)) {
    statsModalBody.appendChild(revenueBlock);
  }

  function openStatsModal() {
    if (!statsModal) return;
    statsModal.classList.add("active");
  }

  function closeStatsModal() {
    if (!statsModal) return;
    statsModal.classList.remove("active");
  }

  if (openStatsBtn) {
    openStatsBtn.addEventListener("click", openStatsModal);
  }

  if (statsModalClose) {
    statsModalClose.addEventListener("click", closeStatsModal);
  }

  if (statsModalOverlay) {
    statsModalOverlay.addEventListener("click", closeStatsModal);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeStatsModal();
    }
  });
});


/* ── СЕКЦІЯ ПОКАЗНИКІВ УНИЗУ СТОРІНКИ + ДОДАТКОВІ ПОКАЗНИКИ ── */
(function () {
  function parseAmount(value) {
    if (value === null || value === undefined) return 0;

    const number = String(value)
      .replace(/\s/g, "")
      .replace("грн", "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");

    return Number(number) || 0;
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("uk-UA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " грн";
  }

  function normalizeDate(value) {
    if (!value) return "";

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function todayString() {
    return normalizeDate(new Date());
  }

  function datePlusDays(days) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return normalizeDate(d);
  }

  function getBookingAmount(booking) {
    return parseAmount(
      booking.total_amount ??
      booking.totalAmount ??
      booking.amount ??
      booking.price ??
      booking.total_price ??
      booking.services_amount
    );
  }

  function getPaidAmount(booking) {
    return parseAmount(
      booking.paid_amount ??
      booking.paidAmount ??
      booking.payment_amount ??
      booking.amount_paid
    );
  }

  function isPaidBooking(booking) {
    const status = String(booking.payment_state || booking.payment_status || booking.paymentStatus || booking.status || "").toLowerCase();
    const paid = getPaidAmount(booking);
    const total = getBookingAmount(booking);

    return (
      status.includes("paid") ||
      status.includes("оплач") ||
      booking.is_paid === 1 ||
      booking.isPaid === true ||
      (total > 0 && paid >= total)
    );
  }

  function isCancelledBooking(booking) {
    const status = String(booking.status || booking.booking_status || "").toLowerCase();
    return status.includes("cancel") || status.includes("скас");
  }

  function getBookingDate(booking) {
    return normalizeDate(
      booking.booking_date ||
      booking.bookingDate ||
      booking.session_date ||
      booking.date
    );
  }

  function getPaymentDate(booking) {
    return normalizeDate(
      booking.payment_date ||
      booking.paid_at ||
      booking.payment_created_at ||
      booking.updated_at ||
      booking.created_at
    );
  }

  function getField(booking, names) {
    for (const name of names) {
      if (booking[name]) return String(booking[name]).trim();
    }

    return "";
  }

  function mostPopular(bookings, fields) {
    const counts = new Map();

    bookings.forEach((booking) => {
      const raw = getField(booking, fields);
      if (!raw) return;

      raw
        .split(",")
        .map(v => v.trim())
        .filter(Boolean)
        .forEach((item) => {
          counts.set(item, (counts.get(item) || 0) + 1);
        });
    });

    let bestName = "—";
    let bestCount = 0;

    counts.forEach((count, name) => {
      if (count > bestCount) {
        bestName = name;
        bestCount = count;
      }
    });

    return {
      name: bestName,
      count: bestCount
    };
  }

  function normalizeBookingsResponse(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.bookings)) return data.bookings;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && Array.isArray(data.data.bookings)) return data.data.bookings;
    return [];
  }

  function renderExtraStats(bookings) {
    const box = document.getElementById("extraStatsGrid");
    if (!box) return;

    const today = todayString();
    const in7Days = datePlusDays(7);

    const paidBookings = bookings.filter(isPaidBooking);
    const paidToday = paidBookings.filter((booking) => getPaymentDate(booking) === today);

    const todayIncome = paidToday.reduce((sum, booking) => {
      const paid = getPaidAmount(booking);
      return sum + (paid || getBookingAmount(booking));
    }, 0);

    const totalPaidIncome = paidBookings.reduce((sum, booking) => {
      const paid = getPaidAmount(booking);
      return sum + (paid || getBookingAmount(booking));
    }, 0);

    const averageCheck = paidBookings.length
      ? totalPaidIncome / paidBookings.length
      : 0;

    const unpaidCount = bookings.filter((booking) => {
      return !isCancelledBooking(booking) && !isPaidBooking(booking);
    }).length;

    const cancelledCount = bookings.filter(isCancelledBooking).length;

    const popularService = mostPopular(bookings, [
      "main_service",
      "service_name",
      "service",
      "services"
    ]);

    const popularHall = mostPopular(bookings, [
      "hall_name",
      "hall"
    ]);

    const popularPhotographer = mostPopular(bookings, [
      "photographer_name",
      "photographer"
    ]);

    const upcoming7 = bookings.filter((booking) => {
      const date = getBookingDate(booking);
      return date && date >= today && date <= in7Days && !isCancelledBooking(booking);
    }).length;

    const items = [
      {
        label: "Дохід за сьогодні",
        value: formatMoney(todayIncome),
        note: "за оплатами, проведеними сьогодні"
      },
      {
        label: "Оплат за сьогодні",
        value: paidToday.length,
        note: "кількість підтверджених оплат"
      },
      {
        label: "Середній чек",
        value: formatMoney(averageCheck),
        note: "середня сума оплаченого бронювання"
      },
      {
        label: "Неоплачені бронювання",
        value: unpaidCount,
        note: "активні бронювання без повної оплати"
      },
      {
        label: "Скасовані бронювання",
        value: cancelledCount,
        note: "за весь період"
      },
      {
        label: "Найпопулярніша послуга",
        value: popularService.name,
        note: popularService.count ? `${popularService.count} бронювань` : "немає даних"
      },
      {
        label: "Найпопулярніший зал",
        value: popularHall.name,
        note: popularHall.count ? `${popularHall.count} бронювань` : "немає даних"
      },
      {
        label: "Найзавантаженіший фотограф",
        value: popularPhotographer.name,
        note: popularPhotographer.count ? `${popularPhotographer.count} бронювань` : "немає даних"
      },
      {
        label: "Бронювання на 7 днів",
        value: upcoming7,
        note: "майбутні активні бронювання"
      }
    ];

    box.innerHTML = items.map((item) => `
      <div class="extra-stat-item">
        <div class="extra-stat-label">${item.label}</div>
        <div class="extra-stat-value">${item.value}</div>
        <div class="extra-stat-note">${item.note}</div>
      </div>
    `).join("");
  }

  async function loadExtraStats() {
    const box = document.getElementById("extraStatsGrid");
    if (!box) return;

    box.innerHTML = `
      <div class="extra-stat-item">
        <div class="extra-stat-label">Завантаження</div>
        <div class="extra-stat-value">—</div>
        <div class="extra-stat-note">отримуємо дані</div>
      </div>
    `;

    try {
      const headers = typeof authHeaders === "function" ? authHeaders() : {};
      const response = await fetch(`${API_URL}/api/bookings`, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Не вдалося отримати бронювання.");
      }

      renderExtraStats(normalizeBookingsResponse(data));
    } catch (error) {
      box.innerHTML = `
        <div class="extra-stat-item">
          <div class="extra-stat-label">Помилка</div>
          <div class="extra-stat-value">—</div>
          <div class="extra-stat-note">Не вдалося завантажити додаткові показники.</div>
        </div>
      `;
    }
  }

  function moveStatsToBottom() {
    const page = document.querySelector("main.page");
    const revenueBlock = document.getElementById("revenueBlock");

    if (!page || !revenueBlock) return;

    let statsSection = document.getElementById("statsSection");

    if (!statsSection) {
      statsSection = document.createElement("section");
      statsSection.className = "section stats-page-section";
      statsSection.id = "statsSection";
    }

    statsSection.innerHTML = `
      <div class="section-header stats-page-header">
        <div>
          <h2>Показники фотостудії</h2>
          <p>Фінансові, адміністративні та робочі дані по бронюваннях.</p>
        </div>
      </div>

      <h3 class="stats-block-title">Основні показники</h3>
      <div id="statsPageBody"></div>

      <h3 class="stats-block-title">Додаткові показники</h3>
      <div class="extra-stats-grid" id="extraStatsGrid"></div>
    `;

    page.appendChild(statsSection);

    const statsPageBody = document.getElementById("statsPageBody");

    if (statsPageBody && !statsPageBody.contains(revenueBlock)) {
      statsPageBody.appendChild(revenueBlock);
    }

    loadExtraStats();
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(moveStatsToBottom, 200);

    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        setTimeout(loadExtraStats, 500);
      });
    }
  });
})();


/* ── ТОЧНИЙ ПЕРЕРАХУНОК ОСНОВНИХ ПОКАЗНИКІВ ВІД 01.01.2026 ── */
(function () {
  function parseAmount(value) {
    if (value === null || value === undefined) return 0;

    return Number(
      String(value)
        .replace(/\s/g, "")
        .replace("грн", "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    ) || 0;
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("uk-UA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " грн";
  }

  function normalizeDate(value) {
    if (!value) return "";

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function getBookingDate(booking) {
    return normalizeDate(
      booking.booking_date ||
      booking.bookingDate ||
      booking.session_date ||
      booking.date
    );
  }

  function getPaidAmount(booking) {
    return parseAmount(
      booking.paid_amount ??
      booking.paidAmount ??
      booking.payment_amount ??
      booking.amount_paid ??
      booking.total_paid
    );
  }

  function getTotalAmount(booking) {
    return parseAmount(
      booking.total_amount ??
      booking.totalAmount ??
      booking.amount ??
      booking.price ??
      booking.total_price ??
      booking.services_amount
    );
  }

  function isCancelled(booking) {
    const status = String(
      booking.status ||
      booking.booking_status ||
      ""
    ).toLowerCase();

    return status.includes("cancel") || status.includes("скас");
  }

  function isPaid(booking) {
    const paymentState = String(
      booking.payment_state ||
      booking.payment_status ||
      booking.paymentStatus ||
      ""
    ).toLowerCase();

    const status = String(
      booking.status ||
      booking.booking_status ||
      ""
    ).toLowerCase();

    const paid = getPaidAmount(booking);
    const total = getTotalAmount(booking);

    return (
      paymentState.includes("paid") ||
      paymentState.includes("оплач") ||
      status === "paid" ||
      status === "completed" ||
      status.includes("оплач") ||
      booking.is_paid === 1 ||
      booking.isPaid === true ||
      (total > 0 && paid >= total)
    );
  }

  function getPaidValue(booking) {
    const paid = getPaidAmount(booking);
    const total = getTotalAmount(booking);

    return paid > 0 ? paid : total;
  }

  function getCurrentMonthRange() {
    const now = new Date();

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      start: normalizeDate(start),
      end: normalizeDate(end)
    };
  }

  function normalizeBookingsResponse(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.bookings)) return data.bookings;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && Array.isArray(data.data.bookings)) return data.data.bookings;
    return [];
  }

  function findStatCardByTitle(text) {
    const cards = document.querySelectorAll("#revenueBlock > div");

    return Array.from(cards).find((card) => {
      return String(card.textContent || "")
        .toLowerCase()
        .includes(text.toLowerCase());
    });
  }

  function setCardValue(card, value, note) {
    if (!card) return;

    const valueEl =
      card.querySelector(".stat-value") ||
      card.querySelector(".revenue-value") ||
      card.querySelector("strong");

    const noteEl =
      card.querySelector(".stat-subtitle") ||
      card.querySelector(".revenue-subtitle") ||
      card.querySelector("p");

    if (valueEl) valueEl.textContent = value;
    if (noteEl && note) noteEl.textContent = note;
  }

  async function recalcMainStatsFromJanuary() {
    try {
      const headers = typeof authHeaders === "function" ? authHeaders() : {};
      const response = await fetch(`${API_URL}/api/bookings`, { headers });
      const data = await response.json();

      if (!response.ok) return;

      const bookings = normalizeBookingsResponse(data);
      const fromDate = "2026-01-01";
      const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

      const activeBookings = bookings.filter((booking) => !isCancelled(booking));

      const paidFromJanuary = activeBookings.filter((booking) => {
        const date = getBookingDate(booking);
        return date >= fromDate && isPaid(booking);
      });

      const paidCurrentMonth = activeBookings.filter((booking) => {
        const date = getBookingDate(booking);
        return date >= monthStart && date <= monthEnd && isPaid(booking);
      });

      const unpaidConfirmed = activeBookings.filter((booking) => {
        const status = String(booking.status || booking.booking_status || "").toLowerCase();

        return (
          !isPaid(booking) &&
          (
            status.includes("confirmed") ||
            status.includes("підтвер") ||
            status === "new" ||
            status.includes("очіку")
          )
        );
      });

      const totalIncome = paidFromJanuary.reduce((sum, booking) => {
        return sum + getPaidValue(booking);
      }, 0);

      const monthIncome = paidCurrentMonth.reduce((sum, booking) => {
        return sum + getPaidValue(booking);
      }, 0);

      const expectedIncome = unpaidConfirmed.reduce((sum, booking) => {
        return sum + getTotalAmount(booking);
      }, 0);

      setCardValue(
        findStatCardByTitle("загальний дохід"),
        formatMoney(totalIncome),
        `з ${paidFromJanuary.length} оплачених бронювань від січня 2026 р.`
      );

      setCardValue(
        findStatCardByTitle("поточний місяць"),
        formatMoney(monthIncome),
        `оплачено у поточному місяці`
      );

      setCardValue(
        findStatCardByTitle("очікується"),
        formatMoney(expectedIncome),
        `підтверджені, ще не оплачені`
      );

      setCardValue(
        findStatCardByTitle("всього бронювань"),
        String(activeBookings.length),
        `не враховуючи скасовані`
      );
    } catch (error) {
      console.warn("Не вдалося перерахувати основні показники:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(recalcMainStatsFromJanuary, 700);

    const refreshBtn = document.getElementById("refreshBtn");

    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        setTimeout(recalcMainStatsFromJanuary, 700);
      });
    }
  });

  window.recalcMainStatsFromJanuary = recalcMainStatsFromJanuary;
})();
