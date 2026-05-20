import { fetchJson } from "@/lib/http";

export interface NewsApiArticle {
  source?: { name?: string };
  author?: string;
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  content?: string;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

export async function fetchNewsArticles(
  companyName: string,
  apiKey?: string,
): Promise<NewsApiArticle[]> {
  if (!apiKey) {
    return [];
  }

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", `"${companyName}"`);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("language", "en");
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetchJson<NewsApiResponse>(url, { timeoutMs: 10000 });
    return response.articles ?? [];
  } catch {
    return [];
  }
}
