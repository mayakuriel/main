import { getEnv } from "../../env";
import type { CrmDealContext, CrmIntegration } from "./types";
import type { GeneratedBriefResponse } from "../../types";

export class PipedriveIntegration implements CrmIntegration {
  public readonly provider = "pipedrive" as const;

  async upsertCompanyBrief(
    _context: CrmDealContext,
    _brief: GeneratedBriefResponse,
  ): Promise<void> {
    const { PIPEDRIVE_API_TOKEN } = getEnv();
    if (!PIPEDRIVE_API_TOKEN) {
      return;
    }

    // Placeholder for future implementation.
    // Design intent:
    // 1. Find or create organization in Pipedrive.
    // 2. Create/update a note field containing summary + JSON payload.
    // 3. Attach confidence metadata for auditability.
  }
}
