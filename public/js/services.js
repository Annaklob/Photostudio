const API_URL = "http://192.168.116.129:3000";

    const SERVICES_WITHOUT_PHOTOGRAPHER = new Set([
      "Оренда залу для стороннього фотографа",
      "Погодинна оренда залу",
      "Оренда студії для стороннього фотографа"
    ]);

    const OUTDOOR_SERVICES = new Set([
      "Виїзна фотосесія в межах міста",
      "Виїзна фотосесія за межами міста",
      "Репортажна зйомка подій"
    ]);

    // Статичні фото (не в БД)
    const SERVICE_IMAGES = {
      "Портретна фотосесія":                    ["https://i.pinimg.com/1200x/e8/d2/5b/e8d25be03fd39bd44dc929cc297a190f.jpg","https://i.pinimg.com/736x/a7/3f/37/a73f3763abc7cf1c0417908ede2755d6.jpg","https://i.pinimg.com/1200x/d0/a5/e2/d0a5e2720e64cb58e09641fc6a31477d.jpg","https://i.pinimg.com/1200x/b7/9e/cc/b79ecca79d6f8b5d4cae8d0752113a55.jpg","https://i.pinimg.com/736x/48/c8/0a/48c80ac9543042e326a436ec2c3c0a87.jpg"],
      "Індивідуальна студійна фотосесія":        ["https://i.pinimg.com/736x/2e/31/be/2e31be14dcfafeff25778b8f6ae91f15.jpg","https://i.pinimg.com/736x/a2/5a/72/a25a724aff0676d9c9fe6af3ecfb0069.jpg","https://i.pinimg.com/736x/f5/c6/32/f5c632cd708af3a43e0c85f1cbe71468.jpg","https://i.pinimg.com/736x/8f/5c/80/8f5c8022c16f5ddfaaa9788b3b05adbd.jpg","https://i.pinimg.com/736x/16/b1/41/16b141d3c268e60d1d26922fdaf1c170.jpg"],
      "Сімейна фотосесія":                       ["https://i.pinimg.com/1200x/59/ed/37/59ed379609268a8b84d1afb0ad7e5e4b.jpg","https://i.pinimg.com/736x/60/b6/a5/60b6a5eccc7717274181738bb52dc57b.jpg","https://i.pinimg.com/736x/d9/a4/d4/d9a4d4852cda3a456567e7e117814ca8.jpg","https://i.pinimg.com/736x/ae/47/13/ae4713094a8d7a2e73b0ccb80d450595.jpg","https://i.pinimg.com/1200x/b2/df/c8/b2dfc8cf33bf268359d0889282780180.jpg"],
      "Дитяча фотосесія":                        ["https://i.pinimg.com/736x/40/1d/26/401d268e24223e1a9d572d903ff41776.jpg","https://i.pinimg.com/736x/b5/ba/fa/b5bafa8cfffe99ac54c5e50caa6ec29f.jpg","https://i.pinimg.com/736x/0c/99/dc/0c99dc9a0c4e6e9e3337ff64392f5511.jpg","https://i.pinimg.com/736x/66/1a/98/661a984eaa753fba87f2c6c26e55689e.jpg","https://i.pinimg.com/736x/46/8d/81/468d81d3cefd27c746e80249775d054d.jpg"],
      "Love Story фотосесія":                    ["https://i.pinimg.com/736x/aa/0a/55/aa0a55e5e9bae7b90d00330728e1ced7.jpg","https://i.pinimg.com/1200x/b1/83/45/b1834578bf2022c49c76e02821d49340.jpg","https://i.pinimg.com/1200x/4a/45/69/4a45697420fd33431999f0aa60e0f599.jpg","https://i.pinimg.com/736x/d1/2c/ce/d12cce565b723d0bc69d79e39e419d86.jpg","https://i.pinimg.com/1200x/3e/d7/90/3ed7907785543539dd008f1bc4c3cec7.jpg"],
      "Весільна фотозйомка":                     ["https://i.pinimg.com/1200x/23/49/90/23499090e8402c6ecb8de2fa30381eae.jpg","https://i.pinimg.com/1200x/e1/15/2e/e1152eab053b1eec9a40fa6f870f60ab.jpg","https://i.pinimg.com/736x/32/4e/04/324e04e118bd2324e34eefda5db53ef7.jpg","https://i.pinimg.com/736x/35/9c/e6/359ce6a3fbc833e887f51a87c9fd0e80.jpg","https://i.pinimg.com/1200x/6f/d9/e1/6fd9e1838c06b8fba39d264f0b1c43f9.jpg"],
      "Фотосесія вагітності":                    ["https://i.pinimg.com/1200x/65/12/d7/6512d7113f2f6396f5e5dc289533e18d.jpg","https://i.pinimg.com/736x/6c/f0/96/6cf0962e29a51c6298d18ae5de2b3d63.jpg","https://i.pinimg.com/736x/09/ba/ec/09baec8d15936a2213086186a290f59f.jpg","https://i.pinimg.com/736x/4e/40/d0/4e40d0c3a35109c7638956d8536f1020.jpg","https://i.pinimg.com/1200x/17/86/29/17862967dfdf5c8188ac3d0d14e3e672.jpg"],
      "Newborn-фотосесія":                       ["https://i.pinimg.com/736x/00/8b/99/008b99578e9517bc6b718adfa2df3d1d.jpg","https://i.pinimg.com/736x/cb/a0/3d/cba03de877eec5dff7747c20db0837ee.jpg","https://i.pinimg.com/736x/21/d2/fd/21d2fdb691e315a949bd2f286ef56099.jpg","https://i.pinimg.com/736x/65/25/df/6525df5b41ab05212c218ee3c84c97b9.jpg","https://i.pinimg.com/1200x/b3/af/7e/b3af7ecc1752c8a762dbfbf303861b44.jpg"],
      "Предметна фотозйомка":                    ["https://i.pinimg.com/1200x/c4/38/23/c4382320d79f3144b379695e27b3be3a.jpg","https://i.pinimg.com/1200x/4c/5e/d9/4c5ed915227ed6ac713b44e69245f633.jpg","https://i.pinimg.com/736x/99/53/da/9953da709475f31c9a358932e0552501.jpg","https://i.pinimg.com/736x/d9/e2/d3/d9e2d3fe514c4561d257c78ba1bd022c.jpg","https://i.pinimg.com/1200x/4e/0a/da/4e0ada2d5e44f3dc0325d9479ec7018a.jpg"],
      "Контент-зйомка для брендів":              ["https://i.pinimg.com/1200x/f7/b5/51/f7b551af01abfe129e26d5fc5eeb5380.jpg","https://i.pinimg.com/1200x/67/53/4f/67534f73669df2d96f8729e6540d0232.jpg","https://i.pinimg.com/1200x/c6/b0/de/c6b0de86106c41a04bb89eaf16e3b09e.jpg","https://i.pinimg.com/1200x/f9/c6/4f/f9c64f6f4cd87de7dc85c160d609b240.jpg"],
      "Каталожна фотозйомка":                    ["https://i.pinimg.com/1200x/00/d9/e2/00d9e2c1f6a6cf11e3d74ce55e469811.jpg","https://i.pinimg.com/1200x/06/56/cf/0656cfbfeb6ee678df92929aa96d46dd.jpg","https://i.pinimg.com/1200x/26/23/c0/2623c03ba4e02e7172ee593c149e4689.jpg"],
      "Виїзна фотосесія в межах міста":          ["https://i.pinimg.com/1200x/28/a5/c5/28a5c5fec2467f03c8785209e080a76e.jpg","https://i.pinimg.com/1200x/12/5d/46/125d465dff5ad00c223800520e70d479.jpg","https://i.pinimg.com/1200x/7e/b5/f6/7eb5f61468b4d6bd28632a67a2d932f4.jpg","https://i.pinimg.com/1200x/b0/ba/92/b0ba92dd2d9c8a5c1db14195ada17568.jpg","https://i.pinimg.com/1200x/4f/e7/ac/4fe7acffdaa4360b77ebcf5163e40d6f.jpg"],
      "Виїзна фотосесія за межами міста":        ["https://i.pinimg.com/1200x/f5/9d/4f/f59d4f85105fda3a91ae4545e5da647a.jpg","https://i.pinimg.com/736x/6d/91/a6/6d91a60780aaaf05809bf99be19b72ce.jpg","https://i.pinimg.com/1200x/bc/41/31/bc4131de79aee5db9a266f1b709b6fe7.jpg","https://i.pinimg.com/1200x/4e/94/bf/4e94bfe2eaa9b299b36847d813016d6e.jpg","https://i.pinimg.com/736x/be/cd/70/becd70750b107a4b02e8a42912eccb4a.jpg"],
      "Репортажна зйомка подій":                 ["https://i.pinimg.com/736x/a9/fe/15/a9fe159ae578533e9c9b1fd5f25a78aa.jpg","https://i.pinimg.com/736x/e8/4c/26/e84c26869f53ec48ca43460c6df31de7.jpg","https://i.pinimg.com/1200x/a9/47/86/a94786e7c2c92715357bc16f083e3836.jpg"],
      "Погодинна оренда залу":                   ["https://i.pinimg.com/736x/a5/54/07/a55407c4703f37d5b654e9e49705f535.jpg","https://i.pinimg.com/1200x/08/74/ce/0874ce69b270ea1bebf98f6ab2070b0d.jpg"],
      "Оренда залу для стороннього фотографа":   ["https://i.pinimg.com/736x/a5/54/07/a55407c4703f37d5b654e9e49705f535.jpg","https://i.pinimg.com/1200x/21/cd/05/21cd0545c3f4bdb77ec0e14eb54b250e.jpg"],
      "Аерозйомка":                              ["https://ireland.apollo.olxcdn.com/v1/files/zkgbn044ejdl1-UA/image;s=960x960"],
      "default":                                 ["https://i.pinimg.com/736x/a5/54/07/a55407c4703f37d5b654e9e49705f535.jpg"]
    };

    // ── AUTH ──
    function getToken()     { return (sessionStorage.getItem("luminaToken") || localStorage.getItem("luminaToken")); }
    function getSavedUser() { try { return JSON.parse((sessionStorage.getItem("luminaUser") || localStorage.getItem("luminaUser")) || "null"); } catch { return null; } }
    function clearAuthData(){ localStorage.removeItem("luminaToken"); localStorage.removeItem("luminaUser"); }

    // ── МЕНЮ: кабінет або увійти ──
    function renderNavAuth() {
      const link = document.getElementById("navAuthLink");
      if (!link) return;
      const savedUser = getSavedUser();
      const token     = getToken();
      if (token && savedUser) {
        const role = savedUser.role;
        let href = "login.html";
        if (role === "admin")        href = "admin.html";
        else if (role === "photographer") href = "photographer-panel.html";
        else                         href = "client-panel.html";
        link.href = href;
        link.textContent = "🗂 Мій кабінет";
        link.classList.add("nav-cabinet");
      } else {
        link.href = "login.html";
        link.textContent = "Увійти";
        link.classList.remove("nav-cabinet");
      }
    }

    // ── Форматування ──
    function formatPrice(service) {
      const price = Number(service.price);
      const dur   = Number(service.duration_minutes);
      if (!price) return "Уточнюйте ціну";
      const ps = price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
      return dur > 0 ? `${ps} грн · ${dur} хв` : `${ps} грн`;
    }
    function formatPriceOption(service) {
      const price = Number(service.price);
      const dur   = Number(service.duration_minutes);
      if (!price) return service.name;
      const ps = price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
      return dur > 0 ? `${service.name} — ${ps} грн / ${dur} хв` : `${service.name} — ${ps} грн`;
    }

    function getServiceImages(service) {
      return SERVICE_IMAGES[service.name] || SERVICE_IMAGES["default"];
    }

    // ── Кеш ──
    let allServicesCache      = [];
    let allHallsCache         = [];
    let allPhotographersCache = [];

    // ── Завантаження (публічні ендпоінти — тільки active + site_visible=1) ──
    async function loadAllCatalogs() {
      try {
        const [sR, hR, pR] = await Promise.all([
          fetch(`${API_URL}/api/services/public`),
          fetch(`${API_URL}/api/halls/public`),
          fetch(`${API_URL}/api/photographers/public`)
        ]);
        const [sD, hD, pD] = await Promise.all([sR.json(), hR.json(), pR.json()]);
        if (sD.success) allServicesCache      = sD.services      || [];
        if (hD.success) allHallsCache         = hD.halls         || [];
        if (pD.success) allPhotographersCache = pD.photographers || [];
      } catch (e) { console.error("Помилка каталогів:", e); }

      renderMainServices();
      renderExtraServices();
      renderFormSelects();
    }

    // ── Картки основних послуг (лише видимі з БД) ──
    function renderMainServices() {
      const track = document.getElementById("servicesTrack");

      // Фіксований пріоритетний порядок
      const SERVICE_ORDER = [
        "Портретна фотосесія","Індивідуальна студійна фотосесія","Сімейна фотосесія",
        "Дитяча фотосесія","Love Story фотосесія","Весільна фотозйомка",
        "Фотосесія вагітності","Newborn-фотосесія","Предметна фотозйомка",
        "Контент-зйомка для брендів","Каталожна фотозйомка",
        "Виїзна фотосесія в межах міста","Виїзна фотосесія за межами міста",
        "Репортажна зйомка подій","Погодинна оренда залу",
        "Оренда залу для стороннього фотографа"
      ];

      // Тільки послуги що прийшли з /api/services/public (вже відфільтровані БД)
      const mainByName = {};
      allServicesCache.filter(s => s.category === "main").forEach(s => { mainByName[s.name] = s; });

      track.innerHTML = "";

      // Спочатку у фіксованому порядку
      SERVICE_ORDER.forEach(name => {
        const s = mainByName[name];
        if (!s) return; // прихована або видалена — не показуємо
        appendServiceCard(track, s);
        delete mainByName[name]; // прибираємо щоб не дублювати
      });

      // Додаткові нові послуги яких нема в ORDER
      Object.values(mainByName).forEach(s => appendServiceCard(track, s));

      // Hover slideshow
      track.querySelectorAll(".service-card").forEach(card => {
        const img    = card.querySelector(".service-image img");
        const images = JSON.parse(card.dataset.images || "[]");
        if (!images.length) return;
        let idx = 0, timer = null;
        const show = i => {
          img.style.opacity = "0.2";
          setTimeout(() => {
            img.src = images[i];
            img.style.opacity = card.classList.contains("aero-card") ? "0.45" : "1";
          }, 140);
        };
        card.addEventListener("mouseenter", () => {
          if (images.length <= 1 || timer) return;
          timer = setInterval(() => { idx = (idx + 1) % images.length; show(idx); }, 700);
        });
        card.addEventListener("mouseleave", () => { clearInterval(timer); timer = null; idx = 0; show(0); });
      });
    }

    function appendServiceCard(track, service) {
      const name   = service.name;
      const images = getServiceImages(service);
      const card   = document.createElement("article");
      card.className = "service-card";
      card.dataset.images = JSON.stringify(images);
      card.innerHTML = `
        <div class="service-image"><img src="${images[0]}" alt="${name}" loading="lazy"></div>
        <div class="service-name">${name}</div>
        <div class="service-price">${formatPrice(service)}</div>
        <button class="card-book open-booking" type="button" data-service="${name}">Забронювати</button>`;
      track.appendChild(card);
    }

    // ── Додаткові послуги (лише видимі з БД) ──
    function renderExtraServices() {
      const grid   = document.getElementById("extraServicesGrid");
      const extras = allServicesCache.filter(s => s.category === "additional");
      if (!extras.length) { grid.innerHTML = `<div class="extra-loading">Додаткові послуги не знайдено.</div>`; return; }
      const half  = Math.ceil(extras.length / 2);
      const col   = items => items.map(s => `
        <div class="extra-item">
          <span class="name">${s.name}</span>
          <span class="price">${formatPrice(s)}</span>
        </div>`).join("");
      grid.innerHTML = `
        <div class="extra-column">${col(extras.slice(0, half))}</div>
        <div class="extra-column">${col(extras.slice(half))}</div>`;
    }

    // ── Дропдауни форми — дані з БД (вже відфільтровані) ──
    function renderFormSelects() {
      const serviceEl = document.getElementById("service");
      const hallEl    = document.getElementById("hall");
      const photoEl   = document.getElementById("photographer");
      const addEl     = document.getElementById("additionalServicesForm");

      const mainSvcs = allServicesCache.filter(s => s.category === "main");
      const addSvcs  = allServicesCache.filter(s => s.category === "additional");

      serviceEl.innerHTML = `<option value="">Оберіть основну послугу</option>` +
        mainSvcs.map(s => `<option value="${s.name}">${formatPriceOption(s)}</option>`).join("");

      addEl.innerHTML = addSvcs.length
        ? addSvcs.map(s => `<label><input type="checkbox" name="additionalServices[]" value="${s.name}"> ${formatPriceOption(s)}</label>`).join("")
        : `<span style="color:#999;font-size:14px;">Додаткових послуг немає</span>`;

      hallEl.innerHTML = `<option value="">Оберіть зал</option>` +
        allHallsCache.map(h => `<option value="${h.name}">${h.name}</option>`).join("") +
        `<option value="Без залу / виїзна зйомка">Без залу / виїзна зйомка</option>`;

      photoEl.innerHTML = `<option value="">Оберіть фотографа</option>` +
        allPhotographersCache.map(p => `<option value="${p.full_name}">${p.full_name}</option>`).join("") +
        ``;
    }

    // ── Слайдер ──
    const viewport = document.getElementById("servicesViewport");
    document.getElementById("prevBtn").addEventListener("click", () => viewport.scrollBy({ left: -viewport.clientWidth, behavior: "smooth" }));
    document.getElementById("nextBtn").addEventListener("click", () => viewport.scrollBy({ left: viewport.clientWidth, behavior: "smooth" }));
    viewport.addEventListener("wheel", e => {
      if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        viewport.scrollBy({ left: e.deltaY, behavior: "smooth" });
      }
    }, { passive: false });

    // ── DOM форми ──
    const bookingModal     = document.getElementById("bookingModal");
    const bookingClose     = document.getElementById("bookingClose");
    const bookingOverlay   = document.getElementById("bookingOverlay");
    const bookingForm      = document.getElementById("bookingForm");
    const bookingSubmitBtn = document.getElementById("bookingSubmitBtn");
    const bookingDate      = document.getElementById("bookingDate");
    const bookingTime      = document.getElementById("bookingTime");
    const bookingError     = document.getElementById("bookingError");
    const dateHint         = document.getElementById("dateHint");
    const clientName       = document.getElementById("clientName");
    const clientPhone      = document.getElementById("clientPhone");
    const clientEmail      = document.getElementById("clientEmail");
    const serviceSelect    = document.getElementById("service");
    const photographerSelect = document.getElementById("photographer");
    const photographerGroup  = document.getElementById("photographerGroup");
    const hallSelect       = document.getElementById("hall");

    const openCallbackForm = document.getElementById("openCallbackForm");
    const callbackModal    = document.getElementById("callbackModal");
    const callbackOverlay  = document.getElementById("callbackOverlay");
    const callbackClose    = document.getElementById("callbackClose");
    const callbackForm     = document.getElementById("callbackForm");
    const callbackError    = document.getElementById("callbackError");

    const successModal   = document.getElementById("successModal");
    const successOverlay = document.getElementById("successOverlay");
    const successOk      = document.getElementById("successOk");
    const successMessage = document.getElementById("successMessage");

    const today = new Date().toISOString().split("T")[0];
    bookingDate.min = today;
    let unavailableDatesSet = new Set();

    function showSuccess(msg) { successMessage.textContent = msg; successModal.classList.add("active"); document.body.classList.add("modal-open"); }
    function closeSuccess()   { successModal.classList.remove("active"); document.body.classList.remove("modal-open"); }
    function showFormError(el, msg) { if (!el) return; el.textContent = msg; el.classList.add("active"); }
    function hideFormError(el)      { if (!el) return; el.textContent = ""; el.classList.remove("active"); }

    function updateServiceRules() {
      const service = serviceSelect.value;
      const withoutPhotographer = SERVICES_WITHOUT_PHOTOGRAPHER.has(service);
      const outdoor = OUTDOOR_SERVICES.has(service);
      if (withoutPhotographer) {
        photographerSelect.value = ""; photographerSelect.disabled = true;
        photographerGroup.style.opacity = "0.42"; photographerGroup.style.pointerEvents = "none";
        photographerGroup.querySelector("label").textContent = "Фотограф (не потрібен для цієї послуги)";
      } else {
        photographerSelect.disabled = false;
        photographerGroup.style.opacity = "1"; photographerGroup.style.pointerEvents = "";
        photographerGroup.querySelector("label").textContent = "Фотограф";
      }
      if (outdoor) {
        for (let i = 0; i < hallSelect.options.length; i++) {
          if (hallSelect.options[i].value.includes("Без залу")) { hallSelect.selectedIndex = i; break; }
        }
        hallSelect.disabled = true;
      } else { hallSelect.disabled = false; }
      unavailableDatesSet = new Set();
      dateHint.textContent = "";
    }

    async function loadAvailableDates() {
      const service      = serviceSelect.value;
      const photographer = photographerSelect.value;
      const hall         = hallSelect.value;
      const withoutPh    = SERVICES_WITHOUT_PHOTOGRAPHER.has(service);
      const outdoor      = OUTDOOR_SERVICES.has(service);
      unavailableDatesSet = new Set(); dateHint.textContent = "";
      if (!service) return;
      if (!withoutPh && (!photographer || false)) return;
      if (!outdoor && !hall) return;
      try {
        const params = new URLSearchParams({ service, photographer: photographer||"", hall: hall||"" });
        const resp = await fetch(`${API_URL}/api/available-dates?${params}`);
        const data = await resp.json();
        if (!data.success) return;
        unavailableDatesSet = new Set(data.unavailableDates || []);
        if (bookingDate.value) checkSelectedDate(bookingDate.value);
      } catch (e) { console.error("Помилка дат:", e); }
    }

    function checkSelectedDate(date) {
      if (!date || unavailableDatesSet.size === 0) { dateHint.textContent = ""; return true; }
      if (unavailableDatesSet.has(date)) {
        dateHint.textContent = "⛔ На цю дату немає вільних слотів. Оберіть іншу.";
        dateHint.style.color = "#8a342c";
        resetAvailableTimes("Немає вільних слотів на цю дату");
        return false;
      }
      dateHint.textContent = "✓ На цю дату є вільні слоти.";
      dateHint.style.color = "#1f6f2a";
      return true;
    }

    function resetAvailableTimes(msg = "Спочатку оберіть послугу та дату") {
      bookingTime.innerHTML = `<option value="">${msg}</option>`;
      bookingTime.value = "";
    }

    async function loadAvailableTimes() {
      hideFormError(bookingError);
      const service      = serviceSelect.value;
      const date         = bookingDate.value;
      const photographer = photographerSelect.value;
      const hall         = hallSelect.value;
      const withoutPh    = SERVICES_WITHOUT_PHOTOGRAPHER.has(service);
      const outdoor      = OUTDOOR_SERVICES.has(service);
      if (!service || !date) { resetAvailableTimes("Спочатку оберіть послугу та дату"); return; }
      if (!withoutPh && !photographer) { resetAvailableTimes("Оберіть фотографа"); return; }
      if (!withoutPh && false) { resetAvailableTimes("Оберіть конкретного фотографа"); return; }
      if (!outdoor && !hall) { resetAvailableTimes("Оберіть зал"); return; }
      if (unavailableDatesSet.size > 0 && unavailableDatesSet.has(date)) { resetAvailableTimes("Немає вільних слотів на цю дату"); return; }
      resetAvailableTimes("Завантаження...");
      try {
        const params = new URLSearchParams({ service, bookingDate: date, photographer: photographer||"", hall: hall||"" });
        const resp = await fetch(`${API_URL}/api/available-times?${params}`);
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.message||"Помилка");
        if (!result.slots?.length) { resetAvailableTimes("Немає вільних годин"); showFormError(bookingError, "На цю дату немає вільних годин."); return; }
        bookingTime.innerHTML = `<option value="">Оберіть вільний час</option>` +
          result.slots.map(s => `<option value="${s.startTime}">${s.label}</option>`).join("");
      } catch (e) { resetAvailableTimes("Не вдалося завантажити"); showFormError(bookingError, "Не вдалося завантажити вільні години."); }
    }

    async function getCurrentUser() {
      const token = getToken();
      if (!token) return null;
      try {
        const resp = await fetch(`${API_URL}/api/me`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await resp.json();
        if (!resp.ok) { clearAuthData(); return null; }
        return data.user;
      } catch { return null; }
    }

    function fillClientData(user) {
      if (!user) return;
      clientName.value = user.full_name || user.fullName || "";
      clientPhone.value = user.phone || "";
      clientEmail.value = user.email || "";
      clientEmail.readOnly = true;
      clientEmail.style.background = "#f1eeee";
      clientEmail.style.cursor = "not-allowed";
    }

    async function openBookingModal(selectedService = "") {
      hideFormError(bookingError);
      const token = getToken();
      if (!token) {
        if (selectedService) localStorage.setItem("luminaPendingService", selectedService);
        localStorage.setItem("luminaAfterLogin", "openBooking");
        window.location.href = "login.html"; return;
      }
      const user = await getCurrentUser();
      if (!user) {
        clearAuthData();
        if (selectedService) localStorage.setItem("luminaPendingService", selectedService);
        localStorage.setItem("luminaAfterLogin", "openBooking");
        window.location.href = "login.html"; return;
      }
      if (user.role !== "client" && user.role !== "admin") {
        showSuccess("Бронювання може створювати тільки клієнт або адміністратор."); return;
      }
      const pending = localStorage.getItem("luminaPendingService");
      const finalService = selectedService || pending || "";
      if (finalService) { serviceSelect.value = finalService; localStorage.removeItem("luminaPendingService"); }
      fillClientData(user);
      updateServiceRules();
      unavailableDatesSet = new Set(); dateHint.textContent = "";
      if (serviceSelect.value) loadAvailableDates();
      resetAvailableTimes();
      bookingModal.classList.add("active"); document.body.classList.add("modal-open");
      setTimeout(() => clientPhone.focus(), 100);
    }

    function closeBookingModal() {
      bookingModal.classList.remove("active"); document.body.classList.remove("modal-open");
      unavailableDatesSet = new Set(); dateHint.textContent = "";
    }

    function openCallbackModal() {
      closeBookingModal(); hideFormError(callbackError);
      const saved = getSavedUser();
      if (saved) {
        document.getElementById("callbackName").value  = saved.fullName || saved.full_name || "";
        document.getElementById("callbackPhone").value = saved.phone || "";
      }
      callbackModal.classList.add("active"); document.body.classList.add("modal-open");
    }

    function closeCallbackModal() { callbackModal.classList.remove("active"); document.body.classList.remove("modal-open"); }

    // ── ПОДІЇ ──
    serviceSelect.addEventListener("change",      () => { updateServiceRules(); loadAvailableDates(); loadAvailableTimes(); });
    bookingDate.addEventListener("change",        () => { if (checkSelectedDate(bookingDate.value) !== false) loadAvailableTimes(); });
    photographerSelect.addEventListener("change", () => { loadAvailableDates(); loadAvailableTimes(); });
    hallSelect.addEventListener("change",         () => { loadAvailableDates(); loadAvailableTimes(); });

    document.addEventListener("click", e => {
      const btn = e.target.closest(".open-booking");
      if (!btn) return;
      e.preventDefault();
      openBookingModal(btn.dataset.service || "");
    });

    bookingClose.addEventListener("click", closeBookingModal);
    bookingOverlay.addEventListener("click", closeBookingModal);
    openCallbackForm.addEventListener("click", openCallbackModal);
    callbackClose.addEventListener("click", closeCallbackModal);
    callbackOverlay.addEventListener("click", closeCallbackModal);
    successOk.addEventListener("click", closeSuccess);
    successOverlay.addEventListener("click", closeSuccess);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (bookingModal.classList.contains("active"))  closeBookingModal();
        if (callbackModal.classList.contains("active")) closeCallbackModal();
        if (successModal.classList.contains("active"))  closeSuccess();
      }
    });

    // ── Відправка бронювання ──
    bookingForm.addEventListener("submit", async e => {
      e.preventDefault();
      hideFormError(bookingError);
      const token = getToken();
      if (!token) { localStorage.setItem("luminaAfterLogin","openBooking"); window.location.href="login.html"; return; }
      const fd = new FormData(bookingForm);
      const bookingData = {
        clientName:         fd.get("clientName"),
        clientPhone:        fd.get("clientPhone"),
        clientEmail:        fd.get("clientEmail"),
        clientInstagram:    fd.get("clientInstagram"),
        service:            fd.get("service"),
        additionalServices: fd.getAll("additionalServices[]"),
        hall:               fd.get("hall"),
        photographer:       photographerSelect.disabled ? "" : fd.get("photographer"),
        bookingDate:        fd.get("bookingDate"),
        bookingTime:        fd.get("bookingTime"),
        message:            fd.get("message")
      };
      if (!bookingData.clientName || !bookingData.clientPhone) { showFormError(bookingError, "Ім'я та телефон є обов'язковими."); return; }
      if (!bookingData.service)     { showFormError(bookingError, "Оберіть основну послугу."); return; }
      if (!bookingData.bookingDate) { showFormError(bookingError, "Оберіть дату."); return; }
      if (!bookingData.bookingTime) { showFormError(bookingError, "Оберіть час."); return; }
      bookingSubmitBtn.disabled = true; bookingSubmitBtn.textContent = "Надсилання...";
      try {
        const resp = await fetch(`${API_URL}/api/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(bookingData)
        });
        const result = await resp.json();
        if (resp.status === 401) { clearAuthData(); window.location.href="login.html"; return; }
        if (!resp.ok) throw new Error(result.message || "Заявку не вдалося відправити.");
        bookingForm.reset(); bookingDate.min = today;
        resetAvailableTimes(); unavailableDatesSet = new Set(); dateHint.textContent = "";
        const cu = await getCurrentUser(); fillClientData(cu);
        closeBookingModal();
        showSuccess("Дякуємо! Вашу заявку прийнято. Ми зв'яжемося з вами найближчим часом.");
      } catch (err) {
        showFormError(bookingError, err.message === "Failed to fetch" ? "Не вдалося відправити. Перевірте з'єднання." : err.message);
      } finally {
        bookingSubmitBtn.disabled = false; bookingSubmitBtn.textContent = "Надіслати заявку";
      }
    });

    // ── Callback ──
    callbackForm.addEventListener("submit", async e => {
      e.preventDefault();
      hideFormError(callbackError);
      const submitBtn = callbackForm.querySelector("button[type='submit']");
      const fd = new FormData(callbackForm);
      const data = { callbackName: fd.get("callbackName"), callbackPhone: fd.get("callbackPhone") };
      if (!data.callbackName || !data.callbackPhone) { showFormError(callbackError, "Заповніть ім'я та телефон."); return; }
      submitBtn.disabled = true; submitBtn.textContent = "Надсилання...";
      try {
        const resp = await fetch(`${API_URL}/api/callback`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.message||"Помилка");
        callbackForm.reset(); closeCallbackModal();
        showSuccess("Дякуємо! Ваш запит на дзвінок відправлено.");
      } catch (err) {
        showFormError(callbackError, err.message==="Failed to fetch" ? "Не вдалося відправити." : err.message);
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = "Надіслати запит";
      }
    });

    // ── СТАРТ ──
    renderNavAuth();

    window.addEventListener("load", async () => {
      await loadAllCatalogs();
      const params = new URLSearchParams(window.location.search);
      if (params.get("booking") === "open" || localStorage.getItem("luminaAfterLogin") === "openBooking") {
        localStorage.removeItem("luminaAfterLogin");
        await openBookingModal();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });
