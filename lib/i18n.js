// Customer-facing translations. Thai text is the key, so Thai is always the fallback and the source
// stays readable for the camp team. English values live in i18n-en.js.
// A value may be [singular, plural]; the form is picked by params.n (1 → singular).
import { en, enPatterns } from './i18n-en.js'

export const languages = ['th','en']
export const languageCookie = 'trunkhill_lang'

export function normalizeLanguage(value) {
  return value === 'en' ? 'en' : value === 'th' ? 'th' : null
}

// Cookie wins; otherwise Thai for any browser that lists Thai, English for everyone else.
export function pickLanguage(cookieValue, acceptLanguage = '') {
  const saved = normalizeLanguage(cookieValue)
  if (saved) return saved
  return /(^|,)\s*th\b/i.test(acceptLanguage) || !acceptLanguage ? 'th' : 'en'
}

function fill(text, params) {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match)
}

export function translate(lang, text, params) {
  if (typeof text !== 'string') return text
  let value = lang === 'en' ? en[text] : undefined
  if (Array.isArray(value)) value = value[Number(params?.n) === 1 ? 0 : 1]
  return fill(value ?? text, params)
}

// Free text from the server or a thrown Error: exact match first, then templated messages.
export function translateMessage(lang, text) {
  if (lang !== 'en' || typeof text !== 'string' || !text) return text
  const exact = en[text]
  if (typeof exact === 'string') return exact
  for (const [pattern, replacement] of enPatterns) {
    // Captured values (item names, zones) are translated too when they are known catalogue text.
    if (pattern.test(text)) return text.replace(pattern, (...groups) =>
      replacement.replace(/\$(\d)/g, (match, index) => {
        const value = groups[Number(index)] ?? ''
        return typeof en[value] === 'string' ? en[value] : value
      }))
  }
  return text
}

export function formatMoney(lang, value) {
  const amount = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'th-TH').format(Number(value) || 0)
  return lang === 'en' ? '฿' + amount : amount + ' บาท'
}

export const localeOf = lang => lang === 'en' ? 'en-GB' : 'th-TH'
