// Page chrome: footer year, favicon, theme toggle and header background.
export function initSite(){
  var root = document.documentElement;
  document.getElementById('year').textContent = new Date().getFullYear();

  // ---------- selected-tab favicon ----------
  var favicon = document.getElementById('site-favicon');
  function updateFavicon(){
    favicon.href = document.visibilityState === 'visible' ? 'assets/images/logo_wh_LR.png' : 'assets/images/logo_bl_LR.png';
  }
  document.addEventListener('visibilitychange', updateFavicon);
  updateFavicon();

  // ---------- theme toggle ----------
  // The saved theme is applied by the inline script in <head>.
  var themeToggle = document.querySelector('.theme-toggle');

  function saveTheme(theme){
    try { localStorage.setItem('artofnobody-theme', theme); } catch (error) {}
  }

  function updateThemeToggle(){
    var isLight = root.getAttribute('data-theme') === 'light';
    themeToggle.setAttribute('aria-pressed', String(isLight));
    themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
  }

  themeToggle.addEventListener('click', function(){
    if (root.getAttribute('data-theme') === 'light'){
      root.removeAttribute('data-theme');
      saveTheme('dark');
    } else {
      root.setAttribute('data-theme', 'light');
      saveTheme('light');
    }
    updateThemeToggle();
  });
  updateThemeToggle();

  // ---------- header background on scroll ----------
  var header = document.querySelector('header');
  function onHeaderScroll(){
    header.classList.toggle('scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onHeaderScroll, { passive: true });
  onHeaderScroll();
}
