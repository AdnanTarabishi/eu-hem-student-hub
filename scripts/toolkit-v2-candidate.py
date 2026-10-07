# Candidate-only integration. Removed from the final release tree.
# Requires the exact reviewed base hashes; will not overwrite changed inputs.
from pathlib import Path
import hashlib, json, subprocess, sys
EXPECTED = {'toolkit.js': {'before': 'a79a1f1c04e731ac4fd4f0110c744dda72530407957f124160ccdc8edadcb2a3', 'after': 'ecb16816b0fc95b5e15a632128343863ec3ff7f49f0271ab56c07a347ad3335b'}, 'toolkit-organiser-data.js': {'before': None, 'after': 'c9b5dbdccdc39299144e23211ab1d7d1e12941e3d01befba41a071a90f7076cc'}, 'privacy.html': {'before': '6e94acd6166a7f84bf1daf0420b7af1c7011a833568d2e5ae69e7fddad969060', 'after': '33f4286d6d3d15a3bf007c599b895f21668e7488f64580bb3c7c482f0639d5c2'}, 'toolkit-organiser.css': {'before': None, 'after': '6726146c1ffe14f6030127e4cc5064566e9d7bb54c457ae21157086ef1d62592'}, 'toolkit.html': {'before': '82f3b3c95e2e3764c5fc08e0725d222dfca112f7a5e3205166feb015123bb2dc', 'after': '2ff7ae80038901b068c76a07158c9b16ed56b921648bfc3f94ec1c16ca8c2b0a'}, 'toolkit-data.js': {'before': 'eaae15ba72b99972ed90ae09493d414c1da357d5e43976fb9579d9c5e4ace834', 'after': '45ddcdf41ce8b85f96c4182d0a99cce5e747327528775615c0656b65548a1d39'}, 'sw.js': {'before': 'c0864f0ad992c2f519354efeea5ce731bb8a3c4836b43715e9a1c334bfe4cd68', 'after': 'edfcacfa56235e67fc9c823d987308785a0bd4be3b0be123fc9252595abf7706'}, 'toolkit-organiser.js': {'before': None, 'after': 'cf49181c3636c73f6434ba9e8850aeb30739b5ced253b896176713ff712ef216'}, 'docs/student-toolkit-v2.md': {'before': None, 'after': '2d8a2a705f731f20d9ad63c44a4db96c824762b6520ccbcc8442c351fa104c5a'}, 'tests/toolkit.test.js': {'before': '50a96ed1410995f25c1b8c650a7c1e3acae0756d315cf506eb3de6ab4046a3d3', 'after': '9e5101d0dc6b1dbc02828f33c18e748f3c49743cf7dffc2a62cc0e18c3fe5659'}, 'tests/toolkit-browser.py': {'before': '18bd053ad93adc7fdde4734014574026a1373aef1e1fcc6155b91de2ac147679', 'after': 'df2797f40077f83a53e83bc8f9681bd99bcc93b198b603a9b441a342b0e44dda'}, 'tests/toolkit-organiser.test.js': {'before': None, 'after': '5eaa5a9f35e3b658c0032a6f84ac984eb5ac94594ab5a15d43a82bcae3aa371f'}}
verify = '--verify' in sys.argv
for name, hashes in EXPECTED.items():
    p=Path(name)
    expected=hashes['after'] if verify or hashes['before'] is None else hashes['before']
    if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:
        raise SystemExit('Hash mismatch; no integration performed: '+name)
if verify:
    print('All 12 release files match the locally tested source byte-for-byte.')
    raise SystemExit(0)
p=Path('toolkit-data.js')
s=p.read_text()
add='''  // v2 additions: short, original descriptions checked against the linked provider.
  // "fresh" means added in this release, not a live availability claim.
  external('who-gho','WHO Global Health Observatory','economics','https://www.who.int/data/gho',
    'Find health indicators and their definitions before comparing countries.',
    ['Explore indicators by health topic or country.','Check metadata and the years available before analysis.','A suggested use: investigate health-system or population-health measures.'],
    'Coverage, definitions and revisions vary by indicator. Cite the source and extraction date; the Hub does not fetch live data.',{fresh:true,tags:'WHO global health data indicators metadata country comparison'});
  external('world-bank','World Bank Open Data','economics','https://data.worldbank.org/',
    'Explore development indicators alongside health and economic context.',
    ['Browse indicators and country-level time series.','Find downloadable datasets and their documentation.','A suggested use: compare health measures with development indicators.'],
    'Check units, denominators, years and reuse conditions. Some specialist or microdata access has additional conditions.',{fresh:true,tags:'World Bank WDI Data360 development data GDP health expenditure'});
  external('openalex','OpenAlex','research','https://openalex.org/',
    'Explore an open catalogue of scholarly works and research connections.',
    ['Discover research records around a topic.','Follow related authors, institutions and research outputs.','A suggested use: broaden a reading list beyond a single seed paper.'],
    'Metadata is not a quality appraisal or a guarantee of full-text access. Check records against original publications; API terms differ from browsing.',{fresh:true,tags:'scholarly discovery papers literature citations metadata'});
  external('equator','EQUATOR Reporting Guidelines','research','https://www.equator-network.org/',
    'Find a reporting checklist that fits the study you are writing.',
    ['Search reporting guidance by study type.','Find PRISMA, STROBE, CHEERS and other reporting resources.','A suggested use: check a draft against the relevant reporting guideline.'],
    'Reporting checklists are not study-design approval or risk-of-bias tools. Check the appropriate version and your assignment requirements.',{fresh:true,tags:'reporting PRISMA STROBE CHEERS economic evaluation systematic review'});
  external('osf','Open Science Framework','research','https://osf.io/',
    'Explore research records and document study plans transparently.',
    ['Discover public research records and linked outputs.','Explore registration of a study or analysis plan.','A suggested use: discuss preregistration with your supervisor.'],
    'Account and visibility settings apply to creating records. Check policies before uploading or publishing; never expose confidential participant data.',{fresh:true,source:'https://www.cos.io/products/osf',tags:'open science preregistration protocol reproducibility'});
  external('euraxess','EURAXESS Jobs & Opportunities','career','https://euraxess.ec.europa.eu/jobs',
    'Explore research jobs and hosting opportunities across institutions.',
    ['Search advertised research positions.','Explore hosting offers and research-career resources.','A suggested use: shortlist roles aligned with your methods and interests.'],
    'Listings have their own deadlines, language, degree and eligibility rules. Inclusion does not guarantee work permission or funding.',{fresh:true,tags:'research jobs PhD funding fellowship hosting career internship'});
  external('orcid','ORCID','career','https://orcid.org/',
    'Connect your research contributions with a persistent researcher identifier.',
    ['Learn how an ORCID iD distinguishes researchers.','Connect relevant research contributions to your record.','A suggested use: check your researcher identity before submitting work.'],
    'Choose record visibility carefully and verify affiliations. An ORCID iD is an identifier, not a credential or publication-quality endorsement.',{fresh:true,source:'https://info.orcid.org/what-is-orcid/',tags:'research identifier profile authors publication identity'});
  external('cordis','CORDIS Research Projects','research','https://cordis.europa.eu/',
    'Discover EU-funded research projects and their reported outputs.',
    ['Search projects related to a health or policy topic.','Explore participating organisations and reported results.','A suggested use: map a research area before approaching a supervisor.'],
    'A project record is not an open vacancy or an invitation to join. Check dates, outputs and current opportunities separately.',{fresh:true,tags:'EU projects Horizon research organisations health policy consortium'});
  external('ruter','Ruter Journey Planner','cities','https://reise.ruter.no/en',
    'Plan public-transport journeys for Oslo and the surrounding area.',
    ['Search stops and routes for local journeys.','Compare public-transport travel suggestions.','A suggested use: check your journey to the Oslo campus.'],
    'Check current departures, disruptions, ticket zones and fare eligibility with the operator. The Hub does not sell tickets.',{fresh:true,cities:['oslo'],tags:'Oslo Norway public transport metro bus tram'});
  external('entur','Entur Travel Planner','cities','https://entur.no/',
    'Explore public-transport travel options across Norway.',
    ['Search journeys across public-transport modes.','Explore connections when travelling beyond your study city.','A suggested use: plan onward travel from Oslo.'],
    'Check the operator and the exact ticket conditions. A suggested route does not by itself establish ticket validity or a guaranteed connection.',{fresh:true,cities:['oslo'],tags:'Norway Oslo train bus journey planner connections'});
  external('ivb','IVB Innsbruck Transport','cities','https://www.ivb.at/en/',
    'Find Innsbruck transport lines, timetables and ticket information.',
    ['Explore local bus and tram line information.','Open timetable and ticket resources from the operator.','A suggested use: check commuting options before choosing accommodation.'],
    'Confirm current routes, ticket conditions and student eligibility with IVB. This card is a source link, not live travel advice.',{fresh:true,cities:['innsbruck'],tags:'Innsbruck Austria bus tram public transport tickets'});
  external('excalidraw','Excalidraw','writing','https://excalidraw.com/',
    'Sketch a concept map or explain a process on a visual whiteboard.',
    ['Draw diagrams and hand-drawn-style concept maps.','Sketch a process before preparing a slide.','A suggested use: map a group presentation argument together.'],
    'Check sharing and export settings before collaboration. Avoid confidential content; hosted and paid products may have different features.',{fresh:true,tags:'whiteboard concept maps group project diagrams presentation'});

'''
s=s.replace('  const plan =',add+'  const plan =') if '  const plan =' in s else s
if "external('who-gho'" not in s:
 s=s.replace("  const ids = new Set",add+"  const ids = new Set")
s=s.replace("      saved:raw.saved==='1'||raw.saved===true,","      saved:raw.saved==='1'||raw.saved===true,\n      city:['bologna','oslo','innsbruck','rotterdam'].includes(raw.city)?raw.city:'all',\n      fresh:raw.fresh==='1'||raw.fresh===true,")
s=s.replace("      (!s.saved||set.has(t.id))&&words.every", "      (s.city==='all'||(t.cities||[]).includes(s.city))&&(!s.fresh||t.fresh===true)&&\n      (!s.saved||set.has(t.id))&&words.every")
p.write_text(s)
r=Path('.')
p=r/'toolkit.html';s=p.read_text()
s=s.replace('<link rel="stylesheet" href="toolkit.css?v=c88c82db">','<link rel="stylesheet" href="toolkit.css?v=c88c82db">\n  <link rel="stylesheet" href="toolkit-organiser.css">')
s=s.replace('<div class="tk-layout">','''<nav id="tk2-sections" class="tk2-sections" aria-label="Toolkit sections">
        <button type="button" data-section="browse" aria-pressed="true" aria-controls="tk2-browse"><span>01</span> Browse tools</button>
        <button type="button" data-section="collections" aria-pressed="false" aria-controls="tk2-collections"><span>02</span> Ready-made collections</button>
        <button type="button" data-section="lists" aria-pressed="false" aria-controls="tk2-lists"><span>03</span> My lists</button>
        <button type="button" data-section="compare" aria-pressed="false" aria-controls="tk2-compare"><span>04</span> Compare <b id="tk2-compare-count">0</b></button>
      </nav>
      <p id="tk2-notice" class="tk2-notice">New in the Toolkit: 8 practical collections, your own lists and 12 more provider resources. <button type="button" id="tk2-new-resources" class="tk-text-button">Browse the new additions →</button></p>
      <div id="tk2-browse" class="tk-layout">''',1)
s=s.replace('              <label>Order<select id="tk-sort">','''              <label>City-specific resources<select id="tk-city"><option value="all">Any city or general use</option><option value="bologna">Bologna-specific</option><option value="oslo">Oslo-specific</option><option value="innsbruck">Innsbruck-specific</option><option value="rotterdam">Rotterdam-specific</option></select></label>
              <label class="tk2-fresh-filter"><input id="tk-fresh" type="checkbox"> New provider additions only</label>
              <label>Order<select id="tk-sort">''')
s=s.replace('      <section class="tk-how"', '''      <section id="tk2-collections" class="tk2-panel" aria-labelledby="tk2-collections-title" hidden></section>
      <section id="tk2-lists" class="tk2-panel" aria-labelledby="tk2-lists-title" hidden></section>
      <section id="tk2-compare" class="tk2-panel" aria-labelledby="tk2-compare-title" hidden></section>
      <p id="tk2-status" class="tk2-status" role="status" aria-live="polite"></p>
      <p id="tk2-error" class="tk-warning" role="alert" hidden></p>
      <p id="tk2-storage-warning" class="tk-warning" role="status" hidden>Browser storage is unavailable. Your lists work in this page session only; export a backup before closing it.</p>
      <section class="tk-how"''',1)
s=s.replace('      <details class="tk-maintenance"><summary>Sources, privacy &amp; catalogue notes</summary>','''      <details class="tk-maintenance"><summary>Sources, privacy &amp; catalogue notes</summary><p>My lists saves list names, known tool IDs and your reviewed checkboxes on this device, separately from bookmarks and course progress. Nothing is sent to the Hub. Export/import is a manual JSON backup, not account synchronisation. Compare selections last only for this page session. Avoid personal or confidential information in list names. Clear lists from the My lists section.</p>''')
s=s.replace('  <script defer src="toolkit.js', '  <script defer src="toolkit-organiser-data.js"></script>\n  <script defer src="toolkit.js')
s=s.replace('\n</body>', '\n  <script defer src="toolkit-organiser.js"></script>\n</body>')
s=s.replace('Useful tools for study, research and student life. Explore the shared Statistics Lab, selected external services and clearly labelled future tools.','Tools for study, research and student life. Explore 8 ready-made collections, create local lists and compare useful resources.')
p.write_text(s)
p=r/'toolkit.js';s=p.read_text()
s=s.replace("    if(toolId)url.searchParams.set('tool',toolId);", "    const current=new URL(window.location.href);\n    for(const key of ['section','collection'])if(current.searchParams.has(key))url.searchParams.set(key,current.searchParams.get(key));\n    if(toolId)url.searchParams.set('tool',toolId);")
s=s.replace("${esc(t.title)}</h4>","${esc(t.title)}${t.fresh?'<span class=\"tk2-new-badge\">New</span>':''}</h4>")
s=s.replace("</div></article>`;\n  }\n  function quick", "</div><div class=\"tk2-card-actions\"><button type=\"button\" class=\"tk-text-button\" data-add-list=\"${t.id}\">Add to list</button>${t.kind!=='planned'?`<button type=\"button\" class=\"tk-text-button\" data-compare=\"${t.id}\" aria-pressed=\"false\">Compare</button>`:'<span class=\"tk-meta tk-small\">Idea, not a live tool</span>'}</div></article>`;\n  }\n  function quick")
s=s.replace("['kind','course','sort']", "['kind','course','sort','city']")
s=s.replace("    $('tk-search').value=state.q;", "    $('tk-search').value=state.q;\n    $('tk-fresh').checked=state.fresh;")
s=s.replace("state.kind!=='all'||state.course!=='all'||state.sort!=='curated'", "state.kind!=='all'||state.course!=='all'||state.city!=='all'||state.fresh||state.sort!=='curated'")
s=s.replace("state.course!=='all'||state.saved;", "state.course!=='all'||state.city!=='all'||state.fresh||state.saved;")
s=s.replace("    syncControls();sidebar();syncURL();", "    syncControls();sidebar();syncURL();\n    root.dispatchEvent(new CustomEvent('toolkit:render'));" )
s=s.replace("kind:'all',course:'all',saved:false,sort:'curated'", "kind:'all',course:'all',city:'all',fresh:false,saved:false,sort:'curated'")
s=s.replace("    dialog.scrollTop=0;", "    root.dispatchEvent(new CustomEvent('toolkit:detail',{detail:{id}}));\n    dialog.scrollTop=0;")
s=s.replace("${source}<p class=\"tk-detail-source\">", "<div class=\"tk2-detail-actions\"><button type=\"button\" class=\"tk-button tk-button-outline\" data-add-list=\"${t.id}\">Add to a personal list</button>${t.kind!=='planned'?`<button type=\"button\" class=\"tk-text-button\" data-compare=\"${t.id}\" aria-pressed=\"false\">Compare this tool</button>`:''}</div>${source}<p class=\"tk-detail-source\">")
s=s.replace("  $('tk-grid').addEventListener", "  $('tk-fresh').addEventListener('change',()=>apply({fresh:$('tk-fresh').checked}));\n  $('tk-grid').addEventListener")
s=s.replace("{saved:true,q:'',category:'all',kind:'all',course:'all'}", "{saved:true,q:'',category:'all',kind:'all',course:'all',city:'all',fresh:false}")
s=s.replace("{q:'Statistics Lab',category:'study',kind:'builtin',course:'all',saved:false}", "{q:'Statistics Lab',category:'study',kind:'builtin',course:'all',city:'all',fresh:false,saved:false}")
s=s.replace("  const requested=new URLSearchParams", "  window.StudentToolkitUI=Object.freeze({apply,reset,openDetail,getSaved:()=>[...prefs.saved]});\n  const requested=new URLSearchParams")
p.write_text(s)
p=r/'sw.js';s=p.read_text().replace('const SITE_FILES = [','const SITE_FILES = [\n  "toolkit-organiser-data.js", "toolkit-organiser.js", "toolkit-organiser.css",',1);p.write_text(s)
p=r/'privacy.html';s=p.read_text();n='<p><strong>Toolkit personal lists:</strong> List names, catalogue IDs and reviewed checkboxes are stored in this browser only, under a separate Toolkit key. Manual JSON export/import creates a portable backup; it does not sync an account. Comparison choices are kept only for the page session. List names should not contain confidential information. My lists includes a clear action that leaves saved bookmarks, course progress and other Hub data unchanged.</p>'
i=s.find('Student Toolkit')
if i<0: i=s.find('Toolkit')
end=s.find('</p>',i)
assert i>=0 and end>i
s=s[:end+4]+'\n      '+n+s[end+4:];p.write_text(s)
p=r/'tests/toolkit.test.js';s=p.read_text().replace('D.items.length,58','D.items.length,70').replace('.size,58','.size,70').replace('[18,24,16]','[18,36,16]').replace("view:'grid',saved:false}","view:'grid',saved:false,city:'all',fresh:false}").replace('result.length,3','result.length,6');p.write_text(s)
p=r/'tests/toolkit-browser.py';s=p.read_text().replace('42','54');p.write_text(s)
p=r/'tests/toolkit-browser.py';s=p.read_text().replace("'24 external entries filter'","'36 external entries filter'").replace("inner_text()=='24'","inner_text()=='36'").replace("count()==3)\n    p.locator('#tk-course')","count()==6)\n    p.locator('#tk-course')");p.write_text(s)
subprocess.run(['node','scripts/stamp-versions.js'],check=True)
subprocess.run([sys.executable,__file__,'--verify'],check=True)
