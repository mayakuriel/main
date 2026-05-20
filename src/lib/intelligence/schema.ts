import { z } from "zod";

const fieldStatusSchema = z.enum(["confirmed", "inferred", "estimated"]);
const stageSchema = z.enum(["startup", "scale-up", "enterprise", "public", "unknown"]);
const expansionSchema = z.enum(["Low", "Medium", "High"]);

const fieldInsightSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    status: fieldStatusSchema,
    confidenceScore: z.number().min(0).max(1),
    sourceAttribution: z.array(z.string()),
    notes: z.string().optional(),
  });

const sectionSignalSchema = z.object({
  signal: z.string(),
  detail: z.string(),
  status: fieldStatusSchema,
  confidenceScore: z.number().min(0).max(1),
  sourceAttribution: z.array(z.string()),
});

const newsItemSchema = z.object({
  title: z.string(),
  summary: z.string(),
  whyItMattersForSales: z.string(),
  url: z.string().optional(),
  publishedAt: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
  sourceAttribution: z.array(z.string()),
});

const stakeholderSchema = z.object({
  role: z.string(),
  reason: z.string(),
  confidenceScore: z.number().min(0).max(1),
  sourceAttribution: z.array(z.string()),
});

export const intelligenceBriefSchema = z.object({
  companySnapshot: z.object({
    companyName: fieldInsightSchema(z.string()),
    industrySegment: fieldInsightSchema(z.string()),
    headquartersLocation: fieldInsightSchema(z.string()),
    estimatedEmployeeCount: fieldInsightSchema(z.string()),
    countriesOfOperation: fieldInsightSchema(z.array(z.string())),
    companyStage: fieldInsightSchema(stageSchema),
  }),
  growthBusinessSignals: z.array(sectionSignalSchema),
  benefitsEmployeeExperienceSignals: z.array(sectionSignalSchema),
  recentNews: z.array(newsItemSchema).max(5),
  buyingCommitteeSuggestions: z.array(stakeholderSchema),
  salesRecommendation: z.object({
    recommendedOutreachAngle: z.string(),
    likelyPainPoints: z.array(z.string()),
    woltBenefitsRelevance: z.string(),
    expansionPotential: fieldInsightSchema(expansionSchema),
  }),
  confirmedFacts: z.array(z.string()),
  inferredInsights: z.array(z.string()),
  estimatedValues: z.array(z.string()),
});

export type IntelligenceBriefSchema = z.infer<typeof intelligenceBriefSchema>;
