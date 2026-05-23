(() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadPhotographersIntoBookingForm() {
    const select = document.getElementById("photographer");
    if (!select) return;

    const previousValue =
      select.value ||
      localStorage.getItem("luminaSelectedPhotographer") ||
      "";

    try {
      const response = await fetch("/api/photographers/public");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Не вдалося отримати фотографів.");
      }

      const photographers = data.photographers || [];

      select.innerHTML = `
        <option value="">Оберіть фотографа</option>
        ${photographers.map((p) => `
          <option value="${escapeHtml(p.full_name)}">
            ${escapeHtml(p.full_name)}
          </option>
        `).join("")}
      `;

      if (
        previousValue &&
        Array.from(select.options).some((option) => option.value === previousValue)
      ) {
        select.value = previousValue;
      }

      select.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      select.innerHTML = `
        <option value="">Не вдалося завантажити фотографів</option>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPhotographersIntoBookingForm);
  } else {
    loadPhotographersIntoBookingForm();
  }
})();
