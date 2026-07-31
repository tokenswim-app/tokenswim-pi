import {
	createModels,
	InMemoryCredentialStore,
	InMemoryModelsStore,
} from "@earendil-works/pi-ai";
import type {
	Api,
	ApiKeyCredential,
	AuthInteraction,
	Model,
	Provider,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../src/index.ts";

/** Load the extension the way pi does, and hand back the provider it registered. */
export function registeredProvider(): Provider<Api> {
	let captured: Provider<Api> | undefined;
	const pi = {
		registerProvider: (provider: Provider<Api>) => {
			captured = provider;
		},
	} as unknown as ExtensionAPI;
	extension(pi);
	if (!captured) throw new Error("extension registered no provider");
	return captured;
}

export function model(id: string): Model<Api> {
	const found = registeredProvider()
		.getModels()
		.find((candidate) => candidate.id === id);
	if (!found) throw new Error(`catalog has no model ${id}`);
	return found;
}

/** Drive the registered provider through pi's models runtime, as a session does. */
export function runtime() {
	const credentials = new InMemoryCredentialStore();
	const models = createModels({
		credentials,
		modelsStore: new InMemoryModelsStore(),
	});
	models.setProvider(registeredProvider());
	return { models, credentials };
}

export function storeCredential(
	credentials: InMemoryCredentialStore,
	credential: ApiKeyCredential,
) {
	return credentials.modify("tokenswim", async () => credential);
}

export function storeKey(credentials: InMemoryCredentialStore, key: string) {
	return storeCredential(credentials, { type: "api_key", key });
}

/**
 * The stored API key. Reports what was stored instead of just `false` when the
 * entry is missing or of the wrong kind, so a failure names the problem.
 */
export async function storedKey(credentials: InMemoryCredentialStore) {
	const stored = await credentials.read("tokenswim");
	if (!stored) return "<nothing stored>";
	if (stored.type !== "api_key") return `<stored a ${stored.type} credential>`;
	return stored.key;
}

/**
 * Start a stand-in gateway on an ephemeral port and point the extension at it.
 * Setting the address is the point, not a side effect: the returned server is
 * only reachable through it. Callers stop the server; `afterEach` clears the
 * variable.
 */
export function standInGateway(handler: (request: Request) => Response) {
	const server = Bun.serve({ port: 0, fetch: handler });
	process.env.TOKENSWIM_BASE_URL = `http://localhost:${server.port}/v1`;
	return server;
}

/** A user who pastes `key` at the prompt. */
export function pasting(key: string): AuthInteraction {
	return { prompt: async () => key, notify: () => {} };
}
