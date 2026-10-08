"""Newsroom UI regression using actual HTML/CSS/JS in an inline Chromium sandbox.
The sandbox adapts URL/history, fetch and storage because this environment blocks
all browser navigation. It does NOT verify live network delivery or service workers.
Run: EUHEM_SITE_ROOT=/path/to/site EUHEM_TEST_OUTPUT=/path/out python tests/announcements/browser.py
Requires Python Playwright and Chromium; no files are fetched from third parties.
"""
from pathlib import Path
import os, re, json, base64, mimetypes, csv, io
from playwright.sync_api import sync_playwright
ROOT=Path(os.getenv('EUHEM_SITE_ROOT', str(Path(__file__).resolve().parents[2])))
OUT=Path(os.getenv('EUHEM_TEST_OUTPUT','/mnt/data/euhem-newsroom-tests'))
OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def ok(label, condition):
    assert condition, label
    checks.append(label); print('PASS',label,flush=True)
def adapted(code):
    code=code.replace('window.location.','window.__loc.')
    return re.sub(r'(?<![\w.])location\.', 'window.__loc.',code)
def data_url(path):
    return 'data:'+(mimetypes.guess_type(str(path))[0] or 'application/octet-stream')+';base64,'+base64.b64encode(path.read_bytes()).decode()
def inline_css(css):
    def replace(m):
        path=ROOT/m.group(2).split('?')[0]
        return 'url("'+data_url(path)+'")' if path.is_file() else m.group(0)
    return re.sub(r'url\((["\']?)([^\)"\']+)\1\)',replace,css)
real_csv=(ROOT/'data/announcements.csv').read_text()
fixture='Date,Title,Category,Message,Link,Pinned,Expires,Posted by,Image,Image alt,Image credit\n2026-10-07,Research café,Academic,"Hello <img src=x onerror=alert(1)> world.",javascript:alert(1),Yes,,Test editor,img/social-preview.png,Test cover,Test credit\n2026-10-06,Campus update,University,Older published update.,https://example.com,No,,Test editor\n2026-10-01,Undated image fallback,Social,Earlier message.,,No,,Test editor,https://tracker.example/x.png,,\n2026-10-09,Future update,Student,Not public yet.,,Yes,,Test editor\n2026-10-05,Expired update,Student,No longer active.,,Yes,2026-10-07,Test editor\n2026-10-08,Expiry today,Student,Visible on expiry date.,,No,2026-10-08,Test editor\n2026-10-07,Broken cover,Social,Safe broken image fallback.,,No,,Test editor,img/missing-file.webp,Missing cover,\n,No date,Student,Always shown.,,No,,Test editor\n'
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    def load(width=1440,theme='light',source=real_csv,hash_value='',blocked=False):
        ctx=browser.new_context(viewport={'width':width,'height':1060},reduced_motion='reduce',color_scheme=theme)
        page=ctx.new_page();page.set_default_timeout(6000)
        # This instant is 8 October in Bologna, but still 7 October in UTC.
        page.clock.install(time=__import__('datetime').datetime(2026,10,7,23,31,tzinfo=__import__('datetime').timezone.utc))
        errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
        html=(ROOT/'announcements.html').read_text()
        styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',html)
        scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
        page.set_content(re.sub(r'<script[\s\S]*?</script>|<link[^>]+>','',html))
        page.evaluate('''({csv,hash,theme,blocked})=>{
          const update=u=>{const v=new URL(u);for(const k of ['href','search','hash','pathname','origin','host','hostname','protocol'])window.__loc[k]=v[k];};
          window.__loc={};update('https://newsroom.example/announcements.html'+hash);
          window.__loc.reload=()=>{};window.__loc.assign=u=>update(new URL(u,window.__loc.href).href);
          window.__prefs={'euhem-theme':theme};
          Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>{if(blocked)throw Error('Storage denied');return window.__prefs[k]??null;},setItem:(k,v)=>{if(blocked)throw Error('Storage denied');window.__prefs[k]=String(v);},removeItem:k=>delete window.__prefs[k]}});
          history.pushState=(_s,_t,u)=>update(new URL(u,window.__loc.href).href);
          history.replaceState=history.pushState;
          window.__goHash=h=>{update('https://newsroom.example/announcements.html'+h);window.dispatchEvent(new HashChangeEvent('hashchange'));};
          window.__feed=csv;window.__fail=false;window.__fetches=[];
          window.fetch=async input=>{const s=String(input);window.__fetches.push(s);if(s==='data/announcements.csv'){if(window.__fail)throw Error('Network unavailable');return new Response(window.__feed,{status:200});}return new Response('{}',{status:404});};
          Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{if(window.__denyCopy)throw Error('Clipboard denied');window.__copied=t;}}});
          window.__denyCopy=false;
          document.documentElement.dataset.theme=theme;
        }''',{'csv':source,'hash':hash_value,'theme':theme,'blocked':blocked})
        for css in styles:page.add_style_tag(content=inline_css((ROOT/css.split('?')[0]).read_text()))
        # Mirror local SVG references and optional local images with data URLs only.
        images={str(p.relative_to(ROOT)):data_url(p) for p in (ROOT/'img').glob('*') if p.suffix in ['.png','.webp','.jpg']}
        page.evaluate('''({sprite,images})=>{
          const box=document.createElement('div');box.hidden=true;box.innerHTML=sprite;document.body.prepend(box);
          const fix=()=>{
            document.querySelectorAll('use[href^="icons.svg#"]').forEach(n=>n.setAttribute('href',n.getAttribute('href').replace('icons.svg','')));
            document.querySelectorAll('img[src]').forEach(n=>{const s=n.getAttribute('src');if(images[s])n.src=images[s];else if(s&&!s.startsWith('data:'))n.dispatchEvent(new Event('error'));});
          }; new MutationObserver(fix).observe(document.body,{childList:true,subtree:true});fix();
        }''',{'sprite':(ROOT/'icons.svg').read_text(),'images':images})
        # Both scripts run against the exact shared CSV contract. PWA is deliberately
        # not loaded: service worker delivery is outside this inline sandbox.
        for filename in scripts:
            path=filename.split('?')[0]
            if path=='pwa.js':continue
            
            code=adapted((ROOT/path).read_text())
            if path=='theme.js': code=code.replace('if (document.readyState === "loading")', 'if (true)')
            page.add_script_tag(content=code)
        page.evaluate('document.documentElement.dataset.theme='+json.dumps(theme))
        page.wait_for_function('document.querySelector("#news-loading").hidden')
        return ctx,page,errors

    ctx,p,errors=load()
    ok('Current source renders without runtime errors',not errors)
    ok('One spotlight, two secondary cards',p.locator('.news-spotlight').count()==1 and p.locator('.news-card').count()==2)
    ok('Active and new counts come from source rows',p.locator('#news-total').inner_text()=='3' and p.locator('#news-new').inner_text()=='3')
    ok('Each announcement appears once',p.locator('.news-card, .news-spotlight').count()==3)
    ok('Desktop has no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    p.screenshot(path=str(OUT/'desktop.png'),full_page=True)
    election_id=p.locator('.news-spotlight').get_attribute('id')
    p.get_by_role('link',name='View full results').click()
    ok('Result reader opens',p.locator('#news-reader').evaluate('(n)=>n.open'))
    ok('Existing election groups and 12 candidate entries preserved',p.locator('.election-section').count()==2 and p.locator('.election-column:first-child li').count()==12)
    ok('Three elected percentages preserved',p.locator('.election-percentage').all_text_contents()==['67%','54%','53%'])
    ok('Read dialog contains the complete official candidate lists',p.evaluate('JSON.stringify([...document.querySelectorAll(".election-column:first-child li")].map(n=>n.textContent))===JSON.stringify(ELECTION_RESULTS_2026.flatMap(g=>g.candidates))'))
    p.screenshot(path=str(OUT/'election-reader.png'),full_page=True)
    p.keyboard.press('Escape')
    p.clock.run_for(100)
    p.wait_for_function('!document.querySelector("#news-reader").open && window.__loc.hash===""')
    ok('Escape closes reader and clears detail hash',not p.locator('#news-reader').evaluate('(n)=>n.open') and p.evaluate('window.__loc.hash')=='')
    p.locator('#news-search').fill('Pinheiro')
    ok('Search finds text inside election results',p.locator('.news-card').count()==1 and p.locator('.news-feature').is_hidden())
    p.locator('#news-search').fill('Van Berge')
    ok('Candidate names missing from summary remain searchable',p.locator('.news-card').count()==1)
    p.locator('#news-search').fill('no-match-xyz')
    ok('Empty search state is clear',p.locator('#news-empty').is_visible())
    p.locator('#news-empty-action').click()
    ok('Reset restores all source rows',p.locator('.news-card, .news-spotlight').count()==3)
    p.get_by_role('button',name='List view',exact=True).click()
    ok('List layout switch works',p.locator('#news-feed').evaluate('(n)=>n.classList.contains("is-list")'))
    p.locator('#news-sort').select_option('oldest')
    ok('Chronological sorting removes priority spotlight',p.locator('.news-feature').is_hidden() and p.locator('.news-card').count()==3)
    p.locator('.news-copy').first.click()
    ok('Copy link uses canonical article hash',p.evaluate('window.__copied.startsWith("https://newsroom.example/announcements.html#2026-")'))
    p.evaluate('window.__denyCopy=true')
    p.locator('.news-copy').first.click()
    ok('Denied clipboard has selectable fallback',p.locator('.news-share-box input').is_visible())
    ok('IDs are unique after all interactions',p.evaluate('(()=>{const ids=[...document.querySelectorAll("[id]")].map(n=>n.id);return new Set(ids).size===ids.length})()'))
    ok('Interactions raise no runtime errors',not errors)
    ctx.close()

    ctx,p,errors=load(width=390,hash_value='#'+election_id)
    ok('Legacy direct link opens full results',p.locator('#news-reader').evaluate('(n)=>n.open'))
    ok('Mobile election columns stack',p.locator('.election-columns').first.evaluate('(n)=>getComputedStyle(n).gridTemplateColumns.split(" ").length===1'))
    ok('Mobile reader has no horizontal overflow',p.locator('#news-reader').evaluate('(n)=>n.scrollWidth<=n.clientWidth'))
    p.screenshot(path=str(OUT/'mobile-reader.png'),full_page=True)
    p.locator('#news-reader-close').click()
    p.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    ok('Mobile page has no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    p.get_by_role('button',name='List view',exact=True).click()
    ok('Mobile list view has no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    ok('Mobile console clean',not errors);ctx.close()

    ctx,p,errors=load(width=320,theme='dark',blocked=True)
    ok('Narrow dark screen without storage has no overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    ok('No storage dependency in newsroom',not errors)
    p.screenshot(path=str(OUT/'narrow-dark.png'),full_page=True)
    ctx.close()
    ctx,p,errors=load(theme='dark')
    p.screenshot(path=str(OUT/'desktop-dark.png'),full_page=True)
    ok('Dark theme renders without runtime errors',not errors);ctx.close()

    ctx,p,errors=load(source=fixture)
    ok('Bologna date handles UTC day boundary and expiry inclusivity',p.locator('#news-total').inner_text()=='6')
    all_text=p.locator('#newsroom').inner_text()
    ok('Future and expired rows excluded', 'Future update' not in all_text and 'Expired update' not in all_text and 'Expiry today' in all_text)
    ok('New badge count excludes undated and older posts',p.locator('#news-new').inner_text()=='4')
    ok('Local photo and optional credit are supported',p.locator('.news-art--photo').count()==1 and p.locator('.news-image-credit').inner_text()=='Test credit')
    ok('Broken or external covers fall back to original artwork',p.locator('.news-card .news-art--photo').count()==0)
    p.locator('#news-search').fill('research cafe')
    ok('Accent-insensitive search works',p.locator('.news-card').count()==1)
    p.get_by_role('link',name='Read update',exact=True).click()
    ok('Content is escaped, never HTML-injected',p.locator('.news-reader-body img').count()==0 and '<img src=x' in p.locator('.news-reader-body').inner_text())
    ok('Unsafe source URL rejected',p.get_by_role('link',name='Open source link',exact=False).count()==0)
    p.locator('#news-reader-close').click()
    p.locator('#news-reset').click()
    p.get_by_role('button',name='University 1').click()
    ok('Category filter retains source label',p.locator('.news-card').count()==1 and 'Campus update' in p.locator('.news-card').inner_text())
    p.locator('#news-reset').click();p.locator('#news-new-only').check()
    ok('New-only filter matches date logic',p.locator('.news-card').count()==4)
    ok('Fixtures produce no runtime errors',not errors);ctx.close()

    ctx,p,errors=load(source='Date,Title,Category,Message\n')
    ok('Empty CSV shows real zero counts',p.locator('#news-total').inner_text()=='0' and p.locator('#news-empty').is_visible())
    ctx.close()
    ctx,p,errors=load(source='bad,headers\n')
    ok('Invalid feed has a recoverable error state',p.locator('#news-empty-title').inner_text()=='Unable to load updates')
    p.evaluate('(text)=>window.__feed=text',real_csv);p.locator('#news-empty-action').click()
    p.wait_for_selector('.news-spotlight')
    ok('Retry restores the feed',p.locator('#news-total').inner_text()=='3')
    ctx.close();browser.close()
(OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'limitation':'Inline browser sandbox; no live network or service-worker validation.'},indent=2))
print('ALL',len(checks),'CHECKS PASSED')
