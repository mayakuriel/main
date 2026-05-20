export type FieldStatus = "confirmed" | "inferred" | "estimated";

export type CompanyStage = "startup" | "scale-up" | "enterprise" | "public" | "unknown";

export type ExpansionPotential = "Low" | "Medium" | "High";

export interface FieldInsight<T> {
  value: T;
  status: FieldStatus;
  confidenceScore: number;
  sourceAttribution: string[];
  notes?: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  whyItMattersForSales: string;
  url?: string;
  publishedAt?: string;
  confidenceScore: number;
  sourceAttribution: string[];
}

export interface StakeholderSuggestion {
  role: string;
  reason: string;
  confidenceScore: number;
  sourceAttribution: string[];
}

export interface BriefSectionSignal {
  signal: string;
  detail: string;
  status: FieldStatus;
  confidenceScore: number;
  sourceAttribution: string[];
}

export interface SalesRecommendation {
  recommendedOutreachAngle: string;
  likelyPainPoints: string[];
  woltBenefitsRelevance: string;
  expansionPotential: FieldInsight<ExpansionPotential>;
}

export interface CompanySnapshot {
  companyName: FieldInsight<string>;
  industrySegment: FieldInsight<string>;
  headquartersLocation: FieldInsight<string>;
  estimatedEmployeeCount: FieldInsight<string>;
  countriesOfOperation: FieldInsight<string[]>;
  companyStage: FieldInsight<CompanyStage>;
}

export interface IntelligenceBrief {
  companySnapshot: CompanySnapshot;
  growthBusinessSignals: BriefSectionSignal[];
  benefitsEmployeeExperienceSignals: BriefSectionSignal[];
  recentNews: NewsItem[];
  buyingCommitteeSuggestions: StakeholderSuggestion[];
  salesRecommendation: SalesRecommendation;
  confirmedFacts: string[];
  inferredInsights: string[];
  estimatedValues: string[];
}

export interface GeneratedBriefPayload {
  companyName: string;
  userProvided?: Partial<{
    industrySegment: string;
    headquartersLocation: string;
    estimatedEmployeeCount: string;
    countriesOfOperation: string[];
    companyStage: CompanyStage;
  }>;
}

export interface GeneratedBriefResponse {
  executiveSummary: string;
  brief: IntelligenceBrief;
  generatedAt: string;
  warnings: string[];
}
