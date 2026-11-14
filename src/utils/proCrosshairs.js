import proData from '../data/proCrosshairs.json' with { type: 'json' };

/**
 * Full verified esports pro crosshair database (674 entries categorized by Year / Major era).
 */
export const PRO_CROSSHAIRS = proData;

export const PRO_YEAR_FILTERS = [
  { id: 'all', labelKey: 'arena.filterAllYears', fallback: 'All Years' },
  { id: '2026', label: '2026' },
  { id: '2024 Major', label: '2024 Major' },
  { id: '2023 Major', label: '2023 Major' },
  { id: 'classic', label: '2012–2016 Legends' },
];

const teamSet = new Set();
for (const entry of PRO_CROSSHAIRS) {
  if (entry.team && entry.team !== 'Pro Circuit') {
    teamSet.add(entry.team);
  }
}

export const PRO_TEAMS = Array.from(teamSet).sort((a, b) => a.localeCompare(b));

export function getProCrosshairById(id) {
  if (!id) return null;
  const lower = String(id).toLowerCase();
  return (
    PRO_CROSSHAIRS.find((p) => p.id === id) ||
    PRO_CROSSHAIRS.find((p) => p.slug === lower || p.player.toLowerCase() === lower) ||
    null
  );
}

/**
 * Filter the esports database by search query, year/era bucket, and team.
 */
export function filterProCrosshairs({ search = '', year = 'all', team = 'all' } = {}) {
  const q = String(search || '').trim().toLowerCase();

  return PRO_CROSSHAIRS.filter((entry) => {
    if (year !== 'all') {
      if (year === 'classic') {
        if (!/^201\d$/.test(entry.year)) return false;
      } else if (entry.year !== year) {
        return false;
      }
    }

    if (team !== 'all' && entry.team !== team) {
      return false;
    }

    if (q) {
      const hay = `${entry.player} ${entry.realName} ${entry.team} ${entry.year} ${entry.tag} ${entry.shareCode}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}
