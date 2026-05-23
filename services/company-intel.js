const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const BING_NEWS_RSS_URL = "https://www.bing.com/news/search";
const BING_WEB_SEARCH_URL = "https://www.bing.com/search";
const WIKIPEDIA_API_URL = "https://wikipedia.org/w/api.php";
const WIKIPEDIA_SUMMARY_PATH = "/api/rest_v1/page/summary/";

const STOP_WORDS = new Set([
  "the",
  "and",
  "inc",
  "inc.",
  "ltd",
  "llc",
  "co",
  "company",
  "corp",
  "corporation",
  "group",
  "solutions",
]);

const QUERY_ALIASES = {
  "shlomo sixt": ["שלמה סיקסט", "shlomo group", "sixt israel", "שלמה גרופ"],
  "yuki": ["yuki data", "יוקי דאטה"],
  "yuki data": ["יוקי דאטה", "yuki"],
  "yes ro": ["yes israel", "yes tv", "yes satellite", "יס"],
  yes: ["yes israel", "yes tv", "yes satellite", "יס"],
};

const KNOWN_COMPANY_PROFILES = {
  "shlomo sixt": {
    displayName: "Shlomo Sixt",
    industry: "Car Rental / Mobility",
    headquarters: "Israel",
  },
  "yes ro": {
    displayName: "yes (Israel TV)",
    industry: "Media / Television",
    headquarters: "Israel",
  },
  yes: {
    displayName: "yes (Israel TV)",
    industry: "Media / Television",
    headquarters: "Israel",
  },
  yuki: {
    displayName: "Yuki Data",
    industry: "Data / Analytics",
  },
};

const GENERIC_SUFFIXES = [
  "inc",
  "inc.",
  "ltd",
  "ltd.",
  "llc",
  "corp",
  "corporation",
  "group",
  "technologies",
  "technology",
  "tech",
  "labs",
  "solutions",
  "systems",
];

async function getCompanyIntel(companyName) {
  const normalizedName = companyName.trim();
  const knownProfile = getKnownCompanyProfile(normalizedName);
  const nameVariants = buildNameVariants(normalizedName);

  const [wikiSummary, recentNews, relatedWebResults] = await Promise.all([
    fetchBestWikipediaSummary(normalizedName, nameVariants),
    fetchRecentNews(normalizedName, nameVariants),
    fetchWebResults(normalizedName, nameVariants),
  ]);

  const textCorpus = [
    wikiSummary?.extract || "",
    ...recentNews.map((item) => `${item.title} ${item.summary}`),
    ...relatedWebResults.map((item) => `${item.title} ${item.snippet}`),
  ]
    .join(" ")
    .trim();

  const extracted = extractGeneralData(textCorpus);
  const industry =
    extracted.industry ||
    wikiSummary?.description ||
    inferIndustryFromSignals(recentNews, relatedWebResults) ||
    knownProfile?.industry ||
    "No clear industry data found";

  const headquarters =
    extracted.headquarters ||
    inferHeadquartersFromWeb(relatedWebResults) ||
    knownProfile?.headquarters ||
    "No clear headquarters data found";

  const employeeCount = normalizeEmployeeCount(
    extracted.employeeCount || inferEmployeeCountFromWeb(relatedWebResults),
  );

  const description = buildCompanyDescription(
    normalizedName,
    wikiSummary,
    recentNews,
    relatedWebResults,
  );

  return {
    query: normalizedName,
    company: {
      name: wikiSummary?.title || knownProfile?.displayName || normalizedName,
      industry,
      headquarters,
      employeeCount: employeeCount || "No public employee count found",
      description,
    },
    recentNews,
    relatedWebResults: relatedWebResults.slice(0, 5),
    sources: buildSources(wikiSummary, recentNews, relatedWebResults, normalizedName),
    dataQuality: {
      summarySourceFound: Boolean(wikiSummary?.extract),
      newsItemsFound: recentNews.length,
      webResultsFound: relatedWebResults.length,
      inferredFromNews: !wikiSummary?.extract && recentNews.length > 0,
      confidence: computeConfidenceScore(wikiSummary, recentNews, relatedWebResults),
    },
    generatedAt: new Date().toISOString(),
  };
}

function buildNameVariants(companyName) {
  const variants = new Set();
  const normalized = companyName.replace(/\s+/g, " ").trim();
  variants.add(normalized);

  for (const alias of getAliasesForQuery(normalized)) {
    variants.add(alias);
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length >= 2) {
    const withoutSuffix = [...tokens];
    while (
      withoutSuffix.length > 1 &&
      GENERIC_SUFFIXES.includes(withoutSuffix[withoutSuffix.length - 1].toLowerCase())
    ) {
      withoutSuffix.pop();
    }
    variants.add(withoutSuffix.join(" "));
  }

  for (const suffix of [" data", " tech", " technologies", " labs"]) {
    if (normalized.toLowerCase().endsWith(suffix)) {
      variants.add(normalized.slice(0, -suffix.length).trim());
    }
  }

  if (tokens.length > 2) {
    variants.add(tokens.slice(0, 2).join(" "));
  }

  return [...variants].filter(Boolean).slice(0, 8);
}

async function fetchBestWikipediaSummary(companyName, nameVariants) {
  const languages = ["en", "he"];
  const candidates = [];

  for (const lang of languages) {
    for (const variant of nameVariants) {
      const summary = await fetchWikipediaSummary(lang, variant);
      if (!summary?.extract) {
        continue;
      }

      const relevance = calculateRelevanceScore(
        companyName,
        `${summary.title || ""} ${summary.description || ""} ${summary.extract || ""}`,
      );

      candidates.push({
        ...summary,
        language: lang,
        relevance,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.relevance - a.relevance);
  const top = candidates[0];
  if (!isLikelyCompanySummary(top, companyName)) {
    return null;
  }

  return top;
}

async function fetchWikipediaSummary(language, title) {
  const direct = await fetchWikipediaSummaryByTitle(language, title);
  if (direct?.extract) {
    return direct;
  }

  const searchCandidate = await searchWikipediaTitle(language, title);
  if (!searchCandidate) {
    return null;
  }

  return await fetchWikipediaSummaryByTitle(language, searchCandidate);
}

async function fetchWikipediaSummaryByTitle(language, title) {
  const encodedTitle = encodeURIComponent(title.replace(/\s+/g, "_"));
  const url = `https://${language}.wikipedia.org${WIKIPEDIA_SUMMARY_PATH}${encodedTitle}`;

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

async function searchWikipediaTitle(language, query) {
  const url = new URL(WIKIPEDIA_API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("origin", "*");
  url.searchParams.set("uselang", language);

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

    return results[0]?.title || null;
  } catch {
    return null;
  }
}

async function fetchRecentNews(companyName, nameVariants) {
  const plans = [];
  for (const variant of nameVariants) {
    plans.push({ provider: "google", query: variant, hl: "he", gl: "IL", ceid: "IL:he" });
    plans.push({ provider: "google", query: variant, hl: "en-US", gl: "US", ceid: "US:en" });
    plans.push({ provider: "google", query: `"${variant}"`, hl: "he", gl: "IL", ceid: "IL:he" });
    plans.push({ provider: "google", query: `"${variant}"`, hl: "en-US", gl: "US", ceid: "US:en" });
    plans.push({ provider: "bing", query: variant });
  }
  plans.push({ provider: "google", query: `site:geektime.co.il ${companyName}`, hl: "he", gl: "IL", ceid: "IL:he" });
  plans.push({ provider: "google", query: `site:calcalistech.com ${companyName}`, hl: "en-US", gl: "US", ceid: "US:en" });
  plans.push({ provider: "google", query: `site:techcrunch.com ${companyName}`, hl: "en-US", gl: "US", ceid: "US:en" });

  const allResults = await Promise.all(
    plans.map((plan) => {
      if (plan.provider === "bing") {
        return fetchBingNewsRss(plan.query);
      }

      return fetchGoogleNewsRss(plan.query, plan.hl, plan.gl, plan.ceid);
    }),
  );

  const threshold = minimumRelevanceThreshold(companyName);
  const scored = allResults
    .flat()
    .map((item) => ({
      ...item,
      relevance:
        calculateRelevanceScore(companyName, `${item.title} ${item.summary}`) +
        queryRelevanceBoost(companyName, item.query || "") +
        (isTrustedBusinessSource(item.source || "", item.sourceUrl || "") ? 0.5 : 0),
      likelyCompanyNews: isLikelyCompanyNews(companyName, item),
    }))
    .filter((item) => item.likelyCompanyNews)
    .filter((item) => item.relevance >= Math.min(1, threshold))
    .sort(sortByRelevanceThenDate);

  return dedupeNews(scored).slice(0, 8).map(stripInternalScore);
}

async function fetchGoogleNewsRss(query, hl, gl, ceid) {
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
    return parseRssItems(xml, "Google News", query);
  } catch {
    return [];
  }
}

async function fetchBingNewsRss(query) {
  const url = new URL(BING_NEWS_RSS_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "rss");
  url.searchParams.set("setlang", "en");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseRssItems(xml, "Bing News", query);
  } catch {
    return [];
  }
}

function parseRssItems(xml, providerName, query) {
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);

  return itemBlocks.map((itemXml) => {
    const title = cleanText(extractTag(itemXml, "title"));
    const link = cleanText(extractTag(itemXml, "link"));
    const pubDate = cleanText(extractTag(itemXml, "pubDate"));
    const sourceTag = extractSourceTag(itemXml);
    const source = sourceTag.text || providerName;
    const sourceUrl = sourceTag.url;
    const description = cleanDescription(cleanText(extractTag(itemXml, "description")));
    const normalizedTitle = normalizeNewsTitle(title || "Untitled news item");

    return {
      title: normalizedTitle,
      source,
      sourceUrl: sourceUrl || "",
      publishedAt: pubDate || "Unknown date",
      summary: description || "No summary available",
      url: preferArticleUrl(link, sourceUrl),
      query: query || "",
    };
  });
}

function extractSourceTag(itemXml) {
  const match = itemXml.match(/<source([^>]*)>([\s\S]*?)<\/source>/i);
  if (!match) {
    return { text: "", url: "" };
  }

  const attrs = match[1] || "";
  const text = cleanText(match[2] || "");
  const urlMatch = attrs.match(/url="([^"]+)"/i);

  return {
    text,
    url: urlMatch?.[1] || "",
  };
}

async function fetchWebResults(companyName, nameVariants) {
  const queries = [];
  queries.push(`${companyName} company`);
  queries.push(`${companyName} startup`);
  queries.push(`${companyName} headquarters employees`);
  queries.push(`${companyName} חברה`);
  for (const variant of nameVariants.slice(1, 3)) {
    queries.push(`${variant} company`);
  }

  const responses = await Promise.all(queries.map((query) => fetchBingWebSearch(query)));
  const threshold = minimumRelevanceThreshold(companyName);

  const scored = responses
    .flat()
    .map((item) => ({
      ...item,
      relevance: calculateRelevanceScore(companyName, `${item.title} ${item.snippet}`),
    }))
    .filter((item) => item.relevance >= threshold)
    .sort(sortByRelevanceThenDate);

  return dedupeWebResults(scored).slice(0, 6).map(stripInternalScore);
}

async function fetchBingWebSearch(query) {
  const url = new URL(BING_WEB_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("setlang", "en");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parseBingWebResults(html);
  } catch {
    return [];
  }
}

function parseBingWebResults(html) {
  const blocks = [...html.matchAll(/<li class="b_algo"[\s\S]*?<\/li>/g)].map((match) => match[0]);

  return blocks
    .map((block) => {
      const linkMatch = block.match(/<h2><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/<p>([\s\S]*?)<\/p>/i);

      const url = cleanText(linkMatch?.[1] || "");
      const title = stripHtml(linkMatch?.[2] || "");
      const snippet = stripHtml(snippetMatch?.[1] || "");

      return {
        title: cleanText(title),
        snippet: cleanText(snippet),
        url,
      };
    })
    .filter((item) => item.title && item.url && !item.url.includes("bing.com/search"));
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

function stripHtml(value) {
  return (value || "").replace(/<[^>]+>/g, " ");
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractGeneralData(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();

  const headquartersMatch =
    cleaned.match(/headquartered in ([^.,;]+)/i) ||
    cleaned.match(/based in ([^.,;]+)/i) ||
    cleaned.match(/ממוקמת ב([^.,;]+)/i) ||
    cleaned.match(/שבסיסה ב([^.,;]+)/i) ||
    cleaned.match(/מטה(?: החברה)? ב([^.,;]+)/i);

  const employeeMatch =
    cleaned.match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*[kKmM]?)\s+employees/i) ||
    cleaned.match(/employs\s+(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*[kKmM]?)/i) ||
    cleaned.match(/מעסיקה(?: כ-?)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*[kKmM]?)/i) ||
    cleaned.match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*[kKmM]?)\s+עובדים/i);

  let industry = "";
  if (lower.includes("software")) industry = "Software / Technology";
  else if (lower.includes("fintech")) industry = "Fintech";
  else if (lower.includes("data") || lower.includes("analytics")) industry = "Data / Analytics";
  else if (/\bai\b/i.test(lower) || lower.includes("artificial intelligence")) industry = "AI";
  else if (lower.includes("bank")) industry = "Banking / Finance";
  else if (lower.includes("retail")) industry = "Retail";
  else if (lower.includes("e-commerce")) industry = "E-commerce";
  else if (lower.includes("logistics")) industry = "Logistics";
  else if (lower.includes("health")) industry = "Health / Healthcare";
  else if (lower.includes("cyber")) industry = "Cybersecurity";
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

function inferIndustryFromSignals(newsItems, webResults) {
  const combined = [...newsItems, ...webResults]
    .map((item) => `${item.title} ${item.summary || ""} ${item.snippet || ""}`)
    .join(" ")
    .toLowerCase();

  if (combined.includes("סייבר")) return "Cybersecurity";
  if (combined.includes("פינטק")) return "Fintech";
  if (combined.includes("בינה מלאכותית")) return "AI";
  if (combined.includes("דאטה") || combined.includes("נתונים")) return "Data / Analytics";
  if (combined.includes("fintech")) return "Fintech";
  if (combined.includes("data") || combined.includes("analytics")) return "Data / Analytics";
  if (combined.includes("artificial intelligence") || /\bai\b/i.test(combined) || combined.includes(" machine learning ")) return "AI";
  if (combined.includes("cybersecurity")) return "Cybersecurity";

  return "";
}

function inferHeadquartersFromWeb(webResults) {
  const text = webResults.map((item) => `${item.title} ${item.snippet}`).join(" ");
  return extractGeneralData(text).headquarters;
}

function inferEmployeeCountFromWeb(webResults) {
  const text = webResults.map((item) => `${item.title} ${item.snippet}`).join(" ");
  return extractGeneralData(text).employeeCount;
}

function normalizeEmployeeCount(value) {
  if (!value) {
    return "";
  }

  const trimmed = String(value).trim();
  const suffixMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*([kKmM])$/);
  if (!suffixMatch) {
    return trimmed;
  }

  const base = Number(suffixMatch[1]);
  const multiplier = suffixMatch[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
  return Math.round(base * multiplier).toLocaleString("en-US");
}

function buildCompanyDescription(companyName, wikiSummary, newsItems, webResults) {
  if (wikiSummary?.extract) {
    return wikiSummary.extract;
  }

  const bestWeb = webResults[0]?.snippet;
  if (bestWeb) {
    return bestWeb;
  }

  const topHeadline = newsItems[0]?.title || "";
  if (topHeadline) {
    return `No official summary page was found quickly for ${companyName}. Recent coverage includes: ${topHeadline}`;
  }

  return "No general description found";
}

function buildSources(wikiSummary, newsItems, webResults, companyName) {
  const sources = [];

  if (wikiSummary?.content_urls?.desktop?.page) {
    sources.push({
      type: "general",
      name: `Wikipedia (${wikiSummary.language || "en"})`,
      url: wikiSummary.content_urls.desktop.page,
    });
  }

  if (newsItems.length > 0) {
    sources.push({
      type: "news",
      name: "Google/Bing News RSS",
      url: `https://news.google.com/search?q=${encodeURIComponent(companyName)}`,
    });
  }

  for (const item of webResults.slice(0, 3)) {
    sources.push({
      type: "web",
      name: item.title,
      url: item.url,
    });
  }

  return dedupeSources(sources);
}

function dedupeSources(sources) {
  const seen = new Set();
  const unique = [];

  for (const source of sources) {
    const key = `${source.type}|${source.url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(source);
  }

  return unique;
}

function computeConfidenceScore(wikiSummary, newsItems, webResults) {
  let score = 0.3;
  if (wikiSummary?.extract) score += 0.35;
  if (newsItems.length >= 3) score += 0.2;
  else if (newsItems.length >= 1) score += 0.1;
  if (webResults.length >= 3) score += 0.15;
  else if (webResults.length >= 1) score += 0.05;

  return Math.min(1, Number(score.toFixed(2)));
}

function queryRelevanceBoost(companyName, query) {
  const q = (query || "").toLowerCase();
  const companyLower = companyName.toLowerCase();

  let boost = 0;
  if (q.includes(companyLower)) {
    boost += 1;
  }
  if (q.includes(`"${companyLower}"`)) {
    boost += 1;
  }
  return boost;
}

function minimumRelevanceThreshold(companyName) {
  const tokens = tokenizeCompanyName(companyName);
  return tokens.length >= 2 ? 2 : 1;
}

function calculateRelevanceScore(companyName, text) {
  const lowerText = (text || "").toLowerCase();
  const companyLower = companyName.toLowerCase();
  const tokens = tokenizeCompanyName(companyName);

  let score = 0;
  if (!lowerText) {
    return 0;
  }

  if (lowerText.includes(companyLower)) {
    score += 4;
  }

  const tokenHits = countCompanyTokenHits(companyName, lowerText);
  score += tokenHits;

  if (tokens.length >= 2 && tokenHits < 2 && !lowerText.includes(companyLower)) {
    score -= 1;
  }

  if (/(raises|funding|seed|series|גייס|השקעה|invest)/i.test(lowerText)) {
    score += 0.5;
  }

  if (/(footballer|singer|actor|actress|born in)/i.test(lowerText)) {
    score -= 2;
  }

  return score;
}

function isLikelyCompanyNews(companyName, item) {
  const combined = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  const companyLower = companyName.toLowerCase();
  const tokens = tokenizeCompanyName(companyName);
  const tokenHits = countCompanyTokenHits(companyName, combined);
  const exactPhrase = combined.includes(companyLower);
  const aliasMatch = getAliasesForQuery(companyName)
    .map((alias) => alias.toLowerCase())
    .some((alias) => alias.length > 2 && combined.includes(alias));
  const ambiguousQuery = isAmbiguousCompanyQuery(companyName);
  const queryContainsCompany = (item.query || "").toLowerCase().includes(companyLower);
  const trustedSource = isTrustedBusinessSource(item.source || "", item.sourceUrl || "");

  const businessHints =
    /(raises|funding|seed|series|startup|company|platform|enterprise|workload|cloud|גייס|גיוס|סטארטאפ|חברה|טכנולוגיה|סיד|בינה מלאכותית|דאטה)/i.test(
      combined,
    );
  const noiseHints =
    /(formula 1|f1|racing|grand prix|driver|football|soccer|nba|mlb|red bull|tsunoda|vessel|ship|imo )/i.test(
      combined,
    );

  if (noiseHints && !businessHints) {
    return false;
  }

  if (ambiguousQuery && !exactPhrase && !aliasMatch) {
    return false;
  }

  if (exactPhrase || aliasMatch) {
    return true;
  }

  if (tokens.length >= 2) {
    if (tokenHits >= 2 && businessHints) {
      return true;
    }
    if (queryContainsCompany && businessHints && trustedSource && tokenHits >= 1) {
      return true;
    }
    if (
      (item.query || "").toLowerCase().includes(`"${companyLower}"`) &&
      !noiseHints &&
      (tokenHits >= 2 || aliasMatch)
    ) {
      return true;
    }
    return false;
  }

  return tokenHits >= 1 && (trustedSource || businessHints);
}

function isTrustedBusinessSource(sourceName, sourceUrl) {
  const text = `${sourceName} ${sourceUrl}`.toLowerCase();
  return /(geektime|גיקטיים|calcalist|ctech|techcrunch|globes|themarker|ynet|pr newswire|siliconangle|yahoo finance|pulse 2\.0|forbes|venturebeat)/i.test(
    text,
  );
}

function tokenizeCompanyName(companyName) {
  const rawTokens = companyName
    .toLowerCase()
    .split(/[\s\-_.,/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  if (rawTokens.length <= 1) {
    return rawTokens;
  }

  return rawTokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function countCompanyTokenHits(companyName, lowerText) {
  const tokens = tokenizeCompanyName(companyName);
  let hits = 0;

  for (const token of tokens) {
    const variants = tokenVariants(token);
    if (variants.some((variant) => lowerText.includes(variant))) {
      hits += 1;
    }
  }

  return hits;
}

function tokenVariants(token) {
  const variants = new Set([token.toLowerCase()]);

  const map = {
    data: ["דאטה", "נתונים"],
    ai: ["בינה מלאכותית"],
    fintech: ["פינטק"],
    yuki: ["יוקי"],
    shlomo: ["שלמה"],
    sixt: ["סיקסט"],
    yes: ["יס"],
  };

  for (const item of map[token.toLowerCase()] || []) {
    variants.add(item.toLowerCase());
  }

  return [...variants];
}

function getAliasesForQuery(companyName) {
  const key = companyName.toLowerCase().trim();
  return QUERY_ALIASES[key] || [];
}

function isAmbiguousCompanyQuery(companyName) {
  const tokens = companyName
    .toLowerCase()
    .split(/[\s\-_.,/]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  if (tokens.some((token) => ["yes", "ro", "or"].includes(token))) {
    return true;
  }

  return tokens.length >= 2 && tokens.every((token) => token.length <= 3);
}

function getKnownCompanyProfile(companyName) {
  const key = companyName.toLowerCase().trim();
  return KNOWN_COMPANY_PROFILES[key] || null;
}

function isLikelyCompanySummary(summary, companyName) {
  if (!summary || !summary.extract) {
    return false;
  }

  const searchable = `${summary.title || ""} ${summary.description || ""} ${summary.extract || ""}`
    .toLowerCase()
    .trim();
  if (/may refer to|disambiguation/i.test(searchable)) {
    return false;
  }
  const relevance = calculateRelevanceScore(companyName, searchable);

  const hasPersonHint = /(footballer|singer|actor|actress|politician|born )/i.test(searchable);
  const hasCompanyHint = /(company|startup|technology|corporation|inc\.|ltd|חברה|סטארטאפ)/i.test(searchable);

  if (hasPersonHint && !hasCompanyHint) {
    return false;
  }

  return relevance >= minimumRelevanceThreshold(companyName) + 1;
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

function dedupeWebResults(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = `${normalizeNewsTitle(item.title)}|${safeDomain(item.url)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function safeDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url || "";
  }
}

function preferArticleUrl(link, sourceUrl) {
  if (!link) {
    return sourceUrl || "";
  }

  if (link.includes("news.google.com") && sourceUrl) {
    return sourceUrl;
  }

  return link;
}

function sortByRelevanceThenDate(a, b) {
  if (b.relevance !== a.relevance) {
    return b.relevance - a.relevance;
  }

  const aDate = Date.parse(a.publishedAt || "");
  const bDate = Date.parse(b.publishedAt || "");

  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return bDate - aDate;
  }

  return 0;
}

function stripInternalScore(item) {
  const clone = { ...item };
  delete clone.relevance;
  delete clone.query;
  delete clone.likelyCompanyNews;
  return clone;
}

function normalizeNewsTitle(title) {
  return (title || "").replace(/\s*-\s*[^-]+$/g, "").trim();
}

module.exports = {
  getCompanyIntel,
};
