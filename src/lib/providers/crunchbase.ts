import { fetchJson } from "../http";

export interface CrunchbaseOrganization {
  name?: string;
  short_description?: string;
  rank_org?: number;
  operating_status?: string;
  founded_on?: { value?: string };
  funding_total?: { value_usd?: number };
  num_employees_enum?: string;
  location_identifiers?: Array<{ value?: string }>;
  ipo_status?: string;
}

interface CrunchbaseSearchResponse {
  entities?: Array<{
    properties?: CrunchbaseOrganization;
  }>;
}

export async function fetchCrunchbaseOrganization(
  companyName: string,
  apiKey?: string,
): Promise<CrunchbaseOrganization | null> {
  if (!apiKey) {
    return null;
  }

  const url = new URL("https://api.crunchbase.com/api/v4/searches/organizations");

  try {
    const response = await fetchJson<CrunchbaseSearchResponse>(url, {
      timeoutMs: 10000,
      method: "POST",
      headers: {
        "X-cb-user-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        field_ids: [
          "identifier",
          "name",
          "short_description",
          "rank_org",
          "operating_status",
          "founded_on",
          "funding_total",
          "num_employees_enum",
          "location_identifiers",
          "ipo_status",
        ],
        query: [
          {
            type: "predicate",
            field_id: "name",
            operator_id: "contains",
            values: [companyName],
          },
        ],
        limit: 1,
      }),
    });

    return response.entities?.[0]?.properties ?? null;
  } catch {
    return null;
  }
}
