# 修改履历

> 记录每次功能变更的内容、涉及文件、背景说明。时间倒序排列（最新在上）。

---

## 2026-07-01

### Align footprint cards and post metadata
- **Nearby footprints**: vertically centered footprint text with the right-side photo strip and added per-photo counters such as `1/3` on multi-photo previews.
- **User post detail**: removed the separate shooting-time row and merged author identity with location metadata into one compact information block.
**Files:** `src/components/Recommend/RecommendList.tsx`, `src/components/Recommend/EventDetail.tsx`

---

### Compact recommend and detail mobile layouts
- **Recommend mobile density**: tightened the recommend page header, tab switcher, hero banner, category shortcut row, and hot activity cards for narrow phone screens without using global scaling.
- **Nearby footprints**: changed footprint cards to a single-column feed; text uses normal weight, and photos sit in a right-side one-third preview area with up to three horizontal thumbnails.
- **Detail mobile density**: reduced hero heights, card padding, typography, and action-strip size on event and user-post detail pages to avoid oversized blocks on small Android/WebView screens.
**Files:** `src/components/Recommend/RecommendList.tsx`, `src/components/Recommend/EventDetail.tsx`

---

### Expand discovery footprint feed
- **Nearby footprints**: changed nearby checkins from small horizontal tiles to user-feed cards with avatar, mood badge, two-line default text, expandable copy, and tappable image preview.
- **Discovery view-all**: "查看全部" on user posts and nearby footprints now scrolls to a full discovery section with a segmented switch for all posts versus all footprints.
- **Image preview**: added a lightweight full-screen image preview for discovery footprint photos.
**Files:** `src/components/Recommend/RecommendList.tsx`

---

### Refine recommend tabs and June demo checkin maintenance
- **Recommend tabs**: restyled the activity/discovery switch as a raised segmented card with active shadows and short subtitles so the two modes have clearer hierarchy.
- **Discovery posts**: removed timestamps from user-post cards in the discovery feed to keep the image-first card cleaner.
- **Demo footprints**: changed the maintenance script/workflow to publish PersonaV2 demo checkins by Tokyo month, defaulting to June 2026 (`--month=2026-06`).
**Files:** `src/components/Recommend/RecommendList.tsx`, `scripts/publish-demo-checkins.ts`, `.github/workflows/maintenance.yml`

---

### Tighten recommend discovery cards and filters
- **Discovery posts**: removed the extra user-post badge and author header from the discovery user-post cards; cards now use image-first activity-style layout with title, description, tags, time, and real like count only when present.
- **Activity filters**: category shortcuts now show active state and scroll to the all-activities section; "查看全部" on hot activities also scrolls to the full activity list.
- **All activities**: restored incremental loading for the full activity grid so the page can expand in batches instead of rendering a fixed short slice.
- **Recommendation basis**: "为你推荐" now prioritizes LLM daily picks (`featuredToday`) and then falls back to recency, engagement, image completeness, and trust score.
- **Demo footprints**: added a maintenance script and manual GitHub Actions workflow to publish existing PersonaV2 demo checkins using the configured `DATABASE_URL` secret.
**Files:** `src/components/Recommend/RecommendList.tsx`, `scripts/publish-demo-checkins.ts`, `.github/workflows/maintenance.yml`

---

### Redesign recommend activity and discovery tabs
- **Activity tab**: rebuilt the recommend page around the supplied activity-page reference with a stronger official featured banner, category shortcuts, hot activity carousel, and recommendation cards.
- **Discovery tab**: added a user-content focused discovery view with user post cards using the app's personal post styling, nearby public checkin cards, and real same-day mood stats.
- **Public checkins**: recommend page now loads recent public footprints alongside event data so discovery content can show actual user footprints instead of reusing official event cards.
**Files:** `src/components/Recommend/RecommendList.tsx`, `src/app/recommend/page.tsx`

---

## 2026-06-30

### Improve extracted event times
- **LLM time prompt**: strengthened extraction instructions to actively capture `日時` / `開催時間` / `開館時間` / `開場` / `開演` and only use midnight when no nearby time exists.
- **Structured date handling**: JSON-LD event dates now preserve existing `HH:mm` values instead of always being converted to `T00:00:00+09:00`.
- **Ingest fallback**: date-only extracted events now infer start/end hours from nearby Japanese time lines such as `日時：9:00〜16:00` or `開館時間：10時〜22時`.
**Files:** `src/lib/llm.ts`, `src/services/extraction/ingest.ts`, `src/services/extraction/sources/jsonLd.ts`

---

### Add follow and follower system
- **Follow graph**: added `UserFollow` storage, follow stats, follow list API, and follow/unfollow support for user profiles.
- **Profile social lists**: personal profile cards now show following / follower buttons in the lower-right corner, opening lists with a knot badge for mutual follows.
- **List actions**: follower lists now show a follow-back button for non-mutual followers and a knot badge for mutual follows; following lists expose cancel follow with a confirmation dialog.
- **Persona friends**: PersonaV2 friend pairs are synced as mutual follows for demo users, while existing simulation `Relationship` data remains separate.
- **User post follow action**: user-post detail follow buttons now create real follow relationships instead of acting as static UI.
**Files:** `prisma/schema.prisma`, `prisma/migrations/20260630113000_add_user_follows/migration.sql`, `src/services/follows.ts`, `src/services/users.ts`, `src/app/api/users/follows/route.ts`, `src/components/Me/ProfileHeader.tsx`, `src/components/Recommend/EventDetail.tsx`, `scripts/sync-demo-users.ts`

---

### Tighten post detail mobile spacing
- **Post detail density**: reduced mobile padding, image spacing, comment composer height, and bottom action sizing so user-post detail pages feel closer to the supplied reference.
- **Scroll tail fix**: removed sticky bottom action blocks from detail pages and reduced bottom padding to prevent extra blank space when scrolled to the end.
- **Official detail mobile fit**: shortened the official hero and tightened the floating info card on mobile while preserving the larger desktop spacing.
- **Flat action strip**: moved guide / map / share / source actions from the page bottom into a flat info strip below the venue/address area for both official events and user posts.
- **Lazy comments**: event detail comments now load root comments 10 at a time, show 3 replies per thread by default, load more replies in batches of 10, and use small inline loading indicators.
**Files:** `src/components/Recommend/EventDetail.tsx`, `src/services/comments.ts`, `src/app/api/events/[id]/comments/route.ts`

---

### Tighten event detail typography
- **Smaller detail typography**: reduced oversized official/user detail fonts and tightened dense statistic rows so labels no longer wrap on mobile.
- **Real counts only**: removed placeholder engagement numbers from event details; likes, comments, favorites, and want-to-go counts now only use live reaction/comment data.
- **Gallery and expand polish**: detail images now open in the lightbox, user-post multi-image galleries scroll horizontally, venue text is smaller, and expand/collapse uses SVG chevrons instead of text glyphs.
- **Official detail polish**: official hero images are clickable for full-screen viewing, event time text is smaller, and venue rows now expose a copy action.
- **Meaningful event tags**: official events now store LLM/extracted `tags`, detail info cards show activity tags instead of filler stats, and bottom action buttons / user-post headers are more compact.
- **User post detail flow**: user post details now lead with the image gallery, then title/body/tags/location; the feedback card is hidden until a better signal is available.
- **User post top actions**: user-post detail top buttons now match official detail sizing, and the inactive more menu is replaced with like / favorite actions.
**Files:** `src/components/Recommend/EventDetail.tsx`, `prisma/schema.prisma`, `prisma/migrations/20260630102000_add_event_tags/migration.sql`, `src/lib/llm.ts`, `src/services/events.ts`, `src/services/extraction/types.ts`, `src/services/extraction/ingest.ts`, `src/services/extraction/sources/connpass.ts`, `src/services/extraction/sources/jsonLd.ts`

---

### Redesign activity detail pages
- **Official activity detail**: rebuilt official event detail as an immersive image-led page with floating action buttons, elevated time/place card, category/meta strip, guidance chips, comment area, and bottom guide/map/share/source actions.
- **User post detail**: added a separate social-post detail layout for personal posts with author header, follow affordance, tag chips, route row, collage gallery, quote card, comments, and bottom actions matching the supplied reference.
- **Detail data**: exposed `createdAt` / `updatedAt` on event detail DTO responses so user posts can show publish time consistently.
**Files:** `src/components/Recommend/EventDetail.tsx`, `src/lib/types.ts`, `src/app/api/events/[id]/route.ts`

---

### Move image regeneration into edit dialogs
- **Edit-first regeneration**: moved demo-only post and footprint image regeneration from the personal page list actions into the edit dialogs, so users can review the regenerated image without closing the editor.
- **Inline preview refresh**: regenerated post covers and footprint photos update immediately inside the edit modal and sync back to the personal page list.
**Files:** `src/components/Me/EditDialogs.tsx`, `src/components/Me/MeView.tsx`

---

### Persist image specs for regeneration
- **Image memory fields**: added `imageSpec` JSON storage to user posts and footprints so the original structured image intent is kept with the content.
- **Persona-locked regeneration**: demo PersonaV2 accounts can regenerate post/footprint images from the personal page, reusing the saved image spec and the character model reference.
- **Simulation write-through**: community simulation now saves `decision.post.imageSpec` when it creates a footprint, so future regenerations use the original visual memory instead of inferring from text.
**Files:** `prisma/schema.prisma`, `prisma/migrations/20260630090000_add_content_image_spec/migration.sql`, `src/services/simulation/engine.ts`, `src/services/simulation/regenerate.ts`, `src/services/checkins.ts`, `src/services/events.ts`, `src/app/api/checkins/route.ts`, `src/app/api/checkins/[id]/regenerate-image/route.ts`, `src/app/api/events/route.ts`, `src/app/api/events/[id]/regenerate-image/route.ts`, `src/components/Me/MeView.tsx`

---

### Add Vercel Speed Insights
- **Speed Insights**: added `@vercel/speed-insights` and mounted the global `<SpeedInsights />` component alongside Web Analytics so Core Web Vitals are collected after production deployment.
**Files:** `package.json`, `yarn.lock`, `src/app/layout.tsx`

---

### Activate Vercel Web Analytics
- **Vercel Analytics**: added `@vercel/analytics` and mounted the global `<Analytics />` component in the App Router root layout so page views are collected after deployment on Vercel.
**Files:** `package.json`, `yarn.lock`, `src/app/layout.tsx`

---

## 2026-06-27

### Refine clusters and extracted event times
- **Mixed cluster sizing**: mixed-source cluster rings scale up more aggressively with activity count so center numbers have more room.
- **Footprint cluster simplification**: footprint clusters now render as numeric pink circles only, without the heart icon badge over the count.
- **Extraction time recovery**: LLM extraction prompts now emphasize exact time capture, and ingestion infers missing hours from nearby source text when extracted timestamps default to midnight.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/lib/llm.ts`, `src/services/extraction/ingest.ts`

---

### Refine image-less activity cards
- **Map popup no-image cards**: activity popups no longer render an empty image area when an activity has no image.
- **Nearby placeholder art**: nearby activity cards now show a designed HTML placeholder with the activity title and category color when image data is missing, with title placement adjusted away from source/category badges.
- **Recommend hero title sizing**: recommendation hero titles use the smaller local title size that was already staged in the working tree.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/components/Map/PopularCard.tsx`, `src/components/Recommend/RecommendList.tsx`, `src/app/globals.css`

---

### Scale mixed cluster rings by count
- **Mixed cluster scaling**: segmented mixed-source cluster rings now grow more clearly with activity count while keeping ordinary source-only clusters as simple numeric circles.
**Files:** `src/components/Map/MapExplorer.tsx`

---

### Round user post map marker
- **Circular user post marker**: individual user posts now use the dedicated round purple camera marker instead of the drop-shaped cluster marker, making the single-post marker visually rounder and closer to official activity marker weight.
**Files:** `src/components/Map/MapExplorer.tsx`

---

### Restore standard cluster circles
- **Standard cluster circles**: official-only and user-only activity clusters return to simple numeric circles without icons, with source color distinction preserved.
- **Mixed cluster ring**: mixed-source clusters keep the segmented ring badge and now load as a square image to avoid oval distortion.
- **Marker/action polish**: user post single markers are enlarged further, and the favorite action now shares the same pill style as navigation and AI guide buttons.
**Files:** `src/components/Map/MapExplorer.tsx`

---

### Restore map cluster badge style
- **Cluster visual rollback**: activity clusters return to the earlier badge-led style with a subtle halo instead of the heavier visible colored main circle.
- **Mixed cluster donut**: mixed activity clusters now use a segmented ring with white dividers and a blue center count, matching the provided reference style.
- **Larger user post marker**: individual user posts now use a larger purple camera bubble and touch target so they match official activity marker weight more closely.
**Files:** `src/components/Map/MapExplorer.tsx`

---

### Polish map clusters and popup detail surfaces
- **Larger count-based clusters**: activity clusters now scale more visibly with aggregate count, including mixed clusters, so the count remains readable when zoomed out.
- **Round popup close buttons**: popup close controls now keep a circular, card-colored background across activity, footprint, landmark, and food cards.
- **Detail tab actions**: activity detail tabs now end with "点击查看详情" and expose navigation / AI guide actions inside the detail panel.
- **Food card footer layout**: food popup footer actions use a stable grid so route, guide, and details no longer collide.
- **Landmark tab surface**: landmark popups now mirror activity cards with detail / post / footprint tabs and related publish entry points.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/app/globals.css`

---

### Align map markers and activity popup tabs
- **User post marker shape**: user posts now use a purple camera bubble marker instead of a standard activity circle with a corner badge.
- **Category-colored official activities**: official activity markers again use category colors so event types are easier to distinguish on the map.
- **Count-based cluster sizing**: map clusters size by aggregated count again, with larger mixed clusters so numbers remain readable when zoomed out.
- **Activity popup tabs**: activity cards now use `详情 / 发帖 / 足迹` tabs; related posts and public footprints load inline, with publish actions at the top of their tabs.
- **Public footprint authors**: public footprint data now includes author information for map and related-content displays.
- **Viewport-safe date picker**: the map filter date picker is fixed within the viewport so it no longer opens off-screen.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/components/Map/Filters.tsx`, `src/app/api/events/[id]/related/route.ts`, `src/services/checkins.ts`, `src/lib/types.ts`, `src/app/globals.css`

---

### Improve map popup close affordance
- **Visible popup close button**: MapLibre popups now use a circular white close button with border, shadow, and higher contrast so activity, footprint, landmark, station, and food cards are easier to dismiss.
**Files:** `src/app/globals.css`

---

### Refine map aggregation shapes and popup cards
- **Semantic cluster markers**: map clusters now use distinct SVG badge shapes for official activity clusters, user-post clusters, mixed clusters, and footprint clusters instead of plain circles.
- **Activity popup cards**: map activity popups now use image-led detail cards with overlaid source/category badges, clearer metadata, and separated actions.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/app/globals.css`

---

### Link posts and footprints to activities
- **Activity-linked posts and footprints**: map activity popups now include actions to create a related post or footprint, and the forms carry the selected activity as their target.
- **Footprint visibility**: footprints can now be public or hidden; hidden footprints stay private while public ones participate in map and activity aggregation.
- **Aggregation data foundation**: added `Post.eventId`, `CheckIn.isPublic`, related indexes, and `/api/events/[id]/related` for future activity detail tabs.
- **Map marker hierarchy**: official activities use blue markers, user posts use purple camera markers, and footprints use lightweight pink heart markers to match the new map legend direction.
**Files:** `prisma/schema.prisma`, `prisma/migrations/20260627093000_add_checkin_visibility/migration.sql`, `src/services/events.ts`, `src/services/checkins.ts`, `src/app/api/events/route.ts`, `src/app/api/events/[id]/related/route.ts`, `src/app/api/checkins/route.ts`, `src/app/api/checkins/[id]/route.ts`, `src/components/Map/MapExplorer.tsx`, `src/components/Map/PostDialog.tsx`, `src/components/Map/CheckInDialog.tsx`, `src/components/Me/EditDialogs.tsx`, `src/lib/types.ts`, `src/app/globals.css`

---

### Distinguish featured activity sources
- **Source icons on featured cards**: nearby featured activity cards now show compact official/user source icons so scraped official events and user posts are easier to distinguish without adding text clutter.
**Files:** `src/components/Map/PopularCard.tsx`

---

### Refine map posting sheet details
- **Half-height form sheet**: publish activity and footprint forms now open as a true half-height sheet with a scrollable content area, while still supporting full expansion.
- **Softer form header**: posting sheet titles are smaller and lighter, status helper copy was removed, and the close button is more visible.
- **Compact category cards**: activity category cards are shorter with clearer selected states.
- **Purple placement anchor**: the draggable map anchor now uses the same purple tone as the publish action.
- **Upper anchor placement**: when opening publish or footprint placement, the map anchor now appears in the upper half of the map instead of the covered center area.
**Files:** `src/components/Map/BottomSheet.tsx`, `src/components/Map/PostDialog.tsx`, `src/components/Map/CheckInDialog.tsx`, `src/components/Map/markers.ts`, `src/components/Map/MapExplorer.tsx`

---

### Move map posting entry into toolbar
- **Centered toolbar publish button**: the map page no longer uses a separate floating plus button; posting now lives as a purple "发帖" action in the middle of the bottom map toolbar.
- **Reference-style publish drawer**: tapping "发帖" opens a bottom drawer for publishing an activity or leaving a footprint, above nearby activity cards.
- **Balanced bottom controls**: the bottom toolbar restores full width since it no longer needs to reserve space for the old floating publish button.
- **Visible secondary menus**: bottom toolbar overflow no longer clips the "更多" and "发帖" popover menus.
- **Higher menu layer and compact drawer**: the bottom toolbar now sits above nearby cards, and the publish drawer supports drag-to-dismiss with tighter, more distinct action cards.
- **Nearby drawer priority**: nearby activity drawers now sit above the toolbar by default, while the toolbar only raises above them when the "更多" menu is open.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/components/Map/PopularCard.tsx`

---

### Restyle posting sheets and date range picker
- **Reference-style sheets**: publish activity and footprint sheets now use larger titles, softer rounded fields, horizontal image strips, and stronger primary buttons matching the provided mobile form reference.
- **Activity category grid**: publish activity categories are presented as compact icon cards instead of small wrapping pills.
- **Single-line date range**: activity time range is now one calendar dropdown for selecting a date range, while preserving ISO start/end values for submission.
**Files:** `src/components/Map/BottomSheet.tsx`, `src/components/Map/PostDialog.tsx`, `src/components/Map/CheckInDialog.tsx`, `src/components/Map/DateRangeDropdown.tsx`

---

### Refine posting and check-in forms
- **Split post actions**: the floating post menu now shows two side-by-side actions, "publish activity" on the left and "publish footprint" on the right.
- **Hide coordinates**: post and footprint sheets no longer display raw latitude/longitude values while keeping draggable anchor repositioning.
- **Remove agreement copy**: posting forms remain free of user-agreement/privacy text until those documents exist.
**Files:** `src/components/Map/ActionFab.tsx`, `src/components/Map/PostDialog.tsx`, `src/components/Map/CheckInDialog.tsx`

---

### Default map actions to current location
- **Initial geolocation**: the map now tries to center on the user's current location on load unless an explicit target is supplied in the URL.
- **Post anchor default**: publish activity and footprint anchors now default to the current location when available.
- **Avoid FAB overlap**: the bottom map toolbar now reserves right-side space for the floating publish button.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/components/Map/ActionFab.tsx`

---

### Reduce map top-control overlap
- **Hide activity-count capsule**: removed the map top activity-count capsule so filter/date controls have more room.
- **Move weather control**: restored the weather button to the right-side control column area so it does not cover top filters or core map controls.
**Files:** `src/components/Map/Filters.tsx`, `src/components/Map/WeatherPanel.tsx`

---

### Convert map recommendation chips into AI intents
- **Remove fake counts**: "for you" recommendation chips no longer show static activity counts.
- **Intent-based guide entry**: tapping a recommendation chip now opens AI guide with nearby activity context and matching bottom actions such as route planning, activity picks, and rest/cafe suggestions.
- **Intent-aware drawer sorting**: nearby activity cards now immediately filter or reorder around the selected intent without leaving the map page.
**Files:** `src/components/Map/PopularCard.tsx`, `src/components/Map/MapExplorer.tsx`, `src/components/Guide/GuideChat.tsx`, `src/components/Guide/GuideContext.tsx`, `src/app/api/guide/route-plan/route.ts`

---

### Make nearby sheet drag follow the finger
- **Direct drag tracking**: nearby activity sheet now updates its transform immediately during pointer movement instead of waiting for an animation frame.
- **Release-only hiding**: the sheet follows the finger while dragging and only decides to snap back or hide after pointer release.
**Files:** `src/components/Map/PopularCard.tsx`

---

### Connect guide route prompt and map favorites
- **Guide-integrated route planning**: the nearby activity sheet now opens the existing AI guide with nearby activity context and a special route-planning option at the bottom.
- **Route result card**: the special route option now renders a structured route card inside AI guide chat, with numbered stops, route summary, estimated time, walk distance, and clickable stop details.
- **Cleaner map AI entry**: removed the separate map AI guide floating button so route planning starts from the nearby activity drawer.
- **Real favorite actions**: featured activity bookmark buttons and map popup favorite buttons now call the real `FAVORITE` reaction endpoint.
- **Image-first map popup cards**: map activity popups now include event cover images with a richer preview-card layout.
**Files:** `src/app/api/guide/route-plan/route.ts`, `src/lib/guideRoute.ts`, `src/components/Guide/GuideContext.tsx`, `src/components/Guide/GuideChat.tsx`, `src/components/Map/MapExplorer.tsx`, `src/components/Map/PopularCard.tsx`, `src/app/globals.css`

---

### Smooth nearby sheet dragging
- **Smoother drawer gesture**: nearby activity sheet dragging now uses requestAnimationFrame and direct transform updates instead of state updates on every pointer move.
- **Better release behavior**: small drags snap back smoothly, while longer downward drags animate closed without accidental tap-to-close.
**Files:** `src/components/Map/PopularCard.tsx`

---

### Restyle map page surface
- **Map top controls**: filter, activity count, date, and weather controls now use larger rounded white capsules with softer shadows.
- **Bottom map dock**: replaced the small pill controls with a reference-style icon dock for food, quick event filters, stations, and map options.
- **Nearby activity sheet**: expanded the drawer with a clearer header, radius hint, AI route entry, featured activity cards, and recommendation chips.
**Files:** `src/components/Map/Filters.tsx`, `src/components/Map/MapExplorer.tsx`, `src/components/Map/PopularCard.tsx`, `src/components/Map/WeatherPanel.tsx`

---

## 2026-06-26

### Add daily featured event carousel
- **LLM daily picks**: the daily extraction workflow now asks the LLM to mark up to five events starting today as `featuredToday` after ingestion.
- **Explore banner carousel**: the recommend page uses those featured events as a rotating hero banner, with a click/like/favorite fallback when no LLM picks exist.
- **Hide sparse metrics**: hot cards no longer show like/view counts while data volume is still low.
**Files:** `.github/workflows/extract.yml`, `src/services/extraction/featured.ts`, `src/services/extraction/index.ts`, `src/components/Recommend/RecommendList.tsx`, `src/app/recommend/page.tsx`, `src/services/events.ts`, `src/lib/types.ts`, `prisma/schema.prisma`, `prisma/migrations/20260626113000_add_event_featured_today/migration.sql`

---

### Strengthen calendar red-day markers
- **Red-day heatmap overlay**: holiday heatmap cells now include a rose bottom overlay band with the date number kept above it for clearer recognition.
**Files:** `src/components/Calendar/CalendarView.tsx`

---

### Smooth calendar heatmap gradient
- **Continuous heatmap color scale**: heatmap cells now compute an HSL color from each day's activity count relative to the month's maximum, giving gradual depth changes instead of coarse two-tone buckets.
- **Red days as overlay**: Japanese holidays keep visible red border/accent treatment while preserving the blue heat intensity underneath.
**Files:** `src/components/Calendar/CalendarView.tsx`

---

### Rebalance calendar heatmap colors
- **Dynamic heatmap baseline**: heatmap color levels now scale against the current month's maximum daily activity count, preventing most days from collapsing into the darkest color.
- **Stronger red-day treatment**: Japanese holidays now use a rose-tinted base, red border, inset accent, and larger holiday dot in the heatmap.
**Files:** `src/components/Calendar/CalendarView.tsx`

---

### Refine calendar date navigation and holidays
- **Default day strip positioning**: the horizontal date strip now scrolls the selected/today date into view on load and when the selected date changes.
- **Separate month and day navigation**: month switching moved to the month label area, while the right-side arrows now move the selected day backward/forward.
- **Restore Japanese red days**: holidays and Sundays are highlighted in the date strip and heatmap, with holiday dots and selected-day holiday text.
- **Compact heatmap cells**: reduced heatmap cell height and added stronger blue intensity levels so activity volume reads as a gradient instead of oversized date boxes.
- **Tighten drawer cards**: kept the in-progress nearby drawer padding/card-gap adjustment and further reduced event card width, image height, text padding, and title/meta spacing.
**Files:** `src/components/Calendar/CalendarView.tsx`, `src/components/Map/PopularCard.tsx`

---

### Tighten calendar and explore density
- **Calendar density pass**: compacted the calendar header/date strip, reduced whitespace, moved category filters into the top-right filter popup, and made search/filter affect the date strip, event list, and heatmap.
- **Calendar heatmap redesign**: replaced the simple dot grid with a weekday-aligned monthly heatmap using visible day cells and intensity levels.
- **Explore density pass**: compacted the explore header, hero banner, hot carousel, sticky tabs, and masonry cards so the page carries more content above the fold.
- **Real popularity metrics**: added `EventMetric` click tracking and server-side aggregation of like/favorite/signup/click counts for curated and hot ranking, removing fake want-to-go counts.
- **Explore interactions**: fixed hot "view all" to reset filters and scroll to the full feed; opening an event now records a click metric.
**Files:** `src/components/Calendar/CalendarView.tsx`, `src/components/Recommend/RecommendList.tsx`, `src/app/recommend/page.tsx`, `src/app/api/events/[id]/click/route.ts`, `src/lib/types.ts`, `prisma/schema.prisma`, `prisma/migrations/20260626103000_add_event_metrics/migration.sql`

---

### Fix map drawer filtering and layering
- **Enable drawer category filtering**: nearby/anchor drawer category pills now filter the visible event cards, with an all-state reset.
- **Tune drawer visual details**: reduced panel radius, card width, title size, badge text size, and softened shadows to better match the reference.
- **Place post FAB below drawer**: lowered the map action FAB z-index so the plus button does not sit above the activity drawer.
**Files:** `src/components/Map/PopularCard.tsx`, `src/components/Map/ActionFab.tsx`

---

### Refine map drawer interaction
- **Restore map control position**: moved map style, food, landmark, and station controls back to their original bottom-left placement.
- **Add drag-down collapse**: the nearby/anchor activity drawer handle now follows a downward drag and collapses when released past the threshold.
**Files:** `src/components/Map/MapExplorer.tsx`, `src/components/Map/PopularCard.tsx`

---

### Redesign map, calendar, and explore pages
- **Map nearby activity sheet**: `PopularCard` now uses a rounded bottom sheet with category pills, horizontal event cards, distance/venue metadata, view-all, and collapsed states.
- **Map control spacing**: moved map style, food, landmark, and station controls upward so they do not collide with the new bottom sheet.
- **Calendar visual refresh**: added page header, month switcher card, horizontal date strip, event timeline card, and monthly heatmap while keeping category filters and detail dialogs.
- **Explore feed refresh**: added page header, search/filter buttons, hero event, weekly hot carousel, pill filters, and softer masonry cards while preserving search, date filters, official/user tabs, and detail routing.
- **Bottom nav polish**: changed labels to map/calendar/explore/mine semantics and added a blue circular active icon state.
**Files:** `src/components/Map/PopularCard.tsx`, `src/components/Map/MapExplorer.tsx`, `src/components/Calendar/CalendarView.tsx`, `src/components/Recommend/RecommendList.tsx`, `src/components/BottomNav.tsx`

---

### 缩小心情标签选择器

- **标签改回轻量 badge**：发布/编辑足迹的心情选择从大卡片改为小号圆角 badge，不再显示编号。
- **布局一行三个**：心情标签固定三列显示，icon 在文字前方，减少表单占用高度。
- **选中态更像标签**：选中后使用对应心情色系、圆角胶囊和轻微描边，保留多选逻辑。

**涉及文件：** `src/components/common/MoodSelector.tsx`

---

### 优化个人页 Tab 与分组信息

- **Tab 改为参考图样式**：个人页主 tab 从胶囊按钮改为文字标签 + 蓝色下划线，去掉足迹、发帖、收藏上的数字，仅消息保留未读徽标。
- **足迹统计缩小**：足迹统计卡片压缩尺寸，降低首屏视觉占用。
- **月份分割更醒目**：月份分组标题加大、加粗并增加底部分割线，让时间线层级更清楚。

**涉及文件：** `src/components/Me/MeView.tsx`

---

### 按设计稿重做心情标签

- **标签库扩展到 40 个**：按照参考方案补齐基础心情与补充心情，覆盖平静、开心、心动、治愈、兴奋、松弛、新鲜、惊喜、想再来、怀念、疲惫、低落、EMO、焦虑、孤独、释然，以及满足、期待、感动、充实、压力大、纠结、伤心、自我怀疑、麻木等状态。
- **线性 icon 风格统一**：为 40 个心情配置低饱和双色系线性图标，保留编号、主标签和副文案。
- **选择器卡片化**：发布/编辑足迹中的心情选择改为编号 + icon + 主副文案的小卡片；默认展示 3 个，展开后展示完整 40 个。
- **数据校验同步**：`moodTags` 服务端合法范围从 1-16 扩展为 1-40。

**涉及文件：** `src/lib/moods.tsx`、`src/components/common/MoodSelector.tsx`、`src/services/checkins.ts`

---

### 调整个人页时间线与照片墙

- **隐藏顶部照片墙**：个人页资料卡下方的照片拼图暂时不渲染，减少首屏占用。
- **时间线贴近参考设计**：足迹列表改为左侧日期/星期/时间列，右侧竖线节点与内容流，不再给每条足迹套独立卡片。
- **图片展示收敛**：足迹图片仍保留大图预览，但单图限制最大高度，避免动态流被图片撑得过高。

**涉及文件：** `src/components/Me/MeView.tsx`

---

### 收紧个人卡片并扩展心情选择

- **个人资料卡变紧凑**：降低个人页顶部资料卡高度，缩小头像、姓名和状态胶囊尺寸，让首屏更多内容露出。
- **资料区重心上移**：右上角菜单改为悬浮定位，不再占用顶部排版空间；头像放大并上移，减少封面上部留白。
- **资料操作收纳**：将“编辑资料 / 登出”收进右上角三横菜单，默认只显示一个二级菜单入口。
- **心情标签扩展**：心情从 10 个扩展为 16 个，加入疲惫、低落、EMO、焦虑、孤独、释然等非正面状态。
- **心情支持多选**：发布/编辑足迹时可同时选择多个心情标签，最多 6 个；个人页和地图足迹弹窗会展示全部已选心情。
- **心情选择折叠**：发布/编辑足迹表单默认只显示 3 个心情标签，其余通过“更多心情”展开；编辑旧足迹时如果当前心情在折叠区，会优先展示已选标签。
- **数据结构升级**：新增 `CheckIn.moodTags` 数组字段保存多选心情，并用旧 `rating` 回填历史数据；`rating` 继续保存第一个心情值作为兼容字段。

**涉及文件：** `prisma/schema.prisma`、`prisma/migrations/20260626072000_add_checkin_mood_tags/migration.sql`、`src/components/Me/ProfileHeader.tsx`、`src/components/common/MoodSelector.tsx`、`src/lib/moods.tsx`、`src/services/checkins.ts`、`src/app/api/checkins/route.ts`、`src/app/api/checkins/[id]/route.ts`

---

### 改善个人页视觉与心情标签

- **个人页头图升级**：将资料区改为更接近参考图的封面卡片风格，使用大封面、暗色渐层、浮层头像、状态胶囊和常住地胶囊，提升信息层级与氛围感。
- **心情从评分改为标签选择**：新增 10 个心情标签（平静、治愈、开心、心动、兴奋、松弛、新鲜、怀念、惊喜、想再来）及线性 icon；新增/编辑足迹共用同一套标签选择器。
- **足迹展示同步**：个人页足迹列表改用心情标签展示，并放大图片卡片；地图足迹弹窗也显示标签名，不再使用 1-5 爱心评分文案。
- **兼容数据结构**：继续复用 `rating` 数字字段保存心情标签值，服务端校验范围从 1-5 扩展为 1-10，避免数据库迁移。

**涉及文件：** `src/components/Me/ProfileHeader.tsx`、`src/components/Me/MeView.tsx`、`src/components/Me/EditDialogs.tsx`、`src/components/Map/CheckInDialog.tsx`、`src/components/Map/MapExplorer.tsx`、`src/components/common/MoodSelector.tsx`、`src/lib/moods.tsx`、`src/services/checkins.ts`

---

### 提高 INS 风人物出镜比例并扩展地点池

- **人物出镜比例提高**：模拟决策 prompt 调整为 INS 风生活博主视角，建议约 45% 主观环境/物品、35% 倒影/定时器/三脚架/手机放置延时/自然 pose、20% 朋友帮拍/合照；图片规则同步允许更高频率的合理出镜。
- **时尚与手部细节增强**：配图规则要求穿搭、妆发和配饰更贴近东京 INS 风生活博主；减少拿手机拍照动作，允许自然 pose；手部特写强调年轻女性手部比例、肤质和指甲细节，避免粗糙、过大或男性化。
- **地点不再硬限于 `PERSONA_SPOTS`**：`personaSpots()` 改为从 `homeArea / frequentAreas / explorationAreas` 派生候选点，并叠加原 `PERSONA_SPOTS` 锚点；没有精确坐标的区域会生成稳定近似坐标，避免角色长期只在几个硬编码场地活动。
- **文档同步**：`docs/demo-personas.md` 说明 `PERSONA_SPOTS` 只是锚点，实际模拟地点来自 V2 区域偏好与探索区域。

**涉及文件：** `src/services/simulation/decide.ts`、`src/services/simulation/image.ts`、`src/lib/personas.ts`、`docs/demo-personas.md`

---

### 调整模拟配图出镜比例

- **从“少出镜”改为“自然比例”**：决策 prompt 明确独自行动时约 70% 为主观环境/物品画面，约 20% 可用自拍、倒影、定时器、三脚架或手机放置延时拍，约 10% 为朋友帮拍/合照。
- **合理出镜触发人物参考图**：`image.ts` 补充定时器、三脚架、手机放桌上/地上等关键词，允许合理的独自出镜场景加载 PersonaV2 参考图；同时避免每张都像第三者跟拍肖像。
- **QA 改为检查拍摄方式是否合理**：不再简单压制出镜，而是判断自拍/倒影/定时器/三脚架/手机放置/朋友拍摄是否成立；无解释的第三人称肖像和不合理双手 POV 才判失败。

**涉及文件：** `src/services/simulation/decide.ts`、`src/services/simulation/image.ts`、`src/services/simulation/imageQA.ts`、`docs/demo-personas.md`

---

### 修正模拟配图第一人称视角

- **避免“他拍误区”**：非 `pro` 角色的配图规则改为主角作为拍摄者，优先生成环境、物品、餐桌、票根、街景、舞台、车窗等主观画面；除非文案明确自拍、合照、朋友帮拍、背影、侧脸、镜子或倒影，否则不让发帖人正面出镜。
- **人物参考图条件化**：`image.ts` 仅在明确需要主角入镜时加载 PersonaV2 参考图，避免 img2img 把发帖人强行塞进每张图。
- **第一人称手部规则**：决策 prompt、生成约束和 QA 都新增“POV 最多一只手入镜”规则；除非自拍、镜子、定时器、三脚架或朋友拍摄明确成立，否则两只手同时清晰入镜会被视为不合理。

**涉及文件：** `src/services/simulation/image.ts`、`src/services/simulation/imageQA.ts`、`src/services/simulation/decide.ts`、`docs/demo-personas.md`

---

### 收紧模拟配图质检与胶片风格

- **图片 QA 更严格**：`imageQA.ts` 重写质检标准，手部/手指/肢体畸形、塑料皮肤、蜡像脸、过度磨皮、过度锐化、HDR 过强、摄影棚光、网红大片感等都作为不合格硬伤，失败时要求改进 prompt 点名修正。
- **生图规则强化真实感**：`image.ts` 增加 natural hands and anatomy、documentary smartphone photo、35mm consumer film snapshot、Fujifilm Superia 色彩、柔和高光、镜头软度等约束，并显式禁止畸形手、融合手指、扭曲手腕和不合理持物。
- **默认重试更严谨**：`IMAGE_QA_RETRIES` 默认值从 1 提高到 2，`.env.example` 同步更新；`docs/demo-personas.md` 补充胶片风格和质检规则。

**涉及文件：** `src/services/simulation/imageQA.ts`、`src/services/simulation/image.ts`、`docs/demo-personas.md`、`.env.example`

---

### 足迹创建表单移除时间输入

- **创建足迹默认使用提交时间**：`CheckInDialog` 移除“到访时间”字段，用户创建足迹时不再手动选择时间；`MapExplorer` 提交足迹时也不再发送 `visitedAt`，服务端沿用 `CheckIn.createdAt` 默认值。
- **保留虚拟人物时间入口**：服务端 `createCheckin` 仍支持 `visitedAt`，`simulation/engine.ts` 继续传入虚拟日期生成的 `when.toISOString()`，虚拟人物足迹不会被真实当前时间覆盖。

**涉及文件：** `src/components/Map/CheckInDialog.tsx`、`src/components/Map/MapExplorer.tsx`

---

### 修复个人页状态文字截断

- **个人信息卡状态支持两行显示**：`ProfileHeader` 中用户状态从单行 `truncate` 改为两行 `line-clamp-2` 与自动断词，避免 PersonaV2 较长当前目标在个人页显示不全。

**涉及文件：** `src/components/Me/ProfileHeader.tsx`

---

### 调整 PersonaV2 头像居中裁剪

- **头像裁剪改为手工定位**：`scripts/crop-avatars.ts` 从自动 `attention` 裁剪改为 13 组逐人方形裁剪参数，避免背景、相机、宠物、甜点等元素把头像重心带偏。
- **重新生成头像资源**：更新 `public/avatars/persona-v2/01.png ... 13.png`，让登录页和用户头像里的脸部更接近圆形头像中心。

**涉及文件：** `scripts/crop-avatars.ts`、`public/avatars/persona-v2/*`

---

### 登录页 demo 用户改为数据库读取 + PersonaV2 头像裁剪

- **一键登录列表改为数据库数据**：`GET /api/auth/demo` 会确保 PersonaV2 的 13 个 demo 用户存在，并按 PersonaV2 顺序返回数据库里的公开用户资料；登录页不再直接 import 静态 `DEMO_USERS`，而是在客户端加载真实数据库用户。
- **头像改为 PersonaV2 方形裁剪**：新增 `scripts/crop-avatars.ts` 和 `npm run crop:avatars`，从 `public/refs/01.png ... 13.png` 裁出适合圆形头像显示的 `public/avatars/persona-v2/01.png ... 13.png`。
- **数据库头像已同步**：`DEMO_USERS.avatarUrl` 改为 `/avatars/persona-v2/xx.png`，并已执行 `npm run sync:demo-users`，结果为 13 个用户更新、13 条角色状态写入、16 组朋友关系确认。

**涉及文件：** `src/components/Auth/AuthForm.tsx`、`src/app/api/auth/demo/route.ts`、`src/services/users.ts`、`src/lib/demoUsers.ts`、`scripts/crop-avatars.ts`、`public/avatars/persona-v2/*`、`package.json`

---

### 同步数据库 demo 人物到 PersonaV2

- **demo 用户资料改为 V2 派生**：`src/lib/demoUsers.ts` 不再维护旧 12 人硬编码列表，改为从 `PERSONAS` 自动生成 13 个 demo 用户的用户名、签名、常驻地、状态、封面和 `/refs/xx.png` 头像。
- **新增数据库同步脚本**：`scripts/sync-demo-users.ts` 会 upsert PersonaV2 的 demo 用户资料、`CharacterState` 情绪/目标/人生阶段，并补齐 V2 朋友关系；`package.json` 新增 `npm run sync:demo-users`。
- **已执行同步**：本地数据库本次同步结果为 7 个用户新建、6 个用户更新、13 条角色状态写入、16 组朋友关系确认。旧版 demo 用户未自动删除，避免误删已有历史内容。

**涉及文件：** `src/lib/demoUsers.ts`、`scripts/sync-demo-users.ts`、`package.json`

---

### 恢复 demo-personas 生图细则

- **恢复完整生图规则**：将旧版 `docs/demo-personas.md` 中的配图目标、人物一致性、摄影能力、图片主体类型、`containsPoster`、镜头类型、出镜优先级、拍摄意图、东京地点库、不完美细节库、配图频率、基础 prompt、最终原则和防 AI 味规则合并回 V2 手册。
- **适配 PersonaV2 表述**：旧规则中的 `public/person.png/refIndex/12人` 表述改为 `public/personV2.png`、`public/refs/01.png ... 13.png` 和 `personaRefIndex()`，并补充 C13 与 V2 的 `photoSkill` 角色分组。

**涉及文件：** `docs/demo-personas.md`

---

### PersonaV2 标准化迁移 + sim-run 调用链适配

- **人物模型以 `PersonaV2` 为准**：`src/lib/personas.ts` 移除旧 `Persona` 类型消费路径，新增 V2 派生函数：`personaGoals`、`personaLifeStageText`、`personaInterestList`、`personaVoiceText`、`personaSpots`、`personaRefIndex`、`personaById`。数据库 `CharacterState.goals/lifeStage` 继续作为运行态快照，由 V2 派生写入。
- **模拟调用链迁移**：`scripts/sim-run.ts` 调用到的 `engine/decide/image/signature/lifeEvents/memory/community` 已改为消费 V2 字段或派生函数，不再读取旧 `job/home/roam/conflict/refIndex`。`sim-init` 会把 V2 目标与人生阶段写成当前 Prisma schema 需要的形状；`sim-inspect` 展示 `occupation`。
- **关系与地点适配**：`friends` 中的 `Cxx` 角色 ID 会通过 `friendPairs()` 映射为用户名关系对；每个角色新增至少 5 个 `personaSpots()` 坐标候选点，供打卡与 LLM 决策使用。
- **视觉参考图升级**：`REF_SHEET` 指向 `public/personV2.png`，`scripts/crop-refs.ts` 从 13 人设定卡裁剪 `public/refs/01.png` 至 `13.png`；`image.ts` 通过 `personaRefIndex()` 加载对应参考图。
- **文档同步**：`docs/demo-personas.md` 重写为 PersonaV2 手册，记录 13 人列表、派生函数、`sim-run` 主链路、图片规则和动态维护模块。
- **项目规则**：`AGENTS.md` 新增约定，之后每次完成代码或内容改动都要同步记录到 `CHANGELOG.md`，并自动创建 git commit。
- **验证**：`npx.cmd tsc --noEmit` 通过；V2 烟测确认 `PERSONAS.length=13`、每人至少 5 个坐标候选点、`friendPairs()` 可生成用户名关系对。全量 `npm run lint` 仍有既存 React lint 规则问题，已修复模拟链路 touched 文件中的 `useAnthropic` hook 命名误判。

**涉及文件：** `src/lib/personas.ts`、`docs/demo-personas.md`、`scripts/{crop-refs,sim-init,sim-inspect}.ts`、`src/services/simulation/{engine,decide,image,signature,lifeEvents,memory,community}.ts`、`public/refs/*`、`AGENTS.md`

---

## 2026-06-23

### 像素级锁脸（person.png 图参）+ 调高配图比例 + 清空重灌脚本

- **像素级锁脸**：装 `sharp`，`scripts/crop-refs.ts` 把 `public/person.png`(1536×1024，6×2) 裁成 12 张单人参考图 `public/refs/01.png…12.png`（取每格中间图形带，去名牌/规格文字）。`image.ts` 出图时按 `persona.refIndex` 载入对应参考图，作为 **Agnes `extra_body.image`（img2img）** 传入 → **把该人物放进新场景、锁定脸/外观**（已实测：美咲 脸与设定图一致、场景为全新代官山咖啡馆抓拍）。Gemini 也支持（inlineData）。
  - 取舍：img2img 下**穿搭会倾向参考图**那套；脸锁定是硬目标（已达成），穿搭变化是软目标（prompt 仍推动，不同场景会变但可能偏向设定图）。
- **调高配图比例**：决策提示由「仅重要瞬间配图」改为「**大部分有场景/画面感的足迹都配图（约 2/3）**，只有很私人/琐碎/无画面的才不配」。
- **清空重灌脚本**：`scripts/sim-reset.ts`（默认干跑打印将删数量，`--yes` 才执行）——只清 demo 12 人的内容(足迹/发帖/评论/点赞)与模拟状态(记忆/状态/关系/世界)，并把 status/signature 重置为初始值；**保留账号/头像**。重灌流程：`sim-reset --yes → seed-demo → sim-init → sim-run --from=2026-02-01 --to=<今天>`。

**涉及文件：** `scripts/crop-refs.ts`、`scripts/sim-reset.ts`、`public/refs/*`、`src/services/simulation/image.ts`、`src/services/simulation/decide.ts`

---

### 社区模拟 V7 · Phase 3c：情绪稳态 + 重大人生事件

- **情绪稳态**（`community.ts` `relaxEmotions`，每日，规则化）：把各角色情绪向「基线」缓慢回归（基线维度→`emotionBaseline`，临时情绪→中性 50，每天 15%），消除长期累积出的极端/矛盾（如 sadness 与 excitement 同时拉满）。实测情绪已回到合理区间。
- **重大人生事件**（`lifeEvents.ts`，每月 1 日，每人 ~12% 概率）：罕见、有意义、有后果。按类型（成就/职业/成长/挫折/生活变动/感情——感情极低）加权选一，LLM 据人物+最近经历生成一条 MILESTONE 记忆 + 刷新当前状态 +（可选）新增目标。实测：悠斗（孤独/有钱没时间）触发「意识到月租 15 万的公寓没人能带回 → 想换个热闹点的地方住」，贴人设、不狗血。
- 维护摘要新增「情绪回归 N · 人生事件 N」；`sim-inspect` 记忆标注 里程碑/摘要。

**待办（Phase 3d）**：角色间评论/八卦/恋爱（需先给 sim 加发帖生成，评论才有挂载点）。

**涉及文件：** `src/services/simulation/{lifeEvents,community,engine}.ts`、`scripts/sim-inspect.ts`

---

### 配图 prompt 改由 LLM 撰写（专业详细）+ 附加生图规则

- 生成图前先用 **LLM 写一段专业、详细的英文场景 prompt**（主体/动作、构图景别、前后景层次、光线质感、镜头/景深、环境道具、氛围；60~110 词），再**附加我们的「生图规则」**`[Constraints]`（主观/客观视角、写实压 AI 感、表情自然不夸张、亚洲年轻人在东京、外观一致、无文字水印）。
- `image.ts`：新增 `scenePromptLLM`(provider 感知 DeepSeek/Claude) + `buildRules` + `composePrompt`（场景 + 规则；LLM 失败回退 photoDesc+规则）。`generateCheckinImage` 改用 `composePrompt`；QA 重生成时也附加规则。
- 实测：LLM 产出的 prompt 画面层次/光线/景深描述明显更专业，规则块完整附加；出图质量与人设外观一致性明显更好（如 美咲 雨中二楼咖啡馆、米色自然系穿搭一致）。
- **健壮性**：给出图/质检/上传的网络请求加超时（`fetchT`，出图 120s、质检 60s、上传 60s、写 prompt 45s）——某次请求卡住即放弃该步、优雅降级，避免拖死整段回填或每日 workflow。

**涉及文件：** `src/services/simulation/image.ts`、`src/services/simulation/imageQA.ts`

---

### 配图视觉质检闭环（不合格自动改 prompt 重生成）

- **`imageQA.ts`**：用 Agnes 多模态 chat（`agnes-2.0-flash`，已实测可读图）「看」生成图，按四条标准判合格（符合画面意图 / 像真人手机随手拍无 AI 感 / 表情自然不夸张不畸形 / 无文字水印），不合格则产出「改进版英文 prompt」。
- **`generateCheckinImage` 改为闭环**：生成 → 质检 → 不合格用改进 prompt 重生成（默认重试 1 次）→ 仍不过则保留最后一张兜底 → 上传 Cloudinary。Provider 接口改为接受最终 prompt 字符串（buildPrompt 移到上层编排）。
- 开关：`IMAGE_QA`(默认开，置 false 省钱)、`IMAGE_QA_RETRIES`(默认 1)、`IMAGE_QA_MODEL`(默认 agnes-2.0-flash)。
- 实测：质检能挑出 AI 感（「皮肤过光滑、透视生硬、虚化不自然」）并给出改进 prompt；端到端重生成的图表情自然、纪实感强。
- 注意：开 QA 后每张图成本/耗时约翻倍（多一次看图 + 可能一次重生成），批量回填可按需关闭。

**涉及文件：** `src/services/simulation/{image,imageQA}.ts`、`.env.example`

---

### 配图 prompt 调优：压「AI 感」+ 表情自然不夸张

- 据 Agnes 文档（无负向提示/guidance 参数，写实度全靠 prompt）重写 `buildPrompt`：强调「手机随手拍 / 自然肌理与瑕疵 / 真实柔光」，并显式 **避免 CGI·3D·过锐·油光皮肤·戏剧打光·影棚摆拍**；人物 **表情自然克制、不摆拍、不夸张笑容**。
- 实测(居酒屋碰杯场景)：表情自然、纪实感明显增强、AI 味下降。
- 记录：Agnes `image: string[]`(参考图/img2img) 在 `extra_body` 内——后续可裁 `person.png` 单人图作图参强化人脸一致性（待装 sharp）。

**涉及文件：** `src/services/simulation/image.ts`

---

### 社区模拟 V7 · Phase 4 配图打通（Agnes，端到端实测）

- **接入 Agnes**（OpenAI images 兼容，已实测）：`POST <base>/images/generations`（Bearer 鉴权），`{model: agnes-image-2.1-flash, prompt, n, size}` → `data[0].url`。`image.ts` 的 `AgnesProvider` 据此精确接入（base 自动补 `/images/generations`）。
- **端到端验证**：模拟 2026-06-27 → 3 条「值得配图」的足迹各生成图 → 上传 Cloudinary（`res.cloudinary.com/.../cloudfootprints`）→ 回填 `photoUrls`。出图质量在线：主观镜头、场景精准（目黑川散步 / 代代木公园野餐 / 浅草摊位）、亚洲年轻人 + 东京感、写实非网红风，与人设穿搭一致。
- 默认仍 `IMAGE_PROVIDER=none`（不烧钱）；本地切 `agnes` 即出图。`.env.example` 更新 Agnes/Gemini 用法。

> 提醒：回填 Feb→现在会对每条配图足迹各生成 1 张（约每张十几秒 + 上传），量大耗时；建议先小段验证质量再批量。

---

### 社区模拟 V7 · Phase 4：人物配图管线（ImageProvider 抽象）

把"生活"转成生活化照片的管线（接口先行、provider 可替换；外部生成 API 待你确认后接入）。

- **决策层标注配图**：`decide.ts` 的 post 新增 `photo`(是否值得配图，仅有画面感/重要瞬间) + `photoDesc`(一句话画面描述，默认主观镜头)。琐碎日常不配图。
- **`image.ts` 统一管线**：`ImageProvider` 接口 + `getImageProvider()`（按 `IMAGE_PROVIDER` env 选）；`buildPrompt` 据 **personas.appearance（以 `public/person.png` 为外观基准）+ photoSkill 视角（casual/hobby 主观手机镜头、pro 客观构图）+ 画面描述 + 季节天气** 拼写实 prompt；生成图统一 `persistToCloudinary`（服务端抓取，自带 CORS）。
- **provider**：`none`（默认）/ **`gemini`（Google Gemini 2.5 Flash Image，已接入）** / `agnes`（备选）。任何失败→不出图、绝不打断模拟。
  - Gemini：鉴权 `x-goog-api-key` 头（已实测确认），图片在 `candidates[0].content.parts[].inlineData`(base64) → 转 data URI → 上传 Cloudinary。
- **引擎接入**：足迹发布后若 `photo` 为真且 provider 启用 → 生成 → 上传 → 回填 `photoUrls`。
- 已实测 `IMAGE_PROVIDER=none` 与 `=gemini` 下推演均照常、不报错；`.env.example` 补充配图相关变量（gemini/agnes）。

**待办**：Gemini key 已接、鉴权确认，但所给账户**额度耗尽(429 RESOURCE_EXHAUSTED)**——AI Studio 充值/开通 billing 后即可真正出图（管线无需再改）。后续增强：以 `person.png` 单人裁切作 Gemini 图参，强化人脸一致性（需图像库）。

**涉及文件：** `src/services/simulation/{decide,engine,image}.ts`、`.env.example`

---

### 社区模拟 V7 · Phase 3b：系统外熟人 + 动态签名/状态

- **系统外熟人（cast）**：社交关系不限于 12 个 App 用户——`CharacterState` 加 `cast`(jsonb `[{name,relation}]`)记录角色现实里反复出现的人（室友/同事/老乡/店主/家人/陌生人）。决策时把 cast 喂回提示，鼓励自然带入、保持连续（"又见到那个…"），并把当天出现的人回写名册（最近优先、去重、最多 8 人）。实测 ケンジ 形成「高円寺横丁拉面店老板」并跨天复现。
- **动态签名/状态**：`signature.ts` 按最近记忆+情绪+人生阶段刷新——`status`(近况)每周一刷新近一周活跃角色、`signature`(个性签名)每月 1 日刷新近两周活跃角色。直接写 `prisma.user`（仅改目标字段，**不经 `updateProfile`** 以免把头像/封面置 null）。
- 维护摘要新增「状态刷新 N / 签名刷新 N」；`sim-inspect` 展示当前 status/signature + 系统外熟人名册。
- schema：`CharacterState.cast` 列（`prisma db push`，非破坏性）。

**涉及文件：** `prisma/schema.prisma`、`src/services/simulation/{decide,engine,signature}.ts`、`scripts/sim-inspect.ts`

---

### 社区模拟 V7 · Phase 3：关系动态 + 社区平衡 + 记忆压缩

在每日推演后加「维护」层，让社区「连接、成长、不失联」。仅在真跑 + 全员 + 当天有动作时触发（子集/dry/幂等重跑不触发）。

- **关系动态**（`relationships.ts`，每日，规则化零 LLM）：同一天都活跃的弱连接朋友 → 强度 +2/情感 +1；超过 14 天没互动 → 强度缓慢 -1。实测成长与衰减并存（如 葵↔小林ゆい 15→18，葵↔たけし 久不互动→12）。
- **社区平衡**（`community.ts`，每周一，规则化）：超过 7 天没活跃的角色 excitement +15，抬高其参与度让其回归，避免有人长期消失。
- **记忆压缩**（`memory.ts`，每月 1 日，LLM）：把 45 天前的一批零碎 EVENT 记忆压成 1 条「生活摘要」(SUMMARY) 并删原件——省 token，且制造「最近迷上手冲」这类成长叙事。回填 Feb→现在时按真实月份自然触发。
- 触发节奏内嵌 `engine.simulateDay`（按日期星期/月初判定），回填一段时也会建立关系/平衡/压缩。`sim-run` 输出每天追加维护摘要（如 `关系+4/-7 · 社区唤醒2`）。

**涉及文件：** `src/services/simulation/{relationships,community,memory,engine}.ts`、`scripts/sim-run.ts`

---

### 模拟质量抽查脚本

- `scripts/sim-inspect.ts`：打印人物的状态(情绪/目标/人生阶段/最后活跃) + 记忆(★重要度、足迹/推演来源) + 最近足迹(♥心情、📷配图) + 关系。`npx tsx scripts/sim-inspect.ts <用户名> [--mem=N]`；不传名字=全员概览(记忆/足迹条数+最后活跃)。回填后抽查推演连续性/口吻用。

**涉及文件：** `scripts/sim-inspect.ts`

---

### 社区模拟 V7 · Phase 2：每日推演引擎（记忆驱动→内容）

把 Phase 1 的地基跑起来：角色「过日子→形成记忆→按概率才产内容」，内容是副产物（非 `prompt→帖子`）。

- **World Agent**（`src/services/simulation/world.ts`）：规则化生成当天东京状态（季节/天气/城市情绪/热点），按日期可复现、零 LLM、落 `WorldState`。
- **角色决策**（`decide.ts`）：provider 感知（DeepSeek JSON / Claude tool use），输入人物档案 + 当前情绪/目标/人生阶段 + 最近记忆 + 最近足迹（防重复）+ 世界状态，输出当天记忆 + 情绪微调 + 可选足迹（地点从据点清单选）。提示内置内容分布(日常 40%…)、情绪比例、防 AI 味、笔触口吻。
- **引擎**（`engine.ts`）：每人「参与度掷点」（外向/情绪决定，0.2–0.75，平淡日不调 LLM）→ 决策 → 写 `Memory` + 可选 `CheckIn`（坐标落据点 + 轻微抖动、时间为当天）+ 更新 `CharacterState` 情绪/活跃。**幂等**：当天已模拟的角色自动跳过，可断点续跑。
- **运行入口**：`scripts/sim-run.ts`（`--date` / `--from --to` 回填 / `--only` / `--dry` 干跑）；`/api/simulate`（cron 端点，`CRON_SECRET` 保护，跑「今天」）。
- 实测：模拟 2026-06-20 单日 → 12 人中 5 人参与、产 3 条足迹，内容贴合人物口吻与当天世界状态（夏季闷热/花火热点）；重跑同日全部跳过（幂等）。

**每日定时（已配置）**：`.github/workflows/simulate.yml`，每日 03:30 JST 跑当天全员（复用 extract 的 `DATABASE_URL`/`LLM_API_KEY` secret）；手动触发可传 `date` 或 `from`+`to` 做回填。
**待办（需你来跑）**：Feb→现在回填——本地 `npx tsx scripts/sim-run.ts --from=2026-02-01 --to=<今天>`，或在 Actions 页手动触发 simulate 填 `from/to`（约数百次 DeepSeek 调用、幂等可分段）。

**涉及文件：** `src/services/simulation/{world,decide,engine}.ts`、`scripts/sim-run.ts`、`src/app/api/simulate/route.ts`、`.github/workflows/simulate.yml`

---

### 人物外观一致性基准（角色设定图）

- 收录 `public/person.png`（12 人角色设定图：正/背全身 + 年龄/职业/身高/体型/穿衣风格），作为**人物长相的唯一标准**，防止后续推演中外观漂移。
- `src/lib/personas.ts` 每人新增 `refIndex`（设定图编号 1–12）+ `appearance`（可识别外观摘要：发型/体型/惯常穿衣/气质）+ `REF_SHEET` 常量。
- 规则写入 `docs/demo-personas.md` 配图规则与 `DECISIONS.md`：任何人物出镜/生成图片都以设定图为准；Phase 4 Image Agent 以其为外观参考。

**涉及文件：** `public/person.png`、`src/lib/personas.ts`、`docs/demo-personas.md`、`DECISIONS.md`

---

### 社区模拟 V7 · Phase 1：记忆/状态/关系地基（无 AI）

把 12 个 demo 账号从「静态测试数据」往「有记忆、会演化的社区」推进第一步（设计见 `docs/Agent_Architecture.md`）。本期纯工程、不调 Claude、可回滚。

- **新增 4 张模拟状态表**（`prisma db push`，非破坏性，仅加表）：`Memory`（记忆，含类型/重要度/发生时间/衰减/溯源）、`CharacterState`（情绪 jsonb/目标/人生阶段）、`Relationship`（弱连接，强度/情感，规范化唯一）、`WorldState`（每天东京状态）。`User` 加对应反向关系。
- **`src/lib/personas.ts`**：12 人「机器可读」结构化档案（性格分值/情绪基线/目标/据点与活动坐标/笔触/弱连接/`photoSkill`），作为各 Agent 的 Layer-2 事实源；`SIM_EPOCH = 2026-02-01`。
- **`scripts/sim-init.ts`**（幂等回填）：现有足迹 → 初始 `Memory`、按 persona 初始化 `CharacterState`、按 friends 建 `Relationship`。已执行入库：**12 人状态 / 57 条记忆 / 13 对关系**。
- **配图视角规则**：`docs/demo-personas.md` 配图规则新增——日常照片默认**主观镜头**（手机随手拍），仅摄影强者（`photoSkill=pro/hobby`）出「作品」时用客观构图。
- 时间线决定：已有内容算「最近几个月」，Feb→现在的内容与每日推演留待 Phase 2。

**涉及文件：** `prisma/schema.prisma`、`src/lib/personas.ts`、`scripts/sim-init.ts`、`docs/demo-personas.md`、`DECISIONS.md`

---

### 新增人物种子内容补配图（不再全是文字）

- 给新 7 人的足迹/发帖补**内容匹配**的主题配图（跑步 / 健身 / 足球 / 温泉 / 电影 / 甜品 / 海岸 / 居酒屋 / 图书馆 / 键盘 / 城市夜等），Unsplash 主题图均 `curl` 验证 200、经 Cloudinary 服务端抓取托管（`scripts/seed-demo.ts` 新增 `EXTRA` 配图表）。每人 2~4 张：有画面感的瞬间配图，琐碎日常（加班/洗衣/emo）不配。
- `docs/demo-personas.md` 新增「配图规则」：内容不要全文字，CheckIn 约半数配图、Post 尽量配封面；图须真实可加载、场景匹配、近期不重复，找不到可靠图宁可不配。
- 已重跑 seed 入库：12 篇发帖 9 篇有 Cloudinary 封面，足迹配图正常。

**涉及文件：** `scripts/seed-demo.ts`、`docs/demo-personas.md`

---

### 用户发帖不受地理范围限制 + 人物动态签名规则

- **范围抽取只限官方活动**：`getEventsInBounds` 原来对官方 `Event` 和用户 `Post` 都加了矩形范围过滤。改为**只有官方活动受 bbox 限制**（数据量大，控性能/流量）；**用户发帖全量返回、不限地理范围** —— 镰仓/箱根等东京 bbox 之外的用户发帖现在也能出现在推荐/日历/地图（实测遥的镰仓帖已可见，官方活动仍无越界）。
- **人物动态签名/状态规则**：`docs/demo-personas.md` 新增「签名与状态（动态更新）」章节 —— 人物会随当前人生状态/情绪不定时更新 `status`（勤，几天~两周）与 `signature`（缓，数周~数月），含更新规则、每人演变示例、落库方式（`updateProfile`，且 `ensureDemoUser` 不覆盖签名）。

**涉及文件：** `src/services/events.ts`、`docs/demo-personas.md`

---

### Demo 社区扩到 12 人 + 人物模拟手册改版 V5

- **`docs/demo-personas.md` 重写**为「模拟人生」框架（V5.1）：核心原则「人生状态＞情绪＞事件＞兴趣」，含内容分布/情绪比例/时间线/地理/动态成长/防 AI 味等规则；12 人**统一档案结构**（基础信息·性格·人生阶段·最大矛盾·兴趣·常见情绪·据点坐标·笔触口吻）+ 落库指引。
- **`src/lib/demoUsers.ts`：5 人 → 12 人**。保留 さくら/ケンジ/美咲/小林ゆい/たけし，新增 麻衣/陸/葵/悠斗/七海/遥/翔太。新 7 人暂无头像图 → `avatarUrl:""` 走「用户名首字母圆底」回退；封面用 6 张莫奈预设循环。
- **`scripts/seed-demo.ts`**：改用 `ensureDemoUser` **自动按 demoUsers 定义创建**（无需先手动登录），并为新 7 人各灌 5 条足迹 + 1 条发帖（遵循新规则：日常为主、含情绪起伏、时间线连续，暂不配图）。已执行入库，12 人各就位、登录页一键登录列表完整。

**涉及文件：** `docs/demo-personas.md`、`src/lib/demoUsers.ts`、`scripts/seed-demo.ts`

---

### 新增 5 个测试账号的人物角色 Prompt 文档

- `docs/demo-personas.md`：给 5 个 demo 账号（さくら / ケンジ / 小林ゆい / たけし / 美咲）写详细人设 prompt —— 每人含可直接复制的 **System Prompt**、活动半径坐标、语气/评分/emoji 习惯、既有足迹范例、人物关系网，外加通用输出字段规范与长期模拟节奏建议。
- 人设与 `src/lib/demoUsers.ts`、`scripts/seed-demo.ts` 既有种子数据一致，用于长期模拟 5 人在 App 的足迹/发帖/评论。

**涉及文件：** `docs/demo-personas.md`（新）

---

### 时间筛选改日历图标 + 弹层层级修复 + 二级字体调细

- **图标**：时间筛选由漏斗图标换成**日历图标**（更贴合"时间"语义）。
- **弹层被遮 bug**：时间筛选弹层原来会被下方二级菜单盖住。给一级菜单行加 `z-20`（含其内的弹层），弹层提到 `z-40`，现在弹层完整浮在二级菜单之上。
- **二级字体调细**：推荐页/日历页二级 tab 字重整体降一档（选中 `semibold→medium`，未选 `medium→normal`），观感更轻。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`、`src/components/Calendar/CalendarView.tsx`

---

### 修复推荐页二级菜单滚动时反复闪烁

- **现象**：发现/活动页滑动时，二级菜单有时一直闪烁（收起↔展开横跳）。
- **根因**：收/展会改变顶栏高度 → 浏览器 clamp `scrollTop` → 再次触发 `scroll`，被误判成反方向滑动，形成反馈循环。
- **修复**：状态切换后**短暂上锁 380ms**（覆盖过渡时长），锁内只跟随 `scrollTop`、不再判定方向；方向阈值由 ±6 提到 ±10；用 `secondaryVisibleRef` 镜像状态避免重复 `setState`。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`

---

### 推荐页顶部改版（仿小红书顶栏）+ 日历页筛选精简

**推荐页顶部：**
- 去掉「中午好…」问候行；顶栏**贴合屏幕顶部**（去容器顶部留白）。
- 一级菜单「活动 / 发现」居中，切换**不放大字号**，仅加粗 + 变黑 + 蓝色短下划线；右侧常驻「漏斗(时间筛选) + 搜索」两个无边框图标（漏斗移到一级行，弹层不受二级收起影响）。
- 一级 / 二级之间加分割线；**二级底部不再有分割线**。
- 二级分类由圆角 chip 改为**横滑文字 tab**（保留分类图标 + 选中用分类色下划线）。
- 二级菜单**随滚动方向显隐**：下滑收起、上滑 / 回顶展开（监听最近可滚动祖先的 scroll，方向判定 ±6px、近顶 <48px 恒展开），给列表更多空间。

**日历页：**
- 分类筛选改为同款横滑文字 tab；去掉独占一行的「全部来源/官方/个人」来源筛选与清单来源徽标，筛选区只剩分类一行，不再拥挤。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`、`src/components/Calendar/CalendarView.tsx`、`src/app/recommend/page.tsx`

---

### 推荐页一级菜单「活动/发现」+ 地图官方/个人 icon 角标

- **推荐页顶部一级菜单**（仿小红书）：新增「活动 / 发现」两个一级 tab（居中下划线高亮）。「活动」只放官方抓取数据（`Event` 表），「发现」只放个人用户发帖（`Post` 表 → `sourceType=USER`）。原分类筛选**降为二级**横滑标签。数据本就在客户端（两表合并的 `EventDTO[]`），切 tab 仅前端按 `sourceType` 分流、即时无请求。
- **去掉来源标记**：一级 tab 已按来源分流，故移除卡片上的「官方/个人」徽标 + 漏斗里的来源筛选项（漏斗只剩时间）。计数随 tab 显示「N 场活动」/「N 篇分享」，空态文案区分（发现态引导去地图发布）。
- **地图官方/个人区分增强**：原来只靠描边色（白/琥珀）区分，不够明显。个人发帖点改为叠加**右上角琥珀人形角标**（新 symbol 层 `event-userbadge`，filter `sourceType=USER`，`icon-offset` 定位右上），一眼可辨；导航隐藏活动图层时一并隐藏。地图弹窗内的来源文字徽标保留（点开才见的确认信息）。
- 数据层未动：官方/个人本就分表（`Event`/`Post`），读取合并为 `EventDTO` 按 `sourceType` 区分。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`、`src/components/Map/MapExplorer.tsx`

---

## 2026-06-22

### 推荐页问候行 + 足迹评分改「心情值」（爱心）

- **推荐页顶部问候行**：去标题后顶部偏空，补一行轻量问候——按时段「早上好/下午好/晚上好…」+ 日期（客户端 mount 后计算，避免水合告警），右侧「东京 · N 场活动」。
- **足迹「五星评分」→「心情值」（爱心）**：图标由星形换成爱心，保留琥珀金配色（#f59e0b，与足迹主题色统一），文案「评分」→「心情」。覆盖：地图发布表单（打卡）、编辑足迹、地图足迹弹窗（`心情 ♥♥♥♡♡`）、个人页足迹列表。
  - 顺带把**地图发布按钮菜单**的「足迹·我来过」图标、**个人页足迹 Tab/相册占位**图标一并换成爱心。
  - 注：美食名店的星级评分（餐厅评分，非心情）保持星形不变。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`、`src/components/Map/CheckInDialog.tsx`、`src/components/Me/EditDialogs.tsx`、`src/components/Map/MapExplorer.tsx`、`src/components/Map/ActionFab.tsx`、`src/components/Me/MeView.tsx`、`src/app/globals.css`

---

### 去掉推荐页大标题 + 异步操作加等待反馈

- **去标题**：移除推荐页「推荐 · 今天去哪」大标题，吸顶标签栏直接置顶，内容区更大更清爽。
- **操作等待反馈**：异步操作过程中不再「画面定住、无反馈」。
  - 通用 `ConfirmDialog` 的确认按钮支持 `onConfirm` 返回 Promise：执行期间按钮显示加载转圈 +「处理中…」并禁用两个按钮、屏蔽背景点击，完成后才关闭。覆盖个人页 / 地图弹窗的删除发帖、删除足迹。
  - 评论删除（`EventDetail`）：按钮在请求中显示「删除中…」并禁用，防重复点击。

**涉及文件：** `src/app/recommend/page.tsx`、`src/components/common/ConfirmDialog.tsx`、`src/components/Me/MeView.tsx`、`src/components/Map/MapExplorer.tsx`、`src/components/Recommend/EventDetail.tsx`

---

### 推荐页顶部精简（仿社区 App：滑动标签 + 搜索/筛选图标）

- 顶部从 3 行压到 1 行：左侧**横向滑动的分类标签**（全部/展览/市集…，sticky 吸顶），右侧两个圆形图标。
- **搜索**：默认只显示放大镜图标；点击后整行切换为搜索输入框（自动聚焦）+「取消」，下方浮出「猜你想搜」；有搜索词时图标高亮。
- **时间 + 来源**收进**漏斗**弹层（点击展开，外部点击关闭，含「重置」）；有筛选时图标右上角显红点。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`

---

### 官方/个人来源区分 + 测试数据配图改用 Cloudinary

- **官方活动 vs 个人发帖区分**（仅 UI，无需改数据结构；约定 `sourceType === "USER"` 为个人发帖）：
  - 新增共享组件 `src/components/common/EventSource.tsx`（来源徽标 `SourceBadge` + 来源筛选 `SourceFilter`）。
  - **推荐页 / 日历页**：新增「全部来源 / 官方 / 个人」筛选；卡片/清单加来源徽标（官方=天蓝✓、个人=琥珀👤）。
  - **地图**：活动弹窗加来源徽标；个人发帖的标记改用**琥珀色粗描边**（官方仍为白边）以区分。
- **测试数据配图修复**：原 `picsum.photos` 外链被网络拦截、加载不出。改为给每条日记配**内容匹配**的真实主题图（Unsplash，逐一验证可达：咖啡日记配咖啡、live 配演出、祭典配神轿、古着配复古衣架等），通过 **Cloudinary unsigned upload（远程 URL 抓取）** 托管，得到自带 CORS 的 `res.cloudinary.com` 链接（列表/弹窗/个人页/地图缩略图均可显示）。脚本含降级：upload 失败时直接用源图 URL。
  - 🐞 **修正本地 `.env` 的 Cloudinary 配置**：原值 cloud=`Root`、preset=`825924217519448`（后者实为 API Key），均不可用，导致本地打卡/发帖上传与种子脚本上传全部失败（线上 Vercel 配置正常，故仅本地受影响）。已更正为正确的 cloud name 与 unsigned 预设名；种子图已全部迁入 Cloudinary。（`.env` 不入库，值不在此记录。）

**涉及文件：** `src/components/common/EventSource.tsx`、`src/components/Recommend/RecommendList.tsx`、`src/components/Calendar/CalendarView.tsx`、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`、`scripts/seed-demo.ts`

---

### 测试账号真人化数据 + 筛选整理 + 地图照片放大

- **测试账号填充**：给 5 个 demo 账号（さくら/ケンジ/小林ゆい/たけし/美咲）按各自人设灌入日记式足迹（22 条，真实地点坐标、跨多周时间线、部分配图）+ 在地图的发帖（5 条，含封面）。脚本 `scripts/seed-demo.ts` 可重复执行（每次先清旧再重灌）。
- **足迹路线移入筛选**：把底部的「足迹路线」开关移进左上角筛选面板（底部按钮太挤），筛选面板新增「清除全部」一键重置（分类/时间/只看我的/足迹路线）。
- **地图照片放大**：有照片的足迹缩略图标记按 `hasPhoto` 数据驱动放大（icon-size 0.72→1.35），脚印保持原大小。

**涉及文件：** `scripts/seed-demo.ts`、`src/components/Map/Filters.tsx`、`src/components/Map/MapExplorer.tsx`

---

### 足迹丰富化（统计/分组 + 弹窗 + 轨迹线 + 照片标记）

- **个人页足迹**：顶部加统计卡（足迹数 / 照片数 / 活跃天数），列表按「年-月」分组（每组「X年X月 · N 处」），照片放大。
- **足迹弹窗**：加「第 N 个足迹」徽标 + 星期几（按时间正序编号）。
- **足迹轨迹线**：把足迹按时间在地图上连成柔和琥珀虚线；底部控件加「足迹路线」开关（默认关）。
- **照片缩略图标记**：有照片的足迹在地图上用圆形照片缩略图标记（canvas 圆裁 + 白环，`addImage`；跨域失败回退脚印，加载完成前先显脚印/琥珀圆兜底）；无照片仍用梅花脚印。

**涉及文件：** `src/components/Map/MapExplorer.tsx`、`src/components/Me/MeView.tsx`、`src/app/globals.css`

---

### 地图足迹弹窗隐藏删除（删除只留个人页）

- 地图上足迹弹窗去掉「删除足迹」按钮，避免地图上误删；删除统一在个人页「足迹」列表里操作。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

### 个人页足迹可跳转定位到地图

- 个人页「足迹」每条加「在地图」按钮，点击跳到地图页并定位到该足迹坐标（复用已有的 `/?lat=&lng=` jump-to-map，地图 `flyTo` zoom 16）。

**涉及文件：** `src/components/Me/MeView.tsx`

---

### 足迹卡片显示图片（多图左右滑动）

- 地图上点足迹弹出的卡片原来只有文字。现加**照片**：多图横向**滑动切换**(CSS scroll-snap，原生触屏/触控板滑动)，右上角「N/总数」随滑动更新，点图开大图(Lightbox)。
- 卡片信息整理：标题/时间/关联活动/评分(★)/备注/删除，统一卡片样式。`checkinsToFC` 把 `photoUrls` 一并带进地图源。

**涉及文件：** `src/components/Map/MapExplorer.tsx`、`src/app/globals.css`、`src/app/api/checkins/route.ts`

---

### 地图活动卡片操作优化（分色 pill + 图标）

- 地图上活动弹窗卡片底部一排操作原来是挤在一起的同色小文字链，辨识度低。改为**带图标的分色 pill**：详情（蓝色实心）、导航（蓝色浅底）、问导游（紫色浅底），各有图标、一眼可分；底部 `flex-wrap` 不再拥挤。
- **来源**按用户要求保持低调文字链；**删除**仍为红色、右对齐。
- 修复弹窗出现纵向滚动条时操作行变窄换行的问题：操作行改 `nowrap` + 不收缩，挤不下则整行横向滚动（隐藏滚动条），不再换行。

**涉及文件：** `src/components/Map/MapExplorer.tsx`、`src/app/globals.css`

---

## 2026-06-20

### 头像统一 + 活动分享 + 「打卡」改「足迹」(梅花脚印)

- **头像统一**：抽出共享 `components/common/Avatar`（有图显图、否则首字母圆底）。修复**消息回复页**、**登录页快速登录按钮**只显示首字母不显示头像的问题；`EventDetail` 改用共享组件去重。
- **分享功能**：`EventDetail` 加「分享」按钮（`components/common/ShareButton`）——优先系统分享面板(`navigator.share`，手机可直接分享到 LINE/X 等)，不支持则弹回退菜单(X / LINE / Facebook / 复制链接)。分享链接为活动深链 `/recommend?event=<id>`。
- **「打卡」改「足迹」**：全站用户可见文案 打卡→足迹（FAB、个人页 tab、足迹弹窗、对话框、提示等；「打卡时间」→「到访时间」「打卡」按钮→「留下足迹」）；保留代码标识 `CheckIn`。
- **地图图标换梅花脚印**：足迹点的白色对勾(√)换成**小猫梅花脚印**(大肉垫 + 四脚趾，canvas 绘制)。

**涉及文件：** `src/components/common/{Avatar,ShareButton}.tsx`(新)、`src/components/Me/{MeView,EditDialogs}.tsx`、`src/components/Recommend/EventDetail.tsx`、`src/components/Map/{MapExplorer,ActionFab,CheckInDialog}.tsx`、`src/components/Auth/AuthForm.tsx`

---

### 换乘导航扩展到活动/店铺/景点（坐标端点接驳）

- 导航不再限于车站到车站：**活动卡片、美食弹窗、名胜弹窗都加了「导航」**入口，把该地点作为终点（也可作起点）。
- 路由引擎支持**坐标端点**：任意地点(POI)自动**就近接驳最近车站 + 步行段**(`accessWalk`/`egressWalk`)，再跑图路由；起/终点任意组合(站↔站 / 站↔POI / POI↔POI)。
- `RoutePanel` 端点可为车站(搜名)或地点(POI 芯片，可清除改为搜站)；详情时间线含首尾步行段(距离/分钟/钟点)。
- `/api/route` 兼容车站名(`fromStation`/`toStation`)与坐标(`fromLat/Lng/Name`…)。

**涉及文件：** `src/services/routePlanner.ts`、`src/app/api/route/route.ts`、`src/components/Map/{RoutePanel,MapExplorer}.tsx`、`src/app/globals.css`

---

### 换乘导航增强：起点可改 + 可收起 + 每站时刻 + 导航时隐藏活动

- **起/终点都可改**：面板里起点也成了搜索框（原来固定为点进来的站），加「互换」按钮。
- **可收起**：面板可收成底部一条概要（起→终 · 约X分 · 换乘N），地图折线保留，便于看图；可再展开。
- **每站预计时刻**：路由引擎给每站算出距出发的累计分钟（`offsets`，按相邻站实距推算）；面板按「首段 ODPT 下一班发车」(无则按现在时间)锚定，逐站显示预计钟点 — JR 等无时刻表的线也有（推算）。
- **导航时隐藏活动**：打开导航面板即隐藏地图上的活动聚合/单点/标注图层，关闭恢复，避免画面太乱。

**涉及文件：** `src/services/routePlanner.ts`、`src/components/Map/RoutePanel.tsx`、`src/components/Map/MapExplorer.tsx`

---

### 换乘导航（连通图路由）

- 车站卡片新增「从这导航」→ `RoutePanel`：搜目的车站 → 给出**换乘方案**（推荐 / 少换乘），含**总耗时估算 + 换乘次数 + 逐段线路**（乘哪条线、从哪到哪几站、何处换乘/步行换乘）。
- **路由引擎** `services/routePlanner.ts`：用 `public/lines.json`(139 线有序站点) + `public/stations.json`(坐标) 建图——节点=(线,站)，同线相邻站连乘车边（**按相邻站实距算耗时**，避免特急少站被低估）、同名站连换乘边、<320m 不同站连**步行换乘**边；跑 Dijkstra（二叉堆），出最优 + 高换乘惩罚的少换乘两套，去重。图进程内缓存（首次 ~0.5s，之后 <20ms）。`/api/route?from=&to=`。
- **地图画折线**：选中方案在地图上按线路色画出全程折线（白色描边垫底）并缩放到全程。
- **叠加 ODPT 下一班**：方案首段若是有时刻表的线（Metro/都营等），显示该线在起点站的下一班发车。

**涉及文件：** `src/services/routePlanner.ts`(新)、`src/app/api/route/route.ts`(新)、`src/components/Map/RoutePanel.tsx`(新)、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`

---

### 测试用户头像（日系动漫）

- 给 5 个测试账号配头像。先尝试 DiceBear（欧美卡通，不符合需求），改为用户提供的**日系动漫整图**裁成 5 张方形头像（按人设分配：さくら=知性长发 / ケンジ=冷感乱发 / ゆい=短发鲍勃 / たけし=沉稳 / 美咲=暖笑长棕发），存 `public/avatars/*.png`（256×256，已删除旧 DiceBear svg 与源整图）。
- `DemoUser` 加 `avatarUrl`，`ensureDemoUser` 在创建时设置、对已存在账号同步（与 coverUrl 同样的"固定形象"逻辑）。已对现有 5 个 demo 行回填。

**涉及文件：** `public/avatars/{sakura,kenji,yui,takeshi,misaki}.svg`(新)、`src/lib/demoUsers.ts`、`src/services/users.ts`

---

### 用户最后登录时间

- `User` 表加 `lastLoginAt`（可空），在 `createSession` 里更新（登录 / 快速登录 / 注册建立会话时都记录，失败不影响登录）。
- `PublicUser`/`PUBLIC_SELECT`/`toPublicUser` 统一加该字段并序列化为 ISO 字符串（lib/auth 单一来源，`services/users` 复用，去掉重复 select）；`AuthUser` 同步加字段。
- 个人页资料卡（`ProfileHeader`）原展示「最后登录 · X」，**后改为不在界面显示**（字段仍照常记录，仅不展示）。

**涉及文件：** `prisma/schema.prisma`、`src/lib/auth.ts`、`src/services/users.ts`、`src/components/Auth/AuthContext.tsx`、`src/components/Me/ProfileHeader.tsx`

---

## 2026-06-19

### 线路详情：点击站点高亮所选站

- 在线路详情面板点某站定位地图时，给该站一个 **active 高亮**（线路色调背景），逐站时刻列表与全程站点图都支持，便于看清当前选的是哪站。

---

### 修复线路详情面板被天气按钮遮挡

- 线路详情面板原 `z-[80]`，天气按钮是 `z-[999]`，面板被按钮压住。把面板提到 `z-[1000]`（与全屏 AI 导游同级，二者不同时出现）盖住天气按钮。
- 顺手删除合并后已无引用的 `TrainTimetablePanel.tsx`（逐站时刻已内联进 `LinePanel`）。

**涉及文件：** `src/components/Map/LinePanel.tsx`、删除 `TrainTimetablePanel.tsx`

---

### 时刻表提速 + 方向点击切换 + 站点点击定位（不关面板）

- **提速**：原来取本站时刻表会**串行**拉该站所有运营商(如新宿~11家)的大表，很慢。现 `/api/station-timetable` 支持 `line=` 只查点进来那条线对应的车站（≈11→1 个请求），且各站请求改**并行**；去掉调试 `console.log`。新宿实测 466ms→**101ms**（约 4.6×）。
- **行进方向点击切换**（恢复旧做法）：面板里「往 X 方面 · 点击切换方向」按钮，发车时刻**只显示当前方向**；默认选「最近一班所在方向」。
- **点击站点在地图定位**（恢复）：逐站列表/站点图里点任一站 → 地图飞到该站，**不再关闭线路详情页**（面板是底部 sheet，地图在上方可见）。

**涉及文件：** `src/services/odpt.ts`、`src/app/api/station-timetable/route.ts`、`src/components/Map/{LinePanel,MapExplorer}.tsx`

---

### 线路面板重做：顶部选发车时刻 + 主体逐站时刻 + 实时列车位置

- 点车站卡片某线路 → 面板**只针对这一条线**（换线退出重选，去掉了顶部线路切换）。
- **顶部 = 发车时刻可选**（该线本站各方向的近几班，合并按时间排序，**默认选最近一班**）。
- **主体 = 选中那班车的逐站时刻**（即该线站点表，右侧到/发时刻，标【当前】站）；顶部换时刻 → 主体时刻随之更新。
- **实时列车位置**：都営等提供 `odpt:Train` 的线，把当前在跑的列车标在站点表上——在区间的标在两站之间「行驶中(+延误)」，停靠中的标在该站「在站」。Metro/JR 无实时位置数据则不显示。新增 `/api/train-positions`。
- 无 ODPT 时刻表的线（JR/大私铁）退回显示线路全程站点图（无时刻）。

**涉及文件：** `src/components/Map/LinePanel.tsx`（重写）、`src/services/odpt.ts`、`src/app/api/train-positions/route.ts`(新)、`src/app/api/station-timetable/route.ts`(加 n 参数)、`src/components/Map/MapExplorer.tsx`

---

### 时刻表与线路详情合并为一个面板

- 点车站卡片里**任意线路 chip** → 打开整合面板：**默认显示该线在本站的「下一班」时刻**（含运行情况 + 点某班车看逐站时刻）。
- **顶部 tab 切换本站其它线路**（横向滚动）；OSM 没收录但 ODPT 有时刻表的线路（如都営新宿線）也会补成 tab，避免漏。
- 面板内「下一班 / 全程」子切换：**全程**= 原线路站点图（有序站点、切换方向、标【当前】站、点击飞到该站）。
- 移除原来单独的「时刻表」按钮（已并入线路点击）；删除独立 `TimetablePanel`，其渲染并入 `LinePanel`。OSM 线名↔ODPT 线路按名称互相包含匹配。

**涉及文件：** `src/components/Map/LinePanel.tsx`（重写）、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`、删除 `TimetablePanel.tsx`

---

### 时刻表覆盖说明改准

- 实测确认 ODPT 时刻表覆盖很窄：**仅 东京Metro/都营/临海线/海鸥线/多摩单轨**有数据；JR(东/东海)及小田急/京王/东急/京急/西武/东武/京成等大私铁的 StationTimetable 与 TrainTimetable **都为 0**（ODPT 后台也无申请入口，是数据未公开而非权限）。空状态提示从"需单独申请"改为如实说明覆盖范围。

---

### 时刻表加刷新按钮

- 车站时刻表 / 单列车逐站表面板头部都加了**刷新按钮**（转圈图标，加载时旋转）。刷新时保留已有内容、不闪空白，仅头部图标转动。车站时刻表刷新会重算「下一班」+ 拉最新运行情况。

---

### 时刻表小调整：逐站时间右置 + 修按钮样式

- 逐站时刻表里**到达/发车时间移到每行右侧**（原来挤在轨道左侧），轨道+站名在左、时间在右，更清晰。
- 修车站卡片「时刻表」按钮样式（图标与文字未对齐/换行显得崩）：两个按钮统一 `inline-flex` 居中 + `line-height:1` + `nowrap`，SVG 固定尺寸。
- 确认 **JR 时刻表 ODPT 完全没有**：`TrainTimetable?operator=JR-East` 与 `?railway=JR-East.Yamanote` 均为 0 条（换 TrainTimetable 也拿不到，非接口问题）。

---

### 时刻表增强：逐站时刻 + 运行情况 + 去 emoji

- **点某班车看逐站时刻**：时刻表里每个发车时间可点 → 弹 `TrainTimetablePanel`，显示该班车停靠的全部站点及各站到/发时刻（ODPT `odpt:TrainTimetable`，真实排点而非估算），并标出【当前】站、滚动到它。`StationTimetable` 的发车带 `odpt:train`，据此拉 `odpt:TrainTimetable`；逐站站名按线路缓存 `odpt:Station` 解析（含直通别线）。新增 `/api/train-timetable`。
- **运行情况**：每条线路显示 ODPT `odpt:TrainInformation`（運行情報）——正常显示绿点「运行正常」，异常显示橙点 + 原文（如延误/见合わせ）。各社「正常」措辞不同（Metro「平常どおり」/都营「遅延はありません」）做了归一。运行情报缓存 90s（实时）。
- **去 emoji**：车站卡片「时刻表」按钮的 🕑 换成线性 SVG 时钟图标。

**涉及文件：** `src/services/odpt.ts`、`src/app/api/train-timetable/route.ts`(新)、`src/components/Map/TrainTimetablePanel.tsx`(新)、`src/components/Map/{TimetablePanel,MapExplorer}.tsx`

---

### 车站时刻表（ODPT 接入）

- 点车站卡片新增「🕑 时刻表」按钮 → 底部 `TimetablePanel` 展示该站各线路/方向的**下一班发车时刻**（实时按当前东京时间算，最近一班高亮）。
- 数据源 **ODPT 公共交通开放数据中心**（`ODPT_API_KEY` 存 `.env`，不提交）：`services/odpt.ts` 按站名查 `odpt:Station`（坐标就近过滤同名站）→ `odpt:StationTimetable` → 按今天运行日历(平日/周末)挑方向算下一班 → 按线路/方向分组。方向/种别/线路名用 ODPT 小词表 `dc:title`，进程内缓存（词表 24h、时刻表按站 6h）。
- 覆盖 JR东日本/东京 Metro/都营及多家私铁；未接入 ODPT 的私铁站返回空并提示。节假日精确判定（目前按周末近似）、实时延误留待后续。

**涉及文件：** `src/services/odpt.ts`(新)、`src/app/api/station-timetable/route.ts`(新)、`src/components/Map/TimetablePanel.tsx`(新)、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`、`.env.example`

---

### 线路详情面板标记【当前】车站

- 点开车站卡片里的线路 chip 看线路全站点时，把**你点进来的那个车站**标出来：站点行加【当前】徽标、圆点放大填色、文字加粗 + 浅色底，并自动滚动到它居中。
- 把进入面板时的当前站名经 `openLinePanel(detail, 当前站名)` 传给 `LinePanel`（新增 `currentStation` 入参）。起点/终点徽标改为中性灰，让【当前】更突出。
- （撤掉上一版在地图上加的琥珀色圆圈高亮——不好看，按用户本意改为面板内标记。）

**涉及文件：** `src/components/Map/{MapExplorer,LinePanel}.tsx`

---

## 2026-06-18

### 修复 GitHub Actions 每日抓取 yarn install 失败（Node 20 → 22）

- **现象**：`每日活动数据更新` workflow 的 `yarn install --frozen-lockfile` 报错 `@prisma/streams-local@0.1.2: The engine "node" is incompatible with this module. Expected version ">=22.0.0". Got "20.20.2"`，job 退出码 1。
- **原因**：升级到 Prisma 7 后，其传递依赖 `@prisma/streams-local` 要求 Node ≥22；而 workflow 的 `setup-node@v4` 仍固定 `node-version: "20"`。
- **修复**：`extract.yml` 的 Node 版本 `20` → `22`。

**涉及文件：** `.github/workflows/extract.yml`

---

## 2026-06-17

### 用户发帖与官方活动分表（Post / Event）

- **动机**：抓取的官方活动（只读、带来源元数据）与用户发帖（可编辑/删除、带作者、可多图/报名）混在一张 `Event` 表里，职责不清。拆成两表。
- **Schema**：新增 `Post` 表（用户发帖：title/description/category/venueName/imageUrl(s)/lat/lng/起止时间/tags/signupEnabled/userId）。`Event` 去掉发帖专属列（userId/tags/signupEnabled/imageUrls），只留官方抓取字段。
- **互动多态**：`Comment`/`Reaction`/`CheckIn` 改为 `eventId` 与 `postId` 二选一（各自级联删除）；`Reaction` 新增 `@@unique([userId, postId, type])`。service 用 `resolveTarget(id)` 判 id 属哪张表（两表 id 全局唯一），前端仍只传一个 id、无需区分。
- **读路径合并**：`getEventsInBounds`/`getEventById`/收藏/报名列表把 Event + Post 并起来统一成 `NormalizedEvent`（Post 映射 `sourceType="USER"`、`trustLevel=10`），DTO 形状不变 → **前端零改动**（地图 mineOnly 过滤、删除按钮等仍按 sourceType 判断）。
- **数据迁移**：`scripts/split-posts.ts` 把现有 `Event(sourceType=USER)` 行搬到 `Post`（复用同一 id，旧深链/外键无缝），评论/点赞/打卡改指 `postId`，再删旧行。已迁移 1 条发帖（作者「美咲」、报名状态保留）。
- **验证**：350=349 官方+1 发帖；按 id 取发帖详情、两类目标的评论/点赞 GET 与登录后 POST 均正常，无报错。

**涉及文件：** `prisma/schema.prisma`、`scripts/split-posts.ts`(新)、`src/services/{events,reactions,comments,checkins,replies}.ts`

---

### 推荐页加搜索框 + 推荐搜索词

- **搜索框**：推荐页顶部新增搜索框（放大镜 + 占位 + 清空按钮），客户端实时过滤——匹配 标题/场馆/地址/简介/描述/分类名/标签。改类别/日期/搜索词都重置懒加载分页。
- **推荐搜索词**：搜索框下「猜你想搜：」一排可点 chip，数据驱动（统计全部活动 `displayTags` 频次取 Top 8），点选即填入搜索。仅未输入时展示。
- 无结果时文案区分：搜索态「没有匹配「X」的活动」、否则「该分类下暂无活动」。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`

---

### 推荐页瀑布流修复（少量条目）+ 推荐搜索词限单行可展开

- **瀑布流分列改 JS 轮询**：原用 CSS `columns-2/3` 多列，条目少时（如搜索后只剩 2 条）会都挤进左列、右列空着。改为按列数（手机 2、≥640px 3，`matchMedia` 响应）把卡片**轮询分配到各列**（item i → 第 i%列），2 条也左右各一、铺满。
- **推荐搜索词单行**：默认只显示前 4 个 + 「更多」（`flex-nowrap overflow-hidden` 强制单行），点「更多」展开全部（`flex-wrap`）、「收起」折回。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`

---

### 修复：地图点活动详情有时只到推荐页、不打开详情

- **现象**：从地图弹窗点「查看详情」跳 `/recommend?event=<id>`，部分活动只停在推荐页、详情抽屉不弹。
- **根因**：推荐页给 `RecommendList` 的 `events` 是**子集**——过滤掉已过期活动、限定固定 `TOKYO_BBOX`、ISR 缓存 1h。地图能点任意活动，一旦不在子集里 `events.find` 命中不了 → 不打开。
- **修复**：`RecommendList` 读 `?event=` 时若列表里找不到，**直接 `GET /api/events/[id]` 按 id 拉取该活动**再打开抽屉，不再依赖它是否已在列表中。已用过期活动验证（之前打不开、现可正常弹详情）。
- **去除闪烁**：拉取期间会先闪一下推荐列表再进详情。改用 **isomorphic layout effect** 在浏览器绘制前同步解析 `?event=`——从地图点详情（客户端导航）时，全屏「加载详情…」遮罩在列表绘制前就盖上，拉到后直接换成详情抽屉，不再闪列表。用 layout/`useEffect` 分环境避免 SSR 警告，无 hydration 不一致。

**涉及文件：** `src/components/Recommend/RecommendList.tsx`

---

### 车站卡片样式修复 + 点击线路看全站点/方向

- **卡片样式**：车站弹窗之前用 `tem-food-popup` 类导致容器透明、内容散乱。新增独立 `.tem-st` 容器（浅天蓝渐变底 + padding + 圆角 + 固定宽）与 `tem-station-popup` 弹窗类（透明外壳 + 阴影 + 尖角配色）；AI 按钮改用天蓝渐变 `.tem-st-ask`。
- **线路详情数据**：`scripts/enrich-station-lines.ts` 复用同一批 OSM route 关系，额外生成 `public/lines.json`——每条线路保留**有序站点序列**（取最长方向变体），含名称/代码/品牌色/是否地铁。139 条线路。
- **点击线路**：车站卡片里有详情的线路 chip 变为可点按钮（右侧 `›`）。点击弹出底部 `LinePanel`：彩色时间轴列出全部站点、可一键切换方向（正/反序，标注「往 X 方面」）、点站点地图飞行定位并标起点/终点。
- **时刻表**：OSM 无时刻表数据，留待后续接入 ODPT（公共交通开放数据中心，需人工注册 API key）——见 DECISIONS。

**涉及文件：** `scripts/enrich-station-lines.ts`、`public/lines.json`(新)、`src/components/Map/LinePanel.tsx`(新)、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`

---

## 2026-06-16

### 车站点击详情：线路 + 简介

- **线路数据**：`scripts/enrich-station-lines.ts` 从 OSM route 关系取线路名+品牌色，补进 `public/stations.json`（按线路代码 JY/M/OH 过滤真线路、清方向/服务/「列車」前缀、按代码+名双重去重）。1188/1361 站带线路。
- **点击弹窗**：点车站弹卡片——站名(中/EN) + 类型(地铁/电车站) + 一句简介(N 条线路经过…) + 各线路彩色圆点+名称 + 「问 AI 导游」。
- **AI 导游**：新增 `station` kind，快捷问题（换乘去景点 / 周边吃喝 / 附近活动），上下文带上经过线路。

**涉及文件：** `scripts/enrich-station-lines.ts`、`public/stations.json`、`src/components/Map/MapExplorer.tsx`、`src/components/Guide/{GuideContext,GuideChat}.tsx`、`src/app/globals.css`

---

### 地图控件布局调整 + 图标替换 emoji

- 左下控件改为两层：上=底图风格（标准/柔和），下=美食 / 景点 / 车站 一排。
- 三个按钮的 emoji（🍜🏯🚉）换成线性 SVG 图标（叉勺 / 鸟居 / 电车），与整体描边风格统一。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

### 车站配色更显眼 + 修复底部控件被 FAB 遮挡

- **车站配色**：普通铁路由石板灰改为 JR 绿 `#16a34a`、地铁靛蓝 `#4f46e5`，图标加大（icon-size 0.52→0.85、半径 11.5）。
- **底部控件**：左下控件行加了「车站」后变长，被右下发帖 FAB 遮住「美食」。改为 `right-20` 留出 FAB 空间 + `flex-wrap` 换行，控件不再被遮（浏览器实测美食按钮恢复可见）。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

### 地图新增电车 / 地铁站层

- **数据**：`scripts/import-stations.ts` 从 OSM(Overpass) 抓首都圈 `railway=station` → `public/stations.json`（1361 站，含 266 地铁；按名+~500m 去重）。静态文件前端一次性加载，无需数据库/分视野。
- **地图层**：`setupStations` 加 `station-icon` 符号层——地铁靛蓝/普通铁路石板灰图标 + 站名标签，`minzoom 13`；图标 `allow-overlap` 始终显示（定位锚点），层级置于景点/美食之上、活动之下，避免被密集 POI 盖住。
- **开关**：左下角新增「🚉 车站」按钮（持久化 `tem_show_stations`，默认开）。
- 浏览器实测：缩放到 13+，有楽町/銀座/東銀座/銀座一丁目 等站正常显示。

**涉及文件：** `scripts/import-stations.ts`、`public/stations.json`、`src/components/Map/MapExplorer.tsx`

---

### AI 导游：每轮回答都带「猜你接下来想问」

之前只有首轮回答带后续问题建议，多轮追问后 suggestions 变空（复现确认：第1轮4条、第2/3轮0条——DeepSeek 多轮时常漏掉该字段）。

- 强化提示：明确「无论首次还是追问，每一轮都必须给出 ≥3 条 suggestions」。
- 兜底 `ensureSuggestions`：主回答 suggestions 不足 3 条时，用一次轻量调用（基于对话+本轮回答）补足并合并；两端（DeepSeek/Anthropic）通用。实测三轮均稳定 4 条。

**涉及文件：** `src/lib/llm.ts`

---

### 跨源活动去重 + 导游防重复

同一活动常被多源以不同标题收录（如「山王祭」/「日枝神社 山王祭」、全/半角空格差异）。

- **去重工具** `lib/eventDedup.ts`：判同规则=同一天（东京时区）+ 标题规范化(NFKC/去空白标点)后相等或互为子串(核心≥3)；无开始时间不判同。
- **入库拦截** `ingest.ts`：除原 (title,sourceUrl) 外，新增「同一天 + 标题包含」跨源查重，命中即跳过，防止新重复。
- **清库脚本** `scripts/dedupe-events.ts`：清理已存在重复，每组保留信息更全/带打卡的一条（带打卡者必留，避免外键问题）。本次清掉 14 组。
- **导游防重复**：导游看到的活动清单先 `dedupeEvents`（保留有摘要/描述更全的一条）；系统提示也加「同一活动可能不同名重复出现，合并视为一个，不要重复推荐」。

**涉及文件：** `src/lib/eventDedup.ts`、`src/services/extraction/ingest.ts`、`src/services/guideEvents.ts`、`src/lib/llm.ts`、`scripts/dedupe-events.ts`

---

### AI 导游：回答里提到的活动可点击进详情

- 注入的活动清单给每条加编号 token（E1…），`buildGuideEventsContext` 返回 `{context, refs}`（token→{id,title}）。
- 导游结构化输出新增 `referenced` 字段（它回答中提到的活动编号；正文不出现编号）；`GuideReply` 加 `referenced`，工具 schema / JSON 指令 / 两端解析 + `cleanTokens` 清洗。
- `/api/chat` 把 referenced 映射回 `events:[{id,title}]` 返回前端。
- 前端在每条导游回答下渲染可点击活动卡片，点击 `GET /api/events/[id]` 拉详情并打开 `EventDetail`（叠在导游面板上）。
- 实测：问“今天有什么活动”，回答提到山王祭等 → 下方出现对应可点击卡片，正文无编号、无系统术语。

**涉及文件：** `src/services/guideEvents.ts`、`src/lib/llm.ts`、`src/app/api/chat/route.ts`、`src/components/Guide/GuideChat.tsx`

---

### AI 导游：不暴露系统/IT 术语

之前回答会说“数据库里有一条…”。修复：导游系统提示新增「绝不暴露数据库/数据/记录/系统/接口等术语，用本地向导口吻自然表达」；注入的活动上下文措辞也去掉“数据库/清单/条目”等字眼并明确「不要向用户提及这份清单的来源或形式」。实测同一问题回复已无系统术语。

**涉及文件：** `src/lib/llm.ts`、`src/services/guideEvents.ts`

---

### AI 导游：接入本站活动库回答“当天/近期活动”

DeepSeek API 无原生联网搜索；而“当天活动”正是本站每日抓取入库的数据。故让导游查我们自己的库（零成本、最准、无 ToS 问题）：

- `services/guideEvents.ts`：取近期真实活动——①近期开始(startTime 在 -1d~+21d) ②进行中长期展(已开始、未结束、按结束时间升序)两桶合并去重，拼成纯文本上下文。
- `/api/chat` 回答前注入该上下文；`chatWithGuide(messages, eventsContext?)` 把它并入 system。失败则空串、不阻塞。
- 实测：问“本周有什么活动”，导游据库内真实条目（含日期/场馆）给出具体推荐，时间相对“今天”正确。

**涉及文件：** `src/services/guideEvents.ts`、`src/app/api/chat/route.ts`、`src/lib/llm.ts`

---

### AI 导游：注入当前时间 + 修复追问空白

- **告知 LLM 当前时间**：`chatWithGuide` 系统提示动态注入「东京当前时间」（精确到分+星期），并要求涉及「今天/本周/现在」一律以此为准、不臆断过期活动档期。解决信息滞后。
- **修复追问返回空白**：本地复现确认根因是 `max_tokens: 1280` 在多轮追问（上下文更长、回答更长）时把回答/工具输出截断 → 解析不到 reply → 空白。修复：上限提到 3000；Anthropic 工具截断时回退取文本块；两端都加「空回复→不带 JSON 约束重答一次」兜底；前端再加一层非空保护。

**涉及文件：** `src/lib/llm.ts`、`src/components/Guide/GuideChat.tsx`

---

### 修复千叶活动缺失 + 定时抓取加固

- **问题**：库内千叶(Chiba)活动为 0，但 jalan/walkerplus 千叶源实测都能正常抓到（jalan 30、walkerplus 80）。根因是四县扩充后数据源增至 ~16 个，单次 cron 30 分钟超时、跑到后面的源被截断 → 千叶（尤其排最后的 jalan）丢失。`geocode` 边界已是首都圈 `KANTO_BOUNDS`，非边界误丢。
- **数据修复**：手动跑千叶四源入库（jalan-120000 / walkerplus-ar0312 / -sports / -live），共 ~141 条，含 LLM 分类与摘要。
- **长效加固**：`.github/workflows/extract.yml` 超时 30→120 分钟，确保单次能跑完四县全部源；安装命令对齐为 yarn（项目已弃用 npm，见 cea23b6）。

**涉及文件：** `.github/workflows/extract.yml`

### AI 导游：每次回答推测用户意图，给出 ≥3 个后续追问选项

- `chatWithGuide` 返回值 `string` → `{ reply, suggestions }`：每次回答后，模型额外推测用户接下来最想了解的方向，产出 3~4 个第一人称、紧扣上下文的后续问题。
- Anthropic 走 tool use（`emit_guide_reply`，`suggestions` minItems 3）；DeepSeek 走 `json_object`；`cleanSuggestions` 去编号/引号、限 4 条；解析失败兜底原文、建议留空。
- `/api/chat` 透传 `suggestions`；`GuideChat` 在最新回复下渲染「猜你接下来想问 · 点选继续」可点选项，点击即作为新问题追问（会话上下文连续）。
- 实测：问「今天东京有什么值得去的活动」→ 回复后给出「浅草三社祭有什么必看的看点？」「森美术馆的夜场票需要预约吗？」「代官山市集附近有推荐的咖啡店吗？」「这三个地方怎么坐电车最顺路？」4 条，顺着回复内容推测。

**涉及文件：** `src/lib/llm.ts`、`src/app/api/chat/route.ts`、`src/components/Guide/GuideChat.tsx`

---

### 数据扩充至首都圈四县（东京 / 神奈川 / 埼玉 / 千叶）

**店铺（Hot Pepper）**

- `scripts/import-hotpepper-poi.ts`：`large_area` 单 `Z011` → 四县数组（`Z011 东京 / Z012 神奈川 / Z013 埼玉 / Z014 千叶`），按 县×菜系 嵌套分页。
- 运行结果：收集 18157 家，新入库 **12141 家**（三县新增约 11377）。

**活动（Walkerplus / じゃらん）**

- Walkerplus：`ar0313`(东京) → 四县（`ar0313/ar0314/ar0311/ar0312`），综合 + 体育(eg0108) + 演唱会(eg0109) 各县生成；详情 URL 正则放宽 `ar\d{4}e\d+`。
- じゃらん：地域码 `130000`(东京) → 四县（`130000/140000/110000/120000`），`makeJalanSource` 工厂化。
- 数据源注册表 `sources/index.ts` 改为 spread 四县源数组。
- **geocode 边界 `TOKYO_BOUNDS` → `KANTO_BOUNDS`**（lat 34.9–36.3 / lng 138.9–140.9）：原边界会把三县活动坐标全判失败丢弃，扩成首都圈后才能入库。

**涉及文件：** `scripts/import-hotpepper-poi.ts`、`src/services/extraction/sources/{walkerplus,jalan,index}.ts`、`src/services/extraction/geocode.ts`

---

### 美食懒加载优化：扩大预取范围，消除平移卡顿

- 请求 Hot Pepper 餐厅时按视野尺寸向外扩 **0.8 倍**预取一圈缓冲（`FOOD_PAD`）；平移只要仍落在已加载缓冲区内（`foodAreaRef`）就**跳过请求与重渲染**，不再每次 `moveend` 都打 API。
- 后端 `take` 800 → **2000**（与前端 `FOOD_CAP` 对应）；返回达上限（密集区被截断）时缓存只记原视野 bbox，避免缓冲区漏点。
- 过期响应用 `reqIdRef` 守卫丢弃，快速平移不会被旧数据覆盖。
- 实测：缓冲区内平移 **0 请求**；移出缓冲热查询约 300ms（约 1500 点）。

**涉及文件：** `src/components/Map/MapExplorer.tsx`、`src/services/hotPepperPoi.ts`

---

### 精选名店补图（官网 og:image 优先，无则不显示）

- 脚本 `scripts/fetch-foodspot-images.mts`（`npm run images:foodspots`）给人工精选名店补图，优先级 **官网 og:image → Hot Pepper 就近匹配 → 维基 media-list**；只用真实抓到、HTTP 200 的 URL，抓不到的**不显示**（不编造）。
- 命中 **6/21**：茶禅華 / NARISAWA / Blue Bottle / HIGASHIYA（官网）+ 龍吟（维基）+ 银座小十（Hot Pepper）。次郎/さいとう 等高级寿司怀石无可靠官方图源 → 无图。
- `foodToFC` 精选店 `photo` 取 `FOOD_SPOT_IMAGES` 补充，弹窗卡片展示。

**涉及文件：** `scripts/fetch-foodspot-images.mts`、`src/lib/foodSpotImages.ts`（新）、`src/components/Map/MapExplorer.tsx`、`package.json`

---

### Hot Pepper 全量上图（前端图层）

- 新增 `services/hotPepperPoi`（`listHotPepperInBounds`）+ `GET /api/hotpepper?bbox`（薄 handler）。
- **复用原 OSM 美食图层机制**（OSM 已隐藏、层 id 仍 `osmfood`）接到 Hot Pepper：按视野**懒加载**（zoom≥13.5 拉、≥14 显示），缩小清空；菜系图标 + 店名标签，随「美食」筛选联动。
- **弹窗卡片**用 Hot Pepper 字段：照片 + 菜系/细分 + 招牌语 + 💴人均 / 📍最寄駅 / 🕒营业 + 设施标签（個室/禁煙/Wi-Fi/カード/ランチ）+ 详情链接 + 问 AI 导游。
- 库内 6811 家，地图放大即按视野显示。**精选名店仍在独立层带「AI 精选」角标叠加**。

**涉及文件：** `src/services/hotPepperPoi.ts`、`src/app/api/hotpepper/route.ts`、`src/components/Map/MapExplorer.tsx`

---

### Hot Pepper 全量入库（数据层）

- **新表 `HotPepperPoi`**（`id`=Hot Pepper 店铺 id 天然去重；name/kind/genre/经纬度/budget/station/open/catch/address/photo/url/amenities），db push 到 Neon。
- **入库脚本** `scripts/import-hotpepper-poi.ts`（`npm run import:hotpepper`，`--reset` 清空重灌）：按 8 个菜系分页拉东京 `large_area=Z011`，每菜系最多 `HOTPEPPER_MAX_PAGES` 页（默认 10），id 去重后批量 `createMany`。
- **实测**：拉入 **6811 家**真实东京餐厅。
- **下一步（前端）**：`services/hotPepperPoi` + `GET /api/hotpepper?bbox` + 地图按视野懒加载图层 + 卡片（接替已隐藏的 OSM 全量层），人工精选叠加 AI 精选角标。

**涉及文件：** `prisma/schema.prisma`、`scripts/import-hotpepper-poi.ts`、`package.json`

---

### 景点卡片配图（真实维基图 + Lightbox 左右滑）

- **拉图脚本** `scripts/fetch-landmark-images.mjs`：从日文维基 `media-list` API 为 26 个景点拉**真实**图片（Wikimedia 缩略图，过滤掉图标/地图/svg/徽标，带限速退避重试），生成 `src/lib/landmarkImages.ts`（25/26 有图，共 119 张；仅 teamLab Planets 未命中）。绝不编造 URL，已验证可加载（HTTP 200）。
- **景点弹窗**顶部加封面图（多图显示「N 张」角标），点击 → **Lightbox 全屏左右滑**（复用 `components/common/Lightbox`）。原生地图弹窗的图通过 `openLightboxRef` 桥接到 React 状态。
- `landmarksToFC` 的 properties 补 `cover`/`images`。

**涉及文件：** `scripts/fetch-landmark-images.mjs`、`src/lib/landmarkImages.ts`（新）、`src/components/Map/MapExplorer.tsx`

---

### 隐藏 OSM 美食层 + 精选店「AI 精选」标识

- **隐藏 OSM 美食**：OSM 全量美食信息不全（无评分/照片/营业时间），用开关 `SHOW_OSM_FOOD=false` 暂隐藏，着重 Hot Pepper；筛选联动/视野懒加载代码本就有 `getLayer`/`getSource` 守卫，自动跳过，不再请求 `/api/food`。
- **AI 精选标识**：人工/AI 精选店（有评分 `rating`）→ 地图图标右上角**紫色星角标**（`foodpick-<kind>` 变体，与 Hot Pepper「有照片」的相机角标区分）；点击卡片标题加**「✨AI精选」紫色徽章**。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

## 2026-06-15

### 美食铺开全 23 区 + Hot Pepper(有照片)相机角标

- **铺开 23 区**：`scripts/import-osm-food.ts` 改为对东京 23 区外包围盒**网格平铺**（0.04°≈4km 一片，约 80 片）逐片拉取，带限流退避重试；osmId upsert 自动跨片去重。一次跑通全 23 区。
- **有照片特殊标识**：Hot Pepper 导入的店（带 `photo`）在地图图标右上角加**相机角标**（`foodfeat-<kind>` 变体图标），与普通点/ OSM 点区分；`featured` 由「是否有照片」派生，`food-icon` 用 `case` 表达式选图标。

**涉及文件：** `scripts/import-osm-food.ts`、`src/components/Map/MapExplorer.tsx`

---

### 美食全量底图：接入 OpenStreetMap（试点）

Hot Pepper 覆盖有限（仅广告合作店、缺大量外国餐厅）。引入 OSM(Overpass) 作为「全量底图」，精选 + Hot Pepper 作亮点叠加。本次为试点（涩谷/新宿/银座三区，跑通整条链路）。

- **数据库**：新增 `FoodPoi` 表（osmType+osmId 唯一、name/nameEn/kind/cuisine/经纬度/营业时间/电话/官网/外带/无障碍/地址）。
- **导入脚本** `scripts/import-osm-food.ts`：Overpass 按区 bbox 拉 restaurant/cafe/fast_food，`cuisine→kind` 映射（`lib/cuisineMap.ts`），按 osm id upsert。仅涩谷一区即 ~1048 家。
- **菜系**：`FoodKind` 加 `other`（装韩/泰/印/越等外国餐厅）+ 图标/配色/筛选项。
- **服务/接口**：`services/foodPoi.ts` + `GET /api/food?bbox`（按地图视野查询，限 800）。
- **地图**：新增 `osmfood` 图层——按视野懒加载（zoom ≥ 13.5 才拉、≥14 才显示）、菜系图标 + 店名标签、点击弹简卡（菜系/营业/电话/官网/外带·无障碍 + 问 AI）；随美食筛选开关联动。无评分/照片（OSM 不含）。

**涉及文件：** `prisma/schema.prisma`、`src/lib/{cuisineMap,foodSpots}.ts`、`scripts/import-osm-food.ts`、`src/services/foodPoi.ts`、`src/app/api/food/route.ts`、`src/components/Map/MapExplorer.tsx`

---

### 地图视觉降噪优化

地图同时有活动聚合/单点、百余美食点、景点、打卡，信息偏杂。优化：

- **分层按缩放显示**：美食图层 `minzoom 12.5`、景点图层 `minzoom 11.5`——缩小时只见活动聚合，放大才出现美食/景点，逐级展开。
- **标签分色降噪**：活动摘要保持红色突出；美食标签改柔和玫红 `#a65a6e`、景点改柔褐 `#8a7a6b`，字号 13→11.5，halo 2→1.5，淡入更晚（美食 13.5→14.2、景点 13→13.6），并加 `text-padding` 减少碰撞，避免满屏红字。
- **聚合点更灵动**：主圆配色更柔（浅蓝渐变）、白边更轻薄（2→1.5、透明度 0.85→0.7）；呼吸动效放慢更柔和（周期 650→1100ms），主圆新增极轻微呼吸缩放（×1.0→×1.035）。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

### 报名活动展示 + 发帖/打卡编辑功能

- **报名活动**：个人页「收藏」tab 改为「收藏 / 报名」二级切换，新增展示当前用户报名过的活动。
  - 新增 `listSignupEvents`（复用 `listEventsByReaction` 泛化）+ `GET /api/signups`。
- **编辑发帖**（仅作者，文字信息，不动坐标/图片）：标题/分类/简介/地点名/时间/标签/报名开关。
  - `updateUserEvent` 服务（鉴权：USER 来源 + 作者）+ `PATCH /api/events/[id]`。
- **编辑打卡**（仅本人）：备注/评分/照片（保留+增删）/时间。
  - `updateCheckin` 服务 + `PATCH /api/checkins/[id]`。
- **UI**：发帖/打卡列表加「编辑」按钮；新增 `Me/EditDialogs.tsx`（居中模态，区别于地图底部 sheet），复用日期选择/图片上传逻辑。

**涉及文件：** `src/services/{reactions,events,checkins}.ts`、`src/app/api/signups/route.ts`、`src/app/api/events/[id]/route.ts`、`src/app/api/checkins/[id]/route.ts`、`src/components/Me/EditDialogs.tsx`、`src/components/Me/MeView.tsx`

---

### 精选名店详细信息补全

最初手工精选的 ~21 家名店字段比 Hot Pepper 导入店少，卡片简陋。补全：

- **数据结构**：`FoodSpot` 加可选 `budget`（参考人均）/ `station`（最寄駅）/ `tips`（预约·营业贴士）；`FoodSpotView` 加 `tips`。
- **数据**：为全部 21 家补上最寄駅、参考人均（约值）、更完整的简介（主厨/背景/看点），名店补预约贴士（如「完全予约制」「极难预约」）。照片未加——米其林级名店无可靠免费图源，不编造 URL。
- **卡片**：人均 💴 移到信息行（精选/导入都展示），新增 💡 贴士行；AI 导览上下文也带上人均/贴士。

**涉及文件：** `src/lib/foodSpots.ts`、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`

---

### 抓取管线 LLM 生成活动一句话摘要（存 Event.summary）

地图标签用活动 description 直接截取效果差（冗长/缺失）。改为在抓取管线里用 LLM 为每条活动生成一句 ≤14 字短摘要，存入新字段，地图标签优先用它。

- **数据库**：`Event.summary String?`（db push 到 Neon）。
- **管线**：新增 `services/extraction/summarize.ts`（`maybeSummarize`，开关 `SUMMARIZE_WITH_LLM=true` + 有 LLM key 才启用，失败静默回退 null），在 `index.ts` 对所有源的活动执行；`lib/llm.ts` 加 `summarizeEvents`（批量 30 条，DeepSeek/Anthropic 双 provider，硬截 14 字）。
- **入库 / DTO**：`ingest.ts` 写入 summary；`ExtractedEvent`、`EventDTO` 加 summary，相关页面/接口 DTO（recommend/calendar/favorites/events[id]）补字段。
- **地图标签**：活动摘要优先级 `summary → description → 分类名 → 标题`。
- **定时任务**：`.github/workflows/extract.yml` 加 `SUMMARIZE_WITH_LLM=true`。
- 实测（DeepSeek）：チームラボ→「teamLab沉浸光影展」、隅田川花火→「隅田川夏夜花火」、東京蚤の市→「东京古董市集」、草間彌生展→「草间弥生回顾展」。

**涉及文件：** `prisma/schema.prisma`、`src/lib/llm.ts`、`src/lib/types.ts`、`src/services/extraction/{summarize,index,ingest,types}.ts`、`src/services/extraction/sources/{jsonLd,connpass}.ts`、`src/components/Map/MapExplorer.tsx`、`src/app/recommend/page.tsx`、`src/app/calendar/page.tsx`、`src/app/api/favorites/route.ts`、`src/app/api/events/[id]/route.ts`、`.github/workflows/extract.yml`

---

### 放大后显示简介标签（活动 / 美食 / 景点）

地图放大到一定缩放级别后，在图标下方显示一句摘要标签（超出截断加省略号，用 MapLibre 表达式渲染时截断，不改数据）：

- **活动**：原本单点无文字，现在 `event-glyph` 层加上摘要标签（zoom 14→14.6 淡入）。
- **美食 / 景点**：原本显示会换行的全名，改为单行摘要。
- **摘要来源（不再直接截标题）**：活动用 `description`（缺省退回分类名）；美食 / 景点用各自的 `blurb` 一句话简介。
- **样式更醒目**：文字偏红 `#d6336c`、字号 13、白色描边加粗（halo 2）。字体保留 Open Sans Regular（CARTO glyph 服务该字重含 CJK，Bold 可能缺 CJK 字形）。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

### 美食卡片丰富 + AI 导览加「店铺评价」

- **AI 导览**：餐厅快捷问题新增「口碑和评价怎么样？」「适合什么场合（约会/聚餐/一人/商务，シーン）」；并把店铺资料（评分/预算/最近车站/设施/招牌语）注入对话上下文，评价更贴合该店。
- **地图美食卡片丰富**：拉取脚本补抓 Hot Pepper 更多真实字段（最寄駅 `station_name`、营业时间 `open`、設施 `card`/`non_smoking`/`wifi`/`private_room`/`lunch`）。卡片新增：📍最寄駅、🕒营业时间、设施标签（個室/禁煙席/Wi-Fi/カード可/ランチ）。

**涉及文件：** `scripts/fetch-hotpepper.ts`、`scripts/build-foodspots.ts`、`src/lib/foodSpots.ts`、`src/lib/foodSpotsImported.ts`、`src/components/Guide/GuideChat.tsx`、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`

---

### 美食扩充：Hot Pepper API 导入 + 人工精选混合

之前美食点只有 ~21 家纯人工精选，店少信息少。改为「Hot Pepper Gourmet API 拉真实候选池 → 精选 → 入库」的混合模式：

- **拉取脚本** `scripts/fetch-hotpepper.ts`（`npm run fetch:hotpepper`，需 `HOTPEPPER_API_KEY`）：按 7 个菜系（和食/焼肉/ラーメン/中華/洋食/伊法/カフェ・スイーツ）各拉东京 100 家，输出候选池 `scripts/hotpepper-candidates.json`（已 gitignore）。
- **精选脚本** `scripts/build-foodspots.ts`：从候选池按菜系配额 + 地理打散（~1.2km 网格去重，避免堆在同一商圈）精选 ~139 家，拆分咖啡/甜品，生成 `src/lib/foodSpotsImported.ts`。
- **数据结构**：`FoodSpot`（人工精选，带参考评分+招牌菜）+ 新增 `FoodSpotImported`（导入店，带预算/照片/官网链接，**无评分**——Hot Pepper API 不提供评分）+ 合并视图 `FoodSpotView` / `FOOD_SPOTS_ALL`。
- **地图卡片**：导入店展示**店铺照片 + 预算 + 招牌语 + Hot Pepper 详情链接**；精选名店仍显示参考评分。
- 说明：用户在 Hot Pepper 网页看到的「料理・味/雰囲気」评分百分比来自网页口コミ，官方 API 不含，故导入店不显示评分。

**涉及文件：** `scripts/fetch-hotpepper.ts`、`scripts/build-foodspots.ts`、`src/lib/foodSpots.ts`、`src/lib/foodSpotsImported.ts`、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`、`package.json`、`.gitignore`

---

## 2026-06-14

### 新增演唱会数据源（walkerplus ライブ）

接入 walkerplus 东京「ライブ・音楽イベント」子分类 `ar0313/eg0109`（复用 walkerplus 工厂，分类强制 `LIVE`，默认 6 页，可用 `WALKERPLUS_LIVE_MAX_PAGES` 调）。跑 `npm run extract` 拉入演唱会/音乐活动。

**涉及文件：** `services/extraction/sources/walkerplus.ts`、`services/extraction/sources/index.ts`

---

### 发帖报名模式

- **数据库**：`Event.signupEnabled`（发帖可开启）；`ReactionType` 加 `SIGNUP`（复用 Reaction 系统，报名=一条 SIGNUP reaction）。db push 到 Neon。
- **发帖表单**：新增「开启报名」开关。
- **详情页**：开启报名的活动顶部显示「报名参加 / 已报名·点击取消」按钮 + 报名人数；乐观更新、未登录提示登录。
- 服务/接口：`getReactionState` 增加 `signupCount/signedUpByMe`；`/reactions` POST 允许 `SIGNUP`；`EventDTO.signupEnabled` + 各 page/route/createUserEvent 贯通。

**涉及文件：** `prisma/schema.prisma`、`lib/types.ts`、`services/{reactions,events}.ts`、`app/api/events/[id]/reactions/route.ts`、相关 page/route、`components/Map/PostDialog.tsx`、`components/Map/MapExplorer.tsx`、`components/Recommend/EventDetail.tsx`

---

### 加载优化：推荐懒加载 + 推荐/日历 ISR 缓存 + 个人页骨架

- **推荐页懒加载**：瀑布流先渲染 12 张，`IntersectionObserver` 触底再加 12，减少首屏 DOM、加快渲染。
- **推荐/日历 ISR 缓存**：从 `force-dynamic` 改 `revalidate=3600`（数据每日定时更新，1h 缓存即可），避免每次请求都查库，显著加快加载。
- **个人页加载骨架**：数据拉取期间显示灰色骨架（照片拼图 + 列表），消除「空白一会才出现」。

**涉及文件：** `components/Recommend/RecommendList.tsx`、`app/recommend/page.tsx`、`app/calendar/page.tsx`、`components/Me/MeView.tsx`

---

### 修复：删除确认用 `window.confirm` 在部分 webview 误删

- **现象**：连续「删除→取消」循环时仍会被删除。**根因**：部分移动端 webview 的 `window.confirm()` 行为不可靠（点「取消」也可能返回 true）。
- **修复**：新增应用内 `ConfirmDialog`（受控弹窗、取消/确认明确回调），替换发帖/打卡删除处的原生 `confirm()`（个人页 + 地图弹窗）。实测「删除→取消」循环不再误删，确认才删。

**涉及文件：** `components/common/ConfirmDialog.tsx`、`components/Me/MeView.tsx`、`components/Map/MapExplorer.tsx`

---

### 聚合圆按「地理分散度」定大小（同点不放大）

聚合圆半径从「按数量」改为「按聚合内各点的经纬包围盒边长」：**同一地点的多个活动 → spread≈0 → 小圆**（如皆在皇居受付的多场马拉松，不再撑成巨型圈）；**不同地点分散 → 越散越大**。实现：source 加 `clusterProperties`(min/max lng·lat) → 半径用 `interpolate(spread)`（主圆 15→27、光晕 22→38）；呼吸动效仍在此基础上脉动。`eventsToFC` 的 properties 补 `lng/lat` 供聚合统计。

**涉及文件：** `components/Map/MapExplorer.tsx`

---

### 多图上传 + 图片点击放大；AI 导游按类型给选项

- **AI 导游分类型快捷问题**：`GuideTopic` 加 `kind`（event/landmark/food），快捷问题随类型变——餐厅问招牌/预算/周边、景区问看点/路线/周边、活动问看点/路线/类似推荐。名胜→landmark、美食→food、活动默认 event。
- **多图上传**：`Event.imageUrls` / `CheckIn.photoUrls`（`String[]`，保留单值字段作封面=首图）。发帖/打卡表单改为**多图网格 + 添加格**（最多 6 张，客户端压缩后并行上传）。db push 到 Neon。
- **图片点击放大**：新增 `Lightbox`（全屏查看、× / Esc 关闭、多图左右切换 + 序号）。详情页图片（单图大图 / 多图九宫格）与个人页打卡照片均可点开放大。
- DTO（`EventDTO.imageUrls` / `CheckInDTO.photoUrls`）+ 各 service/route/page 贯通。

**涉及文件：** `prisma/schema.prisma`、`lib/types.ts`、`components/common/Lightbox.tsx`、`components/Guide/*`、`components/Map/{PostDialog,CheckInDialog,MapExplorer}.tsx`、`components/Recommend/EventDetail.tsx`、`components/Me/MeView.tsx`、`services/{events,checkins}.ts`、相关 route/page

---

### 去掉手动刷新（改每日定时更新）+ 修复时间筛选后顶栏错乱

- **修复样式错乱**：选了日期范围后标签变长（如「6月1日 – 6月30日」），顶部行 flex 把「筛选/刷新」挤到换行、整行错乱。改为 `flex-wrap` + 各按钮 `shrink-0 whitespace-nowrap`：放不下时整块换行，不再挤乱。
- **移除手动「刷新」按钮**：数据全用户共享、无需手动刷新。
- **每日定时更新（GitHub Actions）**：抓取全流程要几分钟，会超过 Vercel 函数超时（Hobby 60s / Pro 300s），故**不走 Vercel Cron**，改用 **GitHub Actions**（`.github/workflows/extract.yml`，每日 `0 18 * * *` UTC = 凌晨 3 点 JST）直接跑 `npm run extract` 连 Neon 入库，无超时、可手动触发。`/api/extract` 仍保留 **GET/POST + `CRON_SECRET` 鉴权**，供需要时手动触发。

**涉及文件：** `components/Map/Filters.tsx`、`components/Map/MapExplorer.tsx`、`app/api/extract/route.ts`、`vercel.json`

---

### 美食按菜系分图标 + 菜系筛选 + 左下控件下移

- **菜系图标**：美食 POI 按 `kind`（日式/中餐/西餐/咖啡/甜品）用不同图标 + 配色（`FOOD_KIND_META`）；补齐中餐(茶禅華/麻布長江)、咖啡(Blue Bottle/猿田彦)、甜品(HIGASHIYA/資生堂)等，共 21 家。
- **美食筛选**：左下「🍜 美食」点开下拉，可选 全部 / 各菜系 / 不显示（MapLibre `setFilter` 按 kind 过滤 + 显隐），选择持久化。
- **左下控件下移 + 横排**：底图风格 / 景点 / 美食 从竖向堆叠（最高到 192px）改为底部一横排（`bottom-7`），更靠下、不挡地图中部。

**涉及文件：** `lib/foodSpots.ts`、`components/Map/MapExplorer.tsx`、`components/Map/StyleSwitcher.tsx`

### 精选美食 POI 层（评分>4.0 + 招牌菜单）

新增「美食」图层（类似名胜，**常驻 POI 非带时间活动**）：

- **精选数据** `lib/foodSpots.ts`：人工精选东京 14 家评分>4.0 名店（次郎/さいとう/龍吟/傳/かんだ/NARISAWA 等），各带菜系、评分、招牌菜单、简介。
- **地图图层**：玫红叉勺图标 + 名称标注；点击弹**美食卡**（暖玫色，与活动/名胜卡区分）：名称 + 菜系 + ★评分 + 简介 + 招牌菜单标签 + 「问 AI 导游」。左下角「🍜 美食」开关显隐（持久化）。
- **说明**：评分/菜单为**人工精选标注**。实时抓取评分>4.0+菜单不可行——食べログ禁爬、Google Places 需付费且 ToS 限制入库、Hot Pepper 免费 API 无评分（见对话），故采用精选方案。

**涉及文件：** `lib/foodSpots.ts`、`components/Map/MapExplorer.tsx`、`app/globals.css`

---

### 时间筛选移到顶部计数右侧

地图页时间筛选 chip 从「筛选」展开面板里**移到顶行**（计数「N个活动中」右边），点击直接弹日历，更显眼易达；展开面板里只保留「含过期」。

**涉及文件：** `components/Map/Filters.tsx`

---

### 收紧地图聚合范围

活动/打卡聚合 `clusterRadius` 48/46 → **36**，`clusterMaxZoom` → 15：邻近但不同地点的活动更早分开、整体不那么密集，放大到 15 级即全部散为单点。（同一坐标的活动——如皆在「皇居受付」的多场马拉松——仍会聚成一团，点击弹堆叠卡片逐个查看。）

**涉及文件：** `components/Map/MapExplorer.tsx`

---

### 新增体育（SPORTS）分类 + 体育数据源

- **新增分类 SPORTS**（体育/スポーツ，色 `#0d9488` 青绿，奖杯图标）：贯通 Prisma 枚举、`lib/categories`、`categoryIcons`、地图色表、关键词分类器（マラソン/ラン/野球/サッカー/ヨガ/試合…）、LLM 抽取与重分类提示。地图筛选 / 推荐 / 日历的分类 chip 自动出现。
- **体育数据源** `walkerplus-sports`：walkerplus 东京体育子分类 `ar0313/eg0108`（约 50+ 条）。把 walkerplus 抓取逻辑重构为工厂，复用同一套两步抓取；体育源分类**强制 SPORTS**。默认 6 页，可用 `WALKERPLUS_SPORTS_MAX_PAGES` 调整。
- 跑 `npm run extract` 即拉入体育活动（dedup 防重复）。

**涉及文件：** `prisma/schema.prisma`、`lib/categories.ts`、`lib/categoryIcons.ts`、`lib/llm.ts`、`components/Map/MapExplorer.tsx`、`services/extraction/sources/jsonLd.ts`、`services/extraction/sources/walkerplus.ts`、`services/extraction/sources/index.ts`

---

### 个人页发帖可点进详情（含过期活动）

个人页「发帖」卡片改为可点击 → 打开活动详情（图片+内容区为点击区，「在地图上查看/删除」独立成底部行，避免按钮嵌套）。详情用本地已加载的 DTO 直接打开，**过期活动同样可跳转**（`listUserEvents` 不做过期过滤）。

**涉及文件：** `components/Me/MeView.tsx`

---

### 日历页活动列表加分类筛选

日历页网格下方新增分类 chip（全部 + 各分类，柔和风格、横向滚动），筛选联动「当天开始 / 展期中」的计数与清单（按 `category` 过滤 `byDate` 分组）。

**涉及文件：** `components/Calendar/CalendarView.tsx`

---

### 消息已读/未读 + 点击定位 + 背景图 url() 修复

- **未读计数**：「消息」tab 徽章改为**未读数**（按 `localStorage` 记录的「最后已读时间」计），点开消息 tab 即标记已读 → 徽章归 0。
- **红色徽章**：`CountBadge` 增加 `red` 常驻红色调，用于消息未读提示。
- **点击定位**：消息条目可点击 → 拉取对应活动（新增 `GET /api/events/[id]` + `getEventById`）并打开详情。
- **修复背景图不显示**：`encodeURIComponent` 不转义括号，稻草堆等带 `()` 的文件名让无引号 CSS `url()` 解析中断 → 资料卡背景图（含默认稻草堆）不显示。给 `url("...")` 加引号修复。

**涉及文件：** `components/Me/MeView.tsx`、`components/Me/ProfileHeader.tsx`、`components/common/CountBadge.tsx`、`services/events.ts`、`app/api/events/[id]/route.ts`

---

### 推荐页筛选样式优化（对齐个人页风格）

分类 / 时间 chip 从描边样式改为**柔和灰底无边**（`bg-neutral-100`），激活态用实色填充 + 阴影（全部/时间=蓝，分类=分类色），与个人页分段控件一致；日历下拉改 `rounded-2xl` + 软阴影，更现代。

**涉及文件：** `components/Recommend/RecommendList.tsx`

---

### 绚烂风景背景 + 打卡删除 + 楼中楼 @回复

- **预设背景换为绚烂风景画**：`lib/covers.ts` 改用莫奈风景（稻草堆·夏末 / 罂粟花田 / 圣拉扎尔火车站 / 春日 / 干草堆 / 日出·印象），均验证可加载；`ensureDemoUser` 改为登录时同步预设背景（demo 账号是固定展示形象），5 个测试账号各配一幅；默认背景=稻草堆。
- **个人页打卡删除**：打卡时间线每条加「删除」（二次确认 → `DELETE /api/checkins/[id]` → 同步移除，照片拼图随之更新）。
- **楼中楼 @回复**：评论 `parentId` 改存**实际回复目标**（不再折叠到顶层）；详情页按根分组平铺，回复到「回复」时显示「@目标：内容」。被 @ 的人因 parentId 指向其评论而**自动收到「消息」通知**（验证：A→B→C 三层，B 的作者收到 C 的回复）。删除评论级联移除整棵子树。

**涉及文件：** `lib/covers.ts`、`services/users.ts`、`components/Me/MeView.tsx`、`components/Recommend/EventDetail.tsx`

---

### 个人页：足迹地图换成打卡照片拼图 + 莫奈预设背景

- **打卡照片拼图**：个人页顶部的「足迹地图」替换为**打卡照片网格**（取打卡上传的照片，最多 9 张，1/2/3 列自适应；无照片时占位提示）。顺带移除 MeView 的 MapLibre 依赖，更轻量。
- **莫奈预设背景**：`lib/covers.ts` 收录 6 幅莫奈公有领域作品（Wikimedia Commons，已验证可加载）。资料卡编辑里可从预设缩略图一键选择背景，或继续自定义上传。
- **测试账号背景**：5 个 demo 账号各配一幅莫奈背景（`demoUsers.ts`）；`ensureDemoUser` 对老账号补背景（仅当为空，不覆盖手动设置）。
- **新用户默认背景**：注册时默认给「睡莲」背景（`registerUser` 写入 `DEFAULT_COVER`）。

**涉及文件：** `lib/covers.ts`、`lib/demoUsers.ts`、`services/users.ts`、`components/Me/MeView.tsx`、`components/Me/ProfileHeader.tsx`

---

### 修复页面级滚动条（根因）+ 资料卡自定义背景图

- **页面级滚动条**：根因是文档根 `html` 仍可滚动（body 虽 `overflow-hidden`）。globals.css 给 `html` 加 `overflow:hidden` + `overscroll-behavior:none`，并撤掉先前 MeView 上隐藏滚动条的临时补丁，恢复内部正常滚动。
- **资料卡背景图**：`User` 加 `coverUrl`（Cloudinary）。编辑资料里可「更换背景 / 移除背景」（客户端压缩后上传，与头像同管线）；卡片以背景图渲染并压暗色渐变遮罩、文字转白，保证可读。贯通 `lib/auth`(PublicUser) / `services/users`(ProfileUpdate) / `/api/auth/profile` / `AuthContext`(AuthUser)。

**涉及文件：** `app/globals.css`、`prisma/schema.prisma`、`lib/auth.ts`、`services/users.ts`、`app/api/auth/profile/route.ts`、`components/Auth/AuthContext.tsx`、`components/Me/ProfileHeader.tsx`、`components/Me/MeView.tsx`

---

## 2026-06-13

### 个人页：资料卡片化 + 隐藏外层滚动条

- **资料栏卡片化**：`ProfileHeader` 从平铺改为**渐变卡片**（蓝→白→玫粉 + 角落柔光 + 阴影），头像放大加白环，常住地做成胶囊 chip，更突出。
- **外层滚动条**：Me 页外层容器加 `[scrollbar-width:none]` + `::-webkit-scrollbar` 隐藏（保留滚动），消除生硬的滚动条视觉（与 BottomSheet 一致）。

**涉及文件：** `components/Me/ProfileHeader.tsx`、`components/Me/MeView.tsx`

---

### 评论回复 / 删除 + 个人页「消息」

- **数据库**：`Comment` 加自关联 `parentId`（回复目标，顶层为 null；级联删除回复）。db push 到 Neon。
- **回复**：详情页评论线程化（顶层评论 + 缩进回复），每条带「回复」；回复保持一级（回复"回复"时挂到同一顶层）。输入区显示「回复 @某人 · 取消」。
- **删除**：评论作者可删自己的评论（`DELETE /api/comments/[id]`，仅作者，级联删回复）。
- **个人页「消息」tab**（第 4 个 tab，铃铛图标 + 计数）：展示**被回复**——① 别人回复了我的评论（带我原评论引用）；② 别人评论了我的帖子；显示对方、内容、所在活动、时间。
- 服务/接口：`services/replies.ts` + `GET /api/replies`；`comments` 服务加 `parentId`/`deleteComment`；`CommentDTO.parentId` + `ReplyNoticeDTO`；新增 `IconBell`。

**涉及文件：** `prisma/schema.prisma`、`services/comments.ts`、`services/replies.ts`、`app/api/comments/[id]/route.ts`、`app/api/replies/route.ts`、`app/api/events/[id]/comments/route.ts`、`components/Recommend/EventDetail.tsx`、`components/Me/MeView.tsx`、`components/icons.tsx`、`lib/types.ts`

---

### 发帖时间改为必选

发帖的「开始时间」必填（否则无法按时间筛选）：表单标 `*`、未选禁用发布并提示，`POST /api/events` 同步校验。

**涉及文件：** `components/Map/PostDialog.tsx`、`app/api/events/route.ts`

---

### 聚合点呼吸动效增强

聚合光晕的「呼吸」从仅透明度微动 → **透明度 + 半径一起脉动**（opacity 0.12–0.28、半径 ×1.0–1.2），效果更明显；半径在基础 step 表达式上乘时间系数，保留按数量分级。实测平滑无卡顿。

**涉及文件：** `components/Map/MapExplorer.tsx`

---

### 景点改为「介绍卡 → 确认问 AI」

点击景点不再直接跳 AI，而是先弹一张**名胜介绍卡**：

- `Landmark` 加 `blurb`（一句话简介），每个地标补中文简介。
- 点击地标 → MapLibre 弹出 `.tem-lm` 卡：类型徽章 + 名称 + 「名胜·类型」+ 简介 + 紫色「问 AI 导游了解更多」按钮；点按钮才唤起 AI 并锁定该名胜。
- **与活动卡视觉区分**：暖色渐变底（活动卡为白底 + 分类色条），暖色弹窗阴影与尖角。

**涉及文件：** `lib/landmarks.ts`、`components/Map/MapExplorer.tsx`、`app/globals.css`

---

### 日历调整：格子只显示节日、活动按「当天开始/展期中」分组

- **格子去掉「N场」数量**：底部只显示节日名（红日子，截断显示），不再显示活动数量。
- **选中日活动分两组 + tab 切换**：「当天开始」（start 日期=当天）/「展期中」（更早开始、当天仍在展期的长期活动），各带计数；切换日期时自动落到有内容的分组。解决长期展览每天都计入导致数量虚高、清单冗杂的问题。

**涉及文件：** `components/Calendar/CalendarView.tsx`

---

### 地图细节优化：聚合更柔和、景点可问 AI、人气活动按锚点

- **聚合点更柔和/灵动**：主圆从饱和蓝（#2563eb）改为按数量渐变的柔和periwinkle蓝（#9cc0f7→#6b8ee0）+ 半透明 + 柔白边；外层光晕加 blur 并做轻微「呼吸」动效（rAF 只改 halo 透明度）；单点加分类色柔光垫底、降透明，弱化突兀。
- **景点可点击问 AI**：点击地标 → 唤起 AI 导游并锁定该名胜（标题/看点/路线/周边）；景点图标尺寸略放大（0.62→0.98）。
- **人气活动按锚点**：原以屏幕中心算距离 → 改为**点击地图空白处落「探索锚点」**（玫红脉冲标记），人气卡片标题变「锚点周边」、按锚点重算最近活动与距离，可「重置」回屏幕中心。空白点击会避开活动/打卡/景点要素与发帖放置态。

**涉及文件：** `components/Map/MapExplorer.tsx`、`components/Map/PopularCard.tsx`、`app/globals.css`

---

### 活动标签（tag）管理：推荐卡片显示标签、发帖可加标签

- **数据库**：`Event` 加 `tags String[] @default([])`。db push 到 Neon（改 schema 后 dev server 需重启）。
- **标签工具** `lib/tags.ts`：`displayTags`（优先人工标签，抓取来源按关键词派生：免费/需购票/需预约/亲子/夜场/限定/体验/户外/室内/美食/音乐）、`normalizeTags`（清洗用户输入）。
- **推荐卡片**：去掉冗长说明文字，改为显示标签 chip（`#xxx`），更清爽。
- **发帖表单**：新增标签输入（回车/按钮添加、chip 可删、最多 8 个），随发帖入库。
- **详情页**：简介下也展示标签。
- DTO（`EventDTO.tags`）+ 各 page/route map 补 `tags`；`createUserEvent` 接收 tags。

**涉及文件：** `prisma/schema.prisma`、`lib/tags.ts`、`lib/types.ts`、`services/events.ts`、`app/api/events/route.ts`、`app/recommend/page.tsx`、`app/calendar/page.tsx`、`app/api/favorites/route.ts`、`components/Recommend/RecommendList.tsx`、`components/Recommend/EventDetail.tsx`、`components/Map/PostDialog.tsx`、`components/Map/MapExplorer.tsx`

---

### 个人页选项卡化（分段控件）

打卡/发帖/收藏三 tab 从下划线样式改为**分段控件**（圆角灰底容器 + 选中白底蓝字带阴影 + 图标 + 计数），更有设计感。

**涉及文件：** `components/Me/MeView.tsx`

---

### 日历：节假日标注 + 活动数量替代圆点

- **日本祝日**（`lib/holidays.ts`，2025–2027 含振替休日/国民の休日/春分秋分）：日历格红日子浅红底 + 红字；选中日在清单标题显示「🎌 节日名」。
- **传统配色**：周日 / 节假日红、周六蓝（仿日本日历）。
- **圆点 → 数量**：原分类色圆点改为显示当天活动数（「N场」），更直观。

**涉及文件：** `lib/holidays.ts`、`components/Calendar/CalendarView.tsx`

---

### 名胜 / 地标 / 公园 标识

在地图上标识主要景点（插画风固定底图做不了，先用图标渲染景点）：

- **精选数据** `lib/landmarks.ts`：~26 个东京知名地标（东京塔/晴空塔、浅草寺/明治神宫、上野公园/新宿御苑、皇居、各大博物馆美术馆、涩谷/东京站等），分 6 类（塔/神社寺/公园/城宫/博物馆/名胜），各类配色 + 白色线性图形。
- **地图图层**（`MapExplorer`）：独立 `landmarks` GeoJSON source + symbol 图层，自定义彩色徽章图标（按 kind）+ 名称标注（zoom≥13 才显示、带描边、碰撞避让）。图层加在活动层**之下**，不干扰活动聚合点击。
- **显隐切换**：左下角「🏯 景点」开关，状态持久化到 `localStorage`（默认显示）。

**涉及文件：** `lib/landmarks.ts`、`components/Map/MapExplorer.tsx`

---

### 柔和马卡龙底图风格（可切换）+ 人气活动卡片

参考用户给的插画风地图 mockup。说明：满地手绘樱花/树 + 3D 地标属美术渲染的固定插画地图，真实可交互矢量瓦片无法等价实现；本次落地「柔和水彩氛围 + 人气卡片」方向。

- **柔和主题**（`lib/mapTheme.ts`）：对现有 Positron 矢量图层**就地重着色**（`setPaintProperty`，不调 `setStyle`，故聚合/打卡等自定义图层不被清掉）——暖奶油陆地、柔蓝水域、柔绿公园、白色道路、柔和标注。切回「标准」时从记录的原始 paint 还原。
- **风格切换器**（`Map/StyleSwitcher.tsx`）：左下角「标准 / 柔和」切换，选择持久化到 `localStorage`，默认柔和。应用时机用「就绪标记 + effect」避免闭包捕获旧 theme。
- **人气活动卡片**（`Map/PopularCard.tsx`）：按距地图中心的球面距离取最近 3 个活动，显示分类图标 + 标题 + 距离，可折叠；点条目跳详情、「查看全部」去推荐页。地图中心随 `moveend` 更新。

**涉及文件：** `lib/mapTheme.ts`、`components/Map/StyleSwitcher.tsx`、`components/Map/PopularCard.tsx`、`components/Map/MapExplorer.tsx`

---

### #2 收藏 / 点赞

依赖用户系统，新增活动的点赞与收藏：

- **数据库**：新增 `Reaction` 表（一张表 + `ReactionType` 枚举 LIKE/FAVORITE 区分），唯一约束 `(userId, eventId, type)` 防重复，删活动级联清理。db push 到 Neon。
- **服务层** `services/reactions.ts`：`getReactionState`（点赞/收藏计数 + 当前用户是否已操作）、`toggleReaction`（切换，返回新状态 + 计数）、`listFavoriteEvents`（我的收藏，附作者）。service 不读 cookie，userId 由 route 传入。
- **API**：`GET/POST /api/events/[id]/reactions`（查状态 / 切换，POST 需登录）、`GET /api/favorites`（我的收藏）。
- **详情页**：头部日期行右侧新增 ❤️ 点赞 + 🔖 收藏按钮（带计数、激活态变色），乐观更新 + 失败回滚，未登录提示登录。
- **个人页**：新增「收藏」tab，**卡片瀑布流**（`columns-2` 2 列，与推荐页一致：封面图 + 色条 + 分类日期 + 标题 + 场馆 + 简介 + 「已收藏」角标），足迹地图同步打点，点击进详情（可在详情里取消收藏，关闭时刷新列表）。
- **图标**：`icons.tsx` 新增 `IconHeart` / `IconBookmark`（支持 `filled`）。

> 注意：本地改 schema 后 dev server 需**重启**才能加载新生成的 Prisma client（否则 `prisma.reaction` 为 undefined → 500）。

**涉及文件：** `prisma/schema.prisma`、`services/reactions.ts`、`app/api/events/[id]/reactions/route.ts`、`app/api/favorites/route.ts`、`components/Recommend/EventDetail.tsx`、`components/Me/MeView.tsx`、`components/icons.tsx`

---

### 推荐详情全屏化 + 发帖人/评论作者展示

`Recommend/EventDetail`（地图弹窗、推荐、日历三处共用）改造：

- **全屏**：从底部抽屉式改为 `fixed inset-0` 全屏铺满（同发帖 form）。
- **固定头部**：下滑时分类 / 标题 / 日期始终可见；地点、图片、简介、评论在下方滚动区。
- **右上角 ×**：补回关闭按钮（此前底部行换成问导游/看地图/来源后丢失）。
- **发帖人**：用户发布的活动顶部显示作者头像 + 用户名（`EventDTO.author`）。
- **评论作者**：每条评论显示作者头像 + 用户名 + 时间；头像无图时首字母圆形兜底；旧 `me` 评论显示「用户」。
- **未登录评论**：发送返回 401 时提示「请先到个人页登录」。
- 推荐页 / 日历页 DTO map 补 `author`，作者信息随活动传到详情。

**涉及文件：** `components/Recommend/EventDetail.tsx`、`app/recommend/page.tsx`、`app/calendar/page.tsx`

---

### 日历样式时间筛选（地图 + 推荐）+ 发帖/打卡时间选择改进

把地图原有的「今天/本周/本月」预设按钮升级为**可视化日历范围选择**，并给推荐页补上时间筛选：

- **共享日期逻辑** `lib/dateFilter.ts`：`DayRange`（YYYY-MM-DD，全 null = 全部时间），按**东京日历日**做活动 [start,end] 与所选区间的重叠判断；快捷预设（今天/本周末/本月）；范围含过去日期时自动忽略「过期」过滤（用户主动看历史）。
- **日历范围选择器** `components/common/CalendarRangePicker.tsx`：月历点选 from→to（自动排序）、月份切换、周末标红、今天蓝点、快捷预设、清除。
- **地图筛选**（`Map/Filters.tsx` + `MapExplorer.tsx`）：`FilterState.dateRange` 由枚举改为 `DayRange`；时间区折叠展开内嵌日历；过滤逻辑用 `eventInDayRange`。
- **推荐筛选**（`Recommend/RecommendList.tsx`）：分类 chip 行右侧新增时间 chip + 下拉日历（点外部收起）。
- **发帖/打卡时间选择**（`PostDialog` / `CheckInDialog`）：原生 `datetime-local` 换成风格统一的 `components/common/DateTimeField.tsx`（弹出月历单选 + 时/分下拉），输出仍是 `YYYY-MM-DDTHH:mm`，兼容既有 `toISO()`。

**涉及文件：** `lib/dateFilter.ts`、`components/common/CalendarRangePicker.tsx`、`components/common/DateTimeField.tsx`、`components/Map/Filters.tsx`、`components/Map/MapExplorer.tsx`、`components/Map/PostDialog.tsx`、`components/Map/CheckInDialog.tsx`、`components/Recommend/RecommendList.tsx`

---

### 评论 / 发帖作者信息（后端打底）

为「评论和发帖显示人物信息」铺底（前端展示随后接）：

- **评论**：`services/comments.ts` 列表 join `User` 附作者公开信息（用户名/头像）；发表评论改为**需登录**（route 取 `getCurrentUserId()` 传入，旧 `me` 数据作者为 null）。
- **活动**：`services/events.ts` 的 `getEventsInBounds` / `listUserEvents` 批量附作者（仅 USER 帖有 `userId`）。
- **类型**：`lib/types.ts` 新增 `UserBrief`，`EventDTO` / `CommentDTO` 加可选 `author`。

**涉及文件：** `services/comments.ts`、`app/api/events/[id]/comments/route.ts`、`services/events.ts`、`lib/types.ts`

---

### 修复：重新抓取产生重复活动

- **现象**：重新 `extract` 后同一活动出现多条。
- **根因**：去重键含 `startTime`，而日期来自无时区字符串 `"2026-03-27T00:00:00"`，被不同环境/时区解析成不同 UTC（差几小时甚至跨天），导致同一活动判不出重复。诊断：206 条里 92 个标题重复，sourceUrl 相同、仅 startTime 漂移。
- **修复**：① 去重键改为 `(title, sourceUrl)`，sourceUrl（每条活动的详情页/官网）已唯一、不依赖易漂移的时间；② JSON-LD 日期补东京时区 `+09:00`，存储也稳定。
- **清理现有重复**：跑一次 `npm run extract -- --reset`（清掉抓取活动重抓，去重即正确）。

**涉及文件：** `services/extraction/ingest.ts`、`services/extraction/sources/jsonLd.ts`

---

### 测试账号一键登录（当前阶段方便用）

- 预置 5 个真实感测试账号（さくら / ケンジ / 小林ゆい / たけし / 美咲，各带签名 / 常住地 / 状态）。
- 登录页底部「测试账号 · 一键登录」区：点选即登录、**无需注册**；首次点选自动创建该账号（含预置资料）。
- 统一口令只在服务端（`services/users.ts`），不暴露前端；`/api/auth/demo` 仅接受白名单用户名。

**涉及文件：** `lib/demoUsers.ts`、`services/users.ts`（`ensureDemoUser`）、`app/api/auth/demo/route.ts`、`components/Auth/AuthForm.tsx`

---

### #1 用户系统（本地账号）

从"单用户 `me`"升级为真实账号：

- **数据库**：新增 `User` 表（用户名 / 口令哈希 / 个性签名 / 头像 / 常住地 / 状态）；`Event` 加 `userId`（发帖作者）。db push 到 Neon。
- **认证**：`bcryptjs` 口令哈希 + `jose` 签发 JWT 存 httpOnly cookie。`lib/auth.ts`（hash/verify/session/getCurrentUser）+ `/api/auth/{register,login,logout,me,profile}`。
- **个人页**：未登录显示登录/注册表单（`AuthForm`）；登录后显示资料卡（头像 / 用户名 / 状态 / 签名 / 常住地，可内联编辑 + 头像上传 + 登出）+ 原有打卡/发帖足迹。全局登录态 `AuthContext`（layout 挂载）。
- **权限**：未登录**不可打卡 / 发帖**（前端 toast 提示 + 后端 401）；打卡 / 发帖记录真实 `userId`；打卡列表、我的发帖按当前用户过滤；删除仅本人可操作。
- **依赖**：`bcryptjs`、`jose`；env 加 `AUTH_SECRET`（本地有开发默认）。

> 待办：评论作者用户名展示；**#2 收藏 / 点赞**（依赖本系统）。旧 `userId="me"` 的历史数据保留、不迁移。

**涉及文件：** `prisma/schema.prisma`、`lib/auth.ts`、`services/users.ts`、`app/api/auth/*`、`components/Auth/{AuthContext,AuthForm}.tsx`、`components/Me/{MeView,ProfileHeader}.tsx`、`services/{checkins,events}.ts` 与对应 route、`components/Map/MapExplorer.tsx`、`app/layout.tsx`、`.env.example`

---

### loading 趣味化 + AI 导游活动入口

1. **loading 趣味化**：切 tab 的加载占位从单调转圈，改为**分类色波浪跳动圆点 + 文案**（推荐"正在为你找活动…"、日历"正在翻日历…"、个人"正在整理足迹…"），抽出 `PageLoading` 组件。
2. **AI 导游活动入口**：把 `GuideChat` 提升为**全局**（`GuideContext` + layout 挂载），活动详情抽屉、地图弹窗卡片新增「问导游」按钮 → **针对该活动**开对话（快捷问题嵌入活动名，并把活动信息作为上下文注入首条消息，AI 聚焦讲解）。地图页保留浮动入口（通用咨询，`GuideFab`）。

**涉及文件：** `components/PageLoading.tsx`、`app/{recommend,calendar,me}/loading.tsx`、`components/Guide/{GuideContext,GuideChat,GuideFab}.tsx`、`app/layout.tsx`、`components/Map/MapExplorer.tsx`、`components/Recommend/EventDetail.tsx`、`app/globals.css`

---

### 发帖/打卡表单现代化改版

把朴素的"label + 灰边输入框"重做为简约高级、与全站一致的风格：
- 抽出共享样式 `formStyles.ts`：浅灰底 + 细边 + 大圆角输入，聚焦变白底 + 蓝色描边/柔光环。
- 分类改为圆角标签（选中填分类色 + 阴影）；图片上传改为大虚线框 + 居中「＋ 选择图片」，预览图圆角全宽。
- 坐标做成 pill；label 弱化为小灰字；必填项标红 *；底部主按钮全宽实心、取消次要。
- `BottomSheet` 头部加分隔线、抓手与标题层次微调。发帖与打卡共用同一套视觉。

**涉及文件：** `components/Map/{formStyles,PostDialog,CheckInDialog,BottomSheet}.tsx`

---

### AI 导游咨询

- 新增 **AI 导游**：地图页右侧紫色浮动入口 → 全屏聊天面板。
- 资深导游 system prompt：讲解活动信息、历史文化渊源、看点，给出推荐与**路线/交通建议**；纯文本输出（约束不用 Markdown）；不确定信息提醒以官方为准、不编造。复用 DeepSeek（`/api/chat`，保留最近 12 轮上下文）。
- 提供 4 个**默认快捷问题**（今天去哪 / 周末展览市集 / 一日游路线 / 祭典历史渊源），点一下即开始。
- 实测：DeepSeek 回复专业（神田祭"江户总镇守"渊源、深川八幡祭泼水文化、门前仲町站交通等）。

**涉及文件：** `lib/llm.ts`（`chatWithGuide`）、`app/api/chat/route.ts`、`components/Guide/GuideChat.tsx`、`components/icons.tsx`（`IconSparkles`）、`components/Map/MapExplorer.tsx`

> 待办（用户系统 v2，已确认需求）：简单本地账号（口令 bcrypt 哈希）；用户资料字段=用户名 / 个性签名 / 头像 / 常住地（可选）/ 状态；用于发帖、评论区分用户，并支撑收藏与点赞。未登录不可打卡/发帖，个人页提供登录入口。

---

### 表单全屏化 + 打卡图片/时间 + tab 切换反馈

1. **发帖/打卡表单全屏可滑动**：`BottomSheet` full 状态改为全屏（`h-[100dvh]`，顶贴屏幕顶、底贴屏幕底）、`z-[999]`、隐藏滚动条；peek/full 拖动切换，关闭走右上角 ×。
2. **打卡支持图片上传 + 打卡时间**：`CheckInDialog` 把"照片外链"换成 Cloudinary 图片上传（与发帖一致：客户端压缩后上传，DB 只存 URL）；保留 datetime「打卡时间」（写入 `CheckIn.createdAt`）。
3. **tab 切换反馈**：给 recommend/calendar/me 加 `loading.tsx`（点 tab 立即显示加载 spinner，消除"卡住"感）；`BottomNav` 乐观高亮（点击立即高亮目标 tab + 轻微放大），配合 `template.tsx` 入场动画。
4. 移除之前 peek 的"取消 FAB"（被全屏 sheet 盖住、已失效），关闭统一走拖动收起 + ×；peek 上拉限制不越过屏幕顶。
5. **推荐卡片限高**：标题 `line-clamp-2`，长标题截断为两行，避免撑乱瀑布流。
6. **地址定位增强（可选 LLM）**：含建筑名/设施名的地址 GSI 常定位到区中心（如「東京タワー」落到都厅）。新增 `GEOCODE_LLM_FALLBACK` 开关，开启后用 LLM 把这类地址规范成标准住所再地理编码（「東京タワー」→「東京都港区芝公園」、「TOKYO DREAM PARK」→「東京都江東区有明3-3-8」），东京边界校验兜底 LLM 幻觉。

**涉及文件：** `components/Map/{BottomSheet,CheckInDialog,PostDialog,ActionFab,MapExplorer}.tsx`、`components/BottomNav.tsx`、`components/Recommend/RecommendList.tsx`、`app/{recommend,calendar,me}/loading.tsx`、`lib/llm.ts`、`services/extraction/ingest.ts`、`.env.example`

---

### 日历长期活动展期显示 + 推荐页分类筛选

1. **日历长期活动**：跨多天的活动（`startTime`→`endTime`）在**展期每一天都显示条目**（之前只在开始日）；当天清单里这类活动的时间列标「展期中」。`byDate` 分组改为按 UTC 午夜从开始日逐天迭代到结束日填充（`guard < 366` 防异常 `endTime` 导致超长循环）。
2. **推荐页分类筛选**：瀑布流上方加分类 chip（全部 + 6 类），点击按 `category` 过滤；再点同一类或「全部」取消。

**涉及文件：** `components/Calendar/CalendarView.tsx`、`components/Recommend/RecommendList.tsx`

---

### UI 优化：天气昼夜 + 页面切换动画 + 详情全屏/原图 + sheet 拖动

5 项体验改进：

1. **天气特效区分昼夜**：`WeatherPanel` 按东京当前时间（18:00–翌 6:00 为夜）算 `isNight` 传给 `WeatherAnimation`；晴天夜晚显示月亮 + 闪烁星空（替代太阳），雨/雪/云夜晚叠一层夜色遮罩，与白天明显区分。
2. **tab 切换动画**：新增 `app/template.tsx`（App Router template 每次导航重新挂载）→ 触发淡入 + 上滑（`tem-page-in` 0.28s），让切换被感知。
3. **推荐详情弹窗铺满屏**：`absolute inset-0 z-30` → `fixed inset-0 z-50`，盖住底部 tab 导航，不再漏出。
4. **详情图片完整显示**：上传/活动图从 `object-cover` 改 `object-contain`（+ 浅灰底 + `max-h-[60vh]`），原图不裁剪、看全。
5. **发帖/打卡 sheet 拖动不再取消 + 定位修复**：下拉只在 peek/full 两档间切换（full→peek 保留已填表单），**不再因下拉直接取消**；新增右上角 × 明确关闭；保留"上拉填写 ›"两步流程。另修：`max-h-[82%]` 因父容器（`absolute` 无明确高度）失效，表单被撑过屏幕顶、抓手被挤出 → 改 `fixed inset-x-0 bottom-0 z-50` + `max-h-[88vh]`，表单底部贴屏幕底（盖底部导航）、顶部留出抓手拖动区。

**涉及文件：** `components/Map/{WeatherPanel,WeatherAnimation,BottomSheet}.tsx`、`components/Recommend/EventDetail.tsx`、`app/template.tsx`、`app/globals.css`

---

## 2026-06-12

### 修复：walkerplus 也抓详情页（定位精确到番地）

**背景：** walkerplus 抓的活动定位不准——列表页 JSON-LD 地址只到区级（如"東京都江東区"），GSI 退回区中心，同区活动糊成一团。

**修复：** 与 jalan 同思路——翻页先收集站内详情页 URL（`/event/ar0313eXXXXXX/`），再逐个抓详情页拿 `streetAddress`（番地级，如"東京都江東区有明3-3-8"）。walkerplus 是 UTF-8，无需特殊解码。

**实测：** 渋谷リアル・イカゲーム→道玄坂、ホグワーツ→练马春日町、ピクサー展→豊洲，均番地级精确。代价：详情请求增多、extract 变慢（低频手动可接受）。

**涉及文件：** `src/services/extraction/sources/walkerplus.ts`

---

### 修复：来源外链跳详情页 + 地址定位（jalan 抓详情页、东京边界校验）

**背景：** 两个 bug——①"来源"链接全跳到列表页；②地图标点明显偏移（jalan 活动被标到北海道札幌）。

**根因 & 修复：**
1. **外链跳列表**：活动 `sourceUrl` 统一存了源列表页 URL。其实 JSON-LD 每条活动有自己的 `url`（jalan=详情页、walkerplus=官网）。
   - `ExtractedEvent` 加 `sourceUrl` 字段；`ldToExtracted` 填 `e.url`、connpass 填 `e.url`；ingest 用 `ev.sourceUrl ?? source.sourceUrl`（存库 + 去重键同步）。
2. **地址偏移**：
   - jalan 的 `addressRegion="東京"`（非"東京都"）→ GSI 把"東京X"整体误判成**北海道札幌市東区**。**geocode 加地址规范化（東京→東京都）+ 东京边界校验**（解析到东京框外一律判失败，宁缺毋滥）。
   - jalan 列表页地址只到区/町 → GSI 退回都厅、一堆点糊在一处。**改为逐个抓详情页**，详情页 JSON-LD 带 `streetAddress`（街道+番地），地址精确到番地级。
   - `ldToExtracted`：有 `streetAddress` 时直接用，不再与 region/locality/venue 重复拼接干扰 GSI。

**数据刷新（重要）：** 旧坏数据（札幌点、列表页 sourceUrl）需清理重抓——新增 `npm run extract -- --reset`：先清掉抓取来的活动（保留发帖/打卡），再重抓。

**实测：** 山王祭→日枝神社、新橋こいち祭→港区新橋、羽田まつり→羽田，均番地级精确、无札幌点；`tsc` 全绿。

**涉及文件：** `extraction/{types,ingest,geocode}.ts`、`sources/{jsonLd,jalan,connpass}.ts`、`scripts/run-extraction.ts`

---

### 抓取增强：分页 + LLM 分类 + 第二来源 jalan

**背景：** 三点优化——抓更多、分类更准、多来源。

**实现：**
1. **walkerplus 分页**：东京全域列表按 `/ar0313/{N}.html` 抓前 `WALKERPLUS_MAX_PAGES` 页（默认 8≈80 个），页间 700ms 延迟、跨页去重；**所有页统一用列表首页作 sourceUrl**，保证 ingest 的 `(title,startTime,sourceUrl)` 去重在跨页/重抓时仍正确。全域列表已涵盖各区，故不逐区抓（逐区只会大量重复）。
2. **LLM 重分类（可选）**：`lib/llm.ts` 加批量 `classifyEvents`（复用 anthropic/deepseek provider 切换）；管线对 prestructured 源调用 `maybeReclassify`。开关 `CLASSIFY_WITH_LLM=true` 且有 LLM key 才启用，否则零成本回退关键词（关键词把"快闪/IP 体验展"等误判为 OTHER 偏多）。
3. **第二来源 jalan**：じゃらん东京活动列表（地域码 130000），SSR + 标准 JSON-LD，单页 30 个、含街道级地址。**坑：jalan 是 Shift_JIS(Windows-31J) 编码**，必须 `arrayBuffer()` + `TextDecoder("shift_jis")` 解码，否则日文乱码致 `JSON.parse` 失败、解析到 0。还需补全浏览器 headers（UA/Accept/Accept-Language）。
4. **共享解析**：抽 `sources/jsonLd.ts`（`extractLdEvents` / `classifyByKeyword` / `ldToExtracted`），walkerplus 与 jalan 复用。
- **GO TOKYO 未接入**：它是 SPA + 封闭私有搜索 API（参数不可逆向、易随改版失效），不符合"稳定源"原则；改用 jalan 这个稳定 JSON-LD 源达成"多来源"。

**实测：** walkerplus 3 页=30、jalan 1 页=30，均全带图带址；`tsc --noEmit` 全绿。

**涉及文件：** `src/services/extraction/sources/{walkerplus,jalan,jsonLd,index}.ts`、`extraction/{classify,index}.ts`、`src/lib/llm.ts`、`.env.example`

---

### 真实数据源：Walkerplus（解析页面 JSON-LD）

- **放弃 connpass 做主力**：它是 IT 勉強会平台，与"展览/市集/live/祭典"定位不符（顶多做 TALK 补充）。
- 新增 **walkerplus 源**：抓东京活动列表页，解析页面内嵌的 schema.org **JSON-LD**（`@type: Event`），**直接拿到结构化活动**（名称/起止日期/图片/场馆/地址/简介），无需 LLM 啃自由文本；分类用关键词推断（不准则归 OTHER）。
- robots.txt 允许 `/event_list/`；地理编码用「都道府县+区+场馆名」，GSI 命中率高。手动低频抓取、尊重站点条款。
- **实测**：一页 10 个真实活动**全部入库**，地理编码 **0 失败**，**全部带图片**，展览分类准确。
- TODO：分页/多区域拿更多；可选用 LLM 增强分类。

**涉及文件：** `src/services/extraction/sources/walkerplus.ts`（新）、`.../sources/index.ts`

### 恢复活动聚合（单点才加图标）+ 筛选改左侧可收起

- **修正**：上一版误删了活动聚合。现在恢复——缩小时合并成**蓝色大圆 + 数量**（聚合圆**不加**分类 icon）；放大到单点时 = **分类色圆 + 分类图标**（图标加大：`icon-size` 0.6→0.85，圆 radius 12→14）。聚合圆点击放大展开 / 同位置堆叠卡片逻辑一并恢复。
- 去掉 USER 发帖点的**黑色描边**，统一白边。
- **#2 筛选改版**：左上角一个「筛选」按钮（带激活数徽标）+ 展开面板（分类 / 时间段 / 含过期 / 只看我的）；收起时只剩 筛选 + 刷新 + 计数，不再用隐蔽的横向滚动，也不挡右上角地图控件/天气。

**涉及文件：** `src/components/Map/MapExplorer.tsx`、`src/components/Map/Filters.tsx`

### 发帖/打卡选日期 + 表单可吸附（peek）+ 天气实况提示

- **#6 表单改为可吸附 sheet**：默认 **peek**（只露标题，地图可见 → 拖锚点定位），**上拉填写**；从 full **下拉回 peek**（重新定位），peek 再下拉才关闭。移除上一版"定位条 + `formOpen`"两步逻辑，统一到 `BottomSheet`。
- **#3 选日期**：发帖加"时间范围"（开始/结束 `datetime-local` → ISO）；打卡加"时间"（可补录过去打卡，覆盖 `createdAt`）。后端 `createUserEvent`/`createCheckin` + 两个 POST 路由透传。
- **#5 天气歧义提示**：天气面板加实况条「现在 X° · 动画为实况，下为未来 7 天」，区分"地图动画=当前实况"与"卡片=未来预报"。

**涉及文件：** `BottomSheet.tsx`、`PostDialog.tsx`、`CheckInDialog.tsx`、`MapExplorer.tsx`、`WeatherPanel.tsx`、`services/{events,checkins}.ts`、`api/{events,checkins}/route.ts`

### 活动点加分类图标（去聚合）+ 天气置顶

- **活动点不再聚合**（用户反馈聚合大圆不直观）：每个活动 = 分类色圆 + **白色分类图标**（symbol 图层，`icon-image` 按 `category` 动态取图，图标位图由 `CATEGORY_GLYPH` 渲染成 data URL 注册），辨识度更高；USER 发帖用**深色描边**区分抓取活动。
- 移除事件聚合图层（halo / clusters / count）与点击展开逻辑；**打卡仍保留聚合**（带数量气泡）。
- **天气按钮 `z-[999]`**（不再被 FAB/打卡遮挡）；天气卡片条提到 `z-[60]`。

### 移动端 UI 修复 + 锚点两步交互 + 打卡对勾图标

1. **移动端筛选栏不再叠在地图控件/天气上**：容器改 `right-14 sm:right-3` 清开右侧缩放/定位控件；分类行与第二行由换行改为**横向滚动**（不再堆叠）。375px 实测：筛选栏右沿 319px、地图控件左沿 336px，不重叠。
2. **打卡/发帖改为两步交互**：点 ➕ 选动作 → 先落**可拖动锚点 + 底部「定位条」**（取消 / 下一步），定位好再点「下一步」才弹输入表单 → **表单不再遮挡锚点**。新增 `formOpen` 状态。
3. **打卡点叠加白色对勾（√）图标**（canvas 画图标 → `map.addImage` → symbol 图层），与活动点（无对勾）一眼区分。
4. **Cloudinary 说明**：`NEXT_PUBLIC_*` 是编译期注入，改 `.env` 后必须**完整重启 dev**（非 HMR）才生效——这正是之前显示「未配置图床」的原因。已验证 `.env` 的 cloud name/preset 会被打进客户端 bundle。

**涉及文件：** `src/components/Map/Filters.tsx`、`src/components/Map/MapExplorer.tsx`

---

### Cloudinary 图床配置完成

- 用 Admin API 建好 unsigned 预设 **`cloudfootprints_unsigned`**（folder `cloudfootprints`，仅图片格式）。
- `.env` 填入 `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`（公开值，不入库）。
- 用 unsigned 直传（**不带 Secret**）跑通真实上传验证：返回 `secure_url` + 尺寸/格式/体积元数据，`q_auto,f_auto` 优化正常。
- **安全**：App 不使用 Cloudinary API Key/Secret；二者不进代码/仓库。Secret 若曾暴露应在控制台轮换。
- 两台 PC 的 `.env` 各自填这两个公开值（`.env` 不随 git 同步）。

---

### 修复：构建自带 `prisma generate`（CI/部署/换机 implicit-any 报错）

**问题：** 在未先跑 `prisma generate` 的环境（Vercel/CI/另一台 PC）`yarn build` 时，`@prisma/client` 无类型 → `getEventsInBounds` 返回 `any` → `recommend`/`calendar` 页 `rows.map((e) => …)` 报「Parameter 'e' implicitly has an 'any' type」。本机能过只因本地早已生成过 client。

**修复：**
- `package.json`：`build` 改为 `prisma generate && next build`；新增 `postinstall: prisma generate`，使构建/安装自带生成、与环境无关。
- `prisma.config.ts`：datasource url 由 `env("DATABASE_URL")` 改为 `process.env.DATABASE_URL ?? ""`，让 `prisma generate`（不连库）在缺 `DATABASE_URL` 的构建环境也不抛错（迁移仍会因连不上而清晰报错）。

**部署提醒：** Vercel 等需在项目环境变量里设好 `DATABASE_URL` / `LLM_*` / `NEXT_PUBLIC_CLOUDINARY_*`（`.env` 不会被部署）。

---

### 发帖贴图（Cloudinary 图床 + 客户端压缩）

**背景：** 发帖支持上传图片。关键决策：**图片不进数据库**（DB 只存返回的 URL），客户端先压缩，二进制存到 Cloudinary 免费图床（自动压缩/CDN，跨设备与部署都能访问）。

**实现：**
- `lib/image.ts`：canvas 把图缩到最长边 1280、JPEG q0.8 重编码，显著减小体积
- `lib/cloudinary.ts`：unsigned upload preset 客户端**直传**（不经服务器），存 `secure_url` 并插入 `q_auto,f_auto` 交付优化；未配置时优雅报错
- `PostDialog`：图片选择 + 预览 + 移除；提交时压缩→上传→带 `imageUrl`；未配置图床时显示提示
- `createUserEvent` / `POST /api/events` / `MapExplorer.submitPost` 透传 `imageUrl`；`/me` 发帖卡片展示图片
- env 增加 `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `_UPLOAD_PRESET`（均为可公开值，非密钥）

**涉及文件：** `src/lib/{image,cloudinary}.ts`、`src/components/Map/PostDialog.tsx`、`.../MapExplorer.tsx`、`src/services/events.ts`、`src/app/api/events/route.ts`、`src/components/Me/MeView.tsx`、`.env.example`

---

### 时间范围筛选 + 活动图片；地图区分打卡/发帖；个人页分 tab

**背景：** 三个功能需求。

**实现：**
1. **时间范围 + 过期默认隐藏**
   - Filters 日期段增加「本月」；新增「含过期」开关（默认关 → 过期活动不显示）
   - `FilterState` 加 `showExpired`；过期判定 = 结束时间（`endTime` 无则 `startTime`）早于现在，未定档不算过期
   - 地图 `filtered` 与推荐页都默认过滤过期；地图可用「含过期」临时显示
2. **活动图片（LLM 抽取）**
   - `Event` 加 `imageUrl` 字段（迁移 `add_event_image`）
   - `llm.ts` 抽取 tool/JSON schema + prompt 增加 `imageUrl`；`ingest` 落库；`EventDTO` 加字段
   - 推荐卡片、详情抽屉展示活动主图
3. **地图区分打卡 / 发帖**
   - 新增 `event-point-user` 图层：USER 发帖在圆心叠白点（靶心造型），与抓取活动（分类色实心）、打卡（琥珀实心）三者一眼区分
4. **个人页 打卡 / 发帖 两 tab**
   - 新增 `GET /api/events?mine=1` + `listUserEvents()`
   - `MeView` 改为两 tab：打卡（时间线）/ 发帖（卡片列表，含「在地图上查看」+ 删除）；顶部足迹地图按当前 tab 撒点

**涉及文件：** `prisma/schema.prisma`、`src/services/extraction/{types,ingest}.ts`、`.../sources/connpass.ts`、`src/lib/{llm,types}.ts`、`src/services/events.ts`、`src/app/api/events/route.ts`、`src/components/Map/{Filters,MapExplorer}.tsx`、`src/components/Me/MeView.tsx`、`src/app/{recommend,calendar}/page.tsx`、`src/components/Recommend/{RecommendList,EventDetail}.tsx`

---

### 文档：README 重写 + 协作工作流

- `README.md` 从过期的早期版本重写为反映当前功能（聚类、两动作 FAB、日历、天气、评论、删除、DeepSeek/Claude 可切换 LLM、4 tab）的完整说明，含快速开始（含 `prisma generate`）、环境变量、目录结构、路线图。
- `CLAUDE.md` 新增「协作流程（Git / 跨设备）」：换机先 `prisma generate`；每次功能完成后 `更新 CHANGELOG → commit → push origin main`；远端 `ChinSeihu/CloudFootPrints`。
- **约定**：今后每次功能新增/变更完成即提交并推送到 GitHub。

### 跨设备同步修复 + 构建清理

**背景：** 从另一台 PC 同步最新代码到本机后，先做环境对齐与编译修复，确保 `tsc` / `next build` 全绿，便于双机共享进度。

**实现：**
1. 本机首次启动运行 `prisma generate`（换设备必做，否则 `@prisma/client` 无 `PrismaClient` 导出、API 全 500）
2. 修复 `tsc` 报错：`MapExplorer.tsx` 的 `CATEGORY_COLOR_EXPR`（MapLibre `match` 表达式用 spread 动态拼分支，TS 无法核对精确元组）改为 `as unknown as maplibregl.ExpressionSpecification` 断言。该错误在 `next dev`（Turbopack 不跑严格 tsc）下不显现，但 `tsc --noEmit` / `next build` 会失败
3. 删除孤儿组件 `CheckInFab.tsx`（已被 `ActionFab` 速拨菜单取代，全项目无引用）；修正 `BottomNav.tsx` 指向它的过期注释
4. 确认 `npm run build` 全绿（9 路由）

**确认（同步版本已实现，本次未改动逻辑）：**
- **打卡聚类**：打卡用 GeoJSON cluster 图层，同址/邻近多次打卡合并为带数量的气泡，放大到 `clusterMaxZoom` 以上散开
- **打卡 / 发帖分两种动作**：FAB 速拨菜单（`ActionFab`）→ 打卡（`CheckInDialog`，个人足迹）或 发帖（`PostDialog`，创建 `sourceType=USER` 活动）

**涉及文件：**
- `src/components/Map/MapExplorer.tsx` — `CATEGORY_COLOR_EXPR` 类型断言
- `src/components/Map/CheckInFab.tsx` — 删除（孤儿）
- `src/components/BottomNav.tsx` — 过期注释更新

---

## 2026-06-09

### 活动日历 + 地址复制 + 地图天气面板

**背景：** 三个新功能——(1) 日历看当日活动；(2) 地址一键复制；(3) 地图天气入口 + 上层天气动画。

**实现：**
1. **活动日历 tab**
   - 底部导航从 3 tab 扩成 4 tab（地图/日历/推荐/个人），`grid-cols-4`
   - 新增 `/calendar`：月历网格，有活动的日期标分类色圆点（最多 3 个）；点某天 → 下方按时间列出当天活动；点活动 → 复用 `EventDetail` 详情抽屉
   - 活动按"东京时区当天"分组（`toLocaleDateString("en-CA", {timeZone:"Asia/Tokyo"})`）；未定档（无 startTime）的活动不进格子
2. **地址复制按钮**
   - 新增通用 `CopyButton` 组件 + `lib/clipboard.ts`（Clipboard API 失败回退 execCommand）
   - 详情抽屉地址行、地图弹窗卡片地址行各加复制图标，点击切换对勾反馈
3. **地图天气面板**
   - 数据源 Open-Meteo（免费无 key），服务端 `services/weather.ts` + `/api/weather`，半小时缓存；WMO code → 6 大类（晴/多云/雾/雨/雪/雷暴）
   - 地图天气按钮（缩放控件下方）显示当前温度；点开后底部出现可横向滑动的近 7 天卡片
   - 展开时地图上层播放天气动画（`WeatherAnimation`，按当前天气大类切换：雨线/雪花/云/阳光/雷闪），CSS keyframes，`pointer-events:none` 不挡交互
   - FAB 提到 `z-30`（高于天气卡片条 z-20），天气展开时仍可点

**涉及文件：**
- `src/components/BottomNav.tsx` — 4 tab
- `src/app/calendar/page.tsx` + `src/components/Calendar/CalendarView.tsx` — 新建日历
- `src/services/weather.ts` + `src/app/api/weather/route.ts` — 新建天气数据层
- `src/components/Map/WeatherPanel.tsx` + `WeatherAnimation.tsx` — 新建天气面板与动画
- `src/components/Map/MapExplorer.tsx` — 挂载 `WeatherPanel`；弹窗卡片加地址复制
- `src/components/Map/ActionFab.tsx` — z-10 → z-30
- `src/components/CopyButton.tsx` + `src/lib/clipboard.ts` — 新建复制能力
- `src/components/Recommend/EventDetail.tsx` — 地址行加复制按钮
- `src/components/icons.tsx` — 新增复制/对勾/翻页箭头/天气系列图标 + `WeatherIcon`
- `src/app/globals.css` — 弹窗地址行 flex 容纳复制按钮；天气动画样式 `.wx-*`

---

### 同位置堆叠卡片 + 强制亮色 + 聚合圆样式

**背景：** 三个体验问题——(1) 同址/极近的多个活动点击后看不全；(2) OS 夜间模式下页面翻黑、文字看不清；(3) 聚合圆纯白不醒目。

**实现：**
1. **堆叠卡片弹窗（活动）**
   - 点击单点：`queryRenderedFeatures` 取点击像素 ±14px 内所有点 → 去重 → 一个弹窗里上下排列多张卡片
   - 点击聚合圆：`getClusterLeaves` 取叶子，若坐标包围盒 < 0.0006°（约 60m）判为"挤在一起"，直接堆叠卡片；否则 `easeTo` 放大展开
   - 卡片信息更详细：分类色条 + 分类/时间 + 标题 + 场馆 + 地址 + 来源链接 / 删除按钮，整卡可点
   - 卡片点击 → `/recommend?event=<id>`，推荐页自动打开该活动详情抽屉
2. **强制亮色主题**：`globals.css` 移除 `@media (prefers-color-scheme: dark)`，加 `color-scheme: light`
3. **聚合圆重做**：活动聚合改实心蓝 + 白边 + 半透明蓝光晕 + 白字；打卡聚合加同款光晕

**涉及文件：**
- `src/components/Map/MapExplorer.tsx` — `eventsToFC` 增加 address/endTime 属性；新增 `event-cluster-halo`/`checkin-cluster-halo` 图层并重配聚合圆配色；重写 event-point/event-clusters 点击逻辑为 `openEventsPopup` 堆叠卡片；引入 `useRouter`
- `src/app/globals.css` — 强制亮色；新增 `.tem-*` 弹窗卡片样式；`.maplibregl-popup-content` padding 归零
- `src/components/Recommend/RecommendList.tsx` — 读 `?event=` 自动打开详情

---

### 环境修复：依赖安装 & Turbopack 启动问题

**问题1：** `npm install` / `yarn install` 始终装到 `next@9.5.5` 而非 `16.2.7`
- 根因：`package.json` 里 `next` 字段值写的是 `"^9.3.3"`，`16.2.7` 是 `eslint-config-next` 的版本
- 同时 `prisma` 版本写的是 `^6.19.3`，与 `@prisma/client@^7.8.0` 不匹配
- 修复：`"next": "16.2.7"`，`"prisma": "^7.8.0"`；删除遗留的 `package-lock.json` 和 `yarn.lock`，用 yarn 重新安装

**问题2：** 页面无限刷新 + Turbopack FATAL panic
- 根因1：`C:\Users\minyuan\package-lock.json`（2023年遗留，仅含 `node@20.7.0`）让 Turbopack 误判 workspace root 为用户目录，导致找不到 Next.js 包，HMR 不断 panic 重连 → 浏览器无限刷新
- 根因2：从未运行 `prisma generate`，`.prisma/client/default` 不存在，API 路由全部 500
- 修复：删除 `C:\Users\minyuan\package-lock.json`；运行 `yarn prisma generate`；`next.config.ts` 加入 `turbopack.root: process.cwd()`

**问题3：** 点击地图/个人 tab 始终跳回推荐页面
- 根因：`C:\Users\minyuan\package.json`（内容 `{"dependencies":{"node":"^20.7.0"}}`）仍然存在。Turbopack 把这个目录识别为 workspace root，找不到 Next.js → FATAL panic → HMR 触发浏览器全量刷新 → 落回最后编译成功的页面（/recommend）
- 修复：删除 `C:\Users\minyuan\package.json`，`turbopack.root` 改为 `process.cwd()`，清除 `.next` 缓存后重启
- **教训：** 如再次出现 "Next.js package not found" FATAL，先检查 `$HOME`（`C:\Users\<user>`）级别是否残留 `package.json` 或 `package-lock.json`

**注意：** 换设备后首次启动必须先运行 `yarn prisma generate`，否则所有 API 路由会报 500。

---

### 地图标记聚合（随比例尺缩放）

**背景：** 同一位置标记过多时视觉混乱，需要按比例尺合并。

**实现：**
- 将活动 markers 从 DOM `maplibregl.Marker` 改为 GeoJSON source + MapLibre 原生 cluster 图层
- `clusterMaxZoom: 14`，14 级以上散开显示单点；点击聚合气泡自动 `easeTo` 展开
- 单点样式：分类色填充圆（radius 9）+ 白色描边（2.5px），颜色通过 MapLibre `match` 表达式动态映射

**涉及文件：**
- `src/components/Map/MapExplorer.tsx` — 新增 `setupEventClusters()`，移除旧 DOM marker 渲染逻辑
- `src/components/Map/markers.ts` — 移除 `eventMarkerEl`、`checkinMarkerEl`、`spreadOffsets`，只保留 `anchorMarkerEl`

---

### 打卡/发帖删除功能

**背景：** v1 缺少删除自己内容的能力。

**实现：**
- 新增 `DELETE /api/checkins/[id]`：只允许删除 `userId === "me"` 的打卡
- 新增 `DELETE /api/events/[id]`：只允许删除 `sourceType === "USER"` 的发帖
- 地图点击弹窗底部增加红色"删除"按钮，删后自动刷新对应图层

**涉及文件：**
- `src/app/api/checkins/[id]/route.ts` — 新建，DELETE handler
- `src/app/api/events/[id]/route.ts` — 新建，DELETE handler
- `src/services/checkins.ts` — 新增 `deleteCheckin()`
- `src/services/events.ts` — 新增 `deleteUserEvent()`
- `src/components/Map/MapExplorer.tsx` — 弹窗 HTML 加入删除按钮，通过 ref 传递删除回调

---

### 地图标记现代化设计

**背景：** 原水滴针视觉风格偏旧，需更现代。

**实现：**
- 活动点改为分类色填充圆 + 白色描边（替代水滴针 SVG）
- 聚合圆改为白底 + 浅灰边框 + 深色数字
- 锚点针（拖拽）保留水滴造型，简化为扁平蓝色 + drop-shadow，去掉多余装饰

**涉及文件：**
- `src/components/Map/markers.ts` — 重写 `anchorMarkerEl()`
- `src/components/Map/MapExplorer.tsx` — 事件/打卡点渲染改为 circle 图层

---

### "我的"筛选 chip

**背景：** 需要快速过滤只看自己发帖/打卡，排除抓取的活动。

**实现：**
- `FilterState` 新增 `mineOnly: boolean` 字段
- Filters 组件末尾增加琥珀色"我的"chip（人形图标）
- `mineOnly` 激活时只显示 `sourceType === "USER"` 的活动；打卡层始终可见（v1 单用户全是自己的）

**涉及文件：**
- `src/components/Map/Filters.tsx` — 新增 mineOnly chip
- `src/components/Map/MapExplorer.tsx` — `filtered` useMemo 增加 mineOnly 过滤条件

---

## 2026-06-09（初始化）

### 项目初始搭建

- Next.js 16 + TypeScript + Tailwind v4 + Prisma 7 + MapLibre GL JS
- 实现地图页、推荐页（占位）、个人页
- 数据提取管线：connpass / 东京都开放数据 / 样例 fixtures → LLM 抽取 → GSI 地理编码 → 入库
- 提取质量 eval 框架（`scripts/eval-extraction.ts`）
- 底部三 tab 导航：地图 / 推荐 / 个人
- FAB 浮动操作按钮：打卡 + 锚点发帖
