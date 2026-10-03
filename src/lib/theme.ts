export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "thread-theme";
export const THEME_EVENT = "thread-theme";
export const PAPER = { light: "#f7f3ea", dark: "#141311" } as const;

export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;
