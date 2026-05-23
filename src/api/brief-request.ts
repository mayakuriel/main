import { z } from "zod";

export const briefRequestSchema = z.object({
  companyName: z.string().min(2, "Company name must have at least 2 characters."),
  userProvided: z
    .object({
      industrySegment: z.string().optional(),
      headquartersLocation: z.string().optional(),
      estimatedEmployeeCount: z.string().optional(),
      countriesOfOperation: z.array(z.string()).optional(),
      companyStage: z.enum(["startup", "scale-up", "enterprise", "public", "unknown"]).optional(),
    })
    .optional(),
});

export type BriefRequestPayload = z.infer<typeof briefRequestSchema>;
