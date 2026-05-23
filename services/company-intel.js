const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";

async function getCompanyIntel(companyName) {
  const normalizedName = companyName.trim();

  const [wikiSummary, recentNews] = await Promise.all([
    fetchWikipediaSummary(normalizedName),
    fetchRecentNews(normalizedName),
  ]);

  const extractedFromSummary = extractGeneralData(wikiSummary?.extract || "");
  const industry =
    extractedFromSummary.industry || wikiSummary?.description || "No clear industry data found";

  return {
    query: normalizedName,
    company: {
      name: wikiSummary?.title || normalizedName,
      industry,
      headquarters:
        extractedFromSummary.headquarters || "No clear headquarters data found",
      employeeCount:
        extractedFromSummary.employeeCount || "No public employee count found",
      description: wikiSummary?.extract || "No general description found",
    },
    recentNews,
    sources: buildSources(wikiSummary, recentNews),
    generatedAt: new Date().toISOString(),
  };
}

async function fetchWikipediaSummary(companyName) {
  const slug = encodeURIComponent(companyName.replace(/\s+/g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`;

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

async function fetchRecentNews(companyName) {
  const url = new URL(GOOGLE_NEWS_RSS_URL);
  url.searchParams.set("q", `"${companyName}"`);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseRssItems(xml).slice(0, 5);
  } catch {
    return [];
  }
}

function parseRssItems(xml) {
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(
    (match) => match[1],
  );

  return itemBlocks.map((itemXml) => {
    const title = cleanText(extractTag(itemXml, "title"));
    const link = cleanText(extractTag(itemXml, "link"));
    const pubDate = cleanText(extractTag(itemXml, "pubDate"));
    const source = cleanText(extractTag(itemXml, "source")) || "Google News";
    const description = cleanDescription(cleanText(extractTag(itemXml, "description")));

    return {
      title: title || "Untitled news item",
      source,
      publishedAt: pubDate || "Unknown date",
      summary: description || "No summary available",
      url: link || "",
    };
  });
}

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1] || "";
}

function cleanDescription(value) {
  return value
    .replace(/<a[^>]*>/gi, "")
    .replace(/<\/a>/gi, "")
    .replace(/<font[^>]*>/gi, "")
    .replace(/<\/font>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return decodeXmlEntities((value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractGeneralData(summaryText) {
  const cleaned = summaryText.replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();

  const headquartersMatch =
    cleaned.match(/headquartered in ([^.,;]+)/i) ||
    cleaned.match(/based in ([^.,;]+)/i);

  const employeeMatch =
    cleaned.match(/(\d{1,3}(?:,\d{3})+|\d+)\s+employees/i) ||
    cleaned.match(/employs\s+(\d{1,3}(?:,\d{3})+|\d+)/i);

  let industry = "";
  if (lower.includes("software")) industry = "Software / Technology";
  else if (lower.includes("fintech")) industry = "Fintech";
  else if (lower.includes("bank")) industry = "Banking / Finance";
  else if (lower.includes("retail")) industry = "Retail";
  else if (lower.includes("e-commerce")) industry = "E-commerce";
  else if (lower.includes("logistics")) industry = "Logistics";
  else if (lower.includes("health")) industry = "Health / Healthcare";

  return {
    headquarters: headquartersMatch?.[1]?.trim() || "",
    employeeCount: employeeMatch?.[1]?.trim() || "",
    industry,
  };
}

function buildSources(wikiSummary, recentNews) {
  const sources = [];

  if (wikiSummary?.content_urls?.desktop?.page) {
    sources.push({
      type: "general",
      name: "Wikipedia",
      url: wikiSummary.content_urls.desktop.page,
    });
  }

  if (recentNews.length > 0) {
    sources.push({
      type: "news",
      name: "Google News RSS",
      url: "https://news.google.com",
    });
  }

  return sources;
}

module.exports = {
  getCompanyIntel,
};
