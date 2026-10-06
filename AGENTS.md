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

## Existing production deployment

- Production already runs on **nixpi**, reached from the Mac with `ssh infiniter@nixpi.tail6650cb.ts.net`. The Docker container is `fitness-ai-convex`; the persisted volume is `fitness-ai-convex-data`.
- The existing Fitness AI source checkout is `/home/infiniter/agent-office/nagy135/fitness-ai`, with origin `git@github.com:nagy135/fitness-ai.git`. Locate and inspect this checkout before creating another one. `/home/infiniter/services/fitness-tracker` is a completely separate project.
- Production API: `https://fitness-ai.infiniter.tech`; auth/site: `https://fitness-ai-auth.infiniter.tech`; dashboard: `https://fitness-ai-dashboard.infiniter.tech`.
- The source checkout may be in use by Agent Office on a feature branch. Preserve that branch and its working tree. Use `/home/infiniter/.cache/fitness-ai-deploy` as a deployment worktree from the same repository, and verify the intended pushed commit from `origin/main` before deploying.
- Deploy application changes into the existing backend with `scripts/convex-self-hosted.sh`. Use the ignored `.env.production.local` targeting the production URL. Credentials remain on their machines; never print or commit them.

```bash
source_checkout=/home/infiniter/agent-office/nagy135/fitness-ai
deploy_checkout=/home/infiniter/.cache/fitness-ai-deploy
git -C "$source_checkout" fetch origin main
if [ ! -e "$deploy_checkout" ]; then
  git -C "$source_checkout" worktree add --detach "$deploy_checkout" origin/main
fi
cd "$deploy_checkout"
# Check that this deployment worktree is clean before pulling.
git pull --ff-only origin main
CONVEX_ENV_FILE="$source_checkout/.env.production.local" nix develop -c ./scripts/convex-self-hosted.sh deploy --yes
```

System prompts live in `packages/ai/src/prompts.ts`; workout tool descriptions live in `convex/ai/workout.ts`. Prompt-only changes take effect through a Convex functions deployment and work with the installed APK. Routine application deployments do not require recreating the Docker backend, rebuilding NixOS, or deleting its data volume. Infrastructure configuration lives in `~/Code/nix-server` on the Mac and `/etc/nixos` on nixpi.
