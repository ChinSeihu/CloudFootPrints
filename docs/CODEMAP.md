# CloudFootPrints Code Map

> Repository navigation for agents and maintainers. Start here, then read only the exact files required by the requested change. This file describes ownership and entry points; source code remains authoritative.

## How to use this map

1. Find the requested feature in **Feature navigation**.
2. Open the first listed entry file and only the relevant symbol or section.
3. Follow a listed related file only when the change crosses that boundary.
4. Use **Directory inventory** when adding, moving, or locating a specific file.
5. Update this map whenever a file is added, removed, moved, or changes responsibility.

Do not use this map to justify broad repository reads. Generated assets, historical migrations, and static datasets are grouped because they are rarely implementation entry points.

## Feature navigation

### Map rendering and interaction

- Entry: `src/components/Map/MapExplorer.tsx` — owns MapLibre sources/layers, clustering, popups, click hit-testing, exploration anchor, bottom action bar, content visibility, and publishing placement.
- Map lifecycle: `src/components/Map/MapView.tsx` — creates the MapLibre instance and reports bounds/readiness.
- Filters: `src/components/Map/Filters.tsx`, `DateRangeDropdown.tsx` — category/date/mine/expired/trail controls.
- Markers/theme: `src/components/Map/markers.ts`, `src/lib/mapTheme.ts`, `src/lib/categoryIcons.ts`.
- Nearby recommendations: `src/components/Map/PopularCard.tsx`.
- Do not inspect API/services for a visual-only layer, hit area, popup, or bottom-bar change unless returned data is wrong.

### Map publishing and check-ins

- Post form: `src/components/Map/PostDialog.tsx`.
- Check-in form: `src/components/Map/CheckInDialog.tsx` — owns footprint content plus optional nearby/searchable activity association.
- Shared sheet/styles: `src/components/Map/BottomSheet.tsx`, `src/components/Map/formStyles.ts`.
- Placement and submission orchestration: `src/components/Map/MapExplorer.tsx`.
- APIs: `src/app/api/events/route.ts`, `src/app/api/checkins/route.ts`.
- Domain logic: `src/services/events.ts`, `src/services/checkins.ts`.

### Activities, discovery, and detail

- Recommendation/discovery page: `src/app/recommend/page.tsx`.
- Feed and filters: `src/components/Recommend/RecommendList.tsx`.
- Detail drawer and interactions: `src/components/Recommend/EventDetail.tsx`.
- Shared event reads/writes: `src/services/events.ts`.
- Detail/related APIs: `src/app/api/events/[id]/route.ts`, `related/route.ts`.
- Shared DTOs/tags/source helpers: `src/lib/types.ts`, `src/lib/tags.ts`, `src/components/common/EventSource.tsx`.

### Calendar

- Server entry: `src/app/calendar/page.tsx`.
- Calendar UI: `src/components/Calendar/CalendarView.tsx`.
- Date rules: `src/lib/dateFilter.ts`, `src/lib/holidays.ts`.

### Authentication and users

- Session/JWT boundary: `src/lib/auth.ts`.
- User domain operations: `src/services/users.ts`.
- Client auth state/forms: `src/components/Auth/AuthContext.tsx`, `AuthForm.tsx`.
- Auth APIs: `src/app/api/auth/**/route.ts`.
- Demo identities: `src/lib/demoUsers.ts`, `src/lib/personas.ts`.

### Personal profile, follows, and messages

- Personal page: `src/app/me/page.tsx`, `src/components/Me/MeView.tsx`.
- Profile/edit UI: `src/components/Me/ProfileHeader.tsx`, `EditDialogs.tsx`.
- Direct-message UI/domain/API: `src/components/Me/DirectMessages.tsx`, `src/services/directMessages.ts`, `src/app/api/messages/**/route.ts`.
- Follow domain/API: `src/services/follows.ts`, `src/app/api/users/follows/route.ts`.
- Reply notifications: `src/services/replies.ts`, `src/app/api/replies/route.ts`.

### Comments, reactions, favorites, and signups

- Domain logic: `src/services/comments.ts`, `reactions.ts`, `replies.ts`.
- Event endpoints: `src/app/api/events/[id]/comments`, `reactions`, and `click`.
- Check-in endpoints: `src/app/api/checkins/[id]/comments` and `reactions`.
- Cross-page activity collections: `src/app/api/wants/route.ts`, `favorites/route.ts`, `signups/route.ts`.
- UI consumers: `src/components/Recommend/EventDetail.tsx`, `RecommendList.tsx`.
- Want-to-go journey state and map deep links: `src/lib/eventJourney.ts`; personal reminder/actions live in `src/components/Me/MeView.tsx`, while `src/components/Map/MapExplorer.tsx` consumes route/check-in deep links.

### AI guide

- Shared character feedback: `src/components/Mascot/MascotFeedback.tsx` — continuous welcome/success compatibility wrapper, quiet empty states and delayed loading feedback; `src/app/loading.tsx` — route Suspense fallback.

- Client state/chat/FAB: `src/components/Guide/GuideContext.tsx`, `GuideChat.tsx`, `GuideFab.tsx`.
- Chat endpoint: `src/app/api/chat/route.ts`.
- Activity grounding: `src/services/guideEvents.ts`.
- Route-plan endpoint/types: `src/app/api/guide/route-plan/route.ts`, `src/lib/guideRoute.ts`.
- LLM calls: `src/lib/llm.ts`.

### Rail, stations, and route planning

- Map panels: `src/components/Map/LinePanel.tsx`, `RoutePanel.tsx`.
- ODPT integration: `src/services/odpt.ts` and station/train timetable APIs.
- Deterministic graph routing: `src/services/routePlanner.ts`, `src/app/api/route/route.ts`.
- Static topology: `public/stations.json`, `public/lines.json`.
- Dataset generator: `scripts/enrich-station-lines.ts`.

### Food, landmarks, and weather

- Food definitions/images: `src/lib/foodSpots.ts`, `foodSpotsImported.ts`, `foodSpotImages.ts`, `cuisineMap.ts`.
- Food queries/APIs: `src/services/foodPoi.ts`, `hotPepperPoi.ts`, `src/app/api/food/route.ts`, `hotpepper/route.ts`.
- Landmarks: `src/lib/landmarks.ts`, `landmarkImages.ts`.
- Weather: `src/services/weather.ts`, `src/app/api/weather/route.ts`, `src/components/Map/WeatherPanel.tsx`, `WeatherAnimation.tsx`.

### Event extraction and ingestion

- Pipeline entry: `src/services/extraction/index.ts`.
- Shared source contract: `src/services/extraction/types.ts`.
- Source registry/adapters: `src/services/extraction/sources/index.ts` and sibling source files.
- Transform stages: `extract.ts`, `classify.ts`, `summarize.ts`, `geocode.ts`, `featured.ts`.
- Database ingest/dedup: `ingest.ts`, `src/lib/eventDedup.ts`.
- LLM implementation: `src/lib/llm.ts`.
- Runtime entry points: `scripts/run-extraction.ts`, `src/app/api/extract/route.ts`.

### Community simulation and image generation

- Orchestrator: `src/services/simulation/engine.ts`.
- Daily decision/location: `decide.ts`; social pass: `social.ts`; world state: `world.ts`.
- Personas, canonical voice/behavior constraints, and relationships: `src/lib/personas.ts`, `relationships.ts`, `community.ts`.
- Memory/life/status: `memory.ts`, `lifeEvents.ts`, `signature.ts`.
- Image pipeline: `image.ts`, `imageQA.ts`, `regenerate.ts`, `src/lib/cloudinary.ts`.
- Script/API entry points: `scripts/sim-*.ts`, `src/app/api/simulate/route.ts`.
- Persona documentation: `docs/demo-personas.md`, `docs/Agent_Architecture.md`.

### Database and deployment

- Data model: `prisma/schema.prisma`; migration history: `prisma/migrations/**`.
- Prisma singleton/config: `src/lib/db.ts`, `prisma.config.ts`.
- Local PostgreSQL: `docker-compose.yml`.
- Next/Vercel/build configuration: `next.config.ts`, `package.json`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`.

## Directory inventory

### Repository root

- `.gitignore` — generated files, secrets, build output, logs, and local datasets excluded from Git.
- `.env.example` — documented environment-variable template; real secrets stay in `.env`.
- `AGENTS.md` — binding repository workflow, scope, documentation, validation, and coding rules for agents.
- `CHANGELOG.md` — concise history of user-visible and architectural changes.
- `CLAUDE.md` — legacy/alternate assistant guidance retained for compatibility.
- `DECISIONS.md` — stable product and architecture decisions.
- `README.md` — project setup and developer-facing overview.
- `docker-compose.yml` — local PostgreSQL service.
- `eslint.config.mjs` — ESLint configuration.
- `next.config.ts` — Next.js configuration and remote-image/build settings.
- `package.json` — dependencies and runnable scripts.
- `postcss.config.mjs` — PostCSS/Tailwind processing.
- `prisma.config.ts` — Prisma CLI configuration.
- `tokyo-event-map-design.md` — original product/design specification.
- `tsconfig.json` — TypeScript compiler configuration.
- `yarn.lock` — exact dependency lock; do not edit manually.
- `extract-4ken.log`, `import-hp.log` — retained local extraction/import diagnostic logs; not runtime inputs.

### Tool and automation configuration

- `.claude/launch.json` — alternate assistant/local launch configuration.
- `.codex/config.md` — repository-local Codex configuration notes.
- `.github/workflows/extract.yml` — scheduled/dispatch event extraction workflow.
- `.github/workflows/simulate.yml` — scheduled/dispatch community simulation workflow.
- `.github/workflows/maintenance.yml` — recurring data/content maintenance workflow.
- `.github/workflows/cleanup-cloudinary.yml` — scheduled/dispatch orphaned-image cleanup workflow.

### `docs/`

- `CODEMAP.md` — this repository and feature navigation index.
- `Agent_Architecture.md` — simulation-agent architecture and lifecycle.
- `demo-personas.md` — PersonaV2 demo account reference.

### `prisma/`

- `schema.prisma` — authoritative PostgreSQL data model and relationships.
- `migrations/migration_lock.toml` — migration provider lock.
- `migrations/20260609073548_init/migration.sql` — initial schema.
- `migrations/20260609085307_add_comments/migration.sql` — comments schema.
- `migrations/20260612020726_add_event_image/migration.sql` — event image support.
- `migrations/20260626072000_add_checkin_mood_tags/migration.sql` — check-in mood tags.
- `migrations/20260626103000_add_event_metrics/migration.sql` — event metrics.
- `migrations/20260626113000_add_event_featured_today/migration.sql` — daily featured flag.
- `migrations/20260627093000_add_checkin_visibility/migration.sql` — public/private check-ins.
- `migrations/20260630090000_add_content_image_spec/migration.sql` — saved image-generation specs.
- `migrations/20260630102000_add_event_tags/migration.sql` — event tags.
- `migrations/20260630113000_add_user_follows/migration.sql` — follow relationships.
- `migrations/20260704120000_add_checkin_interactions/migration.sql` — check-in comments/reactions.
- `migrations/20260715110000_add_direct_messages/migration.sql` — direct messaging.
- `migrations/20260731120000_add_user_admin_role/migration.sql` — admin role.
- `migrations/20260903120000_split_post_kind/migration.sql` — LIFE/ACTIVITY post semantics and existing social-post backfill.

### `public/`

- `brand-icon.png`, `brand-icon-192.png`, `apple-touch-icon.png` — Kumoashi mascot install icons (512/192px) and Apple touch icon (180px).
- `manifest.webmanifest` — installable app name, colors, start URL, and icon metadata.
- `brand/mascots/` — archived character sheets, September 4 design reference, current user-supplied V4 menu atlas, historical V3 atlas, prompts, and asset guidance.

- `stations.json`, `lines.json` — generated static rail topology used by the map and route planner.
- `avatars/*.png`, `avatars/persona-v2/*.png` — user/demo avatar assets.
- `identity-refs/*.png` — persona identity reference crops for image generation.
- `refs/*.png` — persona image reference crops.
- `person.png`, `personV2.png` — original persona reference sheets.
- `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — starter/general static icons; not feature logic.

### `scripts/`

- `backfill-summaries.ts` — fills missing event summaries.
- `build-foodspots.ts` — converts food source data into a TypeScript dataset.
- `clean-image-memory.ts` — removes or repairs stale simulation image-memory data.
- `cleanup-cloudinary.ts` — finds/removes orphaned Cloudinary assets; exports public-id parsing.
- `create-admin.ts` — promotes or creates an administrator account.
- `crop-avatars.ts`, `crop-identity-refs.ts`, `crop-refs.ts` — generate persona image crops.
- `dedupe-events.ts` — database event deduplication maintenance.
- `enrich-station-lines.ts` — builds static station/line topology from OSM data.
- `eval-extraction.ts` — evaluates extraction accuracy against fixtures/dataset.
- `fetch-foodspot-images.mts`, `fetch-landmark-images.mjs` — fetch static POI image references.
- `fetch-hotpepper.ts`, `import-hotpepper-poi.ts` — fetch/import Hot Pepper restaurant data.
- `import-osm-food.ts` — imports OSM food POIs.
- `import-stations.ts` — legacy/static station import.
- `loadEnv.ts` — script-side environment loading helper.
- `publish-demo-checkins.ts` — makes demo persona check-ins public.
- `run-extraction.ts` — CLI extraction-pipeline entry.
- `seed-demo.ts` — legacy/basic demo seed.
- `sim-init.ts` — initializes simulation state.
- `sim-inspect.ts` — reports simulation/persona state.
- `sim-reset.ts` — resets and reseeds simulation content.
- `sim-run.ts` — CLI daily simulation entry.
- `regenerate-sim-images.ts` — previews or replaces simulated post/check-in images created on one Tokyo date.
- `split-posts.ts` — one-time Event-to-Post migration helper.
- `sync-demo-users.ts` — synchronizes PersonaV2 definitions, state snapshots, and relationships into database users.
- `eval/dataset.json` — extraction evaluation cases.
- `fixtures/chiyoda-events.txt` — representative Chiyoda raw event extraction input.
- `fixtures/mori-art-museum.txt` — representative museum raw event extraction input.

### `src/app/`

- `layout.tsx`, `icon.png` — root brand metadata/icon plus providers, analytics, and navigation shell.
- `template.tsx` — route-transition template wrapper.
- `page.tsx` — map page server entry rendering `MapExplorer`.
- `globals.css` — global Tailwind styles and MapLibre popup/card styling.
- `favicon.ico` — application icon.
- `calendar/page.tsx`, `calendar/loading.tsx` — calendar route and loading state.
- `recommend/page.tsx`, `recommend/loading.tsx` — recommendation/discovery route and loading state.
- `me/page.tsx`, `me/loading.tsx` — personal route and loading state.

### `src/app/api/`

- `admin/posts/route.ts` — administrator listing of virtual-user posts.
- `auth/demo/route.ts` — list/login demo accounts.
- `auth/login/route.ts`, `logout/route.ts`, `register/route.ts` — local account session endpoints.
- `auth/me/route.ts`, `profile/route.ts` — current user read/profile update.
- `chat/route.ts` — AI guide chat endpoint.
- `checkins/route.ts` — map/personal check-in list and creation.
- `checkins/[id]/route.ts` — update/delete one check-in.
- `checkins/[id]/comments/route.ts`, `reactions/route.ts` — check-in interactions.
- `checkins/[id]/regenerate-image/route.ts` — demo/admin check-in image regeneration.
- `comments/[id]/route.ts` — delete a comment.
- `events/route.ts` — map event/post list and user-post creation.
- `events/[id]/route.ts` — detail/update/delete one event or post.
- `events/[id]/click/route.ts` — records event click metrics.
- `events/[id]/comments/route.ts`, `reactions/route.ts` — event/post interactions.
- `events/[id]/regenerate-image/route.ts` — demo/admin post image regeneration.
- `events/[id]/related/route.ts` — nearby/linked posts and check-ins.
- `extract/route.ts` — protected extraction trigger.
- `favorites/route.ts`, `signups/route.ts` — current-user saved/joined events.
- `food/route.ts`, `hotpepper/route.ts` — food POI queries.
- `guide/route-plan/route.ts` — LLM-backed guide itinerary planning.
- `messages/route.ts`, `messages/[conversationId]/route.ts` — conversation and message operations.
- `replies/route.ts` — reply notifications.
- `route/route.ts` — deterministic rail/walking route planning.
- `simulate/route.ts` — protected community simulation trigger.
- `station-timetable/route.ts`, `train-timetable/route.ts`, `train-positions/route.ts` — ODPT transport endpoints.
- `users/follows/route.ts` — follow lists and mutations.
- `weather/route.ts` — cached Tokyo weather endpoint.

### `src/components/`

- `BottomNav.tsx` — app-wide bottom navigation.
- `Mascot/Mascot.tsx` — four named IP selections plus persisted no-IP mode, unified raster crop regions, picker, shared footprint mark, and legacy preference migration.
- `CopyButton.tsx` — reusable clipboard action.
- `PageLoading.tsx` — delayed route-loading feedback; calendar/discovery use continuous IP scenes.
- `Mascot/MascotMotion.tsx`, `Mascot/MascotMotion.module.css` — scalable SVG portrait composition, continuous welcome motion, one-shot success and static idle feedback; replaces eight-frame playback.
- `Mascot/LoadingScene.tsx`, `Mascot/LoadingScene.module.css` — layered calendar, discovery, album, route, note-taking, upload, painting and letter actions; four IP portraits, reduced-motion and hidden-tab handling.
- `Mascot/LoadingFeedback.tsx` — delayed section/chat loading, compact scenes and long-wait text; shared by profile, maps, transport, guide/detail, upload/regeneration, messages/follows and discovery pagination.
- `icons.tsx` — shared SVG icon components and category/weather icon dispatch.

### `src/components/Auth/`

- `AuthContext.tsx` — client current-user provider and `useAuth` hook.
- `AuthForm.tsx` — login/register/demo-login interface.

### `src/components/Calendar/`

- `CalendarView.tsx` — calendar grid, day selection, and event display.

### `src/components/common/`

- `Avatar.tsx` — avatar image/fallback rendering.
- `CheckinCommentThreads.tsx` — shared personal/discover footprint comment avatars, Tokyo timestamps, root/reply layout, and discussion reply actions.
- `CalendarRangePicker.tsx` — calendar-based date-range input.
- `ConfirmDialog.tsx` — reusable destructive-action confirmation.
- `CountBadge.tsx` — compact numeric badge.
- `DateTimeField.tsx` — date/time form input.
- `EventSource.tsx` — official/user source badges, filtering, and predicates.
- `Lightbox.tsx` — fullscreen image viewer.
- `MoodSelector.tsx` — mood-tag selector.
- `ShareButton.tsx` — Web Share/clipboard fallback action.

### `src/components/Guide/`

- `GuideContext.tsx` — guide topic/open state provider and hook.
- `GuideChat.tsx` — conversational guide panel and message flow.
- `GuideFab.tsx` — floating guide entry button.

### `src/components/Map/`

- `ActionFab.tsx` — legacy/standalone publish action FAB.
- `BottomSheet.tsx` — draggable publishing sheet shell.
- `CheckInDialog.tsx` — check-in draft form.
- `DateRangeDropdown.tsx` — compact map date range control.
- `Filters.tsx` — map filtering panel.
- `formStyles.ts` — shared publishing-form class strings.
- `LinePanel.tsx` — station line departures, stops, and live train details.
- `MapExplorer.tsx` — main map feature orchestrator and MapLibre layer/event owner.
- `MapView.tsx` — MapLibre creation and bounds observer.
- `markers.ts` — DOM marker factories.
- `PopularCard.tsx` — anchor/center-based nearby event card and recommendation intents.
- `PostDialog.tsx` — LIFE update / ACTIVITY post form with separate time semantics.
- `RoutePanel.tsx` — rail/walking route selection and presentation.
- `StyleSwitcher.tsx` — map theme switcher.
- `WeatherAnimation.tsx` — visual weather overlay.
- `WeatherPanel.tsx` — current/forecast weather UI.

### `src/components/Me/`

- `DirectMessages.tsx` — conversation list and message thread UI.
- `EditDialogs.tsx` — post and check-in editing/regeneration dialogs.
- `MeView.tsx` — personal profile, content, timeline, and admin controls.
- `ProfileHeader.tsx` — profile identity, stats, follow, and edit controls.

### `src/components/Recommend/`

- `EventDetail.tsx` — official-event/user-post detail and interaction UI.
- `RecommendList.tsx` — activity/discovery feed, filters, check-in cards, and pagination.
- `TodayPicks.tsx` — explainable daily top-three recommendations with device-local preference feedback.

### `src/lib/`

- `auth.ts` — password hashing, JWT cookie sessions, current actor/user mapping.
- `categories.ts`, `categoryIcons.ts` — event taxonomy, labels, colors, and glyphs.
- `clipboard.ts` — clipboard API with fallback.
- `cloudinary.ts` — client image upload/configuration.
- `covers.ts` — preset profile covers.
- `cuisineMap.ts` — external cuisine-to-internal food-kind mapping.
- `dateFilter.ts` — Tokyo day-range predicates and presets.
- `db.ts` — shared Prisma client singleton.
- `demoUsers.ts` — demo-user view derived from personas.
- `eventDedup.ts` — event title/day normalization and deduplication.
- `foodSpotImages.ts`, `foodSpotsImported.ts` — generated/static restaurant data.
- `foodSpots.ts` — food POI types, metadata, curated and imported merged view.
- `guideRoute.ts` — guide itinerary request/response types.
- `holidays.ts` — Japanese holiday lookup.
- `image.ts` — browser image compression.
- `landmarkImages.ts`, `landmarks.ts` — landmark image lookup and curated landmark definitions.
- `llm.ts` — Anthropic extraction, classification, summarization, guide, and persona chat calls.
- `mapTheme.ts` — in-place MapLibre basemap recoloring.
- `moods.tsx` — mood definitions and rendering metadata.
- `personas.ts` — PersonaV2 definitions, voices, locations, relationships, and seed memories.
- `PersonaV2_Migration_Guide.md` — historical PersonaV2 migration notes.
- `tags.ts` — normalized/display event tags.
- `types.ts` — shared client/server DTO types.

### `src/services/`

- `checkins.ts` — check-in queries, visibility, creation, update, deletion, and discover pagination.
- `comments.ts` — polymorphic event/post/check-in comments and replies.
- `directMessages.ts` — direct-conversation authorization, reads, send, and read markers.
- `events.ts` — official Event + LIFE/ACTIVITY user Post normalization, map queries, and post mutations.
- `follows.ts` — follow state, lists, mutations, and demo mutual follows.
- `foodPoi.ts`, `hotPepperPoi.ts` — spatial food POI queries and bbox parsing.
- `guideEvents.ts` — builds authoritative activity context for the AI guide.
- `odpt.ts` — ODPT dictionaries, timetable, status, and train-position integration.
- `reactions.ts` — polymorphic likes/favorites and saved/signup lists.
- `replies.ts` — reply-notification projection.
- `routePlanner.ts` — cached station graph and Dijkstra route planning.
- `users.ts` — demo users, registration/login, and profile updates.
- `weather.ts` — Open-Meteo fetch and weather DTO mapping.

### `src/services/extraction/`

- `index.ts` — source runner and complete pipeline orchestration.
- `types.ts` — `Source`, `RawDocument`, and validated extracted-event contract.
- `extract.ts` — raw text to structured events.
- `classify.ts` — optional LLM category refinement.
- `summarize.ts` — optional LLM summary generation.
- `geocode.ts` — GSI address normalization/geocoding and bounds checks.
- `featured.ts` — daily featured-event selection.
- `ingest.ts` — prefilter, deduplicate, enrich, and persist extracted events.
- `sources/index.ts` — enabled source registry.
- `sources/jsonLd.ts` — shared JSON-LD parser/classifier/mapper.
- `sources/walkerplus.ts` — Walkerplus list/detail adapters, including sports/live variants.
- `sources/jalan.ts` — Shift_JIS Jalan list/detail adapters.
- `sources/connpass.ts` — Connpass source adapter.
- `sources/tokyoOpenData.ts` — Tokyo Open Data source adapter.
- `sources/sampleFixtures.ts` — local fixture source for evaluation/development.

### `src/services/simulation/`

- `engine.ts` — daily simulation orchestration, persistence, and maintenance.
- `decide.ts` — persona daily decision prompt/schema, spot resolution, and image specification.
- `social.ts` — daily posts, comments, replies, reactions, and optional post images.
- `world.ts` — daily shared world/weather/event context.
- `community.ts` — emotion relaxation and weekly community balancing.
- `relationships.ts` — relationship growth/decay after activity.
- `memory.ts` — long-term memory compression.
- `lifeEvents.ts` — occasional persona life-event generation.
- `signature.ts` — persona status/signature refresh.
- `image.ts` — outfit planning, prompt composition, providers, generation, upload preflight, and Cloudinary persistence (server-signed credentials preferred; unsigned preset fallback).
- `imageQA.ts` — generated-image quality judgment and prompt repair.
- `regenerate.ts` — post/check-in image regeneration and database update.

## Maintenance checklist

Update this file in the same change when:

- a file is added, removed, renamed, or moved;
- responsibility moves between UI, route, service, or library layers;
- a new feature needs a clear first inspection point;
- a generated dataset or maintenance script becomes part of a regular workflow.

Do not add implementation walkthroughs, line numbers, secrets, temporary debugging notes, or duplicate architectural decisions from `DECISIONS.md`.
