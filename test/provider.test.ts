import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { afterEach, expect, test } from "bun:test";
import {
	model,
	pasting,
	registeredProvider,
	runtime,
	standInGateway,
	storeCredential,
	storedKey,
	storeKey,
} from "./harness.ts";

// Only the address survives as a real variable, and only because Key
// Verification reads it from `process.env`. Everything else names its
// environment through `runtime`.
afterEach(() => {
	delete process.env.TOKENSWIM_BASE_URL;
});

test("registers the Tokenswim provider", () => {
	const provider = registeredProvider();
	expect(provider.id).toBe("tokenswim");
	expect(provider.name).toBe("Tokenswim");
});

test("advertises every model Tokenswim serves, all speaking OpenAI Responses", () => {
	const models = registeredProvider().getModels();
	expect(models.map((entry) => entry.id).sort()).toEqual([
		"gpt-5.5",
		"gpt-5.6-luna",
		"gpt-5.6-sol",
		"gpt-5.6-terra",
		"grok-4.5",
		"grok-4.6",
	]);
	for (const entry of models) {
		expect(entry.api).toBe("openai-responses");
	}
});

// Context windows and output caps are pi's own published figures for these
// models — pi drives auto-compaction off contextWindow, so they are not cosmetic.
test("records each model's real context window and output cap", () => {
	for (const id of ["gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]) {
		expect(model(id).contextWindow).toBe(272_000);
		expect(model(id).maxTokens).toBe(128_000);
	}
	for (const id of ["grok-4.5", "grok-4.6"]) {
		expect(model(id).contextWindow).toBe(500_000);
		expect(model(id).maxTokens).toBe(500_000);
	}
});

// USD per 1M tokens, as published at https://tokenswim.app/pricing — deliberately
// not the upstream vendors' list prices, which pi's built-in catalogs carry.
test("prices every model at Tokenswim's rates", () => {
	expect(model("gpt-5.5").cost).toEqual({ input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 2.5 });
	expect(model("gpt-5.6-luna").cost).toEqual({ input: 0.1, output: 0.6, cacheRead: 0.01, cacheWrite: 0.1 });
	expect(model("gpt-5.6-sol").cost).toEqual({ input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 2.5 });
	expect(model("gpt-5.6-terra").cost).toEqual({ input: 1, output: 6, cacheRead: 0.125, cacheWrite: 1 });
	expect(model("grok-4.5").cost).toEqual({ input: 1, output: 3, cacheRead: 0.15, cacheWrite: 1 });
	expect(model("grok-4.6").cost).toEqual({ input: 1, output: 3, cacheRead: 0.25, cacheWrite: 1 });
});

test("offers only the thinking levels each model can serve", () => {
	expect(getSupportedThinkingLevels(model("gpt-5.5"))).toEqual([
		"off", "minimal", "low", "medium", "high", "xhigh",
	]);
	for (const id of ["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]) {
		expect(getSupportedThinkingLevels(model(id))).toEqual([
			"off", "minimal", "low", "medium", "high", "xhigh", "max",
		]);
	}
	for (const id of ["grok-4.5", "grok-4.6"]) {
		expect(getSupportedThinkingLevels(model(id))).toEqual(["low", "medium", "high"]);
	}
});

// pi does not auto-detect these on the Responses path; whatever is left unset
// takes pi's default, which is wrong for these models in both directions.
test("declares the compatibility flags each model needs", () => {
	for (const id of ["gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]) {
		expect(model(id).compat).toMatchObject({
			supportsToolSearch: true,
			supportsOpenAIGrammarTools: true,
		});
	}
	// Long cache retention is unavailable here; left unset pi defaults it on and
	// sends a retention hint this model does not take.
	for (const id of ["grok-4.5", "grok-4.6"]) {
		expect(model(id).compat).toMatchObject({
			supportsLongCacheRetention: false,
		});
	}
});

test("points requests at the public gateway by default", async () => {
	const { models, credentials } = runtime();
	await storeKey(credentials, "sk-stored");
	const resolved = await models.getAuth("tokenswim");
	expect(resolved?.auth.apiKey).toBe("sk-stored");
	expect(resolved?.auth.baseUrl).toBe("https://tokenswim.app/v1");
});

test("honours a gateway address from the environment", async () => {
	const { models, credentials } = runtime({
		TOKENSWIM_BASE_URL: "http://localhost:3000/v1",
	});
	await storeKey(credentials, "sk-stored");
	const resolved = await models.getAuth("tokenswim");
	expect(resolved?.auth.baseUrl).toBe("http://localhost:3000/v1");
});

// One machine can hold keys for more than one gateway, so an address pinned on
// the credential has to beat the ambient one rather than be silently dropped.
test("prefers a gateway address pinned on the stored credential", async () => {
	const { models, credentials } = runtime({
		TOKENSWIM_BASE_URL: "http://from-the-environment/v1",
	});
	await storeCredential(credentials, {
		type: "api_key",
		key: "sk-stored",
		env: { TOKENSWIM_BASE_URL: "http://from-the-credential/v1" },
	});
	const resolved = await models.getAuth("tokenswim");
	expect(resolved?.auth.baseUrl).toBe("http://from-the-credential/v1");
});

test("refuses an API key the gateway rejects", async () => {
	const server = standInGateway(() => new Response("{}", { status: 401 }));
	try {
		const { models, credentials } = runtime();
		await expect(
			models.login("tokenswim", "api_key", pasting("sk-bad")),
		).rejects.toThrow(/rejected/i);
		expect(await credentials.read("tokenswim")).toBeUndefined();
	} finally {
		server.stop(true);
	}
});

test("stores the key when the gateway is unreachable, and says so", async () => {
	const closed = standInGateway(() => new Response("{}"));
	const port = closed.port;
	closed.stop(true);
	process.env.TOKENSWIM_BASE_URL = `http://localhost:${port}/v1`;

	const notices: string[] = [];
	const { models, credentials } = runtime();
	await models.login("tokenswim", "api_key", {
		prompt: async () => "sk-offline",
		notify: (event) => {
			if ("message" in event) notices.push(event.message);
		},
	});

	expect(await storedKey(credentials)).toBe("sk-offline");
	expect(notices.join(" ")).toMatch(/could not reach/i);
});

// A 500, or a 404 from a mistyped gateway address, says nothing about the key.
// Treating it as a refusal would lock someone out over an outage.
test("treats any other failing status as unreachable, not as a bad key", async () => {
	for (const status of [404, 500, 502]) {
		const server = standInGateway(() => new Response("{}", { status }));
		try {
			const notices: string[] = [];
			const { models, credentials } = runtime();
			await models.login("tokenswim", "api_key", {
				prompt: async () => "sk-outage",
				notify: (event) => {
					if ("message" in event) notices.push(event.message);
				},
			});
			expect(await storedKey(credentials)).toBe("sk-outage");
			expect(notices.join(" ")).toMatch(/could not reach/i);
		} finally {
			server.stop(true);
		}
	}
});

test("presents the API key in an Authorization: Bearer header when verifying", async () => {
	const seen: (string | null)[] = [];
	const server = standInGateway((request) => {
		seen.push(request.headers.get("authorization"));
		return Response.json({ object: "list", data: [] });
	});
	try {
		const { models, credentials } = runtime();
		await models.login("tokenswim", "api_key", pasting("sk-good"));
		expect(seen).toEqual(["Bearer sk-good"]);
		expect(await storedKey(credentials)).toBe("sk-good");
	} finally {
		server.stop(true);
	}
});

test("falls back to the environment variable when no API key is stored", async () => {
	const { models } = runtime({ TOKENSWIM_API_KEY: "sk-from-env" });
	const resolved = await models.getAuth("tokenswim");
	expect(resolved?.auth.apiKey).toBe("sk-from-env");
});

test("prefers a stored API key over the environment variable", async () => {
	const { models, credentials } = runtime({
		TOKENSWIM_API_KEY: "sk-from-env",
	});
	await storeKey(credentials, "sk-stored");
	const resolved = await models.getAuth("tokenswim");
	expect(resolved?.auth.apiKey).toBe("sk-stored");
});

test("reports nothing configured when there is neither an API key nor a variable", async () => {
	const { models } = runtime();
	expect(await models.getAuth("tokenswim")).toBeUndefined();
});
