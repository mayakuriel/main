import { getEnv } from "@/lib/env";
import { generateBriefWithOpenAI } from "@/lib/providers/openai";
import { fetchNewsArticles } from "@/lib/providers/newsapi";
import { fetchCrunchbaseOrganization } from "@/lib/providers/crunchbase";
import { fetchClearbitCompany } from "@/lib/providers/clearbit";
import { fetchApolloOrganization } from "@/lib/providers/apollo";
import { fetchOpenSourcesProfile } from "@/lib/providers/open-sources";
import { scanBenefitsSignals } from "@/lib/providers/perks-scanner";
import type {
  BriefSectionSignal,
  FieldInsight,
  GeneratedBriefPayload,
  GeneratedBriefResponse,
  IntelligenceBrief,
  NewsItem,
  StakeholderSuggestion,
  CompanyStage,
} from "@/lib/types";

interface EnrichedContext {
  companyName: string;
  clearbit: Awaited<ReturnType<typeof fetchClearbitCompany>>;
  crunchbase: Awaited<ReturnType<typeof fetchCrunchbaseOrganization>>;
  apollo: Awaited<ReturnType<typeof fetchApolloOrganization>>;
  openSources: Awaited<ReturnType<typeof fetchOpenSourcesProfile>>;
  news: Awaited<ReturnType<typeof fetchNewsArticles>>;
  benefitsSignals: Awaited<ReturnType<typeof scanBenefitsSignals>>;
}

export async function generateCompanyBrief(
  payload: GeneratedBriefPayload,
): Promise<GeneratedBriefResponse> {
  const env = getEnv();
  const companyName = payload.companyName.trim();
  const warnings: string[] = [];

  const [clearbit, crunchbase, apollo, openSources, news] = await Promise.all([
    fetchClearbitCompany(companyName, env.CLEARBIT_API_KEY),
    fetchCrunchbaseOrganization(companyName, env.CRUNCHBASE_API_KEY),
    fetchApolloOrganization(companyName, env.APOLLO_API_KEY),
    fetchOpenSourcesProfile(companyName),
    fetchNewsArticles(companyName, env.NEWS_API_KEY),
  ]);

  const website = normalizeWebsite(
    clearbit?.domain ? `https://${clearbit.domain}` : apollo?.website_url ?? undefined,
  );
  const benefitsSignals = await scanBenefitsSignals(website);

  if (!env.NEWS_API_KEY) {
    warnings.push("NEWS_API_KEY not configured. Recent news may be limited.");
  }
  if (!env.CLEARBIT_API_KEY && !env.APOLLO_API_KEY) {
    warnings.push("No enrichment API key configured (CLEARBIT_API_KEY or APOLLO_API_KEY).");
  }
  if (!env.CRUNCHBASE_API_KEY) {
    warnings.push("CRUNCHBASE_API_KEY not configured. Funding signals may be limited.");
  }

  const context: EnrichedContext = {
    companyName,
    clearbit,
    crunchbase,
    apollo,
    openSources,
    news,
    benefitsSignals,
  };

  const aiBrief = await generateBriefWithOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    companyName,
    enrichedContext: context,
  });

  if (!env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY not configured. Using deterministic fallback summarization.");
  }

  const baseBrief = aiBrief ?? generateDeterministicBrief(context);
  const brief = applyUserProvidedOverrides(baseBrief, payload);
  const executiveSummary = buildExecutiveSummary(brief);

  return {
    executiveSummary,
    brief,
    generatedAt: new Date().toISOString(),
    warnings,
  };
}

function generateDeterministicBrief(context: EnrichedContext): IntelligenceBrief {
  const companyName = context.clearbit?.name ?? context.apollo?.name ?? context.companyName;
  const industry =
    context.clearbit?.category?.industry ??
    context.apollo?.industry ??
    context.crunchbase?.short_description ??
    "Unknown";
  const headquarters = [
    context.clearbit?.geo?.city ?? context.apollo?.city,
    context.clearbit?.geo?.state ?? context.apollo?.state,
    context.clearbit?.geo?.country ?? context.apollo?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const employees = formatEmployees(
    context.clearbit?.metrics?.employees,
    context.apollo?.estimated_num_employees,
    context.crunchbase?.num_employees_enum,
  );
  const countries = uniqueStrings(
    [
      context.clearbit?.geo?.country,
      context.apollo?.country,
      ...(context.crunchbase?.location_identifiers?.map((item) => item.value) ?? []),
    ].filter(Boolean) as string[],
  );
  const stage = inferCompanyStage(employees, context.crunchbase?.ipo_status, context.crunchbase?.funding_total?.value_usd);

  const snapshot = {
    companyName: createField(companyName, "confirmed", 0.95, buildSources(["clearbit", "apollo", "user_input"])),
    industrySegment: createField(industry, industry === "Unknown" ? "estimated" : "inferred", industry === "Unknown" ? 0.35 : 0.7, buildSources(["clearbit", "apollo", "wikipedia"])),
    headquartersLocation: createField(headquarters || "Unknown", headquarters ? "inferred" : "estimated", headquarters ? 0.68 : 0.3, buildSources(["clearbit", "apollo"])),
    estimatedEmployeeCount: createField(
      employees || "Unknown",
      employees ? "estimated" : "estimated",
      employees ? 0.64 : 0.25,
      buildSources(["clearbit", "apollo", "crunchbase"]),
    ),
    countriesOfOperation: createField(
      countries.length ? countries : ["Unknown"],
      countries.length ? "inferred" : "estimated",
      countries.length ? 0.57 : 0.2,
      buildSources(["crunchbase", "clearbit"]),
    ),
    companyStage: createField(stage, stage === "unknown" ? "estimated" : "inferred", stage === "unknown" ? 0.3 : 0.65, buildSources(["employee_estimate", "crunchbase"])),
  };

  const growthSignals = buildGrowthSignals(context);
  const benefits = buildBenefitsSignals(context);
  const recentNews = buildRecentNews(context);
  const committee = buildStakeholders(snapshot.estimatedEmployeeCount.value, stage);
  const salesRecommendation = buildSalesRecommendation(snapshot, growthSignals, benefits);

  return {
    companySnapshot: snapshot,
    growthBusinessSignals: growthSignals,
    benefitsEmployeeExperienceSignals: benefits,
    recentNews,
    buyingCommitteeSuggestions: committee,
    salesRecommendation,
    confirmedFacts: [
      `Company name: ${snapshot.companyName.value}`,
      ...recentNews.slice(0, 2).map((item) => `News: ${item.title}`),
    ],
    inferredInsights: [
      `Likely stage: ${snapshot.companyStage.value}`,
      `Likely outreach focus: ${salesRecommendation.recommendedOutreachAngle}`,
    ],
    estimatedValues: [
      `Estimated employee count: ${snapshot.estimatedEmployeeCount.value}`,
      `Expansion potential: ${salesRecommendation.expansionPotential.value}`,
    ],
  };
}

function buildGrowthSignals(context: EnrichedContext): BriefSectionSignal[] {
  const signals: BriefSectionSignal[] = [];
  const fundingUsd = context.crunchbase?.funding_total?.value_usd;

  if (fundingUsd) {
    signals.push({
      signal: "Recent funding",
      detail: `Reported total funding is around $${Math.round(fundingUsd / 1_000_000)}M.`,
      status: "confirmed",
      confidenceScore: 0.78,
      sourceAttribution: buildSources(["crunchbase"]),
    });
  }

  const hiringMention = context.news.find((item) =>
    /(hiring|recruiting|talent|headcount)/i.test(`${item.title} ${item.description}`),
  );
  signals.push({
    signal: "Hiring activity",
    detail: hiringMention
      ? `Hiring-related language appeared in recent coverage: "${hiringMention.title ?? "N/A"}".`
      : "No direct hiring data found; verify via careers page and LinkedIn headcount trends.",
    status: hiringMention ? "inferred" : "estimated",
    confidenceScore: hiringMention ? 0.62 : 0.35,
    sourceAttribution: hiringMention ? buildSources(["newsapi"]) : buildSources(["insufficient_public_data"]),
  });

  const expansionMention = context.news.find((item) =>
    /(expand|expansion|new market|new country|global)/i.test(`${item.title} ${item.description}`),
  );
  signals.push({
    signal: "Expansion signals",
    detail: expansionMention
      ? `Potential expansion indicator found: "${expansionMention.title ?? "N/A"}".`
      : "No explicit expansion announcement found in indexed sources.",
    status: expansionMention ? "inferred" : "estimated",
    confidenceScore: expansionMention ? 0.58 : 0.3,
    sourceAttribution: expansionMention ? buildSources(["newsapi"]) : buildSources(["newsapi"]),
  });

  const officeMention = context.news.find((item) =>
    /(office|headquarters|hq|campus)/i.test(`${item.title} ${item.description}`),
  );
  signals.push({
    signal: "Office openings",
    detail: officeMention
      ? `Office-related mention found: "${officeMention.title ?? "N/A"}".`
      : "No clear office opening signal found.",
    status: officeMention ? "inferred" : "estimated",
    confidenceScore: officeMention ? 0.54 : 0.25,
    sourceAttribution: buildSources(["newsapi"]),
  });

  const layoffsMention = context.news.find((item) =>
    /(layoff|restructur|cost-cut|downsizing)/i.test(`${item.title} ${item.description}`),
  );
  signals.push({
    signal: "Layoffs or restructuring",
    detail: layoffsMention
      ? `Potential workforce risk signal: "${layoffsMention.title ?? "N/A"}".`
      : "No layoff/restructuring headlines found in the selected sources.",
    status: layoffsMention ? "confirmed" : "estimated",
    confidenceScore: layoffsMention ? 0.67 : 0.32,
    sourceAttribution: buildSources(["newsapi"]),
  });

  const hybridSignal = context.benefitsSignals.find((item) =>
    /(hybrid|remote)/i.test(item.keyword),
  );
  signals.push({
    signal: "Hybrid / remote work model",
    detail: hybridSignal
      ? `Work model language detected from public pages (${hybridSignal.sourceUrl}).`
      : "No explicit hybrid/remote policy found in scanned pages.",
    status: hybridSignal ? "inferred" : "estimated",
    confidenceScore: hybridSignal ? 0.66 : 0.28,
    sourceAttribution: hybridSignal
      ? buildSources([hybridSignal.sourceUrl])
      : buildSources(["public_site_scan"]),
  });

  return signals;
}

function buildBenefitsSignals(context: EnrichedContext): BriefSectionSignal[] {
  if (context.benefitsSignals.length === 0) {
    return [
      {
        signal: "Benefits indicators",
        detail:
          "No explicit benefit keywords detected on indexed public pages. Validate via careers pages, Glassdoor, and employee testimonials.",
        status: "estimated",
        confidenceScore: 0.3,
        sourceAttribution: buildSources(["careers_page_scan", "insufficient_public_data"]),
      },
    ];
  }

  return context.benefitsSignals.map((hit) => ({
    signal: normalizeKeywordToSignal(hit.keyword),
    detail: `Keyword "${hit.keyword}" found in public content snippet: "${hit.snippet}".`,
    status: "inferred",
    confidenceScore: 0.64,
    sourceAttribution: buildSources([hit.sourceUrl]),
  }));
}

function buildRecentNews(context: EnrichedContext): NewsItem[] {
  return context.news.slice(0, 5).map((item) => ({
    title: item.title ?? "Untitled update",
    summary: item.description ?? "No summary provided by source.",
    whyItMattersForSales: deriveSalesWhyFromNews(item.title ?? "", item.description ?? ""),
    url: item.url,
    publishedAt: item.publishedAt,
    confidenceScore: item.title ? 0.74 : 0.45,
    sourceAttribution: buildSources([item.source?.name ?? "newsapi"]),
  }));
}

function buildStakeholders(employeeCount: string, stage: CompanyStage): StakeholderSuggestion[] {
  const largeOrg = /(1000\+|enterprise|public)/i.test(`${employeeCount} ${stage}`);

  const base: StakeholderSuggestion[] = [
    {
      role: "VP People",
      reason: "Owns talent experience strategy and often sponsors employee-benefit rollouts.",
      confidenceScore: 0.82,
      sourceAttribution: buildSources(["role_heuristic"]),
    },
    {
      role: "HR Director",
      reason: "Typically manages policy execution and benefit adoption across locations.",
      confidenceScore: 0.8,
      sourceAttribution: buildSources(["role_heuristic"]),
    },
    {
      role: "Total Rewards",
      reason: "Evaluates stipend design, cost control, and fairness by market.",
      confidenceScore: 0.84,
      sourceAttribution: buildSources(["role_heuristic"]),
    },
    {
      role: "Workplace Experience",
      reason: "Drives day-to-day in-office and hybrid employee programs.",
      confidenceScore: 0.76,
      sourceAttribution: buildSources(["role_heuristic"]),
    },
  ];

  if (largeOrg) {
    base.push(
      {
        role: "Finance",
        reason: "Controls budget governance and ROI framework for employee benefits at scale.",
        confidenceScore: 0.75,
        sourceAttribution: buildSources(["stage_heuristic"]),
      },
      {
        role: "Procurement",
        reason: "Likely involved in vendor onboarding and enterprise contract negotiations.",
        confidenceScore: 0.72,
        sourceAttribution: buildSources(["stage_heuristic"]),
      },
    );
  }

  return base;
}

function buildSalesRecommendation(
  snapshot: IntelligenceBrief["companySnapshot"],
  growthSignals: BriefSectionSignal[],
  benefitSignals: BriefSectionSignal[],
): IntelligenceBrief["salesRecommendation"] {
  const positiveGrowthCount = growthSignals.filter(
    (signal) => signal.status !== "estimated" && !/layoff/i.test(signal.signal),
  ).length;
  const negativeGrowthCount = growthSignals.filter(
    (signal) => /layoff|restructuring/i.test(signal.signal) && signal.status !== "estimated",
  ).length;

  const relevantBenefitsSignals = benefitSignals.filter((signal) => signal.status !== "estimated");
  const expansionPotential: "Low" | "Medium" | "High" =
    positiveGrowthCount >= 2 && relevantBenefitsSignals.length >= 1
      ? "High"
      : positiveGrowthCount >= 1 && negativeGrowthCount === 0
        ? "Medium"
        : "Low";

  return {
    recommendedOutreachAngle: `Position Wolt Benefits as a flexible meal + wellbeing layer for ${snapshot.companyName.value}'s ${snapshot.companyStage.value} workforce, emphasizing easy rollout across hybrid teams.`,
    likelyPainPoints: [
      "Uneven employee experience across office and hybrid staff",
      "Manual administration of stipends and meal policies",
      "Need to show measurable ROI for people-program spend",
    ],
    woltBenefitsRelevance:
      "Wolt Benefits can centralize meal allowances, improve perceived employee value, and reduce administrative overhead for People and Finance teams.",
    expansionPotential: createField(
      expansionPotential,
      "inferred",
      expansionPotential === "High" ? 0.77 : expansionPotential === "Medium" ? 0.61 : 0.46,
      buildSources(["growth_signals", "benefits_signals"]),
    ),
  };
}

function applyUserProvidedOverrides(
  brief: IntelligenceBrief,
  payload: GeneratedBriefPayload,
): IntelligenceBrief {
  const userProvided = payload.userProvided;
  if (!userProvided) {
    return brief;
  }

  const result = structuredClone(brief);

  if (userProvided.industrySegment) {
    result.companySnapshot.industrySegment = createField(
      userProvided.industrySegment,
      "confirmed",
      1,
      buildSources(["user_input"]),
      "User-provided value preserved.",
    );
  }
  if (userProvided.headquartersLocation) {
    result.companySnapshot.headquartersLocation = createField(
      userProvided.headquartersLocation,
      "confirmed",
      1,
      buildSources(["user_input"]),
      "User-provided value preserved.",
    );
  }
  if (userProvided.estimatedEmployeeCount) {
    result.companySnapshot.estimatedEmployeeCount = createField(
      userProvided.estimatedEmployeeCount,
      "confirmed",
      1,
      buildSources(["user_input"]),
      "User-provided value preserved.",
    );
  }
  if (userProvided.countriesOfOperation?.length) {
    result.companySnapshot.countriesOfOperation = createField(
      userProvided.countriesOfOperation,
      "confirmed",
      1,
      buildSources(["user_input"]),
      "User-provided value preserved.",
    );
  }
  if (userProvided.companyStage) {
    result.companySnapshot.companyStage = createField(
      userProvided.companyStage,
      "confirmed",
      1,
      buildSources(["user_input"]),
      "User-provided value preserved.",
    );
  }

  return result;
}

function buildExecutiveSummary(brief: IntelligenceBrief): string {
  const snapshot = brief.companySnapshot;
  const topGrowthSignal = brief.growthBusinessSignals[0]?.detail ?? "Limited growth evidence found.";
  const benefitsSignal =
    brief.benefitsEmployeeExperienceSignals[0]?.detail ?? "Benefits signals are currently limited.";

  return `${snapshot.companyName.value} appears to be a ${snapshot.companyStage.value} organization in the ${snapshot.industrySegment.value} segment. It is likely headquartered in ${snapshot.headquartersLocation.value} with an estimated workforce of ${snapshot.estimatedEmployeeCount.value}. Key business context: ${topGrowthSignal} Employee-experience context: ${benefitsSignal} Recommended next step: start outreach with People/Total Rewards leadership and position Wolt Benefits as a measurable, hybrid-friendly employee value proposition.`;
}

function deriveSalesWhyFromNews(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/(funding|investment|raises)/i.test(text)) {
    return "Fresh capital often enables investments in retention and employee-experience programs.";
  }
  if (/(hiring|expansion|new office|international)/i.test(text)) {
    return "Growth events increase pressure to standardize benefits across locations and work models.";
  }
  if (/(layoff|restructur|cost)/i.test(text)) {
    return "Cost pressure makes ROI-backed, controllable benefit programs more important in procurement.";
  }

  return "This update can provide a timely, contextual opener for personalized sales outreach.";
}

function inferCompanyStage(
  employeeLabel: string,
  ipoStatus?: string,
  fundingTotalUsd?: number,
): CompanyStage {
  if (ipoStatus && ipoStatus.toLowerCase() !== "private") {
    return "public";
  }
  if (/1000\+|5000\+|enterprise/i.test(employeeLabel)) {
    return "enterprise";
  }
  if (/201-500|501-1000/i.test(employeeLabel) || (fundingTotalUsd ?? 0) > 100_000_000) {
    return "scale-up";
  }
  if (/1-10|11-50|51-200/i.test(employeeLabel)) {
    return "startup";
  }

  return "unknown";
}

function normalizeWebsite(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

function normalizeKeywordToSignal(keyword: string): string {
  if (keyword.includes("meal") || keyword.includes("lunch")) {
    return "Meal allowance / lunch stipend";
  }
  if (keyword.includes("wellbeing") || keyword.includes("mental")) {
    return "Employee wellbeing";
  }
  if (keyword.includes("hybrid") || keyword.includes("remote")) {
    return "Hybrid employee support";
  }
  if (keyword.includes("culture")) {
    return "Workplace culture initiatives";
  }
  return "Office perks";
}

function formatEmployees(
  clearbitEmployees?: number,
  apolloEmployees?: number,
  crunchbaseRange?: string,
): string {
  if (typeof clearbitEmployees === "number") {
    return String(clearbitEmployees);
  }
  if (typeof apolloEmployees === "number") {
    return String(apolloEmployees);
  }
  if (crunchbaseRange) {
    return crunchbaseRange;
  }
  return "Unknown";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function createField<T>(
  value: T,
  status: FieldInsight<T>["status"],
  confidenceScore: number,
  sourceAttribution: string[],
  notes?: string,
): FieldInsight<T> {
  return {
    value,
    status,
    confidenceScore,
    sourceAttribution,
    notes,
  };
}

function buildSources(items: string[]): string[] {
  return uniqueStrings(items.filter(Boolean));
}
