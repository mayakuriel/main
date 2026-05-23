const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

async function getCompanyIntel(companyName) {
  const normalizedName = companyName.trim();

  const [rawWikiSummary, recentNews] = await Promise.all([
    fetchWikipediaSummary(normalizedName),
    fetchRecentNews(normalizedName),
  ]);
  const wikiSummary = isLikelyCompanySummary(rawWikiSummary, normalizedName)
    ? rawWikiSummary
    : null;

  const textForExtraction = [wikiSummary?.extract || "", ...recentNews.map((item) => `${item.title} ${item.summary}`)]
    .join(" ")
    .trim();

  const extractedFromText = extractGeneralData(textForExtraction);
  const industry =
    extractedFromText.industry ||
    wikiSummary?.description ||
    inferIndustryFromNews(recentNews) ||
    "No clear industry data found";

  const companyDescription =
    wikiSummary?.extract || buildFallbackDescription(normalizedName, recentNews);

  return {
    query: normalizedName,
    company: {
      name: wikiSummary?.title || normalizedName,
      industry,
      headquarters:
        extractedFromText.headquarters || "No clear headquarters data found",
      employeeCount:
        extractedFromText.employeeCount || "No public employee count found",
      description: companyDescription || "No general description found",
    },
    recentNews,
    sources: buildSources(wikiSummary, recentNews, normalizedName),
    dataQuality: {
      summarySourceFound: Boolean(wikiSummary?.extract),
      newsItemsFound: recentNews.length,
      inferredFromNews: !wikiSummary?.extract && recentNews.length > 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function fetchWikipediaSummary(companyName) {
  const directSummary = await fetchWikipediaSummaryByTitle(companyName);
  if (directSummary?.extract) {
    return directSummary;
  }

  const searchCandidate = await searchWikipediaTitle(companyName);
  if (searchCandidate) {
    const fromSearch = await fetchWikipediaSummaryByTitle(searchCandidate);
    if (fromSearch?.extract) {
      return fromSearch;
    }
  }

  return null;
}

async function fetchWikipediaSummaryByTitle(title) {
  const slug = encodeURIComponent(title.replace(/\s+/g, "_"));
  const url = `${WIKIPEDIA_SUMMARY_URL}/${slug}`;

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

async function searchWikipediaTitle(companyName) {
  const url = new URL(WIKIPEDIA_API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("srsearch", companyName);

  try {
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const results = payload?.query?.search || [];
    if (results.length === 0) {
      return null;
    }

    const normalized = companyName.toLowerCase();
    const exactLike = results.find((item) => item.title?.toLowerCase().includes(normalized));
    return (exactLike || results[0]).title || null;
  } catch {
    return null;
  }
}

async function fetchRecentNews(companyName) {
  const searchPlans = [
    { query: companyName, hl: "he", gl: "IL", ceid: "IL:he" },
    { query: companyName, hl: "en-US", gl: "US", ceid: "US:en" },
    { query: `"${companyName}"`, hl: "he", gl: "IL", ceid: "IL:he" },
    { query: `"${companyName}"`, hl: "en-US", gl: "US", ceid: "US:en" },
  ];

  const results = await Promise.all(
    searchPlans.map((plan) => fetchRecentNewsByQuery(plan.query, plan.hl, plan.gl, plan.ceid)),
  );

  return dedupeNews(results.flat()).slice(0, 6);
}

async function fetchRecentNewsByQuery(query, hl, gl, ceid) {
  const url = new URL(GOOGLE_NEWS_RSS_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", hl);
  url.searchParams.set("gl", gl);
  url.searchParams.set("ceid", ceid);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseRssItems(xml);
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
      title: normalizeNewsTitle(title || "Untitled news item"),
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
    cleaned.match(/based in ([^.,;]+)/i) ||
    cleaned.match(/ממוקמת ב([^.,;]+)/i) ||
    cleaned.match(/שבסיסה ב([^.,;]+)/i) ||
    cleaned.match(/מטה(?: החברה)? ב([^.,;]+)/i);

  const employeeMatch =
    cleaned.match(/(\d{1,3}(?:,\d{3})+|\d+)\s+employees/i) ||
    cleaned.match(/employs\s+(\d{1,3}(?:,\d{3})+|\d+)/i) ||
    cleaned.match(/מעסיקה(?: כ-?)?(\d{1,3}(?:,\d{3})+|\d+)/i) ||
    cleaned.match(/(\d{1,3}(?:,\d{3})+|\d+)\s+עובדים/i);

  let industry = "";
  if (lower.includes("software")) industry = "Software / Technology";
  else if (lower.includes("fintech")) industry = "Fintech";
  else if (lower.includes("data") || lower.includes("analytics")) industry = "Data / Analytics";
  else if (lower.includes("ai") || lower.includes("artificial intelligence")) industry = "AI";
  else if (lower.includes("bank")) industry = "Banking / Finance";
  else if (lower.includes("retail")) industry = "Retail";
  else if (lower.includes("e-commerce")) industry = "E-commerce";
  else if (lower.includes("logistics")) industry = "Logistics";
  else if (lower.includes("health")) industry = "Health / Healthcare";
  else if (lower.includes("סייבר")) industry = "Cybersecurity";
  else if (lower.includes("פינטק")) industry = "Fintech";
  else if (lower.includes("דאטה") || lower.includes("נתונים")) industry = "Data / Analytics";
  else if (lower.includes("בינה מלאכותית")) industry = "AI";

  return {
    headquarters: headquartersMatch?.[1]?.trim() || "",
    employeeCount: employeeMatch?.[1]?.trim() || "",
    industry,
  };
}

function inferIndustryFromNews(recentNews) {
  if (!recentNews || recentNews.length === 0) {
    return "";
  }

  const combined = recentNews.map((item) => `${item.title} ${item.summary}`).join(" ").toLowerCase();

  if (combined.includes("סייבר")) return "Cybersecurity";
  if (combined.includes("פינטק")) return "Fintech";
  if (combined.includes("בינה מלאכותית")) return "AI";
  if (combined.includes("דאטה") || combined.includes("נתונים")) return "Data / Analytics";
  if (combined.includes("fintech")) return "Fintech";
  if (combined.includes("data") || combined.includes("analytics")) return "Data / Analytics";
  if (combined.includes("ai") || combined.includes("artificial intelligence")) return "AI";

  return "";
}

function buildFallbackDescription(companyName, recentNews) {
  if (!recentNews || recentNews.length === 0) {
    return "";
  }

  const topHeadline = recentNews[0]?.title || "";
  if (!topHeadline) {
    return "";
  }

  return `No official summary page was found quickly for ${companyName}. Recent coverage includes: ${topHeadline}`;
}

function buildSources(wikiSummary, recentNews, companyName) {
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
      url: `https://news.google.com/search?q=${encodeURIComponent(companyName)}`,
    });
  }

  return sources;
}

function isLikelyCompanySummary(summary, companyName) {
  if (!summary || !summary.extract) {
    return false;
  }

  const searchable = `${summary.title || ""} ${summary.description || ""} ${summary.extract || ""}`
    .toLowerCase()
    .trim();
  const tokens = companyName
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  if (tokens.length === 0) {
    return true;
  }

  const tokenHits = tokens.filter((token) => searchable.includes(token)).length;
  const hasBasicMatch = tokenHits >= Math.max(1, Math.floor(tokens.length / 2));

  const negativePersonHints = [
    "footballer",
    "singer",
    "actor",
    "actress",
    "politician",
    "japanese professional",
    "born ",
  ];
  const hasPersonHint = negativePersonHints.some((hint) => searchable.includes(hint));

  const companyHints = [
    "company",
    "startup",
    "founded",
    "technology",
    "software",
    "corporation",
    "inc.",
    "ltd",
    "חברה",
    "סטארטאפ",
  ];
  const hasCompanyHint = companyHints.some((hint) => searchable.includes(hint));

  if (hasPersonHint && !hasCompanyHint) {
    return false;
  }

  return hasBasicMatch;
}

function dedupeNews(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = `${item.title}|${item.source}|${item.publishedAt}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function normalizeNewsTitle(title) {
  return title.replace(/\s*-\s*[^-]+$/g, "").trim();
}

module.exports = {
  getCompanyIntel,
};
