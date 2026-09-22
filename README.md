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
OPENROUTER_API_KEY=your-key-here
```

Choose the model and reasoning effort in Settings → AI preferences. Preferences
are saved per account and apply to logging, analysis, and name suggestions.
New and existing accounts without saved preferences default to GPT-5.6 Terra / Low.
The legacy `AI_MODEL` environment variable no longer overrides user preferences.

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

This command reads the AI provider and API key from `.env.local` without printing the API key:

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

## Build an installable Android APK

### Local preview APK

With the Android SDK/NDK installed, compile the signed preview APK on the Mac
without using cloud build credits. The CLI downloads the existing signing
credentials and preview environment; compilation runs locally. From the repo root:

```bash
mkdir -p dist
ANDROID_HOME="$HOME/Library/Android/sdk" nix develop -c sh -c \
  'cd apps/mobile && npx eas-cli@latest build --platform android --profile preview --local --non-interactive --output ../../dist/fitness-ai-preview.apk'
```

This only builds an APK. It does not deploy backend changes or install the app.
If a feature adds backend functions or schema fields, deploy those separately
before using that feature against a running backend.

### Voice input

The prompt microphone uses `expo-speech-recognition` and the device's preferred
language. Tap it, speak a short workout prompt, then tap stop (or pause until
recognition ends). Review/edit the transcript and tap Send. Existing prompt text
is preserved; another recording appends to it. Recording ends after at most one
minute and is canceled when leaving the screen or putting the app in the background.

Voice input requires a fresh native app build with microphone/speech permissions;
it cannot be added to an existing APK through a JavaScript update. Build the
preview APK below, or run `nix develop -c pnpm --filter mobile exec expo run:ios`
or `expo run:android` with the corresponding local native toolchain installed.
Expo Go still supports typing and keyboard dictation, but its prompt microphone
cannot load this custom native module. On web, voice input requires a browser
with speech recognition support and a secure context (HTTPS or localhost).

The app does not save audio. The operating system/browser speech service may
process audio online; offline availability and accuracy depend on the device
and language. Transcribed text reaches the workout/analysis AI only after Send.

Device smoke check after rebuilding: allow permissions, dictate reps and weights
into both modes, stop and edit before sending, append to existing text, deny
permissions, and leave the screen/background the app while recording. Confirm
that recording stops and late results never replace another mode's prompt.

### Development build with voice input

Install the custom development app once to use the prompt microphone while
keeping live JavaScript reloads. EAS builds it in the cloud, so no local Android
SDK or Xcode is required for the Android APK:

```bash
nix develop -c sh -c 'cd apps/mobile && npx eas-cli@latest build --platform android --profile development'
```

Install the resulting APK on your phone. Then start Metro with the production
backend and open **Fitness AI** instead of Expo Go:

```bash
EXPO_PUBLIC_CONVEX_URL=https://fitness-ai.infiniter.tech \
EXPO_PUBLIC_CONVEX_SITE_URL=https://fitness-ai-auth.infiniter.tech \
nix develop -c pnpm --dir apps/mobile exec expo start --dev-client --lan --clear
```

Scan the development server QR code to connect. Rebuild this app after changing
native dependencies or permissions; ordinary TypeScript edits reload immediately.

### Preview build

The `preview` EAS profile produces a signed APK with the JavaScript bundle included,
so Metro does not need to run. Configure `EXPO_PUBLIC_CONVEX_URL` and
`EXPO_PUBLIC_CONVEX_SITE_URL` in the EAS `preview` environment before building.
Use the deployed Convex API and site/auth URLs, respectively. The phone must be
able to reach those endpoints. Android HTTP traffic is enabled only when a
configured endpoint uses `http://`.

The current nixpi deployment uses `https://fitness-ai.infiniter.tech` for the
API and `https://fitness-ai-auth.infiniter.tech` for auth. Both are configured
in EAS. To deploy backend changes, use the ignored `.env.production.local`:

```bash
CONVEX_ENV_FILE=.env.production.local nix develop -c ./scripts/convex-self-hosted.sh deploy
```

This deployment has its own data; it does not contain the Mac's development
accounts or workout history. Infrastructure is managed in `~/Code/nix-server`.

AI actions emit structured JSON logs tagged `ai_timing`. Watch production timings with:

```bash
CONVEX_ENV_FILE=.env.production.local nix develop -c ./scripts/convex-self-hosted.sh logs --history 100 --success
```

Group events by `traceId`. `request_end.durationMs` measures the action handler;
`stage_end` separates context queries, generation, and saving the response.
`model_end` reports each model round trip (including SDK retries/backoff), input/output,
reasoning and cached token counts when available; `tool_end` measures tool execution.
`step_end` includes model and tool work. Analysis chart correction has its own pass.
Context sizes are character counts, not token estimates. No prompts, workout contents,
tool arguments/results, or error messages are added to these timing logs.

Summary `modelMs` counts completed model calls; `toolMs` sums tool durations, which
can overlap when tools run in parallel. Do not add nested stage/step/tool durations
together. Failed stages and requests are marked; a start without a matching end can
identify an interrupted call. Handler timings exclude phone/network latency and
action startup; `--success` also shows Convex's function durations, including the
client's preparation mutations. Logs are operational diagnostics, not a persistent
analytics table; capture the stream during a test if you need to keep the results.

AI requests use only the latest user message. Workout logging includes the fresh
current draft and defined exercise catalog; saved workouts and exercise histories
are retrieved through read-only tools when needed. Analysis retrieves saved training
data through its read-only tools. Previous chat messages remain visible in the
conversation drawer but are never loaded into model context. Follow-ups must name
their target when it cannot be resolved from the current workout data.

To browse or edit the nixpi database, open
`https://fitness-ai-dashboard.infiniter.tech` and log in with
`CONVEX_SELF_HOSTED_ADMIN_KEY` from `.env.production.local`.

You can also start a local dashboard connected to the same deployment:

```bash
nix develop -c ./scripts/convex-dashboard.sh
```

Open `http://localhost:6792` and log in with `CONVEX_SELF_HOSTED_ADMIN_KEY`
from `.env.production.local`. Choose **Data**, then a table; double-click a cell
or right-click a row and choose **Edit Document**. Edits affect the deployed
database immediately. Confirmed workouts can be edited from history through the shared workout editor;
changes reach saved history only after review and confirmation.

The script reads the backend URL from `.env.production.local`, binds the
dashboard to the Mac's loopback interface, and removes its container when you
press `Ctrl+C`. Override `CONVEX_ENV_FILE` to select another environment,
`DASHBOARD_PORT` to change the local port, or `CONVEX_DASHBOARD_IMAGE` to pin
the dashboard image. Docker must be running.

Log into Expo once, then start the build from the app directory while entering
the Nix environment at the repository root:

```bash
nix develop -c npx eas-cli@latest login
nix develop -c pnpm deploy:eas
```

The app is configured for EAS project `669c38b2-8856-46a3-b55a-45a92defb284`.
Run `deploy:eas` from the repository root. It starts an EAS cloud build using the
Android `preview` profile and its configured environment. Backend changes must
also be deployed with
`CONVEX_ENV_FILE=.env.production.local nix develop -c ./scripts/convex-self-hosted.sh deploy`.
On the first build, EAS will generate an Android signing key. When the build
finishes, open its APK download link on your phone
and install it. `.easignore` includes the generated Convex client bindings while
excluding local environment files and signing credentials.

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
- The confirmation screen creates saved workouts or applies a history editing draft to its original workout.
- History edits reuse the workout table, AI tools, and review screen. Save or cancel restores the ordinary active draft.
- Analysis tools are read-only and retrieve confirmed history on demand.
- Chart data is passed through a validated 2D chart tool and rendered by the app.
- Conversation text is not authoritative application state.

## Stopping the project

Stop the Expo and Convex watchers with `Ctrl+C`, then stop Docker without deleting its persisted volume:

```bash
nix develop -c docker compose -f infra/docker-compose.yml down
```

Do not add `-v` unless you intentionally want to delete all local Convex data.
