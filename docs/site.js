(() => {
  const language = document.querySelector('.language');
  const cache = new Map();
  let pending;

  // Keep the existing artwork loaded when the URL moves into or out of /lv/.
  document.querySelectorAll('img').forEach(image => { image.src = image.src; });
  document.querySelectorAll('link[rel=stylesheet], link[rel=icon]').forEach(link => { link.href = link.href; });
  const pageKey = url => url.origin + url.pathname + url.search;
  cache.set(pageKey(new URL(location.href)), document.documentElement.outerHTML);

  function select(locale) {
    language.querySelectorAll('a').forEach(link => {
      if (link.lang === locale) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  async function changeLanguage(url, pushHistory) {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    const scroll = { left: window.scrollX, top: window.scrollY, behavior: 'instant' };
    const key = pageKey(url);

    try {
      let html = cache.get(key);
      if (!html) {
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) throw new Error('Unable to load translation');
        html = await response.text();
        cache.set(key, html);
      }
      if (request.signal.aborted) return;
      const translated = new DOMParser().parseFromString(html, 'text/html');
      const regions = ['.skip', '.main-nav', '.hero-copy', '.notice', '.site-footer'];
      if (!translated.querySelector('.language') ||
          !translated.querySelector('.directory, article') ||
          regions.some(selector => !translated.querySelector(selector))) {
        throw new Error('Incomplete translation');
      }

      if (pushHistory && url.href !== location.href) history.pushState(null, '', url);
      document.documentElement.lang = translated.documentElement.lang;
      document.title = translated.title;
      for (const selector of ['meta[name=description]', 'link[rel=alternate]']) {
        const attribute = selector.startsWith('meta') ? 'content' : 'href';
        document.querySelector(selector).setAttribute(attribute,
          translated.querySelector(selector).getAttribute(attribute));
      }
      document.querySelector('link[rel=alternate]').hreflang = translated.querySelector('link[rel=alternate]').hreflang;
      for (const selector of regions) {
        const current = document.querySelector(selector);
        const replacement = translated.querySelector(selector);
        current.innerHTML = replacement.innerHTML;
        if (replacement.hasAttribute('aria-label')) {
          current.setAttribute('aria-label', replacement.getAttribute('aria-label'));
        }
      }
      document.querySelector('.directory, article').replaceWith(
        translated.querySelector('.directory, article'));
      document.querySelector('.cat-portrait img').alt = translated.querySelector('.cat-portrait img').alt;
      language.setAttribute('aria-label', translated.querySelector('.language').getAttribute('aria-label'));
      language.querySelectorAll('a').forEach(link => {
        link.setAttribute('href', translated.querySelector(`.language a[lang=${link.lang}]`).getAttribute('href'));
      });
      select(translated.documentElement.lang);
      if (pushHistory) window.scrollTo(scroll);
    } catch (error) {
      if (error.name !== 'AbortError') location.assign(url.href);
    }
  }

  language.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(link.href);
    url.hash = location.hash;
    select(link.lang);
    void changeLanguage(url, true);
  });
  window.addEventListener('popstate', () => {
    void changeLanguage(new URL(location.href), false);
  });
})();
