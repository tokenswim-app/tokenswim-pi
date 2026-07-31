# Tokenswim Pi Extension

A pi coding agent extension that registers Tokenswim as a model provider, so a
Tokenswim API key is all a user needs to run pi against Tokenswim's models.

## Language

### Tokenswim side

**Gateway**:
The public `/v1/*` HTTP surface at <https://tokenswim.app> that serves API-key
holders. Speaks the OpenAI Chat Completions, OpenAI Responses and Anthropic
Messages request shapes.
_Avoid_: proxy, AI gateway, backend

**Model ID**:
The string a caller puts in `model` (`gpt-5.6-sol`, `grok-4.5`). Tokenswim
publishes the current set at <https://tokenswim.app/pricing>; it is not any
upstream vendor's catalog.
_Avoid_: model name, slug

**API Key**:
The secret that authorises calls to the Gateway, created at
<https://tokenswim.app/dashboard/keys>. Presented as an `Authorization: Bearer`
header.
_Avoid_: token, credential, secret

### Pi side

**Provider**:
A pi-registered source of models. This extension registers exactly one, id
`tokenswim`.
_Avoid_: backend, integration

**Wire Protocol**:
The request shape the extension speaks to the Gateway. Fixed to OpenAI
Responses (`POST /v1/responses`) for every model.
_Avoid_: API type, format, endpoint

**Model Catalog**:
The set of models the extension advertises to pi, with the metadata pi needs
(context window, output cap, thinking levels, prices). Declared by the
extension, not fetched from the Gateway.
_Avoid_: model list, models.json

**Key Verification**:
The check that a pasted API Key is live, run once at login rather than on the
first message. A refusal means a bad key; anything else means the Gateway could
not be reached and says nothing about the key.
_Avoid_: validation, auth check
