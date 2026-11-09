/**
 * Applies the reader's stored theme before the first paint (ADR-021), so a page never flashes the
 * other scheme. Inlined into `<head>` by the root layout and the global error page. Reads the key
 * the switch writes (`THEME_KEY` in packages/ui) and accepts only the two schemes; anything else
 * leaves the system's choice. A constant string: nothing from the page or the reader is
 * interpolated into it.
 */
export const THEME_SCRIPT =
  'try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}';
