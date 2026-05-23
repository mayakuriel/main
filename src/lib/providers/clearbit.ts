import { fetchJson } from "../http";

export interface ClearbitCompany {
  name?: string;
  legalName?: string;
  domain?: string;
  category?: {
    industry?: string;
    sector?: string;
    subIndustry?: string;
  };
  metrics?: {
    employees?: number;
    employeesRange?: string;
  };
  geo?: {
    city?: string;
    state?: string;
    country?: string;
  };
  foundedYear?: number;
  site?: {
    phoneNumbers?: string[];
  };
  description?: string;
}

export async function fetchClearbitCompany(
  companyName: string,
  apiKey?: string,
): Promise<ClearbitCompany | null> {
  if (!apiKey) {
    return null;
  }

  const url = new URL("https://company.clearbit.com/v2/companies/find");
  url.searchParams.set("name", companyName);

  try {
    return await fetchJson<ClearbitCompany>(url, {
      timeoutMs: 9000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } catch {
    return null;
  }
}
