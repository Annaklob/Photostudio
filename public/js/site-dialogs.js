(() => {
  function ensureDialogStyles() {
    if (document.getElementById("siteDialogStyles")) return;

    const style = document.createElement("style");
    style.id = "siteDialogStyles";
    style.textContent = `
      .site-dialog {
        position: fixed;
        inset: 0;
        z-index: 30000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .site-dialog.active {
        display: flex;
      }

      .site-dialog-overlay {
        position: absolute;
        inset: 0;
        background: rgba(23, 23, 23, 0.68);
        backdrop-filter: blur(5px);
      }

      .site-dialog-box {
        position: relative;
        z-index: 2;
        width: min(440px, 100%);
        background: #f7f5f2;
        border-radius: 20px;
        padding: 34px 30px 28px;
        text-align: center;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
        color: #1f1f1f;
        font-family: inherit;
      }

      .site-dialog-icon {
        width: 58px;
        height: 58px;
        margin: 0 auto 18px;
        border-radius: 50%;
        background: #efe6df;
        color: #DE4337;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 30px;
        font-weight: 900;
      }

      .site-dialog-title {
        font-size: 26px;
        margin: 0 0 10px;
        font-weight: 900;
      }

      .site-dialog-text {
        color: #666;
        font-size: 16px;
        line-height: 1.5;
        margin: 0 0 26px;
        white-space: pre-line;
      }

      .site-dialog-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .site-dialog-btn {
        min-width: 130px;
        border: none;
        border-radius: 10px;
        padding: 14px 18px;
        font-family: inherit;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
        transition: 0.25s ease;
      }

      .site-dialog-cancel {
        background: #ece7e2;
        color: #1f1f1f;
      }

      .site-dialog-cancel:hover {
        background: #ddd5cf;
      }

      .site-dialog-ok {
        background: #DE4337;
        color: #ffffff;
      }

      .site-dialog-ok:hover {
        background: #bf352c;
      }

      @media (max-width: 520px) {
        .site-dialog-actions {
          flex-direction: column-reverse;
        }

        .site-dialog-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    ensureDialogStyles();

    let dialog = document.getElementById("siteDialog");

    if (dialog) return dialog;

    dialog = document.createElement("div");
    dialog.id = "siteDialog";
    dialog.className = "site-dialog";
    dialog.innerHTML = `
      <div class="site-dialog-overlay" id="siteDialogOverlay"></div>

      <div class="site-dialog-box">
        <div class="site-dialog-icon" id="siteDialogIcon">i</div>
        <h3 class="site-dialog-title" id="siteDialogTitle">Повідомлення</h3>
        <p class="site-dialog-text" id="siteDialogText"></p>

        <div class="site-dialog-actions" id="siteDialogActions">
          <button type="button" class="site-dialog-btn site-dialog-cancel" id="siteDialogCancel">
            Скасувати
          </button>
          <button type="button" class="site-dialog-btn site-dialog-ok" id="siteDialogOk">
            Добре
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    return dialog;
  }

  function openDialog({
    title = "Повідомлення",
    text = "",
    icon = "i",
    confirmText = "Добре",
    cancelText = "Скасувати",
    showCancel = false
  } = {}) {
    return new Promise((resolve) => {
      const dialog = ensureDialog();

      const overlay = document.getElementById("siteDialogOverlay");
      const iconEl = document.getElementById("siteDialogIcon");
      const titleEl = document.getElementById("siteDialogTitle");
      const textEl = document.getElementById("siteDialogText");
      const cancelBtn = document.getElementById("siteDialogCancel");
      const okBtn = document.getElementById("siteDialogOk");

      iconEl.textContent = icon;
      titleEl.textContent = title;
      textEl.textContent = String(text || "");
      okBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      cancelBtn.style.display = showCancel ? "" : "none";

      dialog.classList.add("active");

      function close(result) {
        dialog.classList.remove("active");

        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKeydown);

        resolve(result);
      }

      function onOk() {
        close(true);
      }

      function onCancel() {
        close(false);
      }

      function onKeydown(event) {
        if (event.key === "Escape") close(false);
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKeydown);
    });
  }

  window.showSiteAlert = function (message, options = {}) {
    return openDialog({
      title: options.title || "Повідомлення",
      text: message,
      icon: options.icon || "i",
      confirmText: options.confirmText || "Добре",
      showCancel: false
    });
  };

  window.showSiteConfirm = function (options = {}) {
    return openDialog({
      title: options.title || "Підтвердження",
      text: options.text || "Ви впевнені?",
      icon: options.icon || "!",
      confirmText: options.confirmText || "Підтвердити",
      cancelText: options.cancelText || "Скасувати",
      showCancel: true
    });
  };

  window.alert = function (message) {
    window.showSiteAlert(message);
  };
})();


/* ── ПРИБРАТИ "ПОРАДЬТЕ ФОТОГРАФА" З УСІХ СПИСКІВ ── */
(function removeAdvisePhotographerOptionEverywhere() {
  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function cleanPhotographerSelects() {
    document.querySelectorAll("select").forEach((select) => {
      Array.from(select.options || []).forEach((option) => {
        const text = normalize(option.textContent);
        const value = normalize(option.value);

        if (text === "порадьте фотографа" || value === "порадьте фотографа") {
          option.remove();
        }
      });

      if (normalize(select.value) === "порадьте фотографа") {
        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", cleanPhotographerSelects);

  const observer = new MutationObserver(() => {
    clearTimeout(window.__removeAdvisePhotographerTimer);
    window.__removeAdvisePhotographerTimer = setTimeout(cleanPhotographerSelects, 50);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.cleanPhotographerSelects = cleanPhotographerSelects;
})();
