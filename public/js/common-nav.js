(() => {
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

  function getCabinetLinkByRole(role) {
    if (role === "client") {
      return "client-panel.html";
    }

    if (role === "admin") {
      return "admin.html";
    }

    if (role === "photographer") {
      return "photographer-panel.html";
    }

    return "login.html";
  }

  function updateNavAuthLink() {
    const navAuthLink = document.getElementById("navAuthLink");

    if (!navAuthLink) {
      return;
    }

    const token = getToken();
    const user = getSavedUser();

    if (!token || !user || !user.role) {
      navAuthLink.textContent = "Увійти";
      navAuthLink.href = "login.html";
      return;
    }

    navAuthLink.textContent = "Мій кабінет";
    navAuthLink.href = getCabinetLinkByRole(user.role);
  }

  document.addEventListener("DOMContentLoaded", updateNavAuthLink);
})();
