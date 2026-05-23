import { fetchJson, fetchText } from "../http";

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
    return await fetchNewsFromGoogleRss(companyName);
  }

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", `"${companyName}"`);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("language", "en");
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetchJson<NewsApiResponse>(url, { timeoutMs: 10000 });
    const articles = response.articles ?? [];
    if (articles.length > 0) {
      return articles;
    }
    return await fetchNewsFromGoogleRss(companyName);
  } catch {
    return await fetchNewsFromGoogleRss(companyName);
  }
}

async function fetchNewsFromGoogleRss(companyName: string): Promise<NewsApiArticle[]> {
  const rssUrl = new URL("https://news.google.com/rss/search");
  rssUrl.searchParams.set("q", `"${companyName}"`);
  rssUrl.searchParams.set("hl", "en-US");
  rssUrl.searchParams.set("gl", "US");
  rssUrl.searchParams.set("ceid", "US:en");

  try {
    const xml = await fetchText(rssUrl, { timeoutMs: 10000 });
    return parseRssItems(xml);
  } catch {
    return [];
  }
}

function parseRssItems(xml: string): NewsApiArticle[] {
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);

  return itemMatches
    .map((match) => match[1])
    .map((itemXml) => ({
      source: {
        name: decodeXmlEntities(extractTag(itemXml, "source") ?? "Google News RSS"),
      },
      title: decodeXmlEntities(extractTag(itemXml, "title") ?? ""),
      description: decodeXmlEntities(extractTag(itemXml, "description") ?? ""),
      url: extractTag(itemXml, "link"),
      publishedAt: extractTag(itemXml, "pubDate"),
    }))
    .filter((article) => article.title);
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match?.[1]) {
    return undefined;
  }
  return match[1].trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
