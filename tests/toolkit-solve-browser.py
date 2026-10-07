"""Browser regression of actual Student Toolkit sources in an inline sandbox.
This fallback harness adapts location/history, localStorage and local fetch because
this execution environment blocks browser network navigation, including localhost.
It does NOT test the deployed site's network, real persistent storage or service worker.
Run: EUHEM_SITE_ROOT=/path/to/site EUHEM_TEST_OUTPUT=/path/out python tests/toolkit-browser.py
Requires Python Playwright and Chromium. Font bytes are loaded locally for rendering,
not copied into the handoff archive.
"""
from pathlib import Path
import os,re,json,base64,mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(os.getenv('EUHEM_SITE_ROOT',str(Path(__file__).resolve().parents[1])))
OUT=Path(os.getenv('EUHEM_TEST_OUTPUT','/mnt/data/toolkit-work')); OUT.mkdir(exist_ok=True,parents=True)
(OUT/'screenshots').mkdir(exist_ok=True)
checks=[]
def ok(label,condition):
    assert condition,label
    checks.append(label); print('PASS',label,flush=True)
def adapted(code):
    code=code.replace('window.location.','window.__loc.')
    return re.sub(r'(?<![\w.])location\.', 'window.__loc.',code)
def dataURL(p):
    return 'data:'+ (mimetypes.guess_type(p)[0] or 'application/octet-stream')+';base64,'+base64.b64encode(p.read_bytes()).decode()
def inlineCSS(css):
    def replace(m):
        path=ROOT/m.group(2).split('?')[0]
        return f'url("{dataURL(path)}")' if path.is_file() else m.group(0)
    return re.sub(r'url\(([\"\']?)([^\)\"\']+)\1\)',replace,css)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    def load(path='toolkit.html',query='',width=1365,storage=None,blocked=False):
        ctx=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(9000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        html=(ROOT/path).read_text()
        styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',html)
        scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
        page.set_content(re.sub(r'<script[\s\S]*?</script>|<link[^>]+>','',html))
        files={str(p.relative_to(ROOT)):p.read_text() for folders in ['content','data','calendar'] for p in (ROOT/folders).rglob('*') if p.is_file() and p.suffix in ['.json','.md','.csv','.html','.txt','.ics']}
        js={p.name:adapted(p.read_text()) for p in ROOT.glob('*.js')}
        page.evaluate('''({url,files,js,storage,blocked})=>{
          const update=u=>{const v=new URL(u);for(const k of ['href','search','hash','pathname','origin','host','protocol'])window.__loc[k]=v[k];};
          window.__loc={};update(url); window.__loc.reload=()=>{};
          window.__loc.assign=u=>update(new URL(u,window.__loc.href).href);window.__loc.replace=window.__loc.assign;
          window.__prefs={...storage};
          const ls={getItem:k=>{if(blocked)throw new Error('Storage denied in test');return window.__prefs[k]??null;},setItem:(k,v)=>{if(blocked)throw new Error('Storage denied in test');window.__prefs[k]=String(v);},removeItem:k=>{if(blocked)throw new Error('Storage denied in test');delete window.__prefs[k];},clear:()=>{throw new Error('Do not clear unrelated site data');}};
          Object.defineProperty(window,'localStorage',{configurable:true,value:ls});
          const stack=[url];let pos=0;
          history.replaceState=(_s,_t,u)=>{update(new URL(u,window.__loc.href).href);stack[pos]=window.__loc.href;};
          history.pushState=(_s,_t,u)=>{update(new URL(u,window.__loc.href).href);stack.splice(++pos);stack.push(window.__loc.href);};
          window.__go=u=>{update(new URL(u,window.__loc.href).href);window.dispatchEvent(new PopStateEvent('popstate'));};
          window.__back=()=>{pos=Math.max(0,pos-1);update(stack[pos]);window.dispatchEvent(new PopStateEvent('popstate'));};
          window.__hash=h=>{update(new URL(h,window.__loc.href).href);window.dispatchEvent(new HashChangeEvent('hashchange'));};
          document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a){e.preventDefault();window.__lastLink=a.getAttribute('href');if(a.getAttribute('href').startsWith('#'))window.__hash(a.getAttribute('href'));}},true);
          window.fetch=async input=>{const u=new URL(typeof input==='string'?input:input.url,window.__loc.href),p=u.pathname.replace(/^\\//,'');if(u.origin!=='https://toolkit.example')throw new Error('External fetch disabled in inline harness');return new Response(files[p]??'',{status:p in files?200:404});};
          window.__scripts=js;
          const append=document.head.appendChild.bind(document.head);
          document.head.appendChild=node=>{if(node.tagName==='SCRIPT'&&node.src){const path=new URL(node.src,window.__loc.href).pathname.split('/').pop();if(js[path]){const script=document.createElement('script');script.textContent=js[path];append(script);queueMicrotask(()=>node.dispatchEvent(new Event('load')));return node;}queueMicrotask(()=>node.dispatchEvent(new Event('error')));return node;}return append(node);};
        }''',{'url':'https://toolkit.example/'+path+query,'files':files,'js':js,'storage':storage or {},'blocked':blocked})
        for href in styles:
            if not href.startswith('http') and (ROOT/href.split('?')[0]).is_file():page.add_style_tag(content=inlineCSS((ROOT/href.split('?')[0]).read_text()))
        sprite=(ROOT/'icons.svg').read_text()
        page.evaluate('''sprite=>{const box=document.createElement('div');box.hidden=true;box.innerHTML=sprite;document.body.prepend(box);const fix=()=>document.querySelectorAll('use[href^="icons.svg#"]').forEach(el=>el.setAttribute('href',el.getAttribute('href').replace('icons.svg','')));new MutationObserver(fix).observe(document.body,{childList:true,subtree:true});fix();}''',sprite)
        for img in page.locator('img[src]').all():
            p=ROOT/(img.get_attribute('src')or'').split('?')[0]
            if p.is_file():img.evaluate('(el,src)=>{el.removeAttribute("srcset");el.src=src;}',dataURL(p))
        # In a real page theme.js runs in <head> while readyState is loading,
        # so its toggle mounts after site-nav. Simulate that order after set_content.
        ordered=[src for src in scripts if not src.startswith('theme.js')];
        nav_index=next((i for i,s in enumerate(ordered) if s.startswith('site-nav.js')),-1)
        ordered[nav_index+1:nav_index+1]=[src for src in scripts if src.startswith('theme.js')]
        for src in ordered:
            p=ROOT/src.split('?')[0]
            if not src.startswith('http') and p.is_file() and p.name!='pwa.js':page.add_script_tag(content=js[p.name])
        page.wait_for_timeout(400)
        page.evaluate('document.fonts.ready');return ctx,page,errors
    ctx,p,errors=load(query='?section=solve&solver=finder')
    ok('Solve section restores from URL',p.locator('#tk2-solve').is_visible() and not p.locator('#tk2-browse').is_visible())
    ok('five main views have independent controls',p.locator('#tk2-sections button').count()==5)
    ok('default route is one-sample Student t', 'One-sample t' in p.locator('#sv-finder-result').inner_text())
    ok('matching link uses Fundamentals and t preset','course=fund-quant-methods' in p.locator('#sv-open-lab').get_attribute('href') and 'sl3_mean-test_method=t' in p.locator('#sv-open-lab').get_attribute('href'))
    p.locator('#sv-course').select_option('statistics')
    ok('course selection changes calculator destination','course=quant-methods' in p.locator('#sv-open-lab').get_attribute('href'))
    p.locator('#sv-sd').select_option('known')
    ok('known SD route switches z preset','sl3_mean-test_method=z' in p.locator('#sv-open-lab').get_attribute('href'))
    p.locator('#sv-sd').select_option('unsure')
    ok('unknown SD information does not launch a calculator',p.locator('#sv-open-lab').count()==0)
    p.locator('#sv-sd').select_option('sample');p.locator('#sv-groups').select_option('two');p.locator('#sv-design').select_option('paired')
    ok('paired route explicitly requires SD of differences','SD of DIFFERENCES' in p.locator('#sv-finder-result').inner_text())
    ok('paired route never links two independent means','labtool=mean-test' in p.locator('#sv-open-lab').get_attribute('href'))
    paired_href=p.locator('#sv-open-lab').get_attribute('href')
    p.locator('#sv-design').select_option('complex')
    ok('clustered data require design review',p.locator('#sv-open-lab').count()==0 and 'Clarify' in p.locator('#sv-finder-result').inner_text())
    p.locator('#sv-design').select_option('independent');p.locator('#sv-groups').select_option('one');p.locator('#sv-n').fill('')
    ok('blank n is not zero and stale result removed',p.locator('#sv-finder-error').is_visible() and not p.locator('#sv-finder-result').inner_text())
    p.locator('#sv-goal').select_option('describe')
    ok('descriptive goal ignores inactive numeric inputs',not p.locator('#sv-finder-error').is_visible() and 'labtool=descriptive' in p.locator('#sv-open-lab').get_attribute('href'))
    p.locator('#sv-n').evaluate('(el)=>{el.value="100"}');p.locator('#sv-goal').select_option('estimate');p.locator('#sv-outcome').select_option('binary');p.locator('#sv-k').fill('1')
    ok('sparse observed counts choose labelled Wilson','Supplementary' in p.locator('#sv-finder-result').inner_text() and 'method=wilson' in p.locator('#sv-open-lab').get_attribute('href'))
    p.locator('#sv-goal').select_option('test');p.locator('#sv-p0').fill('.5')
    ok('null counts not observed counts determine proportion test','labtool=proportion-test' in p.locator('#sv-open-lab').get_attribute('href'))
    p.locator('#sv-p0').fill('.001')
    ok('sparse null expected counts stop normal-test launch',p.locator('#sv-open-lab').count()==0)
    p.locator('#sv-groups').select_option('two')
    ok('two binary groups not sent to two means','dedicated procedure' in p.locator('#sv-finder-result').inner_text() and p.locator('#sv-open-lab').count()==0)
    p.locator('#sv-question').fill('zzzz arbitrary equation');p.locator('#sv-question-form').evaluate('(el)=>el.requestSubmit()')
    ok('unmatched search does not fabricate a solution','No topic match' in p.locator('#sv-matches').inner_text())
    p.locator('[data-prompt="compare paired before after"]').click();p.locator('[data-intent="pair"]').click()
    ok('guided prompt opens paired method state',p.locator('#sv-design').input_value()=='paired')
    p.locator('[data-solver="excel"]').click()
    ok('Excel pane opens without erasing method state',p.locator('#sv-excel').is_visible() and not p.locator('#sv-finder').is_visible())
    ok('52 formula recipes available',p.locator('#sv-recipe-list button').count()==52)
    ok('normal example formula uses original scale','NORM.DIST(2,1,1,TRUE)-NORM.DIST(-1,1,1,TRUE)' in p.locator('#sv-formula-output').inner_text())
    ok('full precision normal example shown','0.81859461' in p.locator('#sv-formula-example').inner_text())
    p.locator('#sv-formula-search').fill('sample variance')
    ok('recipe search filters the list',p.locator('#sv-recipe-list button').count()==3)
    p.locator('[data-recipe="var-s"]').click();p.locator('#sv-range').fill('$C$2:$C$10')
    ok('A1 range builder changes copyable formula',p.locator('#sv-formula-output').inner_text()=='=VAR.S($C$2:$C$10)')
    ok('worked answer labelled fixed rather than recalculated','fixed teaching example' in p.locator('#sv-formula-example').inner_text().lower())
    p.locator('#sv-range').fill('A1;WEBSERVICE("https://x")')
    ok('range injection rejected',p.locator('#sv-formula-error').is_visible() and p.locator('#sv-copy-formula').is_disabled())
    p.locator('#sv-range').fill('A2:A8');p.locator('#sv-formula-search').fill('normal left');p.locator('[data-recipe="normal-left"]').click()
    p.locator('#sv-separator').select_option(';')
    ok('semicolon syntax generated',p.locator('#sv-formula-output').inner_text()=='=NORM.DIST(2;1;1;TRUE)')
    p.locator('#sv-formula-search').fill('normal percentile');p.locator('[data-recipe="normal-inverse"]').click();p.locator('#sv-decimal').select_option(',')
    ok('decimal comma changes numeric literals only',p.locator('#sv-formula-output').inner_text()=='=NORM.INV(0,05;0;2)')
    p.locator('#sv-separator').select_option(',')
    ok('ambiguous comma separators refused',p.locator('#sv-copy-formula').is_disabled())
    p.locator('#sv-separator').select_option(';');p.locator('#sv-copy-formula').click()
    ok('copy formula has selectable fallback',p.locator('#sv-clipboard').is_visible() and p.locator('#sv-copy-text').input_value().startswith('=NORM.INV'))
    p.locator('#sv-copy-close').click()
    p.locator('#sv-formula-search').fill('<img src=x onerror=alert(1)>')
    ok('search text cannot inject markup',p.locator('#sv-recipe-list img').count()==0)
    p.locator('#sv-formula-search').fill('');p.locator('[data-solver="health"]').click()
    ok('cost-effectiveness default expected result','4000' in p.locator('#sv-health-result .sv-metrics').inner_text())
    ok('cost-effectiveness plane has accessible text',p.locator('#sv-ce-desc').count()==1)
    p.locator('[data-scenario="dominant"]').click()
    ok('dominant scenario favours A', 'A dominates B' in p.locator('#sv-health-result').inner_text())
    p.locator('[data-scenario="dominated"]').click()
    ok('negative dominated ICER does not favour A','Option B has higher' in p.locator('#sv-health-result h3').inner_text())
    p.locator('[data-scenario="southwest"]').click()
    ok('southwest tradeoff correctly favours B at 20000','Option B has higher' in p.locator('#sv-health-result h3').inner_text())
    p.locator('#sv-lambda').fill('5000')
    ok('southwest threshold change favours A','Option A has higher' in p.locator('#sv-health-result h3').inner_text())
    p.locator('#sv-ea').fill('2')
    ok('zero incremental effect clearly undefined ICER','Undefined' in p.locator('#sv-health-result .sv-metrics').inner_text())
    p.locator('#sv-ca').fill('')
    ok('invalid economics inputs erase stale results',p.locator('#sv-health-error').is_visible() and not p.locator('#sv-health-result').inner_text())
    p.locator('#sv-ca').fill('14000');p.locator('[data-health="qaly"]').click()
    ok('QALY example calculates both alternatives',not p.locator('#sv-health-error').is_visible() and '3.4' in p.locator('#sv-health-result .sv-metrics').inner_text() and '2.9' in p.locator('#sv-health-result .sv-metrics').inner_text())
    p.locator('#sv-qaly-data').fill('1,-0.2,0')
    ok('negative utility supported','-0.2' in p.locator('#sv-health-result .sv-metrics').inner_text())
    p.locator('#sv-qaly-data').fill('1,1.2,0')
    ok('invalid utility rejected',p.locator('#sv-health-error').is_visible() and p.locator('#sv-apply-qaly').is_hidden())
    p.locator('#sv-qaly-data').fill('2,0.8,0.7\n3,0.6,0.5');p.locator('#sv-apply-qaly').click()
    ok('QALYs transfer explicitly into CEA',abs(float(p.locator('#sv-ea').input_value())-3.4)<1e-9 and abs(float(p.locator('#sv-eb').input_value())-2.9)<1e-9)
    ok('transfer keeps costs and reminds horizon check',p.locator('#sv-ca').input_value()=='14000' and 'Costs and threshold were not changed' in p.locator('#sv-status').inner_text())
    p.locator('[data-health="discount"]').click()
    ok('discount example renders table',not p.locator('#sv-health-error').is_visible() and p.locator('#sv-health-result tbody tr').count()==4)
    p.locator('#sv-discount-data').fill('0,1000,0\n5,1000,1');p.locator('#sv-rc').fill('0');p.locator('#sv-re').fill('0')
    ok('zero-rate PV equals explicit flows','2000' in p.locator('#sv-health-result .sv-metrics').inner_text())
    p.locator('#sv-discount-data').fill('0,1000,0\n0,1000,1')
    ok('duplicate dated flows rejected',p.locator('#sv-health-error').is_visible())
    p.locator('#sv-discount-data').fill('0,1000,0\n5,1000,1');p.locator('#sv-copy-working').click()
    ok('copy working fallback contains valid result','present-value totals' in p.locator('#sv-copy-text').input_value().lower())
    p.locator('#sv-copy-close').click();p.locator('#sv-copy-link').click();url=p.locator('#sv-copy-text').input_value()
    ok('tool link contains mode but no entered costs/data','section=solve' in url and 'mode=discount' in url and '1000' not in url and 'sv-' not in url)
    p.locator('#sv-copy-close').click();p.locator('#sv-practice').evaluate('(el)=>el.open=true')
    p.locator('[data-exercise="0"] button').click()
    ok('practice asks for attempt first','Choose an answer' in p.locator('[data-exercise="0"] .sv-answer').inner_text())
    p.locator('[data-exercise="0"] input[value="1"]').check();p.locator('[data-exercise="0"] button').click()
    ok('practice explains correct method','Correct.' in p.locator('[data-exercise="0"] .sv-answer').inner_text())
    p.locator('[data-exercise="2"] input[value="2"]').check();p.locator('[data-exercise="2"] button').click()
    ok('practice corrects ICER quadrant misconception','Not quite.' in p.locator('[data-exercise="2"] .sv-answer').inner_text() and 'savings per QALY lost' in p.locator('[data-exercise="2"] .sv-answer').inner_text())
    prefs=p.evaluate('JSON.stringify(window.__prefs)')
    ok('solver writes no extra local data','toolkit-solve' not in prefs and '14000' not in prefs)
    p.locator('#tk2-sections [data-section="lists"]').click();p.locator('#tk2-list-name').fill('Revision v3');p.locator('#tk2-create-form').evaluate('(el)=>el.requestSubmit()')
    ok('v2 personal lists still create normally',p.locator('.tk2-list-title h3').inner_text()=='Revision v3')
    p.locator('#tk2-add-choice').select_option('excel-assistant');p.locator('#tk2-add-form').evaluate('(el)=>el.requestSubmit()')
    ok('promoted tool retains list ID and is now available','Planned' not in p.locator('[data-entry="excel-assistant"]').inner_text())
    p.locator('#tk2-sections [data-section="compare"]').click();p.locator('#tk2-compare-choice').select_option('health-economics-calculator');p.locator('#tk2-add-compare').click()
    ok('newly available tool can use existing comparison',p.locator('.tk2-compare-table h3').inner_text()=='Health Economics Calculator')
    p.locator('#tk2-sections [data-section="solve"]').click()
    ok('v3 fields survive visits to other Toolkit views',p.locator('#sv-discount-data').input_value()=='0,1000,0\n5,1000,1')
    ok('no runtime errors in interaction test',not errors)
    # URL restoration and actual existing lab receiving the preset.
    ctx2,p2,e2=load(query='?section=solve&solver=excel&recipe=ci-t')
    ok('deep-linked Excel recipe restores on first load',p2.locator('#sv-excel').is_visible() and 'CONFIDENCE.T' in p2.locator('#sv-formula-output').inner_text())
    ctx2.close()
    from urllib.parse import urlsplit
    ctx2,p2,e2=load('statistics-lab.html','?'+urlsplit(paired_href).query)
    ok('existing Lab accepts chosen paired-difference route as one-mean tool',p2.locator('#sl3-mean-test').is_visible() and p2.locator('#sl3-mean-test-n').input_value()=='25' and p2.locator('#sl3-mean-test-method').input_value()=='t')
    ok('old Lab preset load has no script errors',not e2);ctx2.close()
    # Screenshots and overflow checks use the real mounted implementation.
    for width in [320,390,768,1365]:
        c,pg,ee=load(query='?section=solve&solver=health',width=width)
        for mode in ['cea','qaly','discount']:
            pg.locator(f'[data-health="{mode}"]').click()
            ok(f'health {mode} fits {width}px',pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        pg.locator('[data-health="cea"]').click();pg.locator('#sv-health-title').scroll_into_view_if_needed()
        pg.screenshot(path=str(OUT/'screenshots'/f'health-{width}.png'),full_page=True)
        pg.locator('#sv-health').screenshot(path=str(OUT/'screenshots'/f'health-panel-{width}.png'))
        for tool in ['finder','excel']:
            pg.locator(f'[data-solver="{tool}"]').click()
            ok(f'{tool} fits {width}px',pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        if width==1365:
            pg.locator('#sv-excel').screenshot(path=str(OUT/'screenshots'/'excel-panel-1365.png'))
            pg.locator('[data-solver="finder"]').click();pg.locator('#sv-finder').screenshot(path=str(OUT/'screenshots'/'finder-panel-1365.png'))
            pg.locator('#tk2-solve-title').scroll_into_view_if_needed();pg.screenshot(path=str(OUT/'screenshots'/'solve-entry-1365.png'))
        ok(f'no runtime errors at {width}px',not ee)
        pg.evaluate('document.documentElement.dataset.theme="dark"')
        if width==390:pg.locator('#sv-excel').screenshot(path=str(OUT/'screenshots'/'excel-dark-390.png'))
        c.close()
    ctx.close();browser.close()
    (OUT/'solve-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'limitations':'Actual sources loaded inline with URL/storage/fetch adapters; no live navigation, persistent storage or service worker tests.'},indent=2))
    print('PASS',len(checks),'new browser checks')
