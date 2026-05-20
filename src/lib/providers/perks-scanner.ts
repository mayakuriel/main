import { fetchText } from "@/lib/http";

const BENEFIT_KEYWORDS = [
  "meal allowance",
  "lunch stipend",
  "wellbeing",
  "well-being",
  "office perks",
  "hybrid",
  "remote support",
  "mental health",
  "employee experience",
  "workplace culture",
];

export interface BenefitsSignalHit {
  keyword: string;
  snippet: string;
  sourceUrl: string;
}

export async function scanBenefitsSignals(baseWebsiteUrl?: string): Promise<BenefitsSignalHit[]> {
  if (!baseWebsiteUrl) {
    return [];
  }

  const candidates = buildCandidateUrls(baseWebsiteUrl);
  const hits: BenefitsSignalHit[] = [];

  for (const url of candidates) {
    try {
      const html = await fetchText(url, { timeoutMs: 7000 });
      const text = htmlToText(html).toLowerCase();

      for (const keyword of BENEFIT_KEYWORDS) {
        if (text.includes(keyword)) {
          hits.push({
            keyword,
            snippet: extractSnippet(text, keyword),
            sourceUrl: url,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return dedupeHits(hits).slice(0, 8);
}

function buildCandidateUrls(baseWebsiteUrl: string): string[] {
  const normalizedBase = baseWebsiteUrl.endsWith("/")
    ? baseWebsiteUrl.slice(0, -1)
    : baseWebsiteUrl;

  return [
    normalizedBase,
    `${normalizedBase}/careers`,
    `${normalizedBase}/jobs`,
    `${normalizedBase}/about`,
    `${normalizedBase}/people`,
    `${normalizedBase}/culture`,
  ];
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSnippet(text: string, keyword: string): string {
  const index = text.indexOf(keyword);
  if (index < 0) {
    return keyword;
  }

  const start = Math.max(0, index - 75);
  const end = Math.min(text.length, index + keyword.length + 75);
  return text.slice(start, end).trim();
}

function dedupeHits(hits: BenefitsSignalHit[]): BenefitsSignalHit[] {
  const seen = new Set<string>();

  return hits.filter((hit) => {
    const key = `${hit.keyword}:${hit.sourceUrl}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
