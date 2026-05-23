(() => {
  const HIDDEN_IN_BOOKING_FORM = new Set([
    "Зачіска перед фотосесією",
    "Макіяж перед фотосесією",
    "Послуги стиліста",
    "Каталожна фотозйомка"
  ]);

  const ENDPOINTS = [
    "/api/services/public",
    "/api/public/services",
    "/api/services"
  ];

  function formatMoney(value) {
    const number = Number(value || 0);
    return number.toLocaleString("uk-UA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function normalizeServicesResponse(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.services)) {
      return data.services;
    }

    if (data.data && Array.isArray(data.data.services)) {
      return data.data.services;
    }

    return [];
  }

  async function fetchPublicServices() {
    for (const endpoint of ENDPOINTS) {
      try {
        const response = await fetch(endpoint);

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const services = normalizeServicesResponse(data);

        if (services.length > 0) {
          return services;
        }
      } catch (error) {
        console.warn(`Не вдалося завантажити послуги з ${endpoint}`, error);
      }
    }

    throw new Error("Не вдалося завантажити послуги.");
  }

  function isVisibleActiveService(service) {
    if (HIDDEN_IN_BOOKING_FORM.has(service.name)) {
      return false;
    }
    const statusOk = !service.status || service.status === "active";
    const visibleOk =
      service.site_visible === undefined ||
      service.site_visible === null ||
      Number(service.site_visible) === 1 ||
      service.site_visible === true;

    return statusOk && visibleOk;
  }

  function getCategory(service) {
    return service.category || service.service_category || "";
  }

  function getDuration(service) {
    return Number(service.duration_minutes ?? service.duration ?? 0);
  }

  function buildMainServiceLabel(service) {
    const duration = getDuration(service);
    const durationText = duration > 0 ? ` / ${duration} хв` : "";
    return `${service.name} — ${formatMoney(service.price)} грн${durationText}`;
  }

  function buildAdditionalServiceLabel(service) {
    const duration = getDuration(service);
    const durationText = duration > 0 ? ` / ${duration} хв` : "";
    return `${service.name} — ${formatMoney(service.price)} грн${durationText}`;
  }

  function populateMainServiceSelect(services) {
    const select = document.getElementById("service");

    if (!select) {
      return;
    }

    const previousValue = select.value;

    const mainServices = services.filter((service) =>
      isVisibleActiveService(service) && getCategory(service) === "main"
    );

    select.innerHTML = `
      <option value="">Оберіть основну послугу</option>
      ${mainServices.map((service) => `
        <option value="${service.name}">
          ${buildMainServiceLabel(service)}
        </option>
      `).join("")}
    `;

    if (mainServices.some((service) => service.name === previousValue)) {
      select.value = previousValue;
    }

    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function populateAdditionalServices(services) {
    const container = document.querySelector("#bookingForm .additional-services");

    if (!container) {
      return;
    }

    const checkedValues = new Set(
      Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
        .map((input) => input.value)
    );

    const additionalServices = services.filter((service) =>
      isVisibleActiveService(service) && getCategory(service) === "additional"
    );

    if (additionalServices.length === 0) {
      container.innerHTML = `<div style="color:#888;font-size:14px;">Додаткові послуги зараз недоступні.</div>`;
      return;
    }

    container.innerHTML = additionalServices.map((service) => `
      <label>
        <input
          type="checkbox"
          name="additionalServices[]"
          value="${service.name}"
          ${checkedValues.has(service.name) ? "checked" : ""}
        >
        ${buildAdditionalServiceLabel(service)}
      </label>
    `).join("");
  }

  function showLoadingState() {
    const select = document.getElementById("service");
    const container = document.querySelector("#bookingForm .additional-services");

    if (select) {
      select.innerHTML = `<option value="">Завантаження послуг...</option>`;
    }

    if (container) {
      container.innerHTML = `<div style="color:#888;font-size:14px;">Завантаження додаткових послуг...</div>`;
    }
  }

  function showErrorState() {
    const select = document.getElementById("service");
    const container = document.querySelector("#bookingForm .additional-services");

    if (select) {
      select.innerHTML = `<option value="">Не вдалося завантажити послуги</option>`;
    }

    if (container) {
      container.innerHTML = `<div style="color:#8a1f15;font-size:14px;">Не вдалося завантажити додаткові послуги.</div>`;
    }
  }

  async function initBookingCatalog() {
    const select = document.getElementById("service");
    const container = document.querySelector("#bookingForm .additional-services");

    if (!select && !container) {
      return;
    }

    showLoadingState();

    try {
      const services = await fetchPublicServices();
      populateMainServiceSelect(services);
      populateAdditionalServices(services);
    } catch (error) {
      console.error("Помилка завантаження послуг у форму бронювання:", error);
      showErrorState();
    }
  }

  document.addEventListener("DOMContentLoaded", initBookingCatalog);
})();
