(function () {
  const TOKEN_KEY = "luminaToken";
  const USER_KEY = "luminaUser";

  function safeJson(value) {
    try {
      return JSON.parse(value || "null");
    } catch {
      return null;
    }
  }

  function getExpectedRoleByPage() {
    const path = window.location.pathname.toLowerCase();

    if (path.includes("admin.html")) return "admin";
    if (path.includes("client-panel.html")) return "client";
    if (path.includes("photographer-panel.html")) return "photographer";

    return "";
  }

  function getSessionUser() {
    return safeJson(sessionStorage.getItem(USER_KEY));
  }

  function getLocalUser() {
    return safeJson(localStorage.getItem(USER_KEY));
  }

  function restoreLocalFromSession() {
    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    const sessionUser = sessionStorage.getItem(USER_KEY);

    if (sessionToken && sessionUser) {
      localStorage.setItem(TOKEN_KEY, sessionToken);
      localStorage.setItem(USER_KEY, sessionUser);
    }
  }

  function rememberCurrentLocalInThisTab() {
    const expectedRole = getExpectedRoleByPage();
    const localToken = localStorage.getItem(TOKEN_KEY);
    const localUserRaw = localStorage.getItem(USER_KEY);
    const localUser = getLocalUser();

    if (!localToken || !localUser) return;

    const role = String(localUser.role || "").toLowerCase();

    if (expectedRole && role !== expectedRole) {
      return;
    }

    sessionStorage.setItem(TOKEN_KEY, localToken);
    sessionStorage.setItem(USER_KEY, localUserRaw);
  }

  if (getSessionUser()) {
    restoreLocalFromSession();
  } else {
    rememberCurrentLocalInThisTab();
  }

  window.addEventListener("focus", restoreLocalFromSession);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      restoreLocalFromSession();
    }
  });

  window.luminaGetToken = function () {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  };

  window.luminaGetUser = function () {
    return safeJson(sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY));
  };

  window.luminaSaveAuth = function (token, user) {
    const userRaw = typeof user === "string" ? user : JSON.stringify(user);

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, userRaw);

    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, userRaw);
  };

  window.luminaClearAuth = function () {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  };

  document.addEventListener("click", function (event) {
    const target = event.target.closest("button, a");

    if (!target) return;

    const text = String(target.textContent || "").trim().toLowerCase();
    const id = String(target.id || "").toLowerCase();

    if (id.includes("logout") || text === "вийти" || text.includes("вийти з системи")) {
      window.luminaClearAuth();
    }
  });
})();
