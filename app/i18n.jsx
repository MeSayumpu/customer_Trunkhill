'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoney, languageCookie, localeOf, translate, translateMessage } from '../lib/i18n'

const I18nContext = createContext(null)

export function I18nProvider({lang:initial = 'th', children}) {
  const router = useRouter()
  const [lang,setLangState] = useState(initial)

  const setLang = useCallback(next => {
    if (next !== 'th' && next !== 'en') return
    document.cookie = `${languageCookie}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
    setLangState(next)
    // Server-rendered bits (page title, <html lang>) follow on refresh.
    router.refresh()
  },[router])

  const value = useMemo(() => ({
    lang,
    locale:localeOf(lang),
    setLang,
    t:(text,params) => translate(lang,text,params),
    msg:text => translateMessage(lang,text),
    money:amount => formatMoney(lang,amount),
  }),[lang,setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

const fallback = {
  lang:'th', locale:'th-TH', setLang:() => {},
  t:(text,params) => translate('th',text,params), msg:text => text, money:amount => formatMoney('th',amount),
}

export function useI18n() {
  return useContext(I18nContext) ?? fallback
}

export function LanguageSwitch({className = ''}) {
  const {lang,setLang} = useI18n()
  return <div className={'language-switch ' + className} role="group" aria-label="Language / ภาษา">
    <button type="button" lang="th" aria-pressed={lang === 'th'} onClick={() => setLang('th')}>ไทย</button>
    <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
  </div>
}
