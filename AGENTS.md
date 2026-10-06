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
- NixOS manages the production Docker containers through `virtualisation.oci-containers`, defined in `/etc/nixos/modules/services/fitness-ai.nix` (Mac source: `~/Code/nix-server/modules/services/fitness-ai.nix`). The systemd units are `docker-fitness-ai-convex.service` and `docker-fitness-ai-dashboard.service`. `infra/docker-compose.yml` is for local development.
- Nginx serves HTTPS and proxies the API to `127.0.0.1:13210`, auth/HTTP actions to `127.0.0.1:13211`, and the dashboard to `127.0.0.1:16791`. Deploying functions from the source checkout updates the running Convex backend while preserving its Docker data volume.
- The production source and deployment checkout is **`/home/infiniter/services/fitness-ai`** (`~/services/fitness-ai` as `infiniter`), on `main`, with origin `git@github.com:nagy135/fitness-ai.git`. Pull and deploy from this directory. `/home/infiniter/services/fitness-tracker` is a completely separate project.
- Production API: `https://fitness-ai.infiniter.tech`; auth/site: `https://fitness-ai-auth.infiniter.tech`; dashboard: `https://fitness-ai-dashboard.infiniter.tech`.
- Check the production checkout's working tree and verify the intended pushed commit from `origin/main` before deploying.
- Deploy application changes into the existing backend with `scripts/convex-self-hosted.sh`. The ignored `.env.production.local` is stored in `~/services/fitness-ai` and targets the production URL. Credentials remain on their machines; never print or commit them.

```bash
ssh infiniter@nixpi.tail6650cb.ts.net
cd ~/services/fitness-ai
git status --short --branch
# Resolve any local changes before pulling.
git pull --ff-only origin main
nix develop -c pnpm --store-dir .pnpm-home/store --filter @fitness/convex... --filter fitness-ai install --frozen-lockfile
CONVEX_ENV_FILE=.env.production.local nix develop -c ./scripts/convex-self-hosted.sh deploy --yes
```

System prompts live in `packages/ai/src/prompts.ts`; workout tool descriptions live in `convex/ai/workout.ts`. Prompt-only changes take effect through a Convex functions deployment and work with the installed APK. Routine application deployments do not require recreating the Docker backend, rebuilding NixOS, or deleting its data volume. Infrastructure configuration lives in `~/Code/nix-server` on the Mac and `/etc/nixos` on nixpi.
