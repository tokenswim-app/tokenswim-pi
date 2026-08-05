import {
	type ApiKeyAuth,
	createProvider,
	envApiKeyAuth,
} from "@earendil-works/pi-ai";
// Via /compat, not the ./api/* subpath: pi's extension loader resolves the main
// entry and /compat, and silently fails to load an extension that imports any
// other subpath. A relative import like ./catalog.ts is fine — pi's own bundled
// extensions are split across several of them.
import { openAIResponsesApi } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { GATEWAY_URL, MODELS } from "./catalog.ts";

const KEYS_URL = "https://tokenswim.app/dashboard/keys";
const API_KEY_VAR = "TOKENSWIM_API_KEY";
const BASE_URL_VAR = "TOKENSWIM_BASE_URL";

// pi's standard api-key resolution: stored credential first, then the env var.
const KEY_AUTH = envApiKeyAuth("Tokenswim API key", [API_KEY_VAR]);

/** How long Key Verification waits before treating the gateway as unreachable. */
const VERIFY_TIMEOUT_MS = 10_000;

/**
 * Ask the gateway whether a key is live, so a mistyped one fails at login
 * rather than inside the first streamed response.
 *
 * Only an outright refusal is the key's fault. Every other outcome — a network
 * error, a timeout, a 5xx, a 404 from a mistyped gateway address — says nothing
 * about the key, so it resolves to `unreachable` and the key is kept.
 */
async function verifyKey(
	key: string,
	baseUrl: string,
	signal?: AbortSignal,
): Promise<"ok" | "rejected" | "unreachable"> {
	// Without a deadline a blackholed gateway hangs /login forever, which is the
	// failure this whole function exists to prevent.
	const timeout = AbortSignal.timeout(VERIFY_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(`${baseUrl}/models`, {
			headers: { authorization: `Bearer ${key}` },
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		});
	} catch {
		return "unreachable";
	}
	if (response.status === 401 || response.status === 403) return "rejected";
	return response.ok ? "ok" : "unreachable";
}

const AUTH: ApiKeyAuth = {
	...KEY_AUTH,
	login: async (interaction) => {
		const credential = await KEY_AUTH.login?.(interaction);
		if (!credential?.key) throw new Error("No API key entered.");
		// Login reads the process environment directly: `AuthInteraction` carries
		// no auth context, and there is no stored credential to read an address
		// from until this flow finishes. A machine pinned to a self-hosted
		// gateway through a stored credential alone therefore verifies against
		// the default one — the key is still stored either way.
		const baseUrl = process.env[BASE_URL_VAR] ?? GATEWAY_URL;
		const verdict = await verifyKey(
			credential.key,
			baseUrl,
			interaction.signal,
		);
		if (verdict === "rejected") {
			throw new Error(
				`Tokenswim rejected this API key. Check it at ${KEYS_URL} and try again.`,
			);
		}
		if (verdict === "unreachable") {
			interaction.notify({
				type: "info",
				message: `Could not reach ${baseUrl} to check this key, so it was saved unverified.`,
			});
		}
		return credential;
	},
	// Credential and gateway address resolve together. Per-field merge, the shape
	// `ApiKeyAuth.resolve` documents: a value stored on the credential wins, the
	// ambient environment is the fallback. Without the first half, an address
	// pinned inside a stored credential would be silently ignored.
	resolve: async (input) => {
		const resolved = await KEY_AUTH.resolve(input);
		if (!resolved) return undefined;
		const baseUrl =
			input.credential?.env?.[BASE_URL_VAR] ??
			(await input.ctx.env(BASE_URL_VAR)) ??
			GATEWAY_URL;
		return { ...resolved, auth: { ...resolved.auth, baseUrl } };
	},
};

export default function (pi: ExtensionAPI) {
	pi.registerProvider(
		createProvider({
			id: "tokenswim",
			name: "Tokenswim",
			baseUrl: GATEWAY_URL,
			auth: { apiKey: AUTH },
			models: MODELS,
			api: openAIResponsesApi(),
		}),
	);
}
