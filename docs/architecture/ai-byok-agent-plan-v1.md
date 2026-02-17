# AI BYOK Agent Plan (Simplified VS Code Style)

## Goal
Add an in-app AI assistant with `bring your own key` (BYOK), focused on safe editing workflows for documents, noteboard cards, and tree organization.

## Product Constraints
- No developer-funded model usage.
- User provides their own API key.
- Keep Electron security boundaries strict:
  - Renderer: UI only
  - Main process: API calls + tool execution + policy checks
  - Preload: narrow typed IPC bridge

## UX Scope (V1)
- Right-side AI panel with:
  - Prompt input
  - Conversation thread
  - Action preview cards ("Proposed changes")
  - `Approve` / `Reject` controls per action batch
- Modes:
  - `Ask`: no file changes
  - `Edit`: propose changes to active content
  - `Agent`: multi-step tool use (still approval-gated)

## BYOK Flow
1. User opens AI settings.
2. User pastes API key.
3. App validates key with a lightweight request.
4. Key is stored locally (never committed/project-saved).
5. User can remove/replace key anytime.

### Key Storage Recommendation
- Preferred: OS credential vault via `keytar`.
- Fallback: encrypted local storage in app data (only if vault unavailable).
- Never expose key to renderer JS directly.

## Architecture

### Renderer
- AI panel UI state:
  - chat messages
  - pending tool proposal batch
  - approval state
- Calls preload APIs:
  - `ai:setApiKey`
  - `ai:clearApiKey`
  - `ai:sendMessage`
  - `ai:approveActions`
  - `ai:rejectActions`

### Preload
- Typed bridge definitions in `global.d.ts`.
- Only forwards validated payloads to main IPC handlers.

### Main Process
- `AiOrchestrator` service:
  - builds context
  - runs model calls
  - accepts proposed tool actions
  - returns preview payloads for approval
- `ToolExecutor` service:
  - executes allowed tools after approval
  - returns structured results
- `AiPolicy` service:
  - allowlist tools
  - max steps/tokens/batch size limits

## Tool Set (V1 Minimal)

### Read tools
- `get_active_node`
- `get_tree_summary`
- `get_active_document_markdown`
- `get_selected_noteboard_cards`

### Write tools (approval required)
- `update_active_document_markdown` (patch/full replace)
- `create_noteboard_cards`
- `update_noteboard_cards`
- `create_tree_node`
- `rename_tree_node`

## Approval Model
- Model never writes directly.
- Every write is returned as a structured proposal:
  - tool name
  - target entity
  - before/after summary
  - risk level
- User must approve.
- Approved batch executes atomically where possible.
- Every applied batch pushes history snapshot for undo.

## Context Strategy (Simplified)
- Always include:
  - active node metadata
  - current editor type
  - minimal tree breadcrumb
- Include active content only:
  - active document markdown OR selected cards
- No full-project indexing in V1.

## Safety / Guardrails
- Hard limits:
  - max tool steps per request
  - max tokens per request
  - max cards/nodes changed per batch
- Reject destructive actions without explicit confirmation.
- Action log in app session (what was proposed/applied).

## Error Handling
- Clear user-facing categories:
  - invalid key
  - network error
  - rate limit
  - malformed tool output
- Graceful fallback to Ask mode if tool loop fails.

## Telemetry (Local-first)
- Optional, privacy-respecting metrics:
  - requests sent
  - approval vs rejection rate
  - tool execution failures
- No content upload for telemetry.

## Implementation Phases

### Phase A (2-4 days)
- BYOK settings UI + secure key storage
- Main-process test call and status feedback

### Phase B (3-5 days)
- Ask mode chat (no write tools)
- Context packing for active node/editor

### Phase C (4-7 days)
- Edit mode with proposal + approval flow
- `update_active_document_markdown` tool
- Undo integration

### Phase D (4-7 days)
- Agent mode (limited multi-step loop)
- noteboard/tree tools + proposal previews

## Testing Plan
- Unit:
  - key storage service
  - tool schema validation
  - policy limits
- Contract:
  - IPC payload contracts (`global.d.ts` + preload)
  - tool proposal/approval shapes
- Integration:
  - ask mode response
  - edit proposal -> approve -> state mutation
  - reject path leaves state unchanged

## Out of Scope (V1)
- Team/shared cloud context
- autonomous background agents
- full repository/project semantic indexing
- model/provider abstraction layer beyond initial provider

## Definition of Done (V1)
- User can set own key and successfully chat.
- User can request edits and approve/reject proposed changes.
- Applied changes are undoable.
- No direct renderer access to API key.
- Lint/tests pass and docs updated.
