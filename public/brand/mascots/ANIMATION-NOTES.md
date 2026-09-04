# Full-body character animation candidates

## Stage 2: album, map and thinking

Reuses the existing portrait atlas without new generated assets. CSS continuously moves photos into an album, points along a map route, and writes in a notebook. `LoadingFeedback` supplies an 88px compact layout, 250ms presentation delay and a 12-second long-wait notice. Integrated into personal route/auth/content loading, map initialization, transport planning, AI chat and AI itinerary planning. Existing reduced-motion and visibility pausing apply to every new action.

## September 4: continuous calendar and discovery scenes

`loading-portraits.webp` is a 1024-square transparent 2×2 atlas: Kumoashi, Kumoashi Sakura, Michiru, Michiru Lilac in reading order. Generated using built-in imagegen from `menu-user-v4.png`, resized and encoded with Sharp. The source PNG remains in the Codex generated_images folder.

`LoadingScene.tsx` and its CSS module animate stable portraits, hands, pages and a magnifying glass continuously over 2.8/3.2-second loops. This is layered 2.5D motion, not a 30fps video or full character rig. Reduced motion removes animation; hidden documents pause it. No-IP mode omits the scene. The old eight-frame wave below remains in other feedback until subsequent rollout.

Validation: desktop Chromium sample had a 16.7ms median requestAnimationFrame interval over 180 callbacks with none over 34ms; this measures browser scheduling in that environment, not a real-phone frame-rate guarantee. Checked a 390×844 viewport, no-IP mode, alternate portrait selection and reduced motion.

Final built-in imagegen prompt:

> Production layered animation asset, reference-image identity preservation. Make a perfectly aligned 2 by 2 grid of FOUR isolated FRONT-FACING HEAD-AND-SHOULDERS portraits, equal square cells, same scale and baseline. Top left: male white cloud Kumoashi blue hat coral heart cyan star blue scarf (reference third row). Top right: female white cloud Kumoashi purple hat pink heart purple scarf (reference fourth row). Bottom left: navy hood Michiru (reference first row). Bottom right: purple hood feminine Michiru (reference second row). Exact approved 3D toy character likeness and colors. Both eyes open, gentle happy expression, looking slightly downward toward where a calendar will be placed later. Entire hats and shoulders safely inside each cell, 10 percent margins. NO HANDS, NO ARMS, NO PROPS, NO feet; shoulders end cleanly at lower chest. This is a layer to place behind separately animated hands and props. Genuine transparent alpha background everywhere outside characters. No checkerboard, no shadow floor, no glow, no text. 1024x1024 square atlas, 512 square cells.

## Earlier eight-frame candidates

Built-in imagegen generated four 8-frame sheets (4 columns × 2 rows), then performed background extraction. Sources: the user-approved September 4 character design sheet.

Files: loading-kumoashi.png, loading-kumoashi-sakura.png, loading-michiru.png, loading-michiru-lilac.png.

Prompt: Preserve the approved full-body character with entire hat, hands, cape and both feet. Eight equal-cell frames, fixed scale and baseline. Friendly wave: neutral, raised hand, half-closed eyes, closed eyes, reopening, lowering hand, returning to neutral. Transparent RGBA, no checkerboard, labels, floor or shadows.

Extraction prompt: Remove only the drawn white/gray checkerboard to genuine alpha transparency; preserve all eight frames, internal white surfaces, full feet and costume.

Playback: approximately 1.68 seconds including neutral holds; hidden tabs and reduced-motion preferences pause playback. No-IP mode omits the character entirely.

Quality note: these are initial animation candidates. Generated edge residue and frame registration still require visual acceptance; do not describe them as hand-animated or a final smooth animation master.
