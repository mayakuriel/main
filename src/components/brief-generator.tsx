"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedBriefResponse } from "@/lib/types";
import { BriefView } from "@/components/brief-view";

const DEBOUNCE_MS = 900;

export function BriefGenerator() {
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefResponse, setBriefResponse] = useState<GeneratedBriefResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoRequestTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canGenerate = useMemo(() => companyName.trim().length >= 2, [companyName]);

  const generateBrief = useCallback(
    async (source: "auto" | "manual") => {
      if (!canGenerate) {
        return;
      }

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/brief", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyName: companyName.trim(),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unknown request error.");
        }

        const payload = (await response.json()) as GeneratedBriefResponse;
        setBriefResponse(payload);
      } catch (requestError) {
        if (abortController.signal.aborted) {
          return;
        }

        const fallbackMessage = source === "auto"
          ? "Auto-generation failed. You can retry by pressing Generate Brief."
          : "Failed to generate company brief.";
        setError(requestError instanceof Error ? requestError.message : fallbackMessage);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [canGenerate, companyName],
  );

  useEffect(() => {
    if (!canGenerate) {
      if (autoRequestTimeoutRef.current) {
        clearTimeout(autoRequestTimeoutRef.current);
      }
      return;
    }

    autoRequestTimeoutRef.current = setTimeout(() => {
      void generateBrief("auto");
    }, DEBOUNCE_MS);

    return () => {
      if (autoRequestTimeoutRef.current) {
        clearTimeout(autoRequestTimeoutRef.current);
      }
    };
  }, [canGenerate, companyName, generateBrief]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return (
    <section className="generator">
      <div className="search-controls">
        <label htmlFor="companyName">Company name</label>
        <div className="search-row">
          <input
            id="companyName"
            name="companyName"
            placeholder="Type a company (e.g., Stripe)"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
          <button
            type="button"
            disabled={!canGenerate || isLoading}
            onClick={() => {
              void generateBrief("manual");
            }}
          >
            {isLoading ? "Generating..." : "Generate Brief"}
          </button>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {isLoading ? <p className="loading-text">Collecting company intelligence...</p> : null}

      {briefResponse ? <BriefView data={briefResponse} /> : null}
    </section>
  );
}
