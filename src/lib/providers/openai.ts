import { intelligenceBriefSchema } from "@/lib/intelligence/schema";
import { fetchJson } from "@/lib/http";
import type { IntelligenceBrief } from "@/lib/types";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function generateBriefWithOpenAI({
  apiKey,
  model,
  companyName,
  enrichedContext,
}: {
  apiKey?: string;
  model: string;
  companyName: string;
  enrichedContext: unknown;
}): Promise<IntelligenceBrief | null> {
  if (!apiKey) {
    return null;
  }

  const systemPrompt =
    "You are a B2B sales intelligence analyst. Generate strict JSON only, no markdown. Use confidenceScore from 0 to 1. Separate confirmed facts, inferred insights, and estimated values. Never overwrite user-provided values.";

  const userPrompt = `
Target company: ${companyName}

Build a structured sales brief JSON with this exact shape:
{
  "companySnapshot": {
    "companyName": { "value": "...", "status": "...", "confidenceScore": 0.9, "sourceAttribution": ["..."], "notes": "..." },
    "industrySegment": { ... },
    "headquartersLocation": { ... },
    "estimatedEmployeeCount": { ... },
    "countriesOfOperation": { "value": ["..."], ... },
    "companyStage": { "value": "startup|scale-up|enterprise|public|unknown", ... }
  },
  "growthBusinessSignals": [{ "signal": "...", "detail": "...", "status": "...", "confidenceScore": 0.8, "sourceAttribution": ["..."] }],
  "benefitsEmployeeExperienceSignals": [{ ... }],
  "recentNews": [{ "title": "...", "summary": "...", "whyItMattersForSales": "...", "url": "...", "publishedAt": "...", "confidenceScore": 0.8, "sourceAttribution": ["..."] }],
  "buyingCommitteeSuggestions": [{ "role": "...", "reason": "...", "confidenceScore": 0.8, "sourceAttribution": ["..."] }],
  "salesRecommendation": {
    "recommendedOutreachAngle": "...",
    "likelyPainPoints": ["..."],
    "woltBenefitsRelevance": "...",
    "expansionPotential": { "value": "Low|Medium|High", "status": "...", "confidenceScore": 0.8, "sourceAttribution": ["..."] }
  },
  "confirmedFacts": ["..."],
  "inferredInsights": ["..."],
  "estimatedValues": ["..."]
}

Input context:
${JSON.stringify(enrichedContext, null, 2)}
`;

  try {
    const response = await fetchJson<ChatCompletionResponse>(
      "https://api.openai.com/v1/chat/completions",
      {
        timeoutMs: 18000,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          response_format: {
            type: "json_object",
          },
        }),
      },
    );

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = intelligenceBriefSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}
