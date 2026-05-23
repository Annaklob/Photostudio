(function () {
  const LABELS = [
    "всього бронювань",
    "загальна сума послуг",
    "оплачено",
    "до сплати"
  ];

  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function injectStyles() {
    if (document.getElementById("clientStatsListStyles")) return;

    const style = document.createElement("style");
    style.id = "clientStatsListStyles";
    style.textContent = `
      .client-stats-as-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 0 !important;
        margin: 24px 0 30px !important;
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }

      .client-stat-list-item {
        width: 100% !important;
        min-height: auto !important;
        padding: 20px 0 !important;
        background: transparent !important;
        border: none !important;
        border-bottom: 1px solid #e9e2dc !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        grid-template-rows: auto auto !important;
        column-gap: 28px !important;
        row-gap: 6px !important;
        align-items: center !important;
      }

      .client-stat-list-item:last-child {
        border-bottom: none !important;
      }

      .client-stat-list-value {
        grid-column: 2 !important;
        grid-row: 1 / span 2 !important;
        color: #1f1f1f !important;
        font-size: 28px !important;
        font-weight: 900 !important;
        line-height: 1.15 !important;
        text-align: right !important;
        margin: 0 !important;
        white-space: normal !important;
      }

      .client-stat-list-label {
        grid-column: 1 !important;
        grid-row: 1 !important;
        color: #777 !important;
        font-size: 13px !important;
        font-weight: 900 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
        line-height: 1.35 !important;
        margin: 0 !important;
      }

      .client-stat-list-item * {
        color: inherit;
      }

      @media (max-width: 760px) {
        .client-stat-list-item {
          grid-template-columns: 1fr !important;
          grid-template-rows: auto auto !important;
        }

        .client-stat-list-value {
          grid-column: 1 !important;
          grid-row: 2 !important;
          text-align: left !important;
          font-size: 26px !important;
        }

        .client-stat-list-label {
          grid-column: 1 !important;
          grid-row: 1 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getCardLabel(card) {
    const text = normalize(card.textContent);

    return LABELS.find(label => text.includes(label)) || "";
  }

  function splitCard(card) {
    if (card.dataset.clientStatListDone === "1") return;

    const label = getCardLabel(card);
    if (!label) return;

    const children = Array.from(card.children);

    let valueEl = children.find(el => {
      const text = normalize(el.textContent);
      return !LABELS.some(l => text === l || text.includes(l));
    });

    let labelEl = children.find(el => {
      return normalize(el.textContent).includes(label);
    });

    if (!valueEl && children[0]) valueEl = children[0];
    if (!labelEl && children[1]) labelEl = children[1];

    if (valueEl) valueEl.classList.add("client-stat-list-value");
    if (labelEl) labelEl.classList.add("client-stat-list-label");

    card.classList.add("client-stat-list-item");
    card.dataset.clientStatListDone = "1";
  }

  function applyClientStatsList() {
    injectStyles();

    const allElements = Array.from(document.querySelectorAll("div, section, article"));

    const statCards = allElements.filter(el => {
      const text = normalize(el.textContent);
      const directChildren = Array.from(el.children || []);

      if (!directChildren.length) return false;

      return LABELS.some(label => text.includes(label)) &&
        directChildren.length <= 4 &&
        directChildren.some(child => LABELS.some(label => normalize(child.textContent).includes(label)));
    });

    const realCards = statCards.filter(card => {
      const label = getCardLabel(card);
      if (!label) return false;

      const parent = card.parentElement;
      if (!parent) return false;

      const siblings = Array.from(parent.children);
      const matchingSiblings = siblings.filter(item => getCardLabel(item));

      return matchingSiblings.length >= 3;
    });

    if (!realCards.length) return;

    const container = realCards[0].parentElement;
    container.classList.add("client-stats-as-list");

    Array.from(container.children).forEach(card => {
      if (getCardLabel(card)) {
        splitCard(card);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(applyClientStatsList, 300);
    setTimeout(applyClientStatsList, 900);
    setTimeout(applyClientStatsList, 1600);
  });

  const observer = new MutationObserver(() => {
    clearTimeout(window.__clientStatsListTimer);
    window.__clientStatsListTimer = setTimeout(applyClientStatsList, 100);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.applyClientStatsList = applyClientStatsList;
})();
