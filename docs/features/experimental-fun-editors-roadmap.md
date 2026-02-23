# Experimental Fun-Finding Editors Roadmap

## Purpose
This document captures three experimental editor concepts focused on helping designers find fun faster through short hypothesis-test-learn loops.

Target editors:
- Core Loop Simulator
- Hypothesis Playground
- Economy and Balance Tuner

## Product Principles
- Keep iteration speed higher than simulation accuracy in v1.
- Make every model value and assumption explicit and editable.
- Preserve quick actions and undo/redo-safe mutations by default.
- Prefer visual feedback over form-only workflows.
- Exportable snapshots should support playtest/review discussions.

## Shared Foundation
These three editors should share a small runtime foundation instead of three isolated implementations.

### Shared Domain Concepts
- `designVariable`: named numeric parameter with min/max/default/value.
- `scenario`: a saved input profile for simulation/tuning runs.
- `runResult`: calculated output values and pass/fail flags.
- `hypothesis`: statement with expected effect and measurable acceptance criteria.

### Shared Capabilities
- Variable panel (create, edit, lock, reset to default).
- Scenario management (save/load/duplicate/delete).
- Run log timeline (timestamped runs with diffs vs previous run).
- Inline chart widgets (sparkline, delta badge, threshold marker).
- Export/import JSON (for versioned experimentation).

### Shared Technical Approach
- New shared types in `src/shared/types.ts` under a dedicated `designLab` namespace.
- Stateless calculator modules in `src/features/design-lab/calculators/*`.
- Editor-specific controllers/hooks in `src/features/design-lab/hooks/*`.
- Reuse existing interaction primitives:
- `useGlobalKeydown`
- `useOutsidePointerDismiss`
- `startWindowPointerSession`
- `workspace-node-updaters`

## 1) Core Loop Simulator

### Goal
Help designers model minute-to-minute loop feel and reveal dead loops, reward droughts, and pacing issues.

### UX Shape
- Node graph canvas: `Action -> Challenge -> Reward -> Upgrade -> Next Goal`.
- Each node has:
- Duration estimate
- Friction score (0-100)
- Reward intensity (0-100)
- Clarity/confusion score (0-100)
- Run panel:
- Simulate one loop run
- Simulate N loops (default 10)
- Output:
- loop time distribution
- engagement score proxy
- bottleneck stage detection

### MVP Rules (v1)
- Deterministic model only (no random distributions yet).
- Single player archetype profile.
- One active graph per editor node.
- Max 30 nodes per graph.

### Data Model (v1)
- `loopNodes[]`: id, type, label, durationSec, friction, reward, clarity.
- `loopEdges[]`: fromNodeId, toNodeId, weight.
- `simConfig`: iterationCount, breakOnDeadLoop, scoreWeights.
- `simRuns[]`: timestamp, input hash, outputs.

### Implementation Steps
1. Add `core-loop-simulator` editor type metadata.
2. Add node data schema guard/sanitizer in persistence guards.
3. Build graph canvas view with draggable nodes and edge creation.
4. Implement deterministic simulator calculator.
5. Add run panel + result summary cards.
6. Hook into history and autosave.

## 2) Hypothesis Playground

### Goal
Provide a fast sandbox to define game-fun hypotheses and validate them with structured experiments.

### UX Shape
- Board columns:
- Hypotheses
- Experiments
- Signals
- Learnings
- Hypothesis card template:
- statement
- expected player emotion
- measurable signal
- test scope
- confidence (0-100)
- status (`untested` / `in-test` / `validated` / `invalidated`)
- Experiment card:
- setup variables
- test steps
- sample size
- result notes

### MVP Rules (v1)
- No external analytics integration.
- Manual result entry with structured fields.
- Link cards by references only (hypothesisId, experimentId).

### Data Model (v1)
- `hypotheses[]`: structured hypothesis records.
- `experiments[]`: test plans + outcomes.
- `signals[]`: metric-like observations (name/value/unit).
- `learningLog[]`: concise lessons with links.

### Implementation Steps
1. Add `hypothesis-playground` editor type metadata.
2. Implement card board layout reusing noteboard card UI primitives where possible.
3. Add structured editors for hypothesis/experiment cards.
4. Add status workflow actions and filter presets.
5. Add run history feed and simple confidence trend chart.

## 3) Economy and Balance Tuner

### Goal
Help designers tune progression and reward economy without spreadsheet-only workflows.

### UX Shape
- Left: variable table (inputs).
- Center: curve preview charts (income, spend, power curve).
- Right: balance constraints panel (target ranges + warnings).
- Scenario tabs:
- Early game
- Mid game
- End game
- Custom scenarios
- Quick actions:
- normalize rewards
- clamp outliers
- compare scenarios

### MVP Rules (v1)
- One currency and one power metric in first slice.
- Deterministic formulas only.
- Single-branch progression path (no branching trees yet).

### Data Model (v1)
- `variables[]`: numeric tuning values.
- `formulas[]`: expression-like definitions for outputs.
- `constraints[]`: min/max/target warnings.
- `scenarios[]`: overrides for variable sets.
- `runOutputs[]`: per-scenario calculated series.

### Implementation Steps
1. Add `economy-balance-tuner` editor type metadata.
2. Build variable table editor with validation + undo-safe edits.
3. Implement formula evaluator with safe expression parser.
4. Render line/bar mini charts for scenario comparison.
5. Add constraint warnings and recommendation badges.

## Cross-Editor Delivery Plan

### Phase 1 (Foundations)
- Shared types + sanitizers.
- Shared variable/scenario/run modules.
- Shared chart primitives.

### Phase 2 (Core Loop Simulator MVP)
- Ship first because it validates graph + simulation workflow foundations.

### Phase 3 (Hypothesis Playground MVP)
- Leverage existing card interactions and status workflows.

### Phase 4 (Economy/Balance Tuner MVP)
- Build on shared variable/scenario engine and charting primitives.

## Architecture Notes
- Keep calculators pure and isolated from React state.
- UI hooks orchestrate state and persistence only.
- Avoid loading all simulation results into render-critical state at once; keep summary + selected run.
- Persist schema version per editor payload to support migrations.

## Testing Strategy
- Unit tests for calculators and formula evaluator.
- Persistence guard tests for malformed payload recovery.
- Interaction tests for key workflows:
- node drag/create/delete in simulator
- hypothesis status transitions
- scenario compare and constraint warnings

## Open Questions
- Should core loop simulator support stochastic runs in MVP+1?
- Do we need CSV export for economy tuning immediately or later?
- Should hypothesis playground support attachment links (clips/screens) in MVP?

