import "server-only";
import type { ForecastInput, ForecastResult } from "./types";
import { generateForecast } from "./forecaster";

/**
 * Provider abstraction - swap the statistical engine for an ML service later
 * by implementing this interface and registering it in getForecastProvider().
 */
export interface ForecastProvider {
  readonly name: string;
  generate(input: ForecastInput): Promise<ForecastResult>;
}

class LocalStatisticalProvider implements ForecastProvider {
  readonly name = "local-statistical";

  async generate(input: ForecastInput): Promise<ForecastResult> {
    // Synchronous deterministic math; async signature keeps the contract open
    // for network-backed providers.
    return generateForecast(input);
  }
}

/**
 * Optional external provider. Only used when BOTH AI_API_KEY and
 * AI_FORECAST_URL are configured; falls back to the local engine on any
 * failure so forecasting never breaks because of a third party.
 */
class ExternalHttpProvider implements ForecastProvider {
  readonly name = "external-http";

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async generate(input: ForecastInput): Promise<ForecastResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`External forecaster responded ${response.status}`);
      return (await response.json()) as ForecastResult;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getForecastProvider(): ForecastProvider {
  const apiKey = process.env.AI_API_KEY;
  const url = process.env.AI_FORECAST_URL;
  if (apiKey && url) {
    return new ExternalHttpProvider(url, apiKey);
  }
  return new LocalStatisticalProvider();
}

export function hasExternalProvider(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_FORECAST_URL);
}
