import { fetchJson } from "../http";

export interface ApolloOrganization {
  name?: string;
  estimated_num_employees?: number;
  industry?: string;
  website_url?: string;
  keywords?: string[];
  city?: string;
  state?: string;
  country?: string;
}

interface ApolloEnrichmentResponse {
  organization?: ApolloOrganization;
}

export async function fetchApolloOrganization(
  companyName: string,
  apiKey?: string,
): Promise<ApolloOrganization | null> {
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetchJson<ApolloEnrichmentResponse>(
      "https://api.apollo.io/api/v1/organizations/enrich",
      {
        timeoutMs: 9000,
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({
          organization_name: companyName,
        }),
      },
    );

    return response.organization ?? null;
  } catch {
    return null;
  }
}
