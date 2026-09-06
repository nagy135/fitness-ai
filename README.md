# Fitness AI

Fitness AI is an Expo/React Native workout tracker backed by self-hosted Convex. It uses Better Auth for accounts and an OpenRouter model for workout logging and read-only training analysis.

## Prerequisites

Install these before setting up the repository:

- Nix with flakes enabled
- Docker Desktop or OrbStack
- Git
- An OpenRouter API key

All Node, pnpm, Java, Watchman, and CocoaPods versions are supplied by the pinned Nix flake. Do not install a separate project-specific Node version.

## One-time setup

### 1. Clone and enter the repository

```bash
git clone <repository-url> fitness-ai
cd fitness-ai
```

### 2. Install dependencies

```bash
nix develop -c pnpm install
```

### 3. Create the local environment file

```bash
cp .env.example .env.local
```

For development in a browser or simulator on the same Mac, keep these values:

```dotenv
EXPO_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
EXPO_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
```

Add your OpenRouter configuration to `.env.local`:

```dotenv
AI_PROVIDER=openrouter
AI_MODEL=openai/gpt-5.6-luna
OPENROUTER_API_KEY=your-key-here
```

Do not commit `.env.local`. AI and authentication secrets are server-only and must never use an `EXPO_PUBLIC_` prefix.

### 4. Start self-hosted Convex

```bash
nix develop -c docker compose -f infra/docker-compose.yml up -d
```

Confirm that both services are healthy:

```bash
nix develop -c docker compose -f infra/docker-compose.yml ps
```

The backend exposes:

- Convex API and WebSocket endpoint: `http://127.0.0.1:3210`
- Convex HTTP actions and Better Auth: `http://127.0.0.1:3211`
- Convex dashboard: `http://127.0.0.1:6791`

### 5. Generate and save the Convex admin key

```bash
nix develop -c docker compose -f infra/docker-compose.yml exec backend ./generate_admin_key.sh
```

Copy the generated key into `.env.local`:

```dotenv
CONVEX_SELF_HOSTED_ADMIN_KEY=your-generated-admin-key
```

The helper scripts use `CONVEX_SELF_HOSTED_URL` and this key to ensure commands always target the Docker deployment rather than silently creating another local deployment.

### 6. Configure authentication

Generate a Better Auth secret:

```bash
nix develop -c ./scripts/generate-better-auth-secret.sh
```

Copy the printed value into this command so it is stored in the self-hosted deployment:

```bash
nix develop -c ./scripts/convex-self-hosted.sh env set BETTER_AUTH_SECRET '<generated-secret>'
```

Set the public auth endpoint used as the token issuer:

```bash
nix develop -c ./scripts/convex-self-hosted.sh env set CONVEX_SITE_URL http://127.0.0.1:3211
```

Set the Expo Web origin. This variable is required: without it, login can return a valid user and token while the app remains on the login screen.

```bash
nix develop -c ./scripts/convex-self-hosted.sh env set SITE_URL http://localhost:8081
```

### 7. Upload the AI configuration

This command reads the three AI values from `.env.local` without printing the API key:

```bash
nix develop -c ./scripts/sync-convex-ai-env.sh
```

### 8. Push the schema and functions

```bash
nix develop -c pnpm nx run convex:dev
```

Wait for Convex to report that the functions are ready. Keep this process running during development so backend edits are uploaded automatically.

## Starting the project each day

Use three terminals from the repository root.

### Terminal 1: Docker services

```bash
nix develop -c docker compose -f infra/docker-compose.yml up -d
```

### Terminal 2: Convex functions

```bash
nix develop -c pnpm nx run convex:dev
```

### Terminal 3: Expo

```bash
nix develop -c pnpm nx start mobile -- --lan --clear
```

After Expo starts:

- Press `w` to open Expo Web.
- Scan the QR code with Expo Go to use a physical device.
- Use the displayed shortcuts to start an installed iOS or Android simulator.

`--clear` resets the Metro bundler cache. It does not update Convex functions, so Terminal 2 must also be running after backend changes.

## Running on a physical phone

`127.0.0.1` on a phone means the phone itself, not the development Mac. The phone and Mac must be on the same Wi-Fi network, and the two Expo-facing URLs must use the Mac's LAN address.

Find the Mac's Wi-Fi address:

```bash
ipconfig getifaddr en0
```

For example, if it prints `192.168.1.25`, update `.env.local`:

```dotenv
EXPO_PUBLIC_CONVEX_URL=http://192.168.1.25:3210
EXPO_PUBLIC_CONVEX_SITE_URL=http://192.168.1.25:3211
```

Keep the CLI URL on localhost:

```dotenv
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
```

Restart Expo completely after changing any `EXPO_PUBLIC_` value:

```bash
nix develop -c pnpm nx start mobile -- --lan --clear
```

If Expo Web is opened from another computer using `http://<mac-ip>:8081`, also change the server-side web origin:

```bash
nix develop -c ./scripts/convex-self-hosted.sh env set SITE_URL http://<mac-ip>:8081
```

For ordinary Expo Go usage on a phone, `SITE_URL=http://localhost:8081` can remain unchanged because native authentication uses the `fitai://`/`exp://` flow rather than the browser cross-domain flow.

## Verify the setup

Check that Convex is reachable:

```bash
curl http://127.0.0.1:3210/version
```

Check the two auth URLs stored in Convex:

```bash
nix develop -c ./scripts/convex-self-hosted.sh env get CONVEX_SITE_URL
nix develop -c ./scripts/convex-self-hosted.sh env get SITE_URL
```

Expected local web values:

```text
http://127.0.0.1:3211
http://localhost:8081
```

Then open the app, register an account, log a workout, confirm it, and switch to Analysis mode. A request such as “Draw a graph of my weekly training volume” should retrieve confirmed history and render a native chart rather than ASCII text.

## Common problems

### `Failed to fetch` during registration or login

- Confirm Docker is running.
- Confirm ports 3210 and 3211 appear in `docker compose ps`.
- On a physical phone, replace the two public `127.0.0.1` URLs with the Mac's LAN IP.
- Restart Expo after changing `.env.local`.
- Check that the Mac firewall allows incoming connections from the local network.

### Login succeeds but the app stays on the login page

The Better Auth request may succeed while the web cross-domain session plugin is disabled. Verify `SITE_URL`:

```bash
nix develop -c ./scripts/convex-self-hosted.sh env get SITE_URL
```

If it is missing, set it and log in again:

```bash
nix develop -c ./scripts/convex-self-hosted.sh env set SITE_URL http://localhost:8081
```

### The model says no graph tool is available

The mobile bundle is newer than the deployed Convex functions. Keep the backend watcher running and wait until it finishes uploading:

```bash
nix develop -c pnpm nx run convex:dev
```

No new AI conversation is required after the backend update.

### Convex commands target the wrong deployment

Use the repository wrapper instead of a bare `pnpm convex` command:

```bash
nix develop -c ./scripts/convex-self-hosted.sh <convex-command>
```

The wrapper removes `CONVEX_DEPLOYMENT` and explicitly supplies the self-hosted URL and admin key.

## Checks

Run these before committing:

```bash
nix develop -c pnpm nx run-many -t typecheck
nix develop -c pnpm nx run-many -t lint
nix develop -c pnpm nx run-many -t test
nix develop -c pnpm expo-doctor apps/mobile
```

The critical device flow is documented in `maestro/register-and-log-workout.yaml` and expects a running backend plus an OpenRouter model that supports tool calling.

## Architecture and safety boundaries

- Every user-scoped Convex function resolves the Better Auth identity on the server. Clients and AI tools never provide a `userId`.
- Workout AI can modify only the active workout draft through validated tools.
- Only the confirmation screen can create an immutable confirmed workout.
- Analysis tools are read-only and retrieve confirmed history on demand.
- Chart data is passed through a validated 2D chart tool and rendered by the app.
- Conversation text is not authoritative application state.

## Stopping the project

Stop the Expo and Convex watchers with `Ctrl+C`, then stop Docker without deleting its persisted volume:

```bash
nix develop -c docker compose -f infra/docker-compose.yml down
```

Do not add `-v` unless you intentionally want to delete all local Convex data.
