# App audit and UI cleanup

## Scope and design plan

Preserve the natural-language logging → editable draft → explicit confirmation → read-only analysis flow. Keep confirmed history immutable, identity server-resolved, and weights normalized to kilograms.

The visual direction is a focused training notebook: left-aligned exercise names, tabular set values, and cobalt reserved for actions and the active session. The workout itself is the focal point.

- Palette: chalk `#F3F5F9`, white `#FFFFFF`, midnight `#151E30`, slate `#606C80`, cobalt `#315BD6`, pale blue `#A9BEFF`. Dark surfaces use `#101725` and `#1A2436`.
- Type: platform system sans (San Francisco on iOS, Roboto on Android), with semibold controls, 32px session headings, and tabular numeric values. Native font scaling remains enabled.
- Layout: a centered working column on web, full width on phones; safe-area-aware top bar, mode navigation, scrolling workout, and bottom composer.
- Principles: visible review action, readable measurements before editing controls, consistent 44px touch targets, clear recovery from failed requests.

Layout alternatives considered:

```text
Chosen: focused session          Rejected: dashboard
┌──────────────────────────┐     ┌──────────────────────────┐
│ Fitness AI       history │     │ metrics / metrics / stat │
│ Workout     Analysis     │     │ cards / charts / streaks │
│ Today    Review workout  │     │ recent / current / chat  │
│ Exercise                 │     └──────────────────────────┘
│ Set   kg × reps     edit │
│                          │
│ Describe your next set   │
└──────────────────────────┘
```

Review against the brief: a dashboard would add information the logging task does not need. Repeated cards and permanently visible adjustment buttons would compete with the workout. Use grouped exercise rows with on-demand controls instead. No decorative gradients, all-caps eyebrows, or invented training metrics.

## Findings

| Priority | Finding                                                                                 | Resolution                                                                                  |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| High     | Failed profile/draft initialization leaves an endless loading screen.                   | Retryable initialization with a visible error.                                              |
| High     | Prompt failures clear the typed input; responses can leak between modes.                | Preserve failed text, isolate results by mode, prevent conflicting actions during requests. |
| High     | Draft rows omit duration/distance, while history summaries omit reps for weighted sets. | Shared complete set formatting and controls for every stored primary measure.               |
| High     | Confirmation and auth requests lack exception recovery and pending guards.              | Guard submissions and show actionable errors.                                               |
| Medium   | Review is discoverable only by switching to analysis.                                   | Explicit review action; retain the existing mode-switch confirmation path.                  |
| Medium   | Seven small adjustment controls compete in every set row.                               | Compact measurement rows with expandable 44px controls.                                     |
| Medium   | Fixed top/bottom padding ignores device safe areas; wide screens stretch content.       | Shared responsive screen frame and safe-area-aware drawers.                                 |
| Medium   | Theme values, drawer structure, and set formatting are duplicated.                      | Shared tokens, drawer shell, formatting, and feature components.                            |
| Medium   | Account route has no visible entry or back navigation.                                  | Settings links and consistent back controls.                                                |
| Medium   | Removing the final set leaves an empty exercise that prevents confirmation.             | Allow removal of an empty draft exercise from the UI.                                       |
| Medium   | Reordering accepts duplicate rows when all original IDs are also present.               | Validate length, uniqueness, and membership, with regression tests.                         |
| Medium   | Effort validation permits NaN because range comparisons do not reject it.               | Require finite RIR/RPE values, with regression tests.                                       |

## Backend review

Reviewed draft mutations, confirmation, authentication resolution, AI tools, and domain normalization. Confirmation already has an idempotent receipt and normalizes using the catalog. Workout AI has no confirmation/history-write tool; analysis exposes read-only training tools. These boundaries are retained.

Follow-up risks outside this UI refactor: draft dates default to UTC rather than the user's local calendar day; AI actions consist of multiple transactions and can partially modify a draft before failing; history drawers show only the latest 50 entries; backend integration tests are absent (the added backend tests cover pure validation). A failed AI request should be reviewed before resending to avoid duplicating already-applied sets.

## Verification

- `nix develop -c pnpm nx run-many -t typecheck lint test`: passed across all five projects (18 tests: 5 domain, 4 AI boundary/schema, 4 measurement formatting, 5 backend validation).
- Browser checks against the local app: workout rows and expansion, review and return, history summaries, settings navigation, appearance toggle, and exercise dialog. Reviewed 320px, 390px, and 1280px layouts in light/dark themes. Keyboard focus is visible in the exercise dialog.
- Existing workout data was not edited or confirmed during UI verification; the original light theme was restored afterward.
- Native-device keyboard/safe-area behavior and a full AI logging → confirmation flow still require device/end-to-end testing. Auth screens were checked statically, not by registering or logging out the existing session.
- No dependency changes, schema changes, secret changes, or deployment commands were required.
