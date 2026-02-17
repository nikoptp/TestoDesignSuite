# Monetization Roadmap (Phase 1 -> Phase 2)

## Decision
- Start with `Option 1`: fully free/open app + voluntary donations.
- Keep `Option 2` as a later path: open-core with paid convenience features.
- Do not pursue license-gated one-time paid app model at this stage.

## Phase 1: Free + Donation (Now)

### Product Model
- Core app is fully free.
- Source code remains public.
- No feature paywalls.

### Monetization Method
- Add a small, optional support link:
  - GitHub Sponsors, Ko-fi, or Buy Me a Coffee.
- Positioning: "If this app helps you, you can support development."

### Implementation Checklist
1. Add donation link in `README.md`.
2. Add donation link inside app (Settings/About/Help section).
3. Add `FUNDING.yml` in `.github/` for GitHub native sponsor button.
4. Keep donation copy short and non-intrusive.

### Success Metrics to Track
- Monthly active users (MAU)
- Retention (e.g. day-30 usage)
- Donation conversion rate
- Support burden (issues/discussions per active user)

## Phase 2: Open Core + Paid Convenience (Later)

### Trigger Conditions (Start When Most Are True)
- Stable user base with meaningful retention
- Donation revenue is not covering maintenance effort
- Repeated requests for advanced workflows
- Support load is increasing

### What Stays Free
- All core editing features (notes, noteboard, docs, local project files)
- Offline local-first usage

### What Can Be Paid (Convenience Layer)
- Cloud sync + backup
- Team collaboration/sharing
- Premium template/content packs
- Priority support

### Rollout Strategy
1. Keep free core unchanged first.
2. Ship one paid convenience feature with clear value.
3. Validate conversion and churn impact.
4. Expand only if user trust and satisfaction remain high.

## Guardrails
- No dark patterns, no nag screens.
- Avoid paywalling existing free features retroactively.
- Keep export/import and local ownership intact.
- Be transparent about what is free vs paid and why.

## Recommended Next Steps (Immediate)
1. Add donation/support links (repo + app UI).
2. Add simple telemetry for usage metrics (privacy-respecting, opt-in if needed).
3. Revisit Phase 2 only after real user signal.
