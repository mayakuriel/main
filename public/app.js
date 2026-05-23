const companyInput = document.getElementById("companyName");
const fetchButton = document.getElementById("fetchButton");
const statusText = document.getElementById("statusText");
const errorText = document.getElementById("errorText");
const result = document.getElementById("result");

fetchButton.addEventListener("click", () => {
  loadCompanyInfo();
});

companyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadCompanyInfo();
  }
});

async function loadCompanyInfo() {
  const companyName = companyInput.value.trim();
  if (companyName.length < 2) {
    showError("נא להזין לפחות 2 תווים בשם החברה.");
    return;
  }

  hideError();
  statusText.classList.remove("hidden");
  result.classList.add("hidden");

  try {
    const response = await fetch("/api/company-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "אירעה שגיאה בשליפת המידע");
    }

    renderCompanyData(data);
  } catch (error) {
    showError(error instanceof Error ? error.message : "אירעה שגיאה לא צפויה");
  } finally {
    statusText.classList.add("hidden");
  }
}

function renderCompanyData(data) {
  const company = data.company;
  const sourcesHtml = (data.sources || [])
    .map(
      (source) => `
      <li>
        ${escapeHtml(source.name)} -
        <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">מקור</a>
      </li>
    `,
    )
    .join("");

  const dataQuality = data.dataQuality || {};
  const webResultsHtml = (data.relatedWebResults || [])
    .map(
      (item) => `
      <li class="news-item">
        <strong>${escapeHtml(item.title)}</strong><br />
        ${escapeHtml(item.snippet || "")}<br />
        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">למקור</a>` : ""}
      </li>
    `,
    )
    .join("");
  const newsHtml = (data.recentNews || [])
    .map(
      (item) => `
      <li class="news-item">
        <strong>${escapeHtml(item.title)}</strong><br />
        מקור: ${escapeHtml(item.source)} | תאריך: ${escapeHtml(item.publishedAt)}<br />
        ${escapeHtml(item.summary)}<br />
        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">לכתבה</a>` : ""}
      </li>
    `,
    )
    .join("");

  result.innerHTML = `
    <article class="card">
      <h2>מידע על החברה</h2>
      <p><strong>שם חברה:</strong> ${escapeHtml(company.name)}</p>
      <p><strong>תחום פעילות:</strong> ${escapeHtml(company.industry)}</p>
      <p><strong>מיקום:</strong> ${escapeHtml(company.headquarters)}</p>
      <p><strong>כמות עובדים:</strong> ${escapeHtml(company.employeeCount)}</p>
      <p><strong>תיאור כללי:</strong> ${escapeHtml(company.description)}</p>
      ${renderDataQuality(dataQuality)}
      ${sourcesHtml ? `<h3>מקורות</h3><ul>${sourcesHtml}</ul>` : ""}
    </article>
    <article class="card">
      <h2>כתבות אחרונות</h2>
      ${newsHtml ? `<ul>${newsHtml}</ul>` : "<p>לא נמצאו כתבות עדכניות.</p>"}
    </article>
    <article class="card">
      <h2>מקורות ווב נוספים</h2>
      ${webResultsHtml ? `<ul>${webResultsHtml}</ul>` : "<p>לא נמצאו מקורות ווב נוספים.</p>"}
    </article>
  `;

  result.classList.remove("hidden");
}

function renderDataQuality(dataQuality) {
  if (!dataQuality || typeof dataQuality !== "object") {
    return "";
  }

  const lines = [];
  if (dataQuality.summarySourceFound === false) {
    lines.push("לא נמצא עמוד סיכום רשמי, בוצע fallback מכתבות.");
  }
  if (typeof dataQuality.newsItemsFound === "number") {
    lines.push(`נמצאו ${dataQuality.newsItemsFound} כתבות.`);
  }
  if (typeof dataQuality.webResultsFound === "number") {
    lines.push(`נמצאו ${dataQuality.webResultsFound} תוצאות ווב רלוונטיות.`);
  }
  if (typeof dataQuality.confidence === "number") {
    lines.push(`רמת ביטחון: ${Math.round(dataQuality.confidence * 100)}%.`);
  }

  if (lines.length === 0) {
    return "";
  }

  return `<p><strong>איכות מידע:</strong> ${escapeHtml(lines.join(" "))}</p>`;
}

function showError(message) {
  errorText.textContent = message;
  errorText.classList.remove("hidden");
}

function hideError() {
  errorText.classList.add("hidden");
  errorText.textContent = "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
