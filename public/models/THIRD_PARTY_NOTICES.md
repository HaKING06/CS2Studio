# Third-Party Assets & Libraries

## 3D CS2 Weapon Models (`public/models/*.glb`)
Realistic Source 2 Counter-Strike 2 `.glb` weapon meshes (`ak47.glb`, `awp.glb`, `deagle.glb`, `famas.glb`, `galil.glb`, `glock.glb`, `m4a1s.glb`, `m4a4.glb`, `mp9.glb`, `usps.glb`):
- **Source**: `LielXD/CS2-WeaponPaints-Website` (`src/[models]/`) — MIT License, Copyright (c) 2024 LielXD.
- **Note**: Each GLB retains only Valve's HD/legacy geometry layers; CS2 Studio strips the legacy node at load time and renders the HD mesh (`body_hd`).

## CS2 Recoil Pattern Matrices
- Derived from public Counter-Strike 2 weapon recoil impulse tables (`dx`, `dy`, `delayMs`, `cumX`, `cumY`).

## Weapon UI Silhouettes (`public/assets/weapons/*.svg`)
- Used strictly for Buy Binds keyboard tiles and weapon selection badges.
