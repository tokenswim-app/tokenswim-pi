import type { Model } from "@earendil-works/pi-ai";

/** The public gateway, stamped on every catalog entry and on the provider. */
export const GATEWAY_URL = "https://tokenswim.app/v1";

/** Shared by every catalog entry: one provider, one wire protocol (ADR 0001). */
const SHARED = {
	api: "openai-responses",
	provider: "tokenswim",
	baseUrl: GATEWAY_URL,
	reasoning: true,
	input: ["text", "image"],
	contextWindow: 272_000,
	maxTokens: 128_000,
} as const satisfies Omit<Model<"openai-responses">, "id" | "name" | "cost">;

// Thinking levels and compat flags mirror what each model actually accepts.
// `xhigh` and `max` are only offered when mapped explicitly; a `null` hides a
// level pi would otherwise offer.
const GPT_LEVELS = { minimal: "low", xhigh: "xhigh" } as const;
const GPT_LEVELS_WITH_MAX = { ...GPT_LEVELS, max: "max" } as const;
const GPT_COMPAT = {
	supportsToolSearch: true,
	supportsOpenAIGrammarTools: true,
} as const;

const GROK_LEVELS = {
	off: null,
	minimal: null,
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: null,
	max: null,
} as const;
const GROK_COMPAT = { supportsLongCacheRetention: false } as const;

// USD per 1M tokens, from Tokenswim's published pricing at
// https://tokenswim.app/pricing. pi reports session cost from these numbers, so
// they are the gateway's prices, not any upstream vendor's list prices.
export const MODELS: Model<"openai-responses">[] = [
	{
		...SHARED,
		id: "gpt-5.5",
		name: "GPT-5.5",
		thinkingLevelMap: GPT_LEVELS,
		compat: GPT_COMPAT,
		cost: { input: 0.5, output: 3, cacheRead: 0.1, cacheWrite: 0.5 },
	},
	{
		...SHARED,
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		thinkingLevelMap: GPT_LEVELS_WITH_MAX,
		compat: GPT_COMPAT,
		cost: { input: 0.1, output: 0.36, cacheRead: 0.02, cacheWrite: 0.1 },
	},
	{
		...SHARED,
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol",
		thinkingLevelMap: GPT_LEVELS_WITH_MAX,
		compat: GPT_COMPAT,
		cost: { input: 0.4, output: 2, cacheRead: 0.08, cacheWrite: 0.4 },
	},
	{
		...SHARED,
		id: "gpt-5.6-terra",
		name: "GPT-5.6 Terra",
		thinkingLevelMap: GPT_LEVELS_WITH_MAX,
		compat: GPT_COMPAT,
		cost: { input: 0.2, output: 1.2, cacheRead: 0.04, cacheWrite: 0.2 },
	},
	{
		...SHARED,
		id: "gpt-6-astra",
		name: "GPT-6 Astra",
		thinkingLevelMap: { ...GPT_LEVELS_WITH_MAX, off: null, minimal: null },
		compat: GPT_COMPAT,
		cost: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1 },
	},
	{
		...SHARED,
		id: "gpt-6-luna",
		name: "GPT-6 Luna",
		thinkingLevelMap: { ...GPT_LEVELS_WITH_MAX, off: null, minimal: null },
		compat: GPT_COMPAT,
		cost: { input: 0.1, output: 0.18, cacheRead: 0.01, cacheWrite: 0.1 },
	},
	{
		...SHARED,
		id: "gpt-6-sol",
		name: "GPT-6 Sol",
		thinkingLevelMap: { ...GPT_LEVELS_WITH_MAX, off: null, minimal: null },
		compat: GPT_COMPAT,
		cost: { input: 0.2, output: 1, cacheRead: 0.08, cacheWrite: 0.2 },
	},
	{
		...SHARED,
		id: "grok-4.5",
		name: "Grok 4.5",
		thinkingLevelMap: GROK_LEVELS,
		compat: GROK_COMPAT,
		cost: { input: 0.2, output: 0.6, cacheRead: 0.03, cacheWrite: 0.2 },
		contextWindow: 500_000,
		maxTokens: 500_000,
	},
	{
		...SHARED,
		id: "grok-4.6",
		name: "Grok 4.6",
		thinkingLevelMap: GROK_LEVELS,
		compat: GROK_COMPAT,
		cost: { input: 0.2, output: 0.6, cacheRead: 0.05, cacheWrite: 0.2 },
		contextWindow: 500_000,
		maxTokens: 500_000,
	},
];
