const API_URL = "http://192.168.116.129:3000";

    const loginForm = document.getElementById("loginForm");
    const loginBtn = document.getElementById("loginBtn");
    const messageBox = document.getElementById("messageBox");

    function showMessage(text, type) {
      messageBox.textContent = text;
      messageBox.className = `message ${type}`;
    }

    function clearMessage() {
      messageBox.textContent = "";
      messageBox.className = "message";
    }

    function redirectByRole(role) {
      if (role === "admin") {
        window.location.href = "admin.html";
        return;
      }

      if (role === "photographer") {
        window.location.href = "photographer-panel.html";
        return;
      }

      if (role === "client") {
        window.location.href = "client-panel.html";
        return;
      }

      localStorage.removeItem("luminaToken");
      localStorage.removeItem("luminaUser");
      showMessage("Невідома роль користувача.", "error");
    }

    loginForm.addEventListener("submit", async function(event) {
      event.preventDefault();
      clearMessage();

      const formData = new FormData(loginForm);

      const loginData = {
        email: formData.get("email").trim(),
        password: formData.get("password")
      };

      loginBtn.disabled = true;
      loginBtn.textContent = "Вхід...";

      try {
        const response = await fetch(`${API_URL}/api/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Помилка входу.");
        }

        if (!result.token || !result.user) {
          throw new Error("Сервер не повернув дані для входу.");
        }

        localStorage.setItem("luminaToken", result.token);

        sessionStorage.setItem("luminaToken", result.token);
        localStorage.setItem("luminaUser", JSON.stringify(result.user));
        sessionStorage.setItem("luminaUser", JSON.stringify(result.user));

        showMessage("Вхід виконано успішно. Перенаправлення...", "success");

        setTimeout(() => {
          redirectByRole(result.user.role);
        }, 700);
      } catch (error) {
        if (error.message === "Failed to fetch") {
          showMessage("Не вдалося виконати вхід. Спробуйте ще раз пізніше.", "error");
        } else {
          showMessage(error.message, "error");
        }
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Увійти";
      }
    });
