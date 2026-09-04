# 菜单 IP 第二版生成记录


## 统一单角色菜单最终稿

每套固定同一个角色，四个道具顺序为地图、日历、放大镜、个人卡片。以下提示词通过内置 imagegen 分别执行；需要时再执行上面的透明提取。

### kumoashi

Use case: precise-object-edit. This reference is a four-icon menu sprite. Make ALL FOUR icons feature ONLY Kumoashi, the WHITE CLOUD mascot with INDIGO scarf and coral heart head ornament from the LAST TWO reference cells. Do not mix two mascot identities. Keep four dominant functional props in exact order: folded MAP with large location pin, CALENDAR with rings/date grid, large MAGNIFYING GLASS, PERSONAL PROFILE CARD with person silhouette. Each shows the SAME named mascot as a compact bust holding the respective LARGE prop, not a full-body walk. Match the reference premium 3D materials and identity exactly, standard white/indigo/coral/mint. Equal four columns, evenly centered and separated, no overlap. Genuine transparent ALPHA background; NO checkerboard pixels, no colored backdrop, no glow, no floor, no text. Preserve prop clarity at 52px. Output one horizontal strip, four complete icons with safe margins.

### kumoashi-sakura

Use case: precise-object-edit. This reference is a four-icon menu sprite. Make ALL FOUR icons feature ONLY feminine Kumoashi, the CLOUD CURL mascot with flower cape from the LAST TWO reference cells. Do not mix two mascot identities. Keep four dominant functional props in exact order: folded MAP with large location pin, CALENDAR with rings/date grid, large MAGNIFYING GLASS, PERSONAL PROFILE CARD with person silhouette. Each shows the SAME named mascot as a compact bust holding the respective LARGE prop, not a full-body walk. Match the reference premium 3D materials and identity exactly, saturated rose pink and lilac with deep plum edges and shadows, bright dimensional feminine styling, high contrast against WHITE UI. Equal four columns, evenly centered and separated, no overlap. Genuine transparent ALPHA background; NO checkerboard pixels, no colored backdrop, no glow, no floor, no text. Preserve prop clarity at 52px. Output one horizontal strip, four complete icons with safe margins.

### michiru

Use case: precise-object-edit. This reference is a four-icon menu sprite. Make ALL FOUR icons feature ONLY Michiru, the NAVY LOCATION-PIN HOOD mascot from the FIRST TWO reference cells. Do not mix two mascot identities. Keep four dominant functional props in exact order: folded MAP with large location pin, CALENDAR with rings/date grid, large MAGNIFYING GLASS, PERSONAL PROFILE CARD with person silhouette. Each shows the SAME named mascot as a compact bust holding the respective LARGE prop, not a full-body walk. Match the reference premium 3D materials and identity exactly, standard navy/indigo/cream/coral/mint. Equal four columns, evenly centered and separated, no overlap. Genuine transparent ALPHA background; NO checkerboard pixels, no colored backdrop, no glow, no floor, no text. Preserve prop clarity at 52px. Output one horizontal strip, four complete icons with safe margins.

### michiru-lilac

Use case: precise-object-edit. This reference is a four-icon menu sprite. Make ALL FOUR icons feature ONLY feminine Michiru, the PINK LOCATION-PIN HOOD mascot with elegant flower clasp from the FIRST TWO reference cells. Do not mix two mascot identities. Keep four dominant functional props in exact order: folded MAP with large location pin, CALENDAR with rings/date grid, large MAGNIFYING GLASS, PERSONAL PROFILE CARD with person silhouette. Each shows the SAME named mascot as a compact bust holding the respective LARGE prop, not a full-body walk. Match the reference premium 3D materials and identity exactly, saturated rose pink and lilac with deep plum edges and shadows, bright dimensional feminine styling, high contrast against WHITE UI. Equal four columns, evenly centered and separated, no overlap. Genuine transparent ALPHA background; NO checkerboard pixels, no colored backdrop, no glow, no floor, no text. Preserve prop clarity at 52px. Output one horizontal strip, four complete icons with safe margins.


使用内置 imagegen，以 nav-standard.png / nav-feminine.png 为身份参考。最终稿经单独背景提取并检查为 32-bit RGBA；原始生成未严格遵循方格比例，因此显示组件按实际区域取图，不拉伸。

## 共用提示词

Create a production bottom-menu IP sprite strip, four equal SQUARE cells in one horizontal row (4:1 canvas). Each icon is a compact half-body 3D mascot portrait behind a LARGE functional object filling the lower half of its square. Left to right: Michiru holding a folded MAP with huge location pin; Michiru holding a block CALENDAR with binder rings and clear date grid; Kumoashi looking through an oversized MAGNIFYING GLASS; Kumoashi holding a PERSONAL PROFILE CARD with obvious head-and-shoulders silhouette. The functional objects must be visually dominant, instantly identifiable at 44px. Keep original mascot identities from reference, recognizable faces/hood/cloud hairstyle and premium dimensional toy rendering, but entirely new compact menu-specific composition. NO full body/legs, no tiny props. Four isolated centered icons in equal squares, same visual size, 8% transparent margin per cell, no overlap. Genuine transparent alpha background, NO backdrop, NO glow haze, NO checkerboard, no floor, no words, no watermark. Strong form shadows and crisp colored edges for WHITE website background.

## 女性版补充

FEMININE VERSION: preserve feminine faces and elegant flower/cape details. Use saturated rose-pink #DA4A8C and rich lilac #9870D0 middle tones, deeper plum #683979 edges and occlusion shadows, warm highlights and mint accents. NOT washed out, NOT white-on-white, not merely thin pastel outlines. Pink-purple bodies clearly dimensional and solid against white. Map/calendar/lens/profile-card props must have saturated borders and strong contrasting symbols.

## 标准版补充

STANDARD VERSION: preserve standard indigo/coral/mint mascot identities. Michiru navy hood/cream face; Kumoashi fluffy cloud face and indigo scarf with coral heart. Rich indigo form shadows, bright coral symbols and mint map/lens highlights. Compact half-body or busts, equal SQUARE icon frames, no tall narrow full body posing.

## 两版均执行的透明提取

Use case: background-extraction. Edit target is the supplied four function-menu mascots. Remove the baked white/gray checkerboard entirely and output genuine transparent ALPHA PNG. Preserve every character and prop pixel appearance, pose, contrast, saturated colors, shading, exact composition and dimensions. Change ONLY the backdrop. No checkerboard, no background, no halo, no text. Keep all four cutouts, same order and positions.
