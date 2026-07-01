# StemSplitter

A React Native / Expo app that uploads audio tracks, separates them into individual stems (vocals, drums, bass, piano, guitar, other) and lets you play, mix and export each stem independently.

## Stack

| Layer | Technology |
|---|---|
| Mobile | Expo (React Native) + Expo Router |
| Styling | NativeWind (Tailwind for RN) |
| API | tRPC v11 + Express |
| Database | MySQL via Drizzle ORM |
| Auth | OAuth (Manus) |
| Storage | S3-compatible (via Forge presigned URLs) |
| Audio | expo-audio |
| File picker | expo-document-picker |

## Getting started

### 1. Clone & install

```bash
git clone <your-repo-url>
cd stem-splitter
pnpm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:

```env
# Database (MySQL)
DATABASE_URL=mysql://user:password@host:3306/dbname

# Auth
JWT_SECRET=your-jwt-secret
OAUTH_SERVER_URL=https://...
VITE_APP_ID=your-app-id
OWNER_OPEN_ID=your-open-id

# Storage (Forge / S3-compatible)
BUILT_IN_FORGE_API_URL=https://...
BUILT_IN_FORGE_API_KEY=your-forge-key

# Client-side (prefixed with EXPO_PUBLIC_)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_OAUTH_PORTAL_URL=https://...
EXPO_PUBLIC_OAUTH_SERVER_URL=https://...
EXPO_PUBLIC_APP_ID=your-app-id
```

### 3. Set up the database

```bash
pnpm db:push        # generates & runs migrations
```

### 4. Run in development

```bash
pnpm dev            # starts the API server (port 3000) and Metro bundler (port 8081) concurrently
```

Open the app:
- **Web:** `http://localhost:8081`
- **iOS/Android:** scan the QR code with Expo Go, or run `pnpm ios` / `pnpm android`

## Project structure

```
stem-splitter/
├── app/                   # Expo Router screens
│   ├── (tabs)/
│   │   └── index.tsx      # Home — file picker + recent tracks
│   ├── processing.tsx     # Separation progress screen
│   ├── stem-player.tsx    # Per-stem audio player
│   ├── stem-mixer.tsx     # Volume mixer + preset saver
│   └── library.tsx        # Full track library
├── components/            # Shared UI components
├── constants/             # Theme, OAuth config
├── drizzle/               # DB schema + migrations
├── hooks/
│   └── use-stem-player.ts # expo-audio playback hook + mix state
├── lib/
│   └── _core/             # tRPC client, auth helpers
├── server/
│   ├── _core/             # Express server, OAuth, storage proxy
│   ├── db.ts              # Drizzle queries
│   └── routers.ts         # tRPC router definitions
└── shared/                # Types & constants shared by client + server
```

## Uploading a track

1. Tap **Upload Audio** on the home screen
2. Pick an MP3, WAV, FLAC, or M4A file from your device
3. The app:
   - Requests a presigned PUT URL from the server
   - Uploads the file directly to storage
   - Creates a track record in the database
   - Starts the stem separation job
4. The processing screen polls for completion (~8 s in demo mode)
5. Once complete, the stem player opens automatically

## Stem separation backend

The current implementation **simulates** separation (seeding placeholder stem URLs). To wire up real separation:

1. Implement a background job that calls [Demucs](https://github.com/facebookresearch/demucs) (or another model) with the uploaded file URL
2. Write the output stems to storage at `stems/<trackId>/<stemType>.mp3`
3. Update the stems table rows with real `fileUrl` values

## Git workflow

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run server + Metro in parallel |
| `pnpm dev:server` | API server only (tsx watch) |
| `pnpm dev:metro` | Metro bundler only |
| `pnpm build` | Bundle server for production |
| `pnpm start` | Run production server |
| `pnpm db:push` | Generate & run DB migrations |
| `pnpm check` | TypeScript type check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
