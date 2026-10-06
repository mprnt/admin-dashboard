/**
 * Applies the stored theme before first paint.
 *
 * Without this the page renders light, then flips to dark once React hydrates -
 * a white flash on every navigation for dark-mode users. Runs synchronously in
 * <head>, so it must stay small and dependency-free.
 */
export function ThemeScript() {
  const script = `
    (function () {
      try {
        var m = localStorage.getItem('mprnt-theme') || 'system';
        var d = m === 'dark' || (m === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
