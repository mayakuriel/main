import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCompanyBrief } from "@/lib/intelligence/brief-generator";

const requestSchema = z.object({
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const response = await generateCompanyBrief(parsed.data);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate company brief.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
