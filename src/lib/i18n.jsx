import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PT } from "../i18n/pt";

const KEY = "site-lang";
export const LANGS = ["pt", "en"];

export function currentLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return "pt";
}

export function localeOf(lang = currentLang()) {
  return lang === "pt" ? "pt-BR" : "en-US";
}

// Text keys are the English strings; Portuguese comes from the dictionary.
export function translate(lang, text, vars) {
  let out = lang === "pt" ? PT[text] ?? text : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : String(vars[name])));
  return out;
}

const LangContext = createContext({ lang: "pt", setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);

  useEffect(() => {
    document.documentElement.lang = localeOf(lang);
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
    setLangState(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  const { lang, setLang } = useContext(LangContext);
  const t = useCallback((text, vars) => translate(lang, text, vars), [lang]);
  return { t, lang, setLang };
}
