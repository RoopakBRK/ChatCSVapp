/** Shared by the server layout (boot script) and the client theme store. No "use client" here on purpose. */
export const THEME_KEY = "csvchat.theme";

/**
 * Runs in <head> before the page paints: applies a saved choice so there is no flash of the wrong
 * theme. With nothing saved, the CSS follows the system setting (prefers-color-scheme).
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
