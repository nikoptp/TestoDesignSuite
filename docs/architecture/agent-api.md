# Agent API (External)

## Purpose
This API allows external agents/tools to interact with TestoDesignSuite while the app is running, without using renderer DevTools.

The server is hosted by the Electron main process and binds to loopback only.

## Discovery
- Runtime file: `<userData>/data/agent-api.json`
- Example fields:
  - `baseUrl`: `http://127.0.0.1:<port>`
  - `token`: bearer token required for all requests
  - `apiVersion`

`<userData>` maps to Electron's `app.getPath('userData')`.

## Authentication
- Header required on every request:
  - `Authorization: Bearer <token>`
- Missing/invalid token returns `401 UNAUTHORIZED`.

## Endpoints

### Capabilities
- `GET /capabilities`
- Returns API capabilities, method inventory, and error codes.

### Docs API
- `GET /docs`
- `GET /docs/file?path=<relativePath>`
- `PUT /docs/file` body: `{ relativePath, content, expectedHash? }`
- `POST /docs/file` body: `{ relativePath, content }`
- `POST /docs/rename` body: `{ fromRelativePath, toRelativePath }`
- `DELETE /docs/file?path=<relativePath>`

Docs constraints:
- Scope: `docs/**`
- Extensions: `.md`, `.markdown`
- Paths outside `docs/` are rejected.

### Nodes API
- `GET /nodes`
- `POST /nodes/create` body:
  - `{ editorType, name?, parentId?, initialMarkdown? }`

Notes:
- `story-document` supports `initialMarkdown`.
- When UI window is active, node creation is routed through renderer state for autosave-safe updates.
- If no active window exists, creation falls back to persisted tree-state mutation.

## Security Controls
- Loopback-only binding: `127.0.0.1` (not externally exposed).
- Bearer token auth required.
- Request body size limit: `1,000,000` bytes.
- Basic rate limit: `240` requests/minute per process window.
- Error responses are sanitized (`INTERNAL_ERROR` does not expose stack/paths).
- CORS wildcard headers are not emitted by default.

## Error Codes
Common codes returned by API:
- `UNAUTHORIZED`
- `NOT_FOUND`
- `INVALID_ARGUMENT`
- `INVALID_JSON`
- `PAYLOAD_TOO_LARGE`
- `RATE_LIMITED`
- `INVALID_EDITOR_TYPE`
- `PARENT_NOT_FOUND`
- `INTERNAL_ERROR`

## Operational Notes
- The runtime token file is session-scoped and removed when the app server stops.
- External tools should always fetch `/capabilities` first and adapt to `apiVersion`.
- For docs writes, prefer optimistic concurrency with `expectedHash`.
