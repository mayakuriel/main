import { fetchJson } from "@/lib/http";

interface WikipediaSummary {
  title?: string;
  description?: string;
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

interface DuckDuckGoResponse {
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
    Topics?: Array<{
      Text?: string;
      FirstURL?: string;
    }>;
  }>;
}

export interface OpenSourcesProfile {
  description?: string;
  sourceUrl?: string;
  relatedMentions: Array<{ text: string; url?: string }>;
}

export async function fetchOpenSourcesProfile(companyName: string): Promise<OpenSourcesProfile> {
  const [wiki, duck] = await Promise.allSettled([
    fetchWikipedia(companyName),
    fetchDuckDuckGo(companyName),
  ]);

  const relatedMentions: Array<{ text: string; url?: string }> = [];

  if (duck.status === "fulfilled") {
    relatedMentions.push(...duck.value.relatedMentions);
  }

  if (wiki.status === "fulfilled") {
    return {
      description: wiki.value.description,
      sourceUrl: wiki.value.sourceUrl,
      relatedMentions,
    };
  }

  return {
    description: duck.status === "fulfilled" ? duck.value.description : undefined,
    sourceUrl: duck.status === "fulfilled" ? duck.value.sourceUrl : undefined,
    relatedMentions,
  };
}

async function fetchWikipedia(companyName: string): Promise<{ description?: string; sourceUrl?: string }> {
  const slug = encodeURIComponent(companyName.replace(/\s+/g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`;
  const response = await fetchJson<WikipediaSummary>(url, { timeoutMs: 8000 });

  return {
    description: response.extract ?? response.description,
    sourceUrl: response.content_urls?.desktop?.page,
  };
}

async function fetchDuckDuckGo(companyName: string): Promise<{
  description?: string;
  sourceUrl?: string;
  relatedMentions: Array<{ text: string; url?: string }>;
}> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", companyName);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  try {
    const response = await fetchJson<DuckDuckGoResponse>(url, { timeoutMs: 8000 });
    const relatedMentions = flattenRelatedTopics(response.RelatedTopics ?? [])
      .filter((item) => item.text)
      .slice(0, 5);

    return {
      description: response.AbstractText,
      sourceUrl: response.AbstractURL,
      relatedMentions,
    };
  } catch {
    return { relatedMentions: [] };
  }
}

function flattenRelatedTopics(
  topics: Array<{
    Text?: string;
    FirstURL?: string;
    Topics?: Array<{ Text?: string; FirstURL?: string }>;
  }>,
): Array<{ text: string; url?: string }> {
  return topics.flatMap((topic) => {
    if (topic.Topics?.length) {
      return topic.Topics.map((nested) => ({
        text: nested.Text ?? "",
        url: nested.FirstURL,
      }));
    }

    return [{ text: topic.Text ?? "", url: topic.FirstURL }];
  });
}
