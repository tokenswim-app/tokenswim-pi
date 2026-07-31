import { expect, test } from "bun:test";
import { registeredProvider } from "../harness.ts";

/**
 * Drift detector for the static Model Catalog. Tokenswim operators can add,
 * remove or reprice models at any time; this is the check that says so, and the
 * reason the Catalog is allowed to be a literal.
 *
 * It needs the network, so it opts in rather than opting out: living under
 * `test/` it is discovered by the default run, and skips itself there. A path
 * filter would have been one `bun test` invocation away from silently pulling
 * the network into every run.
 */
const OPTED_IN = process.env.TOKENSWIM_DRIFT === "1";

type Offer = {
	sku: string;
	priceSpecification: { price: string; unitText: string }[];
};

/** Match on the unit label rather than array position — order is not a contract. */
function publishedCost(offer: Offer) {
	const priceFor = (unit: string) => {
		const spec = offer.priceSpecification.find((candidate) =>
			candidate.unitText.includes(`1M ${unit} tokens`),
		);
		if (!spec) throw new Error(`${offer.sku} publishes no ${unit} price`);
		return Number(spec.price);
	};
	return {
		input: priceFor("input"),
		cacheWrite: priceFor("cache write"),
		cacheRead: priceFor("cache read"),
		output: priceFor("output"),
	};
}

test.skipIf(!OPTED_IN)("catalog still matches Tokenswim's published pricing", async () => {
	const response = await fetch("https://tokenswim.app/pricing.json");
	expect(response.status).toBe(200);
	const payload = (await response.json()) as {
		itemListElement: { item: Offer }[];
	};
	const live = new Map(
		payload.itemListElement.map(({ item }) => [item.sku, publishedCost(item)]),
	);

	const catalog = registeredProvider().getModels();
	expect(catalog.map((model) => model.id).sort()).toEqual(
		[...live.keys()].sort(),
	);
	for (const model of catalog) {
		const expected = live.get(model.id);
		if (!expected) throw new Error(`${model.id} is no longer published`);
		// Tag with the id so a mismatch names the model instead of just the numbers.
		expect({ id: model.id, ...model.cost }).toEqual({ id: model.id, ...expected });
	}
});
