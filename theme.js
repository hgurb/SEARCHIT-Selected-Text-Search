// Apply before the stylesheet loads to avoid flashing the wrong theme.
(() => {
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try {
    const stored = localStorage.getItem('searchit-theme');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch { /* Follow the system when preference storage is unavailable. */ }
  const resolvedTheme = () => preference ?? (systemTheme.matches ? 'dark' : 'light');
  function applyTheme() { document.documentElement.dataset.theme = resolvedTheme(); }
  applyTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('#theme-toggle');
    function updateButton() {
      const next = resolvedTheme() === 'dark' ? 'light' : 'dark';
      button.setAttribute('aria-label', 'Switch to ' + next + ' mode');
      button.setAttribute('title', 'Switch to ' + next + ' mode');
    }
    updateButton();
    button.addEventListener('click', () => {
      preference = resolvedTheme() === 'dark' ? 'light' : 'dark';
      applyTheme();
      updateButton();
      try { localStorage.setItem('searchit-theme', preference); }
      catch { /* Switching still works for the current page. */ }
    });
    systemTheme.addEventListener('change', () => { if (!preference) { applyTheme(); updateButton(); } });
    window.addEventListener('storage', event => {
      if (event.key !== 'searchit-theme' && event.key !== null) return;
      preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : undefined;
      applyTheme();
      updateButton();
    });
  });
})();
