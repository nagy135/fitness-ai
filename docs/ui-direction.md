# UI direction: training club

The second UI pass responds to the request for a more interesting interface and a light/dark switch on every screen.

## Visual plan

- Palette: chalk #F0F2ED, paper #FFFFFF, court green #173C37, dark green #102622, apricot #FFB38C, slate green #65746B.
- Type: bundled Barlow Condensed SemiBold for session headings, wordmark, and prominent set measurements; platform sans for explanations, forms, and controls. Keep sentence case and native text scaling.
- Layout: a permanent compact wordmark/toolbar, visible sun/moon switch, underlined mode tabs, one apricot session panel, and closely grouped exercise rows. The session panel contains a native vector weight-plate illustration; the log remains the main working area.
- Character: gym equipment and sports typography. A single distinctive session panel carries the visual emphasis; other screens share the display typography and green palette.

```text
fitai    history chat settings  sun/moon
Workout                 Analysis
┌────────────────────────────────────┐
│ Date                       plates  │
│ In session.                        │
│ 4 sets / 1 exercise    Review       │
└────────────────────────────────────┘
Bench press
1    80 kg × 8 reps                 edit
2    80 kg × 8 reps                 edit
[ Describe your next set              ↑ ]
```

Review: changing just the accent color would leave the previous design intact. This direction also changes the type proportions, navigation, session hierarchy, and row treatment. Avoid fabricated performance metrics, decorative motion, and extra dashboard cards. The same theme switch appears in the screen frame, loading state, drawers, and exercise dialog.

The font is bundled with its SIL Open Font License, so runtime loading needs no external font request.

## Verification

Typecheck and lint pass for the final mobile/shared UI changes. The full repository suite passed all 18 tests during this pass. Browser previews covered populated and empty workouts, dark and light themes, and 390px/320px layouts. The narrow-screen empty heading was shortened to prevent an oversized session panel. Theme controls are provided by the shared screen frame for login, registration, workout, analysis, review, settings, exercise library, and loading states; drawers and the exercise dialog include their own control. Native-device testing remains outstanding.
