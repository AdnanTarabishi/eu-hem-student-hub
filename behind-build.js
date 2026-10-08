// Progressive enhancement only: the complete estimate is readable without JavaScript.
(() => {
  const page = document.querySelector('.build-page');
  if (!page) return;
  const controls = page.querySelector('.build-controls');
  const modeButtons = [...page.querySelectorAll('[data-build-unit]')];
  const rows = [...page.querySelectorAll('.build-work')];
  const expand = page.querySelector('.build-expand');
  const status = page.querySelector('#build-announcement');
  if (!controls || !expand || !status) return;
  const syncDetails = () => {
    const allOpen = rows.every(row => row.open);
    expand.textContent = allOpen ? 'Hide all details' : 'Show all details';
    expand.setAttribute('aria-expanded', String(allOpen));
  };
  for (const button of modeButtons) button.addEventListener('click', () => {
    const share = button.dataset.buildUnit === 'share';
    for (const other of modeButtons) other.setAttribute('aria-pressed', String(other === button));
    for (const value of page.querySelectorAll('.build-value')) value.textContent = share ? `${value.dataset.share}%` : `${value.dataset.hours} h`;
    status.textContent = share ? 'Showing each category as a percentage of the total estimate.' : 'Showing the illustrative allocation in hours.';
  });
  expand.addEventListener('click', () => {
    const open = !rows.every(row => row.open);
    for (const row of rows) row.open = open;
    syncDetails();
  });
  for (const row of rows) row.addEventListener('toggle', syncDetails);
  controls.hidden = false;
})();
