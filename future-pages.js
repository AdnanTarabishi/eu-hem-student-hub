/* Progressive preview navigation. No data collection, uploads or account actions. */
(function () {
  'use strict';
  const main = document.querySelector('.future-page #main');
  if (!main) return;
  const navigation = main.querySelector('.fp-tabs');
  if (!navigation) return;
  const decode = value => { try { return decodeURIComponent(value.replace(/^#/, '')); } catch (_) { return ''; } };
  const entries = [...navigation.querySelectorAll('[data-fp-tab]')].map(tab => {
    const panel = document.getElementById(decode(tab.hash));
    return panel?.hasAttribute('data-fp-panel') ? {tab,panel} : null;
  }).filter(Boolean);
  if (!entries.length) return;
  navigation.setAttribute('role', 'tablist');
  navigation.setAttribute('aria-orientation', 'horizontal');
  entries.forEach(({tab,panel}) => {
    tab.id = 'fp-tab-' + panel.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
  });
  function select(id, write = false, focus = false) {
    const current = entries.find(entry => entry.panel.id === id) || entries[0];
    entries.forEach(({tab,panel}) => {
      const selected = panel === current.panel;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
    });
    if (write && decode(location.hash) !== current.panel.id) {
      const url = new URL(location.href);
      url.hash = current.panel.id;
      try { history.pushState(null, '', url.href); }
      catch (_) { location.hash = current.panel.id; }
    }
    if (focus) current.tab.focus();
    return current;
  }
  entries.forEach(({tab,panel}, index) => {
    tab.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(panel.id, true);
    });
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % entries.length;
      else if (event.key === 'ArrowLeft') next = (index + entries.length - 1) % entries.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = entries.length - 1;
      else if (event.key === ' ') {
        event.preventDefault(); select(panel.id, true); return;
      } else return;
      event.preventDefault();
      select(entries[next].panel.id, true, true);
    });
  });
  main.addEventListener('click', event => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || navigation.contains(anchor) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = decode(anchor.hash);
    if (!entries.some(entry => entry.panel.id === id)) return;
    event.preventDefault();
    const current = select(id, true);
    current.panel.focus({preventScroll:true});
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    current.panel.scrollIntoView({block:'start', behavior:reduced?'auto':'smooth'});
  });
  const sync = () => select(decode(location.hash));
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
  sync();
})();
