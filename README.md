# CS2 Studio (`v0.0.1`)

**Domain**: `https://cs2studio.haking.tr` • **Support**: `cs2studio@haking.tr` • **Support Creator**: [buymeacoffee.com/haking](https://www.buymeacoffee.com/haking)

A 100% client-side Static Multi-Page Application (Astro MPA) Counter-Strike 2 configuration suite backed cleanly by `localStorage` and optimized for Cloudflare Pages:

- **`/spray-arena`** (`/[lang]/spray-arena`) — Three.js Dust2 range with realistic Source 2 HD `.glb` CS2 weapon models, HTML5 canvas crosshair overlay, mathematical CS2 spray pattern simulation, Pro Crosshair Database (`donk`, `s1mple`, `m0NESY`, `ZywOo`, `NiKo`, `ropz`, `b1t`, `dev1ce`, `ScreaM`), and CS2/legacy Share Code import & export.
- **`/viewmodel`** (`/[lang]/viewmodel`) — Live 3D Viewmodel Simulator syncing `viewmodel_fov`, `offset_x`, `offset_y`, `offset_z`, and Desktop/Couch/Classic presets.
- **`/buy-binds`** (`/[lang]/buy-binds`) — SortableJS drag-and-drop interactive mechanical keyboard buy bind creator.
- **`/autoexec`** (`/[lang]/autoexec`) — Consolidated `autoexec.cfg` compiler & instant download via `file-saver`.

## Multi-Language SEO Routing (20 Locales)
Static routes generated for `en`, `tr`, `ru`, `de`, `pt`, `es`, `pl`, `fr`, `zh`, `uk`, `sv`, `da`, `fi`, `nl`, `it`, `ja`, `ko`, `ar`, `cs`, `ro` with self-referencing `<link rel="canonical">`, 21-way `hreflang` alternates (`x-default` + 20 locales), Open Graph, Twitter Cards, `SoftwareApplication` JSON-LD, and automatic `sitemap-index.xml`.

## Realistic 3D Models
Place any extra realistic Counter-Strike 2 Source 2 `.glb` files inside `public/models/` (**Drop the real CS2 .glb files here**) or drag-and-drop `.glb` files directly onto the `/spray-arena` or `/viewmodel` 3D canvas.

## Commands
```bash
npm install
npm run dev
npm run build
npm run preview
```
