import {
  SUPPORTED_LANGUAGES,
  PAGE_SLUGS,
  getLocalizedPath,
} from '../utils/i18n.js';

const SITE = 'https://cs2studio.haking.tr';
const PAGE_KEYS = Object.keys(PAGE_SLUGS);

function buildAlternateLinks(pageKey: string): string {
  const xDefault = `${SITE}${getLocalizedPath('en', pageKey, false)}`;
  const links = [
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}" />`,
  ];
  for (const l of SUPPORTED_LANGUAGES) {
    const href = `${SITE}${getLocalizedPath(l.code, pageKey, true)}`;
    links.push(`    <xhtml:link rel="alternate" hreflang="${l.code}" href="${href}" />`);
  }
  return links.join('\n');
}

export function GET() {
  const lastmod = new Date().toISOString().split('T')[0];
  const urls: string[] = [];

  // Default unprefixed routes (/)
  for (const pageKey of PAGE_KEYS) {
    const loc = `${SITE}${getLocalizedPath('en', pageKey, false)}`;
    const priority = pageKey === 'home' ? '1.0' : '0.9';
    urls.push(
      [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        `    <priority>${priority}</priority>`,
        buildAlternateLinks(pageKey),
        '  </url>',
      ].join('\n'),
    );
  }

  // Localized /[lang]/... static routes (20 languages x 6 pages = 120 routes)
  for (const l of SUPPORTED_LANGUAGES) {
    for (const pageKey of PAGE_KEYS) {
      const loc = `${SITE}${getLocalizedPath(l.code, pageKey, true)}`;
      const priority = pageKey === 'home' ? '0.9' : '0.8';
      urls.push(
        [
          '  <url>',
          `    <loc>${loc}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '    <changefreq>weekly</changefreq>',
          `    <priority>${priority}</priority>`,
          buildAlternateLinks(pageKey),
          '  </url>',
        ].join('\n'),
      );
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
