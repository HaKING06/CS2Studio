export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇺🇸' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr', flag: '🇷🇺' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr', flag: '🇵🇹' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', dir: 'ltr', flag: '🇵🇱' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', dir: 'ltr', flag: '🇨🇳' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', dir: 'ltr', flag: '🇺🇦' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', dir: 'ltr', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', dir: 'ltr', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', dir: 'ltr', flag: '🇫🇮' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', dir: 'ltr', flag: '🇳🇱' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', dir: 'ltr', flag: '🇨🇿' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', dir: 'ltr', flag: '🇷🇴' },
];

export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export const PAGE_SLUGS = {
  home: '',
  'spray-arena': 'spray-arena',
  crosshair: 'crosshair',
  viewmodel: 'viewmodel',
  'buy-binds': 'buy-binds',
  autoexec: 'autoexec',
};

const localeModules = import.meta.glob('../locales/*.json', { eager: true });
const LOCALE_CACHE = {};

for (const [path, mod] of Object.entries(localeModules)) {
  const match = path.match(/([a-z]{2})\.json$/);
  if (match) {
    LOCALE_CACHE[match[1]] = mod.default || mod;
  }
}

export function getLangInfo(lang = 'en') {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
}

export function getDictionary(lang = 'en') {
  return LOCALE_CACHE[lang] || LOCALE_CACHE.en || {};
}

export function translateKey(dict, key, vars = {}) {
  const parts = String(key || '').split('.');
  let cur = dict;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = cur[part];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur !== 'string') {
    let fallback = LOCALE_CACHE.en;
    for (const part of parts) {
      fallback = fallback && typeof fallback === 'object' ? fallback[part] : undefined;
    }
    cur = typeof fallback === 'string' ? fallback : key;
  }
  return cur.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`));
}

export function getLocalizedPath(lang, pageKey = 'home', usePrefix = true) {
  const slug = PAGE_SLUGS[pageKey] ?? '';
  if (!usePrefix) {
    return slug ? `/${slug}` : '/';
  }
  return slug ? `/${lang}/${slug}` : `/${lang}`;
}

export function getStaticLangPaths() {
  return SUPPORTED_LANGUAGES.map((l) => ({ params: { lang: l.code } }));
}
