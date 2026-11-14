# Third-Party Assets & Libraries

## 3D Dust2 Map Slice (`public/models/de_dust2_slice.glb`)
Authentic Dust2 A-site & Long corridor GLB environment mesh:
- **Source**: `StarKnightt/counter-strike-in-browser` (`public/models/dust2_a.webp.glb`) — MIT License, Copyright (c) 2026 StarKnightt.
- **Textures**: Baked Poly Haven CC0 WebP PBR maps (`diff`, `nor`, `rough`) optimized for <25 MiB Cloudflare Pages static delivery.

## 3D CS2 Weapon Models (`public/models/*.glb`)
Realistic Source 2 Counter-Strike 2 `.glb` weapon meshes (`ak47.glb`, `awp.glb`, `deagle.glb`, `famas.glb`, `galil.glb`, `glock.glb`, `m4a1s.glb`, `m4a4.glb`, `mp9.glb`, `usps.glb`):
- **Source**: `LielXD/CS2-WeaponPaints-Website` (`src/[models]/`) — MIT License, Copyright (c) 2024 LielXD.
- **Note**: Each GLB retains only Valve's HD/legacy geometry layers; CS2 Studio strips the legacy node at load time and renders the HD mesh (`body_hd`).

## CS2 Recoil Pattern Matrices
- Derived from Artanis-RCS (`MIT License`) Counter-Strike 2 weapon recoil impulse tables (`dx`, `dy`, `delayMs`, `cumX`, `cumY`).

## Weapon UI Silhouettes (`public/assets/weapons/*.svg`)
- Used strictly for Buy Binds keyboard tiles and weapon selection badges.
