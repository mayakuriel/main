import type { FieldStatus, GeneratedBriefResponse } from "@/lib/types";

export function BriefView({ data }: { data: GeneratedBriefResponse }) {
  const { brief } = data;

  return (
    <div className="brief-wrapper">
      <article className="summary-card">
        <h2>Executive Summary</h2>
        <p>{data.executiveSummary}</p>
        <p className="meta-line">Generated at: {new Date(data.generatedAt).toLocaleString()}</p>
        {data.warnings.length ? (
          <ul className="warning-list">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </article>

      <details open className="detail-section">
        <summary>Company Snapshot</summary>
        <ul className="detail-grid">
          <li>{renderField("Company name", brief.companySnapshot.companyName)}</li>
          <li>{renderField("Industry / segment", brief.companySnapshot.industrySegment)}</li>
          <li>{renderField("Headquarters", brief.companySnapshot.headquartersLocation)}</li>
          <li>{renderField("Employee count", brief.companySnapshot.estimatedEmployeeCount)}</li>
          <li>
            {renderField(
              "Countries of operation",
              {
                ...brief.companySnapshot.countriesOfOperation,
                value: brief.companySnapshot.countriesOfOperation.value.join(", "),
              },
            )}
          </li>
          <li>{renderField("Company stage", brief.companySnapshot.companyStage)}</li>
        </ul>
      </details>

      <details className="detail-section">
        <summary>Growth &amp; Business Signals</summary>
        <SignalList
          items={brief.growthBusinessSignals.map((signal) => ({
            title: signal.signal,
            body: signal.detail,
            confidence: signal.confidenceScore,
            status: signal.status,
            sources: signal.sourceAttribution,
          }))}
        />
      </details>

      <details className="detail-section">
        <summary>Benefits &amp; Employee Experience Signals</summary>
        <SignalList
          items={brief.benefitsEmployeeExperienceSignals.map((signal) => ({
            title: signal.signal,
            body: signal.detail,
            confidence: signal.confidenceScore,
            status: signal.status,
            sources: signal.sourceAttribution,
          }))}
        />
      </details>

      <details className="detail-section">
        <summary>Recent News</summary>
        <ul className="stack-list">
          {brief.recentNews.map((item) => (
            <li key={`${item.title}-${item.url ?? item.publishedAt}`} className="stack-card">
              <h4>{item.title}</h4>
              <p>{item.summary}</p>
              <p>
                <strong>Why this matters:</strong> {item.whyItMattersForSales}
              </p>
              <small>
                Confidence: {formatConfidence(item.confidenceScore)} | Sources:{" "}
                {item.sourceAttribution.join(", ")}
              </small>
            </li>
          ))}
        </ul>
      </details>

      <details className="detail-section">
        <summary>Buying Committee Suggestions</summary>
        <ul className="stack-list">
          {brief.buyingCommitteeSuggestions.map((suggestion) => (
            <li key={suggestion.role} className="stack-card">
              <h4>{suggestion.role}</h4>
              <p>{suggestion.reason}</p>
              <small>
                Confidence: {formatConfidence(suggestion.confidenceScore)} | Sources:{" "}
                {suggestion.sourceAttribution.join(", ")}
              </small>
            </li>
          ))}
        </ul>
      </details>

      <details className="detail-section">
        <summary>Sales Recommendation</summary>
        <ul className="stack-list">
          <li className="stack-card">
            <h4>Outreach angle</h4>
            <p>{brief.salesRecommendation.recommendedOutreachAngle}</p>
          </li>
          <li className="stack-card">
            <h4>Likely pain points</h4>
            <ul>
              {brief.salesRecommendation.likelyPainPoints.map((painPoint) => (
                <li key={painPoint}>{painPoint}</li>
              ))}
            </ul>
          </li>
          <li className="stack-card">
            <h4>Why Wolt Benefits</h4>
            <p>{brief.salesRecommendation.woltBenefitsRelevance}</p>
            <p>
              <strong>Expansion potential:</strong>{" "}
              {brief.salesRecommendation.expansionPotential.value} (
              {formatConfidence(brief.salesRecommendation.expansionPotential.confidenceScore)})
            </p>
          </li>
        </ul>
      </details>

      <details className="detail-section">
        <summary>Raw JSON Output</summary>
        <pre className="json-output">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

function renderField(
  label: string,
  field: {
    value: string;
    status: FieldStatus;
    confidenceScore: number;
    sourceAttribution: string[];
    notes?: string;
  },
) {
  return (
    <div className="snapshot-field">
      <h4>{label}</h4>
      <p>{field.value || "Unknown"}</p>
      <small>
        <StatusPill status={field.status} /> Confidence: {formatConfidence(field.confidenceScore)} |
        Sources: {field.sourceAttribution.join(", ")}
      </small>
      {field.notes ? <small>{field.notes}</small> : null}
    </div>
  );
}

function SignalList({
  items,
}: {
  items: Array<{
    title: string;
    body: string;
    confidence: number;
    status: FieldStatus;
    sources: string[];
  }>;
}) {
  return (
    <ul className="stack-list">
      {items.map((item) => (
        <li key={`${item.title}-${item.body}`} className="stack-card">
          <h4>{item.title}</h4>
          <p>{item.body}</p>
          <small>
            <StatusPill status={item.status} /> Confidence: {formatConfidence(item.confidence)} |
            Sources: {item.sources.join(", ")}
          </small>
        </li>
      ))}
    </ul>
  );
}

function StatusPill({ status }: { status: FieldStatus }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
