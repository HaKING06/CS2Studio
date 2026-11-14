/**
 * Real HD 1080p CS2 in-game Panorama screenshots used for visual map preview
 * and automatic WebGL fallback — zero procedural 2D gradients or block walls.
 */
export const CS2_MAP_BACKDROPS = [
  { id: 'img-dust2-site', label: 'Dust2 · A Site', map: 'de_dust2', src: '/assets/maps/de_dust2_site.webp' },
  { id: 'img-dust2-long', label: 'Dust2 · T Alley', map: 'de_dust2', src: '/assets/maps/de_dust2_long.webp' },
  { id: 'img-mirage-a', label: 'Mirage · A Site', map: 'de_mirage', src: '/assets/maps/de_mirage_mid.webp' },
  { id: 'img-mirage-b', label: 'Mirage · B Apps', map: 'de_mirage', src: '/assets/maps/de_mirage_a.webp' },
  { id: 'img-inferno', label: 'Inferno · B Site', map: 'de_inferno', src: '/assets/maps/de_inferno_mid.webp' },
  { id: 'img-nuke', label: 'Nuke · Yard', map: 'de_nuke', src: '/assets/maps/de_nuke_yard.webp' },
  { id: 'img-ancient', label: 'Ancient · Mid', map: 'de_ancient', src: '/assets/maps/de_ancient_mid.webp' },
  { id: 'img-anubis', label: 'Anubis · Mid', map: 'de_anubis', src: '/assets/maps/de_anubis_mid.webp' },
  { id: 'img-overpass', label: 'Overpass · A Site', map: 'de_overpass', src: '/assets/maps/de_overpass_a.webp' },
  { id: 'img-train', label: 'Train · Yard', map: 'de_train', src: '/assets/maps/de_train_yard.webp' },
];

export const DEFAULT_FALLBACK_BACKDROP = CS2_MAP_BACKDROPS[0].src;
