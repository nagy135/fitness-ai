# Fitness AI

Fitness AI is a mobile-first workout tracker. Users log the current workout in natural language, review the resulting structured draft, confirm it into saved history, and ask read-only questions about past training.

## Stack and layout

- pnpm/Nx TypeScript monorepo; use the pinned Nix environment described in `README.md`.
- `apps/mobile`: Expo 57, React Native 0.86, Expo Router, NativeWind, and Convex React hooks. Read its more specific `AGENTS.md` before changing mobile code.
- `convex`: self-hosted Convex schema/functions plus Better Auth. `convex/ai` contains server-side AI actions.
- `packages/domain`: framework-independent workout normalization and calculations.
- `packages/ai`: model configuration, prompts, schemas, and tool boundaries (Vercel AI SDK/OpenRouter).
- `packages/ui`: shared React Native UI primitives.

## Important boundaries

- Edit confirmed workouts through an `editingWorkoutId` draft and explicit confirmation. Preserve the ordinary active draft and leave saved history unchanged until confirmation.
- Workout-mode AI may edit only the active draft through validated tools. Analysis-mode AI is read-only.
- Resolve the authenticated user in Convex functions; never accept a client- or model-provided `userId`.
- Stored weight is normalized to kilograms. Preserve tracking-type normalization when handling sets.
- Secrets stay server-side and must never use an `EXPO_PUBLIC_` prefix. Do not commit `.env.local`.
- Use `scripts/convex-self-hosted.sh` for Convex CLI operations so commands cannot silently target another deployment.

## Working conventions

- Keep route files in `apps/mobile/src/app`; put components, features, and utilities outside the route tree.
- Prefer shared domain logic in `packages/domain` when it is useful to both the app and backend.
- Preserve dark mode, mobile layouts, loading/empty states, and accessibility labels in UI work.
- Before finishing, run the relevant checks; for a cross-repository change use:

```bash
pnpm nx run-many -t typecheck
pnpm nx run-many -t lint
pnpm nx run-many -t test
```

Backend development requires the Docker services and the Convex watcher. Setup, environment variables, and troubleshooting live in `README.md`.
