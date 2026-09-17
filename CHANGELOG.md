# Changelog

All notable changes to FixFlow are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.13.0](https://github.com/ElyasOmarcodes/FixFlow/releases/tag/v0.13.0) - 2026-09-17

### Changed

- **The app is now FixFlow.** New name, new mark, new package identifier (`com.fixflow.app`) — one Material Symbol, `auto_awesome_mosaic`, on the brand gradient: three panels, one tall and two stacked, which is what this app lays out. The mark lives in one SVG that a script renders into every launcher icon and splash, so the icon on a home screen and the one in the toolbar cannot drift apart. Projects already on a machine are untouched: the storage keys keep their old names on purpose, because renaming them would not migrate that data, it would hide it. On Android the new identifier means this installs alongside the old app rather than over it.
- **The colour control is a picker, not a wall.** It was a native `<input type="color">` beside a raw hex box, under two rows of swatches, under a recents strip — all always open, in a 280px sidebar, and repeated for every gradient stop. There was no way to actually *choose* a colour; you either knew its hex or you clicked through to the operating system's own dialog. It is now one row until you open it, and then a saturation/brightness field, a hue rail, the hex, the eyedropper where the browser has one, and swatches organised behind brand / recent / palette tabs.
- **Every group of properties says what it is.** The panel was a stack of identical unlabelled cards — a blur slider and a shadow toggle shared one anonymous box — so there was no way to tell which control belonged to which idea. Each group now has a heading, an icon and a fold, and remembers which ones you keep closed. Several dozen labels that had never been translated now are, in all three languages.

### Added

- **The whole Google icon catalogue, browsable.** The online picker drew every cell as its own request, so it showed 120 of 4,403 and the rest were reachable only by guessing the right search term. It now loads one Material Symbols font — ~320 KB, every glyph — and virtualises the grid, so the entire catalogue scrolls at the cost of the thirty cells on screen. About 144 names the font has no ligature for fall back to the image endpoint rather than being spelled out in letters across their neighbours.
- **Online icons on a chip.** The chip picker was library-only because a chip drew its glyph as strokes on a fixed 24-grid. It now reads the glyph's own coordinate box and paint mode, so all three styles and seven weights work there too.
- **Translate the whole design in one action.** The localisation view keeps one design in many locales side by side, which is the wrong shape for "this is in English, make it Pashto" — that meant retyping every layer by hand, and chips could not be translated at all. The toolbar now collects every string on the canvas, chips and grouped layers included, translates a slide's worth per request so the wording stays consistent, and writes it all back as a single undo step.

### Fixed

- **Copying a style onto an icon or a chip does something.** Neither layer type had an entry in the style table, so the copy took an empty style and the paste silently did nothing.
- **The app follows the system theme on a phone.** Applying the theme lived in a control that is not mounted on narrow screens, so a phone stayed dark until the overflow menu was opened once. The theme is now applied before the first frame, and the status and navigation bars are tinted to match it.
- **The switches in the mobile properties sheet are the right shape.** A coarse-pointer rule raised the minimum height of every button in the panel, which stretched a 44×20 switch into a 44×40 lozenge. Touch targets are now grown with a transparent overlay instead, so a control stays the size it was drawn.

## [0.12.0](https://github.com/ElyasOmarcodes/FixFlow/releases/tag/v0.12.0) - 2026-09-17

### Fixed

- **The app no longer vibrates on every tap.** A delegated listener answered every press in the app with a haptic. That is not what native apps do and it is exhausting on a phone. The buzz is now reserved for a long press — the one gesture with no visual start, where it is the only signal the hold registered.
- **Android Back no longer leaves the app from anywhere in the editor.** It unwinds what you are holding first — an open text editor, then group edit, then a multi-selection, then a single selection — and only an empty stack reaches the shell, which asks once ("press back again to leave") instead of exiting on the first press.
- **The slide long-press menu works on mobile again.** It relied on the browser's `contextmenu`, which a touch hold does not reliably fire on a `<button>` — and the slide thumbnails became buttons in 0.11.0. The hold is now measured from pointer events, so it works on every element and can be felt before the menu appears. The menu also gained the `role` it never had, which made it invisible to a screen reader.
- **Layers no longer jump after a pinch-zoom.** A two-finger zoom usually starts with one finger already down, and if that finger landed on a layer Konva had begun dragging it. The pinch then swallowed the touch events Konva needs for its own bookkeeping, leaving a stale pointer position for the next gesture to measure against, and a `dragend` reporting wherever the finger happened to be when the second one arrived. A drag interrupted by a pinch is now abandoned rather than committed, the lift reaches Konva so it can clean up, and the tap that ends the gesture is ignored.
- **An icon's backing plate no longer moves or resizes the icon.** The layer's origin was the plate's corner with the glyph inset by the padding, so switching a plate on — or changing its padding or corner radius — appeared to reposition and resize the layer. The origin is the glyph now and the plate grows outward around it; existing projects are migrated so nothing shifts. The plate also had a 12%-white default fill that was invisible on most designs, and its corner radius could exceed half the plate and distort the shape.

## [0.11.0](https://github.com/ElyasOmarcodes/FixFlow/releases/tag/v0.11.0) - 2026-09-17

### Added

- **The whole Google icon catalogue.** The online tab searched a hand-picked list of 159 names; it now carries all 4,403 Material Symbols from fonts.google.com/icons, in the three styles Google draws them in (outlined, rounded, sharp), across the fill axis and the seven weights. The names are bundled — Google's metadata endpoint sends no CORS header, so a browser cannot read it and a search box backed by it would always be empty — and they load as their own lazy chunk, so the main bundle grows by 6 KB rather than 74. Only the geometry of the icon you actually pick is fetched. Search ranks an exact name first, then a match at the start of a word, then one buried inside one, so "car" offers `car` and `car_rental` before `scorecard`.
- **Android hardware integration.** Back unwinds the surface stack in the order you opened things; pressing a control answers in the hand; the status bar follows the app's theme; the keyboard's height is published to the layout so sheets sit above it rather than under it.
- **A written answer to "what does an API key get me".** The AI help chapter now covers each feature, how to choose a provider, what it costs, and what every error the app can show actually means — in English, Pashto and Persian.

### Changed

- **A chip's icon side is an explicit left or right.** It was `start`/`end`, which reads as writing-direction relative and never was: the design canvas is pinned left-to-right so the exported PNG does not change with the interface language. Projects that stored the old values are migrated on load.
- **The format-scoped warning is shown once.** The yellow frame around the canvas and the banner under the toolbar reappeared on every switch away from Base. Each kind of scoping now announces itself the first time and then stays quiet.
- **Launch order is splash → projects page, always.** The start screen is a lazy chunk and the splash did not wait for it, so on a slow connection the editor showed through in between. It is preloaded under the splash instead.
- **Slide thumbnails in the navigator are real buttons** — as bare `div`s the primary way to move between slides was invisible to the keyboard and to a screen reader.

### Fixed

- **Dialogs no longer open behind the mobile panels.** `ModalShell` defaulted to `z-50` while the side sheets are `z-60`, so the icon picker opened from the properties sheet was underneath it and the sheet had to be closed to reach it. Other dialogs had papered over the same clash with `z-[9999]`, which is why some opened correctly and some did not. There is now one z-index scale in the design tokens and nothing outside it.
- **Controls that broke in the light theme.** Style › Shadow's switch was a white knob on a near-white track: the component took six styling props and every call site passed its own, so they had drifted — one knob stopped short of the track end, and the Shadow one was a bespoke 44×24 built from hardcoded dark-theme colours. The switch is now closed and sized by a prop. The same hardcoded-dark problem left the gradient colour block a black hole in the middle of a light panel and the Help chapter's bold text a pale grey on white; translucent hairlines, fills, text colours and the semantic colours are all tokens that invert with the theme.
- **Releases no longer accumulate old installers.** The Cargo cache covers `src-tauri/target`, which is also where the bundler writes, so a restored cache carried the previous release's `bundle/` directory and the collect step picked up both versions — v0.10.0 published with three v0.9.0 files attached. The bundle directory is cleared before each build, collection asserts every file carries the current version, and the release job removes any asset already on the tag before uploading, so a release is exactly what that run produced.
- **Web behaviours that gave the WebView away**: long-press raising the browser's own menu over the app's, a stray file drop navigating the editor away, a pinch scaling the page under the canvas, and focusing a field zooming the viewport to a scale the app could not undo.

## [0.10.0](https://github.com/ElyasOmarcodes/FixFlow/releases/tag/v0.10.0) - 2026-09-17

### Added

- **A start screen.** FixFlow opens on a launch page — recent projects first, the template gallery second, a new blank project or an imported `.json` one click away — instead of dropping you into whichever project happened to be open last. It layers over the editor rather than replacing it, so the Konva stage and its observers stay mounted and dismissing it is instant. Escape leaves, Android Back leaves, the toolbar logo brings it back, and a checkbox at the foot turns it off for good. While it is up the editor's shortcuts are held, so <kbd>Delete</kbd> cannot remove a layer nobody can see.
- **Chip is a real layer type.** It used to be a group holding a rounded rect with a text layer parked on top, which meant every edit was a trip into group-edit mode and the pill never re-fitted its own label. A chip is now one layer whose box is derived from its text, padding and optional glyph, with its own inspector for label, font, text colour, background fill, corner radius, padding and the icon's side, size, gap and colour. Chip labels also appear in the localization view and the CLI manifest alongside text layers — a chip on a store screenshot is copy, and copy gets translated.
- **An icon layer, with 155 bundled glyphs across 17 categories.** Drawn as vector geometry rather than a bitmap, so it stays sharp at a 1290px export and its colour and line weight remain properties rather than baked pixels. An optional backing plate sits behind it with its own fill, padding and corner radius.
- **Google Material Symbols in the icon picker.** A second tab fetches any of 159 verified symbols straight from `fonts.gstatic.com`, which answers with `access-control-allow-origin: *` — no proxy and no server. The bundled library stays the default because it works offline, in the desktop shell and in the headless exporter. A fetched glyph's path, viewBox and paint mode are stored on the layer, so a project that travels to another machine renders without the network; the two sets are not interchangeable (library glyphs are stroked on a 24-grid, Material's are filled shapes on `0 -960 960 960`) and the renderer reads which it has rather than assuming.
- **Stacking order on the selection toolbar.** The bar under a selected layer now carries duplicate, bring to front, bring forward, send backward and send to back. The background stays pinned at the bottom and cannot be displaced.
- **Long-press to reorder the format tabs.** The two chevrons that nudged the active format one slot at a time are gone; the tabs are sortable. A held press starts the drag, so a plain tap still switches format — tap and drag cannot be told apart at the instant contact is made, and a distance-only threshold turns every slightly imprecise tap on a phone into a reorder.

### Changed

- **The three editorial templates are redesigned.** Noor, Orbit and Serein were two layouts alternating over seven slides: the same bones each time, a flat single-colour background, one font at weight 700 for headline and body alike, and no panorama. Each is now an arc of six slide groups over the same seven slides — hero, a panorama with the device crossing the seam, feature cards, a two-device showcase with its numbers, a detail slide and a close — with a palette per surface, a display face paired against a text face, and real weight hierarchy. They are generated from one layout system (`scripts/build-editorial-templates.mjs`), because the three share everything but palette and copy, and that is what let them drift apart in the first place.
- **The template gallery shows what each template looks like.** There are no rendered thumbnails, so every card was the same placeholder icon. Cards now paint the template's own first-slide fill, built into the manifest by a generator that also derives name, category and slide count from the template files — the manifest was hand-maintained and could drift from what it described.
- **Actions on the selection box are the four corners you asked for:** delete top-left, lock top-right, resize bottom-left, rotate bottom-right. Resize and rotate are drags rather than buttons, because that is the gesture the job needs — Konva's own anchors are 10px squares, fine with a mouse and hopeless with a fingertip, and there was no rotate affordance on touch at all. Rotation quantises to 45° while smart snap is on, so one toggle governs angle and position. The grips now appear on phone and tablet: they were hidden below 74 screen pixels, which is exactly what a shape at fit-zoom on a phone measures, and since they sit *outside* the box they never covered the layer anyway.
- **The mobile "…" toolbar is a bottom sheet.** Tapping it un-hid the desktop toolbar and let it wrap: a row built for 1440px folded into four ragged lines of unlabelled icons with dividers stranded mid-row. The same actions are now presented the way a phone presents things — labelled targets grouped by what they do, two columns on a phone and four on a tablet, where it becomes a centred dialog. The desktop toolbar is no longer rendered at all on compact widths rather than merely hidden, so its controls no longer haunt the accessibility tree as ghost twins of the sheet's.
- **Slide thumbnails in the navigator are real buttons.** As bare `div`s, the primary way to move between slides was invisible to the keyboard and to a screen reader.

### Fixed

- **The canvas-format menu that never fit.** It carried `max-h-[min(30rem,calc(100vh-5rem))]`; in an arbitrary Tailwind value that renders as `calc(100vh-5rem)` — no spaces around the operator, which is invalid CSS — so the declaration was dropped and the menu grew to its natural ~1080px. The body does not scroll, so on an 844px phone everything past the fold, including "Custom size…" and the DPI dialog behind it, was unreachable. The limit is now computed from where the menu opens, in `dvh` so Android's URL bar cannot lie about it.
- **Menus that would not close.** Neither the format menu nor the custom-size dialog answered Escape, and dismissal listened only for `mousedown` — which touch browsers synthesise late, and not at all when the tap is consumed. Both now close on Escape and on `pointerdown` outside.
- **The slide-count controls that hung over the canvas.** They were a `<details>` that became a floating panel on compact widths, closable only by finding the same small summary again. They are now the first card in the slide strip, sized like a slide card, opening a popover upward with a title and a close button.
- **Each handle gesture is one undo step.** History is paused for the drag so a hundred pointer moves do not become a hundred entries — but pausing alone left nothing to undo at all, so release rewinds to the starting values while still paused, resumes, then reapplies the result.

## [0.9.0](https://github.com/ElyasOmarcodes/FixFlow/releases/tag/v0.9.0) - 2026-09-16

### Added

- **Smart snap.** A toolbar toggle: while you drag, a layer latches onto the edges and centres of the other layers, the canvas, and each pano slide seam, with guides showing which alignments it found. Both axes resolve independently, so you can slide along one guide instead of being trapped at an intersection; a centre alignment wins a tie against an edge; and every line the box settles on is drawn, not only the one that caused the snap — which is why aligning two boxes shows three guides rather than one. The magnet is measured in screen pixels and divided by zoom, so it reaches the same physical distance at 10% and at 200%. Hold <kbd>Alt</kbd> to suspend it mid-drag. The preference lives in `localStorage` rather than the project: it describes how you like to work, so it must not travel with an exported design or enter the undo history.
- **Actions on the selection box.** Delete, duplicate, lock and edit sit on the four corners of the selected layer, just outside the resize anchors so both stay usable. They step aside during a drag or resize instead of chasing the pointer, hide below ~74 on-screen pixels where they would swamp the layer, and never appear on the background, which spans the whole canvas.
- **Templates open as their own project by default.** The gallery now asks where a template should land. Appending its slides to the project you already have open is still available, but it is a deliberate choice rather than the only behaviour.
- **Pashto and Persian/Dari interface languages, with right-to-left layout.** A new Language section in Settings switches the editor chrome between English, پښتو and فارسی / دری; the choice persists locally and is detected from the browser's languages on a first visit (Dari `prs` maps to Persian). `lang`/`dir` are stamped on `<html>` before first paint so an RTL interface never flashes left-to-right. The design canvas stays pinned left-to-right — mirroring it would flip slide coordinates and pano seams while the exported PNGs stayed identical. Interface language is deliberately separate from a project's design locales: switching it changes no slide and no export.
- **20 Pashto / Persian / Arabic-script fonts**, led by Vazirmatn (وزیر متن), plus Noto Sans/Naskh/Kufi Arabic, IBM Plex Sans Arabic, Cairo, Tajawal, Almarai, Readex Pro, Baloo Bhaijaan 2, Reem Kufi, Lalezar, Amiri, Scheherazade New, Lateef, Harmattan, Alkalami, Markazi Text, Gulzar and Noto Nastaliq Urdu. All carry the extra Pashto letters (ټ ډ ړ ږ ژ ښ ګ ڼ ې ی) on top of the Arabic and Persian sets, so a Pashto headline no longer breaks joining mid-word.
- **A script filter in the font picker** (All / Latin / پښتو) and a dedicated Arabic-script section whose rows preview each face with its own-script name — a Latin "Aa" sample says nothing about a Naskh or Nastaliq design. Font search now matches the native name too, so typing "وزیر" finds Vazirmatn.
- **Desktop and Android app builds.** `.github/workflows/apps.yml` builds Windows (`nsis`), macOS (one universal `dmg`) and Linux (`deb`, `rpm`) installers via Tauri v2, plus an Android APK/AAB via Capacitor, and attaches them to every `v*` release. Both shells wrap the same web bundle, so there is no second codebase. The Linux `.deb` measures 1.8 MB around a 3.7 MB stripped binary, and the APK lands at ~4–6 MB, against roughly 120 MB for an equivalent Electron build: Tauri uses the OS webview instead of bundling Chromium, the Rust release profile is tuned for size (`opt-level = "s"`, LTO, one codegen unit, `panic = "abort"`, stripped), no Tauri plugins are linked in, and the Android release build runs R8 code and resource shrinking. See `docs/native-apps.md`.

### Fixed

- **Opening a template no longer mixes two designs on one canvas.** Applying a template always merged its slide groups into the current project, so two designs with different canvas sizes, backgrounds and brand palettes ended up stacked. Appending now also re-derives the project's active formats and clears the selection, group-edit and inline-text ids that pointed into the outgoing group — those stale ids were what left transformers floating over the new canvas. The same clearing covers opening a project and starting a new one.
- **Right-to-left layout.** The chrome moved to logical properties throughout, so Pashto and Persian mirror properly: panels, dropdowns, popovers, sheet close buttons and tree indentation all follow the writing direction. Arrows and chevrons that mean "backwards along the line" mirror; vertical arrows do not. The horizontal scroll affordance measured `scrollLeft`, which counts down from zero in an RTL container, so its edge fades were inverted. The design canvas stays pinned left-to-right, as before.
- **Handheld and tablet layout.** Seven overlapping media queries that redefined the same classes were consolidated into three tiers. Tablet is now a real tier rather than a large phone: the layers sheet takes the lower two thirds so the canvas stays visible, the tool rail is labelled, and the insert menu is four across. The zoom pill and the selection toolbar both sat at the bottom of the canvas and overlapped on any narrow screen; they now stack.
- **AI connection errors are readable.** A failed provider call pasted the raw JSON body into the settings panel, burying the one line that said what was wrong. Responses are now parsed for the provider's own message and paired with a remedy for the status — a leaked key, a referrer-restricted key, an unknown model id and a quota limit each say what to do next.

### Changed

- **Motion.** Four easing curves and five durations as design tokens, with entrance animations for modals, sheets and popovers, a real exit transition for dialogs (they used to vanish on the frame they were dismissed), and uniform press feedback across the chrome. All of it collapses under `prefers-reduced-motion`.
- **Every emoji and Unicode dingbat used as a UI icon is now a real SVG icon.** The editor drew its chrome with characters like 📱 🎨 ◉ ✕ ▾ ⠿ ⌫, which render differently on every platform, ignore the theme colour and look nothing like a native control. `src/components/ui/Icon.tsx` is a single hand-rolled 24×24 stroke sprite (no icon-font or runtime dependency added) wired through the toolbar, layers panel, assets, slide navigator, properties inspector, projects/templates/settings/help modals, canvas overlays, editing-context bar and the localization view. Emoji that are actual canvas *content* — the emoji-layer palette and the emoji layer's default value — are untouched.
- **Native browser widgets restyled to read as app chrome.** Scrollbars are overlay pills on a transparent track (with Firefox `scrollbar-color` and no stepper arrows); `<select>` gets the app's own chevron instead of the OS dropdown button, mirrored under RTL; range sliders render one flat rail and accent knob across WebKit and Gecko; checkboxes are custom boxes with drawn check and indeterminate states; colour inputs are flat chips instead of the inset native swatch; number spinners, autofill tinting, search-clear and password-reveal chrome are suppressed; the platform focus ring is replaced by an accent `:focus-visible` ring; and chrome no longer drag-selects like a document while inputs and contenteditable surfaces stay selectable. The rules live inside `@layer base` so component Tailwind utilities still win over them.

## [0.8.3](https://github.com/Pr0xS/FixFlow/compare/v0.8.2...v0.8.3) - 2026-08-14

### Fixed

- Export button no longer stays permanently disabled after a fresh page load. Stage readiness was only re-checked when the active slide group's memoized reference happened to change (e.g. after opening Preview first); it's now re-checked whenever the Export modal opens and polls for the Konva stage to mount instead of giving up after a single synchronous check.
- Export format checkboxes now respond correctly when clicking directly on the checkbox, not just its label text. A redundant click handler on the wrapping `<label>` (with `preventDefault()`) was firing alongside the checkbox's own `onChange`, double-toggling the selection back to its original state when clicking the tick itself.
- Export formats and locales can now be freely checked/unchecked, including down to zero of either. Previously the last checked item silently refused to uncheck with no visible reason. The Export button now disables itself (with a clear "Select at least one format/locale to export" hint) instead of blocking the interaction.

## [0.8.2](https://github.com/Pr0xS/FixFlow/compare/v0.8.1...v0.8.2) - 2026-08-14

### Security

- `js-yaml` bumped from 4.3.0 to 4.3.1, fixing a high-severity quadratic-CPU-consumption DoS in `!!omap` resolution ([GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj)).
- Transitive `nanoid` (pulled in by `postcss`/vite's toolchain) pinned to `^3.3.18` via `overrides`, fixing an infinite-loop DoS when a custom generator's `size` is zero ([GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8)). FixFlow's own runtime `nanoid` (v5, used for layer IDs) is unaffected and untouched.
- Transitive `brace-expansion` (pulled in by `eslint`'s `minimatch`) pinned to `^5.0.9` via `overrides`, fixing three high-severity DoS advisories ([GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895)).
- `npm audit` now reports 0 vulnerabilities (was 3 high).

## [0.8.1](https://github.com/Pr0xS/FixFlow/compare/v0.8.0...v0.8.1) - 2026-08-14

### Fixed

- Preview modal loading bar now reflects real per-slide capture progress (e.g. "3 of 7") instead of a static animated placeholder, and only blurs the slide group currently regenerating instead of every thumbnail.
- Export now shows real progress across format × locale combinations (e.g. "iPad · Italian") with a live percentage, and can be cancelled mid-export via a new Cancel button without corrupting editor or stage state.

## [0.8.0](https://github.com/Pr0xS/FixFlow/compare/v0.7.1...v0.8.0) - 2026-07-30

### Added

- Format families: every slide group now belongs to a device category — Phone, Tablet, Watch, Desktop, TV, VR, or Game — each with its own authoring Base canvas and default device-surface rebasing (e.g. switching to Tablet auto-rebases Phone mockups onto iPad/Android Tablet; Watch onto Apple Watch/Wear OS).
- A family switcher in the editing bar, family forking (spin up a new family from an existing Base/format layout, scaled to fit), and a stable `slideKey` identity that links "the same conceptual slide" across families even once their layouts diverge.
- "Bring content from…" — pulls text and images from the matching slide in another family into the current slide, without touching layout; previews every change before confirming and skips layers with no counterpart or a mismatched type.
- New device mockups: Apple Watch, Wear OS, Android Tablet, and additional iPad variants.
- Offscreen thumbnail precache pipeline: an inert offscreen capture stage precaches thumbnails per family/format in the background, with bounded settle waits and imageless-stage settling, instead of only generating thumbnails on-demand when a slide group is visited.
- Sliding-well redesign of the format/locale editing tab bar.
- Open-core extensibility seam and an async project storage layer, laying groundwork for pluggable storage backends.
- `docs/help/*.md` — the in-app Help modal's 14 chapters are now plain Markdown files in the repo, the single source of truth for user-facing documentation (readable directly on GitHub and rendered in-app), replacing the hand-written `HelpContent.tsx` and the stale, unreferenced `HELP.md`. Documents the new format-family model and "Bring content from…" for the first time.

### Fixed

- Phone status bar/model no longer leaks onto Watch family layouts; corrected Apple Watch screen symmetry and redesigned Wear OS side controls.
- Preview modal: no longer reverts to the previous slide instead of following the one you clicked, and no longer leaves `activeFamily` stale after a cross-family format switch (which previously left Preview showing zero slides).
- Several thumbnail-capture race conditions: stale cache-key validation on read, decoded-image caching to stop a black flash on slide switch, and real pending-image-load tracking so stage settling doesn't declare victory before images actually finish loading.
- Switching formats within the same family now does a relative pan + zoom rescale instead of a hard reset.
- Responsive format/locale bar and editor chrome at small screens.

## [0.7.1](https://github.com/Pr0xS/FixFlow/compare/v0.7.0...v0.7.1) - 2026-07-26

### Fixed

- Nav thumbnails no longer go permanently blank after a tab is backgrounded for a long time (or the browser restarts and the tab is revisited). The capture polling loops (`waitForStage`/`waitForStageSettled`) were bounded by wall-clock time but could only advance via `requestAnimationFrame`, which browsers fully suspend for hidden tabs — on resume the clock had already passed the timeout before a single frame fired, so the capture silently gave up with no retry path. Thumbnails are now silently re-captured on `visibilitychange` when the tab becomes visible again.

## [0.7.0](https://github.com/Pr0xS/FixFlow/compare/v0.6.1...v0.7.0) - 2026-07-25

### Added

- Editing a layer's layout (position, size, rotation) while on the Base format tab with a non-default locale active now works, instead of being blocked with a warning. The adjustment is stored as a delta relative to the base value and composes across every active format, so a locale-wide fix (e.g. longer German text) no longer needs to be repeated per format.
- A "Test Connection" button in AI provider settings that exercises the real chat-completion path (translating a short fixed string) instead of just listing models, so it catches providers/models that list fine but fail at call time.

### Changed

- Unified per-locale layout storage from two fields (`localeBaseDelta`, `localeLayoutOverrides`) into one (`localeAdjust`), with a single composing model instead of a most-specific-wins one: format overrides stay absolute/pinned, locale adjustments now always compose on top of them instead of occasionally being shadowed by them. Existing projects migrate automatically.
- The layout-override indicator next to position/size fields now shows independently for format pins and locale adjustments (previously a locale adjustment could be silently shadowed by a format override with no visual indication).

### Fixed

- A per-format locale layout adjustment no longer goes stale when the shared base layout or a format override is edited afterward — it now tracks those upstream edits instead of silently freezing at whatever value it was pinned to.
- Localization table: renamed "Change source" button to "Change default"; default phone layer name changed from "iPhone 16 Pro" to generic "Phone"; fixed sticky Layer column peek-through and scroll jump; synced horizontal scroll across all slide-group sections; added a real trailing gutter after the last locale column; kept the edited text cell fully visible when the docked styling panel opens.

## [0.6.1](https://github.com/Pr0xS/FixFlow/compare/v0.6.0...v0.6.1) - 2026-07-20

### Added

- Eager low-resolution slide thumbnail precache: the nav filmstrip now fills in thumbnails for every slide group shortly after project load/import/slide-group-add instead of only after a group is manually visited/previewed.
- A branded global loading screen shown on app boot that blocks until the initial thumbnail precache completes, with a looping "loading …" word-reel indicator; it only appears once per session (later precache passes stay silent behind the existing lightweight canvas overlay).
- Rebuilt the Help panel into a full 14-section user guide (Projects, Templates, Slides, Layers, Properties, Canvas Formats, Localization, Format × Locale editing, Brand Kit, Assets, Exporting, AI Features, Keyboard Shortcuts) with a searchable sidebar and section navigation, replacing the previous single-scroll overview.

### Changed

- The floating format/locale editing alert now has a single "↩ Base + Default" button that returns both the canvas format and locale to shared/default at once, replacing two separate buttons.
- Removed the confirmation popups on "Use format layout as shared…" and "Reset pairing layout" — both actions are covered by undo (Ctrl/⌘+Z), so the "this cannot be undone" warning was inaccurate.

### Fixed

- Unified all interactive-editor capture paths (thumbnail precache, Preview high-res capture, export) onto the shared capture mutex, closing a latent race between Preview and Export that could corrupt `activeSlideGroupId`/`panoRenderOverride` restoration.
- Preview and precache captures no longer restore a stale active slide group if the project changes mid-capture.
- Slide navigator thumbnail spacing: pano/strip sub-slides now cluster with a tighter, consistent gap so they read as one continuous unit, distinct groups have clearer separation, and a group's name label no longer widens narrow thumbnail strips into uneven gutters.

## [0.6.0](https://github.com/Pr0xS/FixFlow/compare/v0.5.2...v0.6.0) - 2026-07-19

### Added

- Format-scoped per-locale layout overrides: adjust a layer's position, size, or rotation for a specific locale scoped to a specific canvas format (e.g. a German-only fix on Android) without affecting other formats or locales.
- A merged format + locale editing bar and a floating, top-centered context alert that always states what's currently being edited and what's shared vs. scoped — replacing the previous stacked warning banners.
- Grouped format and locale actions (reset layout, reset visibility, make layers shared, promote format layout to shared, reset a locale+format pairing) in a single, clearly sectioned menu.
- Default-locale promotion: promote any locale to become the project's new default, with a dialog explaining what happens to incomplete translations.

### Changed

- Locale storage is now fully symmetric: default-locale content lives in each layer's flat fields (mirrored into `localeContent[defaultLocale]`), non-default content lives in `localeContent[locale]`. Removed the legacy `localeOverrides` field and its dual-path read fallback in the app runtime (the CLI still tolerates raw un-migrated files).

### Fixed

- Base-table locale edits (Localization view) no longer desync `localeContent[defaultLocale]`, which could surface stale source text in exported translation manifests.
- Promoting a locale to default no longer replaces content with an empty string when the target locale has an empty manual override — it now correctly falls back to the previous default's content.
- Inline canvas text editing is now restricted to the default locale, preventing translated content from being silently overwritten by default-locale text when a non-default locale tab is active.
- Arrow-key nudging now reads the resolved (format/locale-aware) position instead of raw base coordinates, fixing a position jump on the first nudge when a format or locale override was already active.
- Editing a layer's layout while on the Base format tab with a non-default locale active now shows an explicit warning that layout changes won't apply there, instead of silently reverting with no explanation.

## [0.5.2](https://github.com/Pr0xS/FixFlow/compare/v0.5.1...v0.5.2) - 2026-07-19

### Added

- Project-scoped asset library: images are now stored per-project in IndexedDB instead of one shared global store, preventing cross-project asset collisions.
- Self-contained project export/import — exported project JSON now embeds every referenced image, so imported projects are portable across profiles/machines.
- Shared UI primitives for modals, numeric inputs, toggles, segmented controls, file uploads, and inline labels.
- Reusable layer-tree walkers, Konva fill conversion, layer interaction/effect hooks, and a pure browser/headless export plan.
- AI transport and export-plan tests covering timeouts, retries, collision-safe filenames, nested layers, and gradients.

### Changed

- Split the canvas stage into focused viewport, selection, drop-target, transformer, geometry, and overlay modules.
- Unified browser and headless export enumeration and made CLI output names collision-safe with `<group>__<slide>.png` naming.
- Improved rich-text segmentation from quadratic scans to a sweep-line implementation and cached text measurements.
- Narrowed Zustand selectors and consolidated repeated layer, property-panel, and modal behavior.

### Fixed

- Prevented deleting the active project from resurrecting it via a stale replacement-load race.
- Fixed image-layer base-locale preview not rendering in the Localization panel (asset-store key wasn't resolved to a data URL).
- Added AI request timeouts and transient retries while preventing non-idempotent image generation from retrying after transport failures.
- Added consistent CLI validation and error reporting with non-zero exit codes.
- Preserved project update timestamps when clearing format-specific state.

## [0.5.1](https://github.com/Pr0xS/FixFlow/compare/v0.4.1...v0.5.1) - 2026-07-16

### Added

- Editable background accent glows with independent color, opacity, blur, position, size, direct canvas manipulation, and overlap-aware selection.
- OpenAI-compatible custom provider support with shared provider/model settings for OpenAI, OpenRouter, Google Gemini, and custom endpoints.
- Four new bundled template sets for nutrition, finance, travel, and productivity.

### Changed

- Template phone screenshots are extracted into the IndexedDB asset store during import to avoid localStorage quota failures.
- AI requests now use a unified OpenAI-compatible client and Google Gemini's compatibility endpoint.
- Background and content interaction layers are separated while editing accents, preserving visual stacking and direct manipulation.

### Fixed

- Removed clipped edges and white halos from blurred canvas elements by padding filter caches and using native canvas blur filters.
- Preserved project export filenames that already include non-PNG extensions.
- Prevented project-library saves from persisting large inline screenshot data URLs.
- Prevented template exports from including project screenshots, image layers, background images, or brand logos.

## [0.4.1](https://github.com/Pr0xS/FixFlow/compare/v0.4.0...v0.4.1) (2026-07-12)

### Bug Fixes

* support multiple simultaneous custom canvas formats ([#37](https://github.com/Pr0xS/FixFlow/pull/37)) ([f3e8280](https://github.com/Pr0xS/FixFlow/commit/f3e8280a0b9074e7704486592ad48aacc255f8f2))

## [0.4.0](https://github.com/Pr0xS/FixFlow/compare/v0.3.3...v0.4.0) (2026-07-07)


### Features

* add checkmark shape type ([170f1b9](https://github.com/Pr0xS/FixFlow/commit/170f1b9d10c22766ba815133ccd192ab942a0017))
* show real slide background behind text previews in LocalizationView ([30fd536](https://github.com/Pr0xS/FixFlow/commit/30fd53634aa8d8ee520ae91a08a6dbdf803cf133))


### Bug Fixes

* apply text weight through rich-text mark system with selection support ([b5e713d](https://github.com/Pr0xS/FixFlow/commit/b5e713d515a36e2f987d8097623954429722ad71))
* correct noise toggle knob alignment in Background properties ([688f34f](https://github.com/Pr0xS/FixFlow/commit/688f34fd5fb0a23b01e4213b49bfa17902e44871))
* cross-slide paste offset cascade + add test coverage for export/import and geometry ([#35](https://github.com/Pr0xS/FixFlow/issues/35)) ([5b048e5](https://github.com/Pr0xS/FixFlow/commit/5b048e53ccd6f407e3afdf42b154d22dd17b0eac))
* keep release-please tags on bare vX.Y.Z format ([#33](https://github.com/Pr0xS/FixFlow/issues/33)) ([1459d94](https://github.com/Pr0xS/FixFlow/commit/1459d94465c7b6f5975fa20c1e69228b339dc183))

## [0.2.3] - 2026-06-14

### Added

- Logo and favicon: new SVG brand mark (two portrait screenshot cards with purple→pink gradient) replaces the generic bolt icon; added `public/logo.svg` wordmark for use in README and OG metadata.
- Current project name displayed in the toolbar between the logo and the Projects button — click to rename inline (Enter to confirm, Escape to cancel).
- README now shows the FixFlow logo at the top, linked to the live demo.
- Richer `index.html` metadata: page title, description, theme-color, Open Graph, and Twitter/X card tags.

### Fixed

- Infinite render loop (`Maximum update depth exceeded`) caused by `useProjectsStore` selector returning a new object on every render; fixed by wrapping with `useShallow`.

## [0.2.2] - 2026-06-14

### Fixed

- OpenCode Go is now explicitly blocked in GitHub Pages/no-proxy production builds before any browser request is attempted, avoiding CORS console errors for both model loading and chat/image calls.
- Removed the hardcoded OpenCode model list from static production mode; unsupported providers now show a clear error instead of exposing models that cannot run.

### Changed

- Image-editing capability hints now treat OpenCode as unavailable in no-proxy static builds.

## [0.2.1] - 2026-06-14

### Fixed

- GitHub Pages AI provider compatibility: OpenCode now uses a local curated model list in no-proxy production builds instead of calling its `/models` endpoint, avoiding the browser CORS failure.
- Google AI requests now switch correctly between direct browser API-key query parameters and proxy header auth when `VITE_AI_PROXY_BASE_URL` is configured.

### Added

- Optional production AI proxy routing via `VITE_AI_PROXY_BASE_URL`, while keeping static GitHub Pages direct-provider mode as the default.
- Fallback model lists for providers when dynamic model discovery is blocked by CORS or network errors.
- Tests covering AI URL routing and OpenCode no-proxy model fallback behavior.

### Documentation

- Documented static-host AI behavior and optional proxy configuration in the README.

## [0.2.0] - 2026-06-14

### Added

- 80+ curated Google Fonts (expanded from 23; includes sans-serif, serif, display, monospace, handwriting)
- Multi-format export: one project exports to multiple platform sizes (iPhone 6.9", Android Phone, iPad 13", Android Tablet) with per-format layout and visibility overrides
- AI translation: auto-translate all text layers to any locale using OpenAI, Anthropic, or compatible APIs
- Brand color system: named brand colors with token binding (`@brand:<id>`) across all fill fields
- Gradient presets: 12 quick-pick gradient swatches in the gradient editor (Midnight, Ocean, Aurora, Candy, Sunset, Fire, Forest, Peach, Royal, Lavender, Neon, Nordic)
- Phone position presets: one-click Center / Hero / Bleed / Tilt ↺ / Tilt ↻ placement for phone mockup layers
- Text placement presets: one-click Top / Middle / Bottom positioning for text layers, pano-aware
- OS file drop on canvas: drag image files from the OS file manager directly onto the canvas to replace a phone screenshot, replace an image layer, or create a new image layer; supports multiple files
- Rich text marks system (`TextMark`): range-based per-character styling (start/end offsets) replacing the legacy `TextSpan` segment system; supports fill, fontWeight, italic, underline, strikethrough per range
- Format-aware rendering: per-format visibility and layout overrides; base format for authoring, exportable formats for each platform
- ZIP batch export from the browser: download all slides in a group as a ZIP in one click
- Locale manifest generation and import via CLI for external translation workflows
- `--locale` and `--all-locales` flags for CLI export

### Changed

- Asset store migrated from in-memory Map to IndexedDB for persistence across page reloads

## [0.1.0] - 2026-06-09

### Added

- Visual canvas editor with Konva: drag, resize, rotate, group layers
- Layer types: phone mockup, text, image, shape, chips (pill labels), brand lockup, group
- Background layer: solid or gradient background; always at the bottom of the stack
- Rich text: per-span color, gradient fill, font weight, italic within one text layer
- 23 curated Google Fonts loaded on demand
- Pano slide groups: canvas spanning multiple slides for phone-crossing-seam layouts
- Gradient fills: linear and radial on backgrounds, shapes, and text
- Full undo/redo via zundo
- Multi-project management: create, open, rename, delete; auto-saved to localStorage
- Layer panel: drag-to-reorder with dnd-kit, visibility toggle, lock, rename
- Properties inspector: context-aware panel per selected layer
- Contextual toolbar: floating quick-actions above selected layer
- Asset library: import screenshots by file or folder, drag to canvas
- Browser export: download individual slides or full groups as PNGs
- CLI batch export: headless Playwright export for automation pipelines
- Templates: import/export project decks as reusable JSON templates
- Localization: per-locale text and image overrides; locale switcher in preview
- Phone status bar simulation: iOS and Android styles (transparent / solid background)
- Phone mockups: iPhone 16 Pro, iPhone 16 Pro (No Island), Pixel 9, Pixel 9 (No Camera)
- Plain mockup variants without Dynamic Island / punch-hole for clean marketing shots
- Asset persistence: IndexedDB storage for imported screenshots (survives page reload)
- Preview modal: full-project filmstrip preview with high-res thumbnail capture
- Slide navigator: thumbnail-based navigation with per-slide index

[Unreleased]: https://github.com/Pr0xS/FixFlow/compare/v0.5.1...HEAD
[0.2.2]: https://github.com/Pr0xS/FixFlow/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Pr0xS/FixFlow/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Pr0xS/FixFlow/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Pr0xS/FixFlow/releases/tag/v0.1.0
