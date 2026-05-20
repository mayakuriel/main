export interface AppEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  NEWS_API_KEY?: string;
  CRUNCHBASE_API_KEY?: string;
  CLEARBIT_API_KEY?: string;
  APOLLO_API_KEY?: string;
  PIPEDRIVE_API_TOKEN?: string;
}

export function getEnv(): AppEnv {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    CRUNCHBASE_API_KEY: process.env.CRUNCHBASE_API_KEY,
    CLEARBIT_API_KEY: process.env.CLEARBIT_API_KEY,
    APOLLO_API_KEY: process.env.APOLLO_API_KEY,
    PIPEDRIVE_API_TOKEN: process.env.PIPEDRIVE_API_TOKEN,
  };
}
