# @tokenswim/pi

Use [Tokenswim](https://tokenswim.app)'s models in the
[pi coding agent](https://pi.dev). One API key, no per-vendor accounts.

## Install

```bash
pi install npm:@tokenswim/pi
```

Then log in — pi prompts for the key and checks it against the gateway before
storing it, so a mistyped key fails immediately rather than on your first
message:

```
/login tokenswim
```

Get a key at <https://tokenswim.app/dashboard/keys>.

Prefer environment variables? Set `TOKENSWIM_API_KEY` instead and skip the
login. A key stored by `/login` takes precedence over the variable.

## Configuration

| Variable | Purpose |
| --- | --- |
| `TOKENSWIM_API_KEY` | API key, used when none is stored by `/login` |
| `TOKENSWIM_BASE_URL` | Gateway address, default `https://tokenswim.app/v1` |

`TOKENSWIM_BASE_URL` is also read from the credential's own `env` block in pi's
auth file, so one machine can hold keys for more than one gateway:

```json
{
  "tokenswim": {
    "type": "api_key",
    "key": "sk-...",
    "env": { "TOKENSWIM_BASE_URL": "https://gateway.example.com/v1" }
  }
}
```

## Development

```bash
bun install
bun run check          # typecheck + tests, no network, no credentials
bun run test:drift     # compare the catalog against tokenswim.app/pricing
```

`./ext.sh` registers a local checkout with pi and verifies it actually loaded —
pi fails silently on a broken extension, so the install message alone proves
nothing:

```bash
./ext.sh install       # register, then confirm the models appear
./ext.sh status        # is it installed, and what does it expose
./ext.sh try           # run pi once with it, touching no settings
./ext.sh uninstall
```

A local install is registered by path, never copied, so edits under `src/` are
live in the next pi session — `/reload` picks them up without restarting.

To send one real request (spends balance):

```bash
bun run smoke              # gpt-5.6-luna, the cheapest model
bun run smoke grok-4.5
```

## License

MIT
