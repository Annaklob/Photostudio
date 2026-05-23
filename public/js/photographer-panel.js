const API_URL = "http://192.168.116.129:3000";

    const userInfo = document.getElementById("userInfo");
    const logoutBtn = document.getElementById("logoutBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const bookingsBlock = document.getElementById("bookingsBlock");

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

    function goToLogin() {
      clearAuthData();
      window.location.href = "login.html";
    }

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


    const token = getToken();
    const user = getSavedUser();

    if (!token || !user) {
      goToLogin();
    }

    if (user.role !== "photographer") {
      redirectByRole(user && user.role ? user.role : "");
    }

    userInfo.textContent = `${user.fullName || user.full_name || "Фотограф"} | фотограф`;

    function authHeaders(extraHeaders = {}) {
      return {
        ...extraHeaders,
        "Authorization": `Bearer ${token}`
      };
    }

    function safe(value) {
      if (value === null || value === undefined || value === "") {
        return "—";
      }

      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function formatDate(value) {
      if (!value) {
        return "—";
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return safe(value);
      }

      return date.toLocaleDateString("uk-UA");
    }

    function formatTime(value) {
      if (!value) {
        return "—";
      }

      return String(value).slice(0, 5);
    }

    function formatStatus(status) {
      const statuses = {
        new: "Очікує підтвердження",
        confirmed: "Підтверджено",
        paid: "Оплачено",
        completed: "Завершено",
        cancelled: "Скасовано"
      };

      return statuses[status] || status || "—";
    }

    function formatServices(booking) {
      const mainService = booking.main_service || booking.services || "—";
      const additionalServices = booking.additional_services;

      return `
        <div class="services-main">${safe(mainService)}</div>
        ${
          additionalServices
            ? `<div class="services-extra">Додатково: ${safe(additionalServices)}</div>`
            : ""
        }
      `;
    }

    function handleAuthError(response) {
      if (response.status === 401 || response.status === 403) {
        goToLogin();
        return true;
      }

      return false;
    }

    async function changeStatus(bookingId, status) {
      try {
        const response = await fetch(`${API_URL}/api/bookings/${bookingId}/status`, {
          method: "PATCH",
          headers: authHeaders({
            "Content-Type": "application/json"
          }),
          body: JSON.stringify({ status })
        });

        if (handleAuthError(response)) {
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Не вдалося змінити статус.");
        }

        await loadBookings();
      } catch (error) {
        showSiteAlert(error.message);
      }
    }

    async function loadBookings() {
      try {
        const response = await fetch(`${API_URL}/api/photographers/me/bookings`, {
          method: "GET",
          headers: authHeaders()
        });

        if (handleAuthError(response)) {
          return;
        }

        if (!response.ok) {
          throw new Error("Не вдалося завантажити бронювання.");
        }

        const bookings = await response.json();

        if (bookings.length === 0) {
          bookingsBlock.innerHTML = `
            <div class="empty">
              Поки що немає призначених зйомок.
            </div>
          `;
          return;
        }

        bookingsBlock.innerHTML = `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Клієнт</th>
                  <th>Телефон</th>
                  <th>Email</th>
                  <th>Послуги</th>
                  <th>Зал</th>
                  <th>Дата</th>
                  <th>Час</th>
                  <th>Статус</th>
                  <th>Коментар</th>
                  <th>Дії</th>
                </tr>
              </thead>

              <tbody>
                ${bookings.map((booking) => `
                  <tr>
                    <td>${safe(booking.booking_id)}</td>
                    <td>${safe(booking.client_name)}</td>
                    <td>${safe(booking.client_phone)}</td>
                    <td>${safe(booking.client_email)}</td>
                    <td>${formatServices(booking)}</td>
                    <td>${safe(booking.hall_name)}</td>
                    <td>${formatDate(booking.booking_date)}</td>
                    <td>${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</td>
                    <td>
                      <span class="status ${safe(booking.status)}">
                        ${formatStatus(booking.status)}
                      </span>
                    </td>
                    <td>${safe(booking.comment)}</td>
                    <td>
                      <div class="actions">
                        ${
                          booking.status === "completed"
                            ? `<button class="action-btn complete-btn" type="button" disabled>Завершено</button>`
                            : `<button class="action-btn complete-btn" type="button" onclick="changeStatus(${booking.booking_id}, 'completed')">Позначити завершено</button>`
                        }
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      } catch (error) {
        bookingsBlock.innerHTML = `
          <div class="error">
            Не вдалося завантажити зйомки. Перевірте підключення до сервера.
          </div>
        `;
      }
    }

    logoutBtn.addEventListener("click", function() {
      clearAuthData();
      window.location.href = "login.html";
    });

    refreshBtn.addEventListener("click", loadBookings);

    loadBookings();
