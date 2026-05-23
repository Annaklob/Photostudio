(() => {
  const RENTAL_WITHOUT_PHOTOGRAPHER = new Set([
    "погодинна оренда залу",
    "оренда залу для стороннього фотографа",
    "оренда студії для стороннього фотографа"
  ]);

  const OUTDOOR_SERVICES = new Set([
    "виїзна фотосесія в межах міста",
    "виїзна фотосесія за межами міста",
    "репортажна зйомка подій"
  ]);

  let availableDatesCache = [];
  let requestTimer = null;
  let activeController = null;

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isRentalWithoutPhotographer(serviceName) {
    return RENTAL_WITHOUT_PHOTOGRAPHER.has(normalize(serviceName));
  }

  function isOutdoorService(serviceName) {
    return OUTDOOR_SERVICES.has(normalize(serviceName));
  }

  function serviceNeedsPhotographer(serviceName) {
    return !isRentalWithoutPhotographer(serviceName);
  }

  function formatDateUa(dateString) {
    const [year, month, day] = String(dateString).split("-");
    return `${day}.${month}.${year}`;
  }

  function getElements() {
    return {
      service: document.getElementById("service"),
      hall: document.getElementById("hall"),
      photographer: document.getElementById("photographer"),
      bookingDate: document.getElementById("bookingDate"),
      bookingTime: document.getElementById("bookingTime")
    };
  }

  function ensureHintBox() {
    const { bookingDate } = getElements();

    if (!bookingDate) {
      return null;
    }

    let box = document.getElementById("availableDatesBox");

    if (!box) {
      box = document.createElement("div");
      box.id = "availableDatesBox";
      box.className = "available-dates-box";

      const dateGroup = bookingDate.closest(".form-group");

      if (dateGroup) {
        dateGroup.appendChild(box);
      }
    }

    return box;
  }

  function ensureStyles() {
    if (document.getElementById("bookingDatesStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "bookingDatesStyles";
    style.textContent = `
      .available-dates-box {
        margin-top: 10px;
        font-size: 14px;
        line-height: 1.4;
      }

      .available-dates-message {
        color: #666;
        font-weight: 600;
      }

      .available-dates-message.error {
        color: #8a1f15;
      }

      .available-dates-message.success {
        color: #1f6f2a;
        margin-bottom: 8px;
      }

      .available-dates-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .available-date-btn {
        border: 1px solid #d8d2cd;
        background: #ffffff;
        color: #1f1f1f;
        padding: 7px 10px;
        border-radius: 999px;
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        transition: 0.2s ease;
      }

      .available-date-btn:hover,
      .available-date-btn.active {
        background: #171717;
        color: #ffffff;
        border-color: #171717;
      }

      .available-dates-more {
        margin-top: 8px;
        color: #777;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  function showMessage(message, type = "") {
    const box = ensureHintBox();

    if (!box) {
      return;
    }

    box.innerHTML = `
      <div class="available-dates-message ${type}">
        ${message}
      </div>
    `;
  }

  function clearSelectedDateIfNeeded() {
    const { bookingDate, bookingTime } = getElements();

    if (!bookingDate || !bookingDate.value) {
      return;
    }

    if (!availableDatesCache.includes(bookingDate.value)) {
      bookingDate.value = "";

      if (bookingTime) {
        bookingTime.innerHTML = `
          <option value="">
            Спочатку оберіть доступну дату
          </option>
        `;
      }
    }
  }

  function renderAvailableDates(dates, durationMinutes) {
    const box = ensureHintBox();

    if (!box) {
      return;
    }

    availableDatesCache = Array.isArray(dates) ? dates : [];

    if (!availableDatesCache.length) {
      box.innerHTML = `
        <div class="available-dates-message error">
          На найближчі 60 днів немає доступних дат для цього вибору.
        </div>
      `;
      clearSelectedDateIfNeeded();
      return;
    }

    const firstDates = availableDatesCache.slice(0, 12);
    const remaining = availableDatesCache.length - firstDates.length;
    const durationText = durationMinutes
      ? ` для цієї послуги тривалістю ${durationMinutes} хв`
      : "";

    box.innerHTML = `
      <div class="available-dates-message success">
        Найближчі доступні дні${durationText}:
      </div>

      <div class="available-dates-list">
        ${firstDates.map((date) => `
          <button
            type="button"
            class="available-date-btn"
            data-date="${date}"
          >
            ${formatDateUa(date)}
          </button>
        `).join("")}
      </div>

      ${remaining > 0 ? `
        <div class="available-dates-more">
          Ще доступно дат: ${remaining}. Також можна обрати дату вручну в календарі.
        </div>
      ` : ""}
    `;

    clearSelectedDateIfNeeded();
  }

  function getMissingRequirementMessage() {
    const { service, hall, photographer } = getElements();

    const serviceValue = service ? service.value : "";
    const hallValue = hall ? hall.value : "";
    const photographerValue = photographer && !photographer.disabled
      ? photographer.value
      : "";

    if (!serviceValue) {
      return "Оберіть послугу, щоб побачити доступні дні.";
    }

    if (!isOutdoorService(serviceValue) && !hallValue) {
      return "Оберіть зал, щоб побачити доступні дні.";
    }

    if (
      serviceNeedsPhotographer(serviceValue) &&
      (!photographerValue || photographerValue === "Порадьте фотографа")
    ) {
      return "Оберіть конкретного фотографа, щоб побачити його доступні дні.";
    }

    return "";
  }

  async function loadAvailableDates() {
    const {
      service,
      hall,
      photographer
    } = getElements();

    const missingMessage = getMissingRequirementMessage();

    if (missingMessage) {
      availableDatesCache = [];
      showMessage(missingMessage);
      return;
    }

    const serviceValue = service.value;
    const hallValue = hall ? hall.value : "";
    const photographerValue = photographer && !photographer.disabled
      ? photographer.value
      : "";

    const params = new URLSearchParams({
      service: serviceValue
    });

    if (!isOutdoorService(serviceValue) && hallValue) {
      params.set("hall", hallValue);
    }

    if (serviceNeedsPhotographer(serviceValue) && photographerValue) {
      params.set("photographer", photographerValue);
    }

    if (activeController) {
      activeController.abort();
    }

    activeController = new AbortController();

    showMessage("Завантажуємо доступні дні...");

    try {
      const response = await fetch(
        `/api/available-dates?${params.toString()}`,
        { signal: activeController.signal }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Не вдалося завантажити доступні дні.");
      }

      renderAvailableDates(
        result.availableDates || [],
        result.durationMinutes || 0
      );
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      availableDatesCache = [];
      showMessage(
        error.message || "Не вдалося завантажити доступні дні.",
        "error"
      );
    }
  }

  function scheduleDatesReload() {
    clearTimeout(requestTimer);
    requestTimer = setTimeout(loadAvailableDates, 180);
  }

  function handleDateButtonClick(event) {
    const button = event.target.closest(".available-date-btn");

    if (!button) {
      return;
    }

    const { bookingDate } = getElements();

    if (!bookingDate) {
      return;
    }

    bookingDate.value = button.dataset.date;

    document
      .querySelectorAll(".available-date-btn")
      .forEach((item) => item.classList.remove("active"));

    button.classList.add("active");

    bookingDate.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function validateManualDate() {
    const { bookingDate } = getElements();

    if (!bookingDate || !bookingDate.value || !availableDatesCache.length) {
      return;
    }

    if (!availableDatesCache.includes(bookingDate.value)) {
      bookingDate.value = "";
      showMessage(
        "Ця дата недоступна. Оберіть один із доступних днів нижче.",
        "error"
      );
    }
  }

  function init() {
    const {
      service,
      hall,
      photographer,
      bookingDate
    } = getElements();

    if (!service || !bookingDate) {
      return;
    }

    ensureStyles();
    ensureHintBox();

    service.addEventListener("change", scheduleDatesReload);

    if (hall) {
      hall.addEventListener("change", scheduleDatesReload);
    }

    if (photographer) {
      photographer.addEventListener("change", scheduleDatesReload);
    }

    bookingDate.addEventListener("change", validateManualDate);

    document.addEventListener("click", handleDateButtonClick);

    scheduleDatesReload();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
