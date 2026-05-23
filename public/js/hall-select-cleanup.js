(function () {
  const HALL_NAMES = [
    "без залу / виїзна зйомка",
    "водний зал",
    "світлий зал",
    "темний зал"
  ];

  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isHallSelect(select) {
    if (!select || select.tagName !== "SELECT") return false;

    const idName = normalize(`${select.id} ${select.name} ${select.className}`);

    if (
      idName.includes("hall") ||
      idName.includes("зал")
    ) {
      return true;
    }

    return Array.from(select.options || []).some(option => {
      const text = normalize(option.textContent);
      return HALL_NAMES.includes(text);
    });
  }

  function cleanSelect(select) {
    if (!isHallSelect(select)) return;

    const currentValue = select.value;
    const seenTexts = new Set();

    Array.from(select.options).forEach(option => {
      const text = normalize(option.textContent);

      if (!text) return;

      // Плейсхолдери типу "Оберіть зал" не чіпаємо
      if (
        text.includes("оберіть") ||
        text.includes("спочатку")
      ) {
        return;
      }

      if (seenTexts.has(text)) {
        option.remove();
        return;
      }

      seenTexts.add(text);
    });

    if (currentValue) {
      select.value = currentValue;
    }
  }

  function cleanAllHallSelects() {
    document.querySelectorAll("select").forEach(cleanSelect);
  }

  document.addEventListener("DOMContentLoaded", cleanAllHallSelects);

  const observer = new MutationObserver(() => {
    clearTimeout(window.__hallSelectCleanupTimer);
    window.__hallSelectCleanupTimer = setTimeout(cleanAllHallSelects, 50);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.cleanAllHallSelects = cleanAllHallSelects;
})();
