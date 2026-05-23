const companyNameInput = document.getElementById("companyName");
const generateButton = document.getElementById("generateButton");
const statusText = document.getElementById("statusText");
const errorBanner = document.getElementById("errorBanner");
const resultPanel = document.getElementById("resultPanel");

let debounceTimeout;
let currentAbortController;

companyNameInput.addEventListener("input", () => {
  const value = companyNameInput.value.trim();
  generateButton.disabled = value.length < 2;

  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  if (value.length < 2) {
    return;
  }

  debounceTimeout = setTimeout(() => {
    void generateBrief("auto");
  }, 900);
});

generateButton.addEventListener("click", () => {
  void generateBrief("manual");
});

async function generateBrief(source) {
  const companyName = companyNameInput.value.trim();
  if (companyName.length < 2) {
    return;
  }

  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();

  errorBanner.classList.add("hidden");
  statusText.classList.remove("hidden");
  generateButton.disabled = true;

  try {
    const response = await fetch("/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
      signal: currentAbortController.signal,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to generate brief.");
    }

    renderBrief(payload);
  } catch (error) {
    if (currentAbortController.signal.aborted) {
      return;
    }

    errorBanner.textContent =
      error instanceof Error
        ? error.message
        : source === "auto"
          ? "Auto-generation failed. Please try Generate Brief."
          : "Failed to generate company brief.";
    errorBanner.classList.remove("hidden");
  } finally {
    statusText.classList.add("hidden");
    generateButton.disabled = companyNameInput.value.trim().length < 2;
  }
}

function renderBrief(data) {
  const brief = data.brief;
  resultPanel.classList.remove("hidden");

  resultPanel.innerHTML = `
    <article class="summary-card">
      <h2>Executive Summary</h2>
      <p>${escapeHtml(data.executiveSummary)}</p>
      <p class="meta-line">Generated at: ${new Date(data.generatedAt).toLocaleString()}</p>
      ${renderWarnings(data.warnings)}
    </article>

    <details open class="detail-section">
      <summary>Company Snapshot</summary>
      <ul class="detail-grid">
        <li>${renderField("Company name", brief.companySnapshot.companyName)}</li>
        <li>${renderField("Industry / segment", brief.companySnapshot.industrySegment)}</li>
        <li>${renderField("Headquarters", brief.companySnapshot.headquartersLocation)}</li>
        <li>${renderField("Employee count", brief.companySnapshot.estimatedEmployeeCount)}</li>
        <li>${renderField("Countries of operation", {
          ...brief.companySnapshot.countriesOfOperation,
          value: brief.companySnapshot.countriesOfOperation.value.join(", "),
        })}</li>
        <li>${renderField("Company stage", brief.companySnapshot.companyStage)}</li>
      </ul>
    </details>

    <details class="detail-section">
      <summary>Growth & Business Signals</summary>
      ${renderSignalList(
        brief.growthBusinessSignals.map((signal) => ({
          title: signal.signal,
          body: signal.detail,
          status: signal.status,
          confidence: signal.confidenceScore,
          sources: signal.sourceAttribution,
        })),
      )}
    </details>

    <details class="detail-section">
      <summary>Benefits & Employee Experience Signals</summary>
      ${renderSignalList(
        brief.benefitsEmployeeExperienceSignals.map((signal) => ({
          title: signal.signal,
          body: signal.detail,
          status: signal.status,
          confidence: signal.confidenceScore,
          sources: signal.sourceAttribution,
        })),
      )}
    </details>

    <details class="detail-section">
      <summary>Recent News</summary>
      <ul class="stack-list">
        ${brief.recentNews
          .map(
            (item) => `
          <li class="stack-card">
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.summary)}</p>
            <p><strong>Why this matters:</strong> ${escapeHtml(item.whyItMattersForSales)}</p>
            <small>Confidence: ${formatConfidence(item.confidenceScore)} | Sources: ${escapeHtml(item.sourceAttribution.join(", "))}</small>
          </li>
        `,
          )
          .join("")}
      </ul>
    </details>

    <details class="detail-section">
      <summary>Buying Committee Suggestions</summary>
      <ul class="stack-list">
        ${brief.buyingCommitteeSuggestions
          .map(
            (item) => `
          <li class="stack-card">
            <h4>${escapeHtml(item.role)}</h4>
            <p>${escapeHtml(item.reason)}</p>
            <small>Confidence: ${formatConfidence(item.confidenceScore)} | Sources: ${escapeHtml(item.sourceAttribution.join(", "))}</small>
          </li>
        `,
          )
          .join("")}
      </ul>
    </details>

    <details class="detail-section">
      <summary>Sales Recommendation</summary>
      <ul class="stack-list">
        <li class="stack-card">
          <h4>Outreach angle</h4>
          <p>${escapeHtml(brief.salesRecommendation.recommendedOutreachAngle)}</p>
        </li>
        <li class="stack-card">
          <h4>Likely pain points</h4>
          <ul>
            ${brief.salesRecommendation.likelyPainPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </li>
        <li class="stack-card">
          <h4>Why Wolt Benefits</h4>
          <p>${escapeHtml(brief.salesRecommendation.woltBenefitsRelevance)}</p>
          <p>
            <strong>Expansion potential:</strong>
            ${escapeHtml(brief.salesRecommendation.expansionPotential.value)} (${formatConfidence(
              brief.salesRecommendation.expansionPotential.confidenceScore,
            )})
          </p>
        </li>
      </ul>
    </details>

    <details class="detail-section">
      <summary>Raw JSON Output</summary>
      <pre class="json-output">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
    </details>
  `;
}

function renderWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    return "";
  }

  return `<ul class="warning-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function renderField(label, field) {
  return `
    <div class="snapshot-field">
      <h4>${escapeHtml(label)}</h4>
      <p>${escapeHtml(field.value || "Unknown")}</p>
      <small>
        <span class="status-pill status-${escapeHtml(field.status)}">${escapeHtml(field.status)}</span>
        Confidence: ${formatConfidence(field.confidenceScore)} | Sources: ${escapeHtml(field.sourceAttribution.join(", "))}
      </small>
      ${field.notes ? `<small>${escapeHtml(field.notes)}</small>` : ""}
    </div>
  `;
}

function renderSignalList(items) {
  return `
    <ul class="stack-list">
      ${items
        .map(
          (item) => `
        <li class="stack-card">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.body)}</p>
          <small>
            <span class="status-pill status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
            Confidence: ${formatConfidence(item.confidence)} | Sources: ${escapeHtml(item.sources.join(", "))}
          </small>
        </li>
      `,
        )
        .join("")}
    </ul>
  `;
}

function formatConfidence(value) {
  return `${Math.round(value * 100)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
