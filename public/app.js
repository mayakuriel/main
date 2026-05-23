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
    </article>
    <article class="card">
      <h2>כתבות אחרונות</h2>
      ${newsHtml ? `<ul>${newsHtml}</ul>` : "<p>לא נמצאו כתבות עדכניות.</p>"}
    </article>
  `;

  result.classList.remove("hidden");
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
