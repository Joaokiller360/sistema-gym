'use client'

// Applies the stored theme before first paint. Rendered only on the server:
// React never executes <script> tags it creates on the client (and warns about
// them), and hydration skips the extra node inside <head>.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`

export function ThemeScript() {
  if (typeof window !== 'undefined') return null
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
}
