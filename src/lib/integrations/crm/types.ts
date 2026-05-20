import type { GeneratedBriefResponse } from "@/lib/types";

export interface CrmDealContext {
  organizationName: string;
  externalId?: string;
}

export interface CrmIntegration {
  provider: "pipedrive";
  upsertCompanyBrief(context: CrmDealContext, brief: GeneratedBriefResponse): Promise<void>;
}
