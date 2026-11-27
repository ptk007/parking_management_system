import { readonly, ref } from 'vue'
import { parkingMapThai } from './parkingMapThai'
import { interfaceThai } from './interfaceThai'
import { interfaceEnglish } from './interfaceEnglish'
import { guideThai } from './guideThai'

export type Language = 'en' | 'th'
export type LocalizedText = string | [message: string, values: Record<string, string | number>]

const preferenceKey = 'parking:language'

function savedLanguage(): Language {
  try {
    const saved = localStorage.getItem(preferenceKey) ?? localStorage.getItem('parking-map:language')
    return saved === 'th' ? 'th' : 'en'
  } catch {
    return 'en'
  }
}

const currentLanguage = ref<Language>(savedLanguage())
export const language = readonly(currentLanguage)

export function setLanguage(value: Language) {
  currentLanguage.value = value
  try {
    localStorage.setItem(preferenceKey, value)
  } catch {
    // The selection still applies for this visit.
  }
}

const thai = { ...parkingMapThai, ...interfaceThai, ...guideThai }

export function t(text: LocalizedText): string {
  const [message, values] = typeof text === 'string' ? [text] : text
  const translations = language.value === 'th' ? thai : interfaceEnglish
  const translated = Object.prototype.hasOwnProperty.call(translations, message)
    ? translations[message]!
    : message
  if (!values) return translated
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder,
  )
}
