/* Mount the same lab inside the Fundamentals study workspace without replacing
 * its guided experiments, mock exam, casework or learner progress. */
(function () {
  'use strict';
  const view=document.getElementById('fs-view'), main=document.getElementById('main');
  if(!view||!main)return;
  const panel=document.createElement('section');panel.id='fund-shared-lab';panel.hidden=true;
  panel.setAttribute('aria-label','Fundamentals Interactive Statistics Lab');
  document.getElementById('fs-content').insertAdjacentElement('afterend',panel);
  const nav=document.querySelector('.fs-nav');
  const link=document.createElement('a');link.href='#calculators';link.textContent='Interactive Lab · 12 tools';
  nav.insertBefore(link,nav.querySelector('[href="#explore"]'));
  nav.querySelector('[href="#explore"]').textContent='Guided experiments';
  const start=document.createElement('a');start.href='#calculators';start.className='fs-button fs-secondary';start.textContent='Open the Interactive Lab →';
  document.querySelector('.fs-hero .button-row').append(start);
  const toolByTopic={1:'descriptive',2:'normal',3:'sampling',4:'confidence',5:'mean-test',6:'two-means'};
  let mounted=false;
  function refresh(){
    const active=location.hash==='#calculators';
    view.hidden=active;panel.hidden=!active;document.querySelector('.fs-hero').hidden=active;
    if(active){
      nav.querySelectorAll('[aria-current]').forEach(a=>a.removeAttribute('aria-current'));link.setAttribute('aria-current','page');
      if(!mounted&&window.StatisticsLab){window.StatisticsLab.mount(panel);mounted=true;}
    }else link.removeAttribute('aria-current');
    // Add context links only to actual topic-path cards, not quizzes or answers.
    view.querySelectorAll('.fs-card .fs-number').forEach(number=>{
      const key=toolByTopic[Number(number.textContent)],card=number.closest('.fs-card');
      if(!key||card.querySelector('[data-shared-lab]'))return;
      const a=document.createElement('a');a.dataset.sharedLab='true';a.className='sl3-fund-link';
      a.href=`fund-statistics.html?labtool=${key}#calculators`;a.textContent='Use the matching calculator →';card.appendChild(a);
    });
  }
  // Native workspace fetches and hash routing can redraw #fs-view; do not watch attributes.
  new MutationObserver(refresh).observe(view,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>queueMicrotask(refresh));refresh();
})();
