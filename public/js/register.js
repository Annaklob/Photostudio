const API_URL = "http://192.168.116.129:3000";

    const registerForm = document.getElementById("registerForm");
    const registerBtn = document.getElementById("registerBtn");
    const messageBox = document.getElementById("messageBox");

    function showMessage(text, type) {
      messageBox.textContent = text;
      messageBox.className = `message ${type}`;
    }

    function clearMessage() {
      messageBox.textContent = "";
      messageBox.className = "message";
    }

    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    registerForm.addEventListener("submit", async function(event) {
      event.preventDefault();
      clearMessage();

      const formData = new FormData(registerForm);

      const registerData = {
        fullName: formData.get("fullName").trim(),
        phone: formData.get("phone").trim(),
        email: formData.get("email").trim().toLowerCase(),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword")
      };

      if (!registerData.fullName || !registerData.phone || !registerData.email || !registerData.password || !registerData.confirmPassword) {
        showMessage("Заповніть усі поля.", "error");
        return;
      }

      if (!isValidEmail(registerData.email)) {
        showMessage("Введіть коректну email-адресу.", "error");
        return;
      }

      if (registerData.password.length < 6) {
        showMessage("Пароль має містити мінімум 6 символів.", "error");
        return;
      }

      if (registerData.password !== registerData.confirmPassword) {
        showMessage("Паролі не співпадають.", "error");
        return;
      }

      registerBtn.disabled = true;
      registerBtn.textContent = "Реєстрація...";

      try {
        const response = await fetch(`${API_URL}/api/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(registerData)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Помилка реєстрації.");
        }

        showMessage("Реєстрація успішна. Зараз відкриється сторінка входу.", "success");
        registerForm.reset();

        setTimeout(() => {
          window.location.href = "login.html";
        }, 1200);
      } catch (error) {
        if (error.message === "Failed to fetch") {
          showMessage("Не вдалося підключитися до сервера. Перевірте, чи запущений backend у VMware.", "error");
        } else {
          showMessage(error.message, "error");
        }
      } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = "Зареєструватися";
      }
    });
