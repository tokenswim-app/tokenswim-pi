/**
 * Manual smoke test: one real turn through the gateway.
 *
 *   bun run smoke                # gpt-5.6-luna, the cheapest model
 *   bun run smoke grok-4.5       # or any other catalog id
 *
 * Spends real balance. Resolves the API key the way a pi session does — the key
 * stored by `/login tokenswim` first, then TOKENSWIM_API_KEY. Set
 * TOKENSWIM_BASE_URL to aim at a different gateway.
 */
import {
	createModels,
	InMemoryCredentialStore,
	InMemoryModelsStore,
	type Context,
} from "@earendil-works/pi-ai";
import { readStoredCredential } from "@earendil-works/pi-coding-agent";
import { registeredProvider } from "./harness.ts";

/** Same precedence the extension itself resolves with: stored key, then env. */
function apiKey(): string {
	const stored = readStoredCredential("tokenswim");
	if (stored?.type === "api_key" && stored.key) return stored.key;
	if (process.env.TOKENSWIM_API_KEY) return process.env.TOKENSWIM_API_KEY;
	console.error(
		"No Tokenswim API key. Run `/login tokenswim` in pi, or set TOKENSWIM_API_KEY.",
	);
	process.exit(1);
}

const modelId = process.argv[2] ?? "gpt-5.6-luna";

const credentials = new InMemoryCredentialStore();
await credentials.modify("tokenswim", async () => ({
	type: "api_key",
	key: apiKey(),
}));

const models = createModels({
	credentials,
	modelsStore: new InMemoryModelsStore(),
});
models.setProvider(registeredProvider());

const model = models.getModel("tokenswim", modelId);
if (!model) {
	const known = models
		.getModels("tokenswim")
		.map((candidate) => candidate.id)
		.join(", ");
	console.error(`Unknown model ${modelId}. The catalog has: ${known}`);
	process.exit(1);
}

const context: Context = {
	systemPrompt: "You are terse.",
	messages: [
		{
			role: "user",
			content: "Reply with exactly: smoke test ok",
			timestamp: Date.now(),
		},
	],
};

console.log(
	`→ ${model.id} via ${process.env.TOKENSWIM_BASE_URL ?? "https://tokenswim.app/v1"}\n`,
);

for await (const event of models.streamSimple(model, context)) {
	if (event.type === "thinking_delta") process.stdout.write(`\x1b[2m${event.delta}\x1b[0m`);
	if (event.type === "text_delta") process.stdout.write(event.delta);
	if (event.type === "error") {
		console.error(`\n\n✗ ${event.error.errorMessage}`);
		process.exit(1);
	}
	if (event.type === "done") {
		const { input, output, cacheRead, cost } = event.message.usage;
		console.log(
			`\n\n✓ ${event.reason} — in ${input} (cache ${cacheRead}), out ${output}, $${cost.total.toFixed(6)}`,
		);
	}
}
