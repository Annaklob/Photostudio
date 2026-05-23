const revealElements = document.querySelectorAll(".reveal");

    function revealOnScroll() {
      const triggerBottom = window.innerHeight * 0.88;

      revealElements.forEach((element) => {
        const elementTop = element.getBoundingClientRect().top;

        if (elementTop < triggerBottom) {
          element.classList.add("visible");
        }
      });
    }

    window.addEventListener("scroll", revealOnScroll);
    window.addEventListener("load", revealOnScroll);
    window.addEventListener("resize", revealOnScroll);

    const API_URL = "http://192.168.116.129:3000";

    const bookingModal = document.getElementById("bookingModal");
    const bookingClose = document.getElementById("bookingClose");
    const bookingOverlay = document.getElementById("bookingOverlay");
    const bookingButtons = document.querySelectorAll(".open-booking");
    const bookingForm = document.getElementById("bookingForm");

    const clientName = document.getElementById("clientName");
    const clientPhone = document.getElementById("clientPhone");
    const clientEmail = document.getElementById("clientEmail");
    const clientInstagram = document.getElementById("clientInstagram");

    const serviceSelect = document.getElementById("service");
    const hallSelect = document.getElementById("hall");
    const photographerSelect = document.getElementById("photographer");
    const bookingDate = document.getElementById("bookingDate");
    const bookingTime = document.getElementById("bookingTime");
    const bookingError = document.getElementById("bookingError");

    const openCallbackForm = document.getElementById("openCallbackForm");
    const callbackModal = document.getElementById("callbackModal");
    const callbackOverlay = document.getElementById("callbackOverlay");
    const callbackClose = document.getElementById("callbackClose");
    const callbackForm = document.getElementById("callbackForm");
    const callbackName = document.getElementById("callbackName");
    const callbackPhone = document.getElementById("callbackPhone");
    const callbackError = document.getElementById("callbackError");

    const successModal = document.getElementById("successModal");
    const successOverlay = document.getElementById("successOverlay");
    const successOk = document.getElementById("successOk");
    const successMessage = document.getElementById("successMessage");

    const SERVICES_WITHOUT_PHOTOGRAPHER = new Set([
  "Погодинна оренда залу",
  "Оренда залу для стороннього фотографа",
  "Оренда студії для стороннього фотографа"
]);

function isServiceWithoutPhotographer(serviceName) {
  return SERVICES_WITHOUT_PHOTOGRAPHER.has(serviceName);
}

function updatePhotographerRequirement() {
  if (!serviceSelect || !photographerSelect) {
    return;
  }

  const service = serviceSelect.value;
  const withoutPhotographer = isServiceWithoutPhotographer(service);

  if (!photographerSelect.dataset.originalOptions) {
    photographerSelect.dataset.originalOptions = photographerSelect.innerHTML;
  }

  if (withoutPhotographer) {
    photographerSelect.required = false;
    photographerSelect.disabled = true;
    photographerSelect.innerHTML = `
      <option value="">Фотограф не потрібен для цієї послуги</option>
    `;
    photographerSelect.value = "";
    return;
  }

  if (photographerSelect.disabled) {
    photographerSelect.innerHTML = photographerSelect.dataset.originalOptions;
  }

  photographerSelect.disabled = false;
  photographerSelect.required = false;
}

const today = new Date().toISOString().split("T")[0];
    bookingDate.min = today;

    function getToken() {
      return (sessionStorage.getItem("luminaToken") || localStorage.getItem("luminaToken"));
    }

    function getSavedUser() {
      const savedUser = (sessionStorage.getItem("luminaUser") || localStorage.getItem("luminaUser"));

      if (!savedUser) {
        return null;
      }

      try {
        return JSON.parse(savedUser);
      } catch (error) {
        return null;
      }
    }

    function clearAuthData() {
      localStorage.removeItem("luminaToken");
      localStorage.removeItem("luminaUser");
    }

    function showSuccess(message) {
      successMessage.textContent = message;
      successModal.classList.add("active");
      document.body.classList.add("modal-open");
    }

    function closeSuccess() {
      successModal.classList.remove("active");
      document.body.classList.remove("modal-open");
    }

    function showFormError(element, message) {
      if (!element) {
        return;
      }

      element.textContent = message;
      element.classList.add("active");
    }

    function hideFormError(element) {
      if (!element) {
        return;
      }

      element.textContent = "";
      element.classList.remove("active");
    }

    function setSelectValue(selectElement, value) {
      if (!selectElement || !value) {
        return;
      }

      const hasOption = Array.from(selectElement.options).some((option) => option.value === value || option.textContent.trim() === value);

      if (!hasOption) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        selectElement.appendChild(option);
      }

      selectElement.value = value;
    }

    function isBookingTimeAllowed(time) {
      return time >= "09:00" && time <= "19:00";
    }

    function validateBookingTimeOnSite(time) {
      if (!time) {
        showFormError(bookingError, "Оберіть час бронювання.");
        return false;
      }

      if (!isBookingTimeAllowed(time)) {
        showFormError(bookingError, "Lumina працює з 09:00 до 20:00. Оберіть інший час.");
        return false;
      }

      return true;
    }

    async function getCurrentUser() {
      const token = getToken();

      if (!token) {
        return null;
      }

      try {
        const response = await fetch(`${API_URL}/api/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        const result = await response.json();

        if (!response.ok) {
          clearAuthData();
          return null;
        }

        return result.user;
      } catch (error) {
        return null;
      }
    }

    function fillClientData(user) {
      if (!user) {
        return;
      }

      clientName.value = user.full_name || user.fullName || "";
      clientPhone.value = user.phone || "";
      clientEmail.value = user.email || "";

      clientEmail.readOnly = true;
      clientEmail.style.background = "#f1eeee";
      clientEmail.style.cursor = "not-allowed";
      clientEmail.title = "Email береться з вашого акаунта і не змінюється у формі бронювання.";
    }

    function resetAvailableTimes(message = "Спочатку оберіть послугу, дату і фотографа") {
      bookingTime.innerHTML = `<option value="">${message}</option>`;
      bookingTime.value = "";
    }

    async function loadAvailableTimes() {
      hideFormError(bookingError);

      const service = serviceSelect ? serviceSelect.value : "";
      const date = bookingDate ? bookingDate.value : "";
      const photographer = photographerSelect && !photographerSelect.disabled ? photographerSelect.value : "";
      const hall = hallSelect ? hallSelect.value : "";
      const withoutPhotographer = isServiceWithoutPhotographer(service);

      resetAvailableTimes("Завантаження вільних годин...");

      if (!service || !date || (!withoutPhotographer && !photographer)) {
        resetAvailableTimes(
          withoutPhotographer
            ? "Спочатку оберіть послугу і дату"
            : "Спочатку оберіть послугу, дату і фотографа"
        );
        return;
      }

      if (!withoutPhotographer && false) {
        resetAvailableTimes("Оберіть конкретного фотографа для перегляду вільних годин");
        return;
      }

      try {
        const params = new URLSearchParams({
          service: service,
          bookingDate: date,
          hall: hall
        });

        if (!withoutPhotographer && photographer) {
          params.set("photographer", photographer);
        }

        const response = await fetch(`${API_URL}/api/available-times?${params.toString()}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Не вдалося отримати вільні години.");
        }

        if (!result.slots || result.slots.length === 0) {
          resetAvailableTimes("Немає вільних годин");

          showFormError(
            bookingError,
            "На цю дату немає вільних годин для обраного фотографа."
          );

          return;
        }

        bookingTime.innerHTML = `
          <option value="">Оберіть вільний час</option>
          ${result.slots.map((slot) => `
            <option value="${slot.startTime}">
              ${slot.label}
            </option>
          `).join("")}
        `;
      } catch (error) {
        resetAvailableTimes("Не вдалося завантажити години");

        showFormError(
          bookingError,
          "Не вдалося завантажити вільні години. Перевірте підключення до сервера."
        );
      }
    }

    async function openBookingModal() {
      hideFormError(bookingError);

      // Загальна кнопка бронювання без автоматичного вибору залу чи фотографа.

      const token = getToken();

      if (!token) {
        localStorage.setItem("luminaAfterLogin", "openBooking");
        window.location.href = "login.html";
        return;
      }

      const user = await getCurrentUser();

      if (!user) {
        clearAuthData();
        localStorage.setItem("luminaAfterLogin", "openBooking");
        window.location.href = "login.html";
        return;
      }

      if (user.role !== "client" && user.role !== "admin") {
        showSuccess("Бронювання може створювати тільки клієнт або адміністратор.");
        return;
      }

      fillClientData(user);

      // Тут клієнт самостійно обирає послугу, зал і фотографа.
      resetAvailableTimes();
      loadAvailableTimes();

      bookingModal.classList.add("active");
      document.body.classList.add("modal-open");

      setTimeout(() => {
        clientPhone.focus();
      }, 100);
    }

    function closeBookingModal() {
      bookingModal.classList.remove("active");
      document.body.classList.remove("modal-open");
    }

    function openCallbackModal() {
      closeBookingModal();
      hideFormError(callbackError);

      const savedUser = getSavedUser();

      if (savedUser) {
        callbackName.value = savedUser.fullName || savedUser.full_name || "";
        callbackPhone.value = savedUser.phone || "";
      }

      callbackModal.classList.add("active");
      document.body.classList.add("modal-open");

      setTimeout(() => {
        callbackPhone.focus();
      }, 100);
    }

    function closeCallbackModal() {
      callbackModal.classList.remove("active");
      document.body.classList.remove("modal-open");
    }


    if (serviceSelect) {
      serviceSelect.addEventListener("change", function() {
        updatePhotographerRequirement();
        loadAvailableTimes();
      });
    }

    if (bookingDate) {
      bookingDate.addEventListener("change", loadAvailableTimes);
    }

    if (photographerSelect) {
      photographerSelect.addEventListener("change", loadAvailableTimes);
    }

    if (hallSelect) {
      hallSelect.addEventListener("change", loadAvailableTimes);
    }

    bookingButtons.forEach((button) => {
      button.addEventListener("click", function(event) {
        event.preventDefault();
        openBookingModal();
      });
    });

    bookingClose.addEventListener("click", closeBookingModal);
    bookingOverlay.addEventListener("click", closeBookingModal);

    openCallbackForm.addEventListener("click", openCallbackModal);
    callbackClose.addEventListener("click", closeCallbackModal);
    callbackOverlay.addEventListener("click", closeCallbackModal);

    successOk.addEventListener("click", closeSuccess);
    successOverlay.addEventListener("click", closeSuccess);

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        if (bookingModal.classList.contains("active")) {
          closeBookingModal();
        }

        if (callbackModal.classList.contains("active")) {
          closeCallbackModal();
        }

        if (successModal.classList.contains("active")) {
          closeSuccess();
        }
      }
    });

    bookingForm.addEventListener("submit", async function(event) {
      event.preventDefault();
      hideFormError(bookingError);

      const token = getToken();

      if (!token) {
        localStorage.setItem("luminaAfterLogin", "openBooking");
        window.location.href = "login.html";
        return;
      }

      const formData = new FormData(bookingForm);

      const bookingData = {
        clientName: formData.get("clientName"),
        clientPhone: formData.get("clientPhone"),
        clientInstagram: formData.get("clientInstagram"),
        service: formData.get("service"),
        additionalServices: formData.getAll("additionalServices[]"),
        hall: formData.get("hall"),
        photographer: formData.get("photographer"),
        bookingDate: formData.get("bookingDate"),
        bookingTime: formData.get("bookingTime"),
        message: formData.get("message")
      };

      if (!bookingData.clientName || !bookingData.clientPhone) {
        showFormError(bookingError, "Ім’я та телефон є обов’язковими.");
        return;
      }

      if (!bookingData.service) {
        showFormError(bookingError, "Оберіть основну послугу.");
        return;
      }

      if (!bookingData.bookingDate) {
        showFormError(bookingError, "Оберіть дату бронювання.");
        return;
      }

      if (!validateBookingTimeOnSite(bookingData.bookingTime)) {
        bookingTime.focus();
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (response.status === 401) {
          clearAuthData();
          localStorage.setItem("luminaAfterLogin", "openBooking");
          window.location.href = "login.html";
          return;
        }

        if (!response.ok) {
          throw new Error(result.message || "Заявку не вдалося відправити.");
        }

        bookingForm.reset();
        bookingDate.min = today;
        updatePhotographerRequirement();
        resetAvailableTimes();

        const currentUser = await getCurrentUser();
        fillClientData(currentUser);

        closeBookingModal();

        showSuccess("Дякуємо! Ваша заявка на бронювання відправлена. Ми зв’яжемося з вами найближчим часом.");
      } catch (error) {
        if (error.message === "Failed to fetch") {
          showFormError(bookingError, "Не вдалося відправити заявку. Перевірте підключення до сервера.");
        } else {
          showFormError(bookingError, error.message);
        }
      }
    });

    callbackForm.addEventListener("submit", async function(event) {
      event.preventDefault();
      hideFormError(callbackError);

      const formData = new FormData(callbackForm);

      const callbackData = {
        callbackName: formData.get("callbackName"),
        callbackPhone: formData.get("callbackPhone")
      };

      if (!callbackData.callbackName || !callbackData.callbackPhone) {
        showFormError(callbackError, "Заповніть ім’я та телефон.");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(callbackData)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Запит не вдалося відправити.");
        }

        callbackForm.reset();
        closeCallbackModal();

        showSuccess("Дякуємо! Ваш запит на дзвінок відправлено. Ми зв’яжемося з вами найближчим часом.");
      } catch (error) {
        if (error.message === "Failed to fetch") {
          showFormError(callbackError, "Не вдалося відправити запит. Перевірте підключення до сервера.");
        } else {
          showFormError(callbackError, error.message);
        }
      }
    });

    window.addEventListener("load", async function() {
      const params = new URLSearchParams(window.location.search);
      const shouldOpenBooking = params.get("booking") === "open" || localStorage.getItem("luminaAfterLogin") === "openBooking";

      if (shouldOpenBooking) {
        localStorage.removeItem("luminaAfterLogin");
        await openBookingModal();

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    });
