"""Real local-HTTP course checks for CI (no adapted URL, DOM or localStorage).
Public external requests are blocked and service workers are disabled, so this
checks local delivery and genuine browser storage, not external feeds or offline.
The constrained authoring environment blocks localhost browser navigation.
"""
from pathlib import Path
import json, os, shutil, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('EUHEM_SITE_ROOT',Path(__file__).resolve().parents[2])).resolve()
BASE='http://localhost:8000'
checks=[]
def ok(label,condition):
    assert condition,label
    checks.append(label)
    print('PASS',label,flush=True)
server=subprocess.Popen(['node','scripts/preview.js'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE+'/course.html',timeout=1).close();break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Preview server did not start')
    with sync_playwright() as pw:
        executable=os.getenv('CHROMIUM_BINARY') or shutil.which('chromium') or shutil.which('google-chrome')
        browser=pw.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(service_workers='block',viewport={'width':1440,'height':1000},reduced_motion='reduce')
        ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith(BASE+'/') else route.abort())
        page=ctx.new_page();page.set_default_timeout(12000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        response=page.goto(BASE+'/course.html?course=right-to-health&tab=casebook')
        page.wait_for_selector('.rth-casebook-detail')
        ok('Real HTTP returns the course page',response.status==200)
        ok('Casebook loads its fetched JSON and twelve cases',page.locator('.rth-case-select').count()==12)
        ok('Page-script interactions start without JavaScript errors',not errors)
        stored_before=page.evaluate('JSON.stringify({...localStorage})')
        page.locator('.rth-casebook-detail textarea').fill('A hypothetical analysis retained only in this page.')
        ok('Case note is not written to real localStorage',page.evaluate('JSON.stringify({...localStorage})')==stored_before)
        page.locator('.rth-tabs').get_by_role('link',name='Glossary',exact=True).click()
        page.locator('.rth-tabs').get_by_role('link',name='Casebook',exact=True).click()
        ok('Real route navigation retains the open-page case note','hypothetical' in page.locator('.rth-casebook-detail textarea').input_value())
        with page.expect_download() as event:
            page.get_by_role('button',name='Export my analysis (.txt)',exact=True).click()
        download=event.value
        text=Path(download.path()).read_text()
        ok('Real Blob export downloads a sourced analysis','hypothetical' in text and 'Reading location:' in text)
        page.reload();page.wait_for_selector('.rth-casebook-detail')
        ok('Reload really clears the temporary case note',page.locator('.rth-casebook-detail textarea').input_value()=='')
        page.get_by_role('button',name='Reveal the first step',exact=True).click()
        ok('Real case step reveal works',page.locator('.rth-case-step').count()==1)
        page.get_by_role('link',name='Read the related guide',exact=False).click()
        page.get_by_role('button',name='Mark understood',exact=True).click()
        page.reload();page.wait_for_selector('.rth-reading')
        ok('Guide progress survives a real browser reload',page.evaluate('JSON.parse(localStorage.getItem("euhem-progress-v1")).topics["right-to-health.economic-rights"]')=='understood')
        ok('Expanded seven-section reader is served over HTTP',page.locator('.rth-reading-section').count()==7)
        page.locator('.rth-tabs').get_by_role('link',name='Workshop',exact=True).click()
        page.locator('.rth-workshop-grid textarea').first.fill('Hypothetical workshop preparation')
        page.get_by_role('button',name='Save on this device',exact=True).click()
        page.reload();page.wait_for_selector('.rth-workshop-grid')
        ok('Workshop saved note survives real reload',page.locator('.rth-workshop-grid textarea').first.input_value()=='Hypothetical workshop preparation')
        page.locator('.rth-tabs').get_by_role('link',name='Practice',exact=True).click()
        ok('All 100 native question cards load through real data fetches',page.locator('#question-bank .question-card').count()==100)
        page.set_viewport_size({'width':390,'height':844})
        page.locator('.rth-tabs').get_by_role('link',name='Casebook',exact=True).click()
        ok('Real mobile casebook does not overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        ok('Real HTTP and storage interactions finish without JS errors',not errors)
        ctx.close();browser.close()
    print('TOTAL',len(checks),'real HTTP checks passed; external feeds and service workers excluded')
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill()
