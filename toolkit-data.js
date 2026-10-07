/* Student Toolkit catalogue and pure helpers. English, original editorial copy.
 * One record per entry; existing tools are linked, never copied. No runtime API.
 * External descriptions are based on provider pages reviewed on 2026-10-07.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudentToolkitData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const reviewed = '2026-10-07';
  const categories = [
    ['all','All tools','grid'], ['study','Study & statistics','chart-column'],
    ['economics','Health economics','scale'], ['research','Research','library'],
    ['writing','AI & writing','sparkles'], ['life','Life & budget','home'],
    ['career','Career','briefcase'], ['cities','Cities & mobility','globe']
  ].map(([id,label,icon]) => ({id,label,icon}));
  const items = [];
  const add = (id,title,category,kind,summary,includes,extra={}) => items.push({
    id,title,category,kind,summary,includes,icon:categories.find(c=>c.id===category).icon,
    ...extra
  });
  const lab = (id,title,summary,includes,extra={}) => add(id,title,'study','builtin',summary,includes,{
    href:`statistics-lab.html?labtool=${id}`,courses:['fundamentals','statistics'],
    access:'Free · no account',note:'Educational calculations, not validated research or clinical software. Check assumptions and follow the rules for assessed work.',
    collection:'Statistics Lab',...extra
  });
  lab('normal','Normal Distribution','See the probability between values or in the tails of a normal curve.',
    ['Change the mean, SD and bounds; move the boundary sliders.','Follow standardisation and area calculations step by step.','Compare full-precision results with the printed-table method.'],{icon:'trending-up',tags:'z score gaussian probability area',featured:true});
  lab('ztable','Interactive Z-table','Connect a cumulative probability cell to its shaded normal curve.',
    ['Positive and negative z-scores, with row and column highlighting.','Left-tail, right-tail and symmetric two-tail probabilities.','Navigate the table by mouse, touch or keyboard.'],{icon:'grid',tags:'z-score lookup cumulative phi'});
  lab('quantiles','Cutoffs & Percentiles','Start with a probability and work backwards to the value or interval.',
    ['Left-tail, right-tail or equal-tail central probability.','Two cumulative probabilities and the area between them.','Inverse z-scores, original-scale values and Excel formulas.'],{icon:'calculator',tags:'inverse normal percentile limits'});
  lab('sampling','Sample Means & CLT','Understand standard error and how averages vary across samples.',
    ['Calculate probabilities for a sample mean using σ / √n.','Distinguish a sampling interval from a confidence interval.','Explore a seeded 500-sample simulation with different population shapes.'],{icon:'network',tags:'sampling central limit theorem standard error simulation'});
  lab('confidence','Mean Confidence Intervals','Build a two-sided interval and understand the margin of error.',
    ['Choose z for known population SD or t for sample SD.','See degrees of freedom, critical value and interval endpoints.','Read a repeated-sampling interpretation and Excel checks.'],{icon:'scale',tags:'confidence interval mean t z estimation',featured:true});
  lab('descriptive','Data Summary & Box Plot','Turn a column of numbers into a clear picture of centre and spread.',
    ['Mean, median, modes, sample/population variance and SD.','Explicit quartile conventions, IQR, histogram and box plot.','Up to 5,000 observations; invalid and missing values are not silently zeroed.'],{icon:'chart-column',tags:'mean median variance sd standard deviation quartiles IQR histogram OECD excel',featured:true});
  lab('tdist','Student t Explorer','Compare Student’s t with the normal distribution and inspect tail areas.',
    ['Change degrees of freedom and the observed t value.','Left, right and two-tail probabilities.','Two-sided critical values for a chosen significance level.'],{icon:'trending-up',tags:'t distribution critical value df'});
  lab('mean-test','One Mean Test','Test a population-mean claim with explicit hypotheses and worked reasoning.',
    ['Known-SD z, sample-SD t and a labelled large-sample z option.','One-sided or two-sided alternatives and shaded p-values.','Critical boundaries, decision wording and Excel checks.'],{icon:'check',tags:'hypothesis p value null significance'});
  lab('proportion-ci','Proportion Interval','Estimate a population proportion with a clearly labelled interval method.',
    ['Course Wald interval with observed-count checks.','Wilson score interval labelled as a supplementary method.','Endpoints, standard error and confidence interpretation.'],{icon:'scale',tags:'wald wilson confidence proportion percentage'});
  lab('proportion-test','One Proportion Test','Compare an observed proportion with a claim about the population.',
    ['Null-based standard error and expected counts.','One-sided or two-sided hypotheses.','No normal-test decision when the implemented count check fails.'],{icon:'check',tags:'hypothesis proportion z test expected counts'});
  lab('two-means','Two Independent Means','Compare two groups and interpret the uncertainty in their difference.',
    ['Course large-sample normal approximation.','Supplementary Welch t with fractional degrees of freedom.','Contrast direction, p-value and a labelled two-sided interval.'],{icon:'scale',tags:'two sample welch comparison independent groups',note:'Not a paired-data calculator. Fundamentals Topic 6 is additional/time permitting; Welch is supplementary. Check the course guide.'});
  lab('discrete','Discrete Probability','Explore expectation, variance and events in a specified probability model.',
    ['Enter possible values and their probabilities.','Expectation, variance, SD and cumulative probabilities.','Inclusive events and a Bernoulli example; totals must equal one.'],{icon:'chart-column',tags:'bernoulli discrete expected value probability mass'});
  const hub = (id,title,category,href,summary,includes,extra={}) => add(id,title,category,'builtin',summary,includes,{
    href,access:'Free · no Hub account',collection:'Hub workspace',note:'A student-run guide. Confirm requirements, deadlines and practical arrangements with the original provider.',...extra
  });
  hub('study-plan','Study Plan','study','studyplan.html','Organise course choices and credits in the existing semester planner.',
    ['Explore the programme’s study-plan structure.','Keep course choices and statuses on your device.','Open the related timetable and exam information.'],{icon:'study-plan',tags:'ECTS CFU course selection semester'});
  hub('calendar','Calendar & Key Dates','study','calendar.html','Keep the programme’s dates within easy reach.',
    ['Find the calendar feeds already offered by the Hub.','Open subscription options for your calendar app.','Use official course sources to confirm important dates.'],{icon:'calendar',tags:'schedule exams timetable deadlines'});
  hub('thesis','Thesis Explorer','research','thesis.html','Explore previous thesis topics and the Hub’s research-planning guidance.',
    ['Browse the existing thesis archive.','Explore topic, method and proposal guidance.','Use the existing personal thesis workspace.'],{icon:'library',tags:'thesis dissertation proposal literature research methods',featured:true});
  hub('city-guides','Four-City Guides','cities','city-guide.html','Prepare for Bologna, Oslo, Innsbruck and Rotterdam.',
    ['Explore existing city guides and their original sources.','Find housing, transport and arrival information.','Check source dates before making a practical decision.'],{icon:'globe',tags:'Italy Norway Austria Netherlands moving housing transport',cities:['bologna','oslo','innsbruck','rotterdam'],featured:true});
  hub('fundamentals-workspace','Fundamentals Study Workspace','study','fund-statistics.html','Return to the topic pathway, guided experiments and exam preparation.',
    ['Original topic guides and worked cases.','Guided experiments and study resources.','Practice and mock preparation; not permission to use aids in an exam.'],{icon:'book',courses:['fundamentals'],tags:'statistics foundations fundamentals mock flashcards'});
  hub('statistics-workspace','Statistics Study Centre','study','statistics.html','Connect calculation practice with interpretation and revision.',
    ['Open the existing Statistics Study Centre.','Review concepts and numerical working.','Return to your study and practice activities.'],{icon:'graduation',courses:['statistics'],tags:'statistics healthcare review practice'});

  const external = (id,title,category,href,summary,includes,note,extra={}) => add(id,title,category,'external',summary,includes,{
    href,access:'Check provider access',note,source:href,reviewed,...extra
  });
  external('zotero','Zotero','research','https://www.zotero.org/','Keep papers, references and citations organised for your next assignment.',
    ['Collect and organise research references.','Create citations and bibliographies.','A suggested use: one collection per assignment or thesis theme.'],
    'Check citation metadata against the original paper. Sync/storage options have their own terms.',{icon:'library',featured:true,tags:'references bibliography citations manager'});
  external('researchrabbit','ResearchRabbit','research','https://www.researchrabbit.ai/','Discover related papers and explore connections around a starting article.',
    ['Explore related literature from a seed paper.','Build a collection for a research question.','Use citation connections as leads for further screening.'],
    'Discovery is not a systematic-review search strategy. Verify every paper and document your search.',{icon:'network',tags:'literature discovery papers citation network'});
  external('anki','Anki','study','https://apps.ankiweb.net/','Build a repeatable flashcard-review routine from your own material.',
    ['Create question-and-answer cards.','Review cards with scheduled repetition.','Start with a small, carefully checked deck.'],
    'Use material you own or may reuse. Official apps and access terms differ by platform.',{icon:'flashcards',tags:'flashcards spaced repetition recall memory'});
  external('jamovi','jamovi','study','https://www.jamovi.org/','Explore statistical analyses through a graphical interface.',
    ['Work with tabular data.','Explore statistical analyses and their output.','Use the provider’s learning resources alongside your course.'],
    'Selecting an analysis does not validate its assumptions. Do not upload confidential research data to an unapproved cloud service.',{icon:'chart-column',tags:'statistics software GUI data regression'});
  external('jasp','JASP','study','https://jasp-stats.org/','A graphical environment for learning and performing statistical analyses.',
    ['Explore classical and Bayesian analysis options.','Inspect tables and plots.','Check settings and assumptions before interpreting output.'],
    'Bayesian methods may be beyond your current course. Follow the method specified by the instructor.',{icon:'chart-column',tags:'statistics software Bayesian analysis'});
  external('chatgpt','ChatGPT Study Mode','writing','https://chatgpt.com/studymode','Work through a concept with questions, explanations and knowledge checks.',
    ['Ask for hints rather than a finished assessed answer.','Explain your level and where you got stuck.','Check your reasoning against course material.'],
    'AI can make mistakes. Follow course AI rules; do not upload private data or material without permission.',{source:'https://help.openai.com/en/articles/11780217-using-study-mode-in-chatgpt',icon:'sparkles',tags:'AI tutor explain quiz OpenAI learning'});
  external('notebooklm','Gemini Notebook / NotebookLM','writing','https://notebooklm.google/','Explore and question a collection of sources you are permitted to use.',
    ['Source-centred AI research and study support.','Keep related permitted readings together.','Return to original passages to check an answer.'],
    'Google now calls NotebookLM Gemini Notebook. AI answers still need checking; respect source permissions and account privacy settings.',{icon:'book',source:'https://notebooklm.google/plans',tags:'Google NotebookLM notebook sources AI notes'});
  external('rstudio','RStudio','study','https://docs.posit.co/ide/user/','Develop reproducible analyses with code, plots and project files.',
    ['Use the RStudio IDE with R or Python workflows.','Organise analysis scripts in a project.','Record your package versions and analysis decisions.'],
    'Requires learning the language and appropriate software setup. Open-source and commercial editions differ.',{icon:'calculator',tags:'R Posit code statistics reproducibility econometrics'});
  external('colab','Google Colab','study','https://developers.google.com/colab','Use browser-based notebooks for coding practice and data analysis.',
    ['Write and run notebook code.','Combine analysis with explanatory text.','Practice with public or synthetic datasets.'],
    'Cloud runtime limits and account terms vary. Avoid confidential data without institutional approval.',{icon:'calculator',tags:'Python code notebook data analysis'});
  external('overleaf','Overleaf','writing','https://www.overleaf.com/','Write a structured academic document with an online LaTeX workflow.',
    ['Draft formula-heavy reports and documents.','Work with LaTeX templates.','Collaborate under the provider’s access limits.'],
    'Confirm the required submission format first. Account, collaboration and premium features have provider terms.',{icon:'file',tags:'LaTeX writing mathematics thesis report'});
  external('deepl','DeepL Translator','writing','https://www.deepl.com/en/translator','Understand everyday text and check wording across languages.',
    ['Translate short practical texts.','Compare alternative wording.','Use alongside language learning, not instead of understanding.'],
    'Do not rely on unreviewed translations for legal or clinical decisions. Avoid uploading private documents.',{icon:'globe',tags:'language translation Italian German Norwegian Dutch'});
  external('canva','Canva','writing','https://www.canva.com/','Design presentations, posters and simple visual communication.',
    ['Prepare slide and poster layouts.','Use consistent typography and spacing.','Check exported files before submission.'],
    'Check asset licences, access tiers and any university branding rules. Student access is not automatically premium.',{icon:'file',tags:'design presentation poster slides'});
  external('notion','Notion','study','https://www.notion.com/product','Keep project context, notes and tasks in a shared workspace.',
    ['Organise an assignment or group project.','Keep notes and task context together.','Review sharing permissions before inviting others.'],
    'Features, AI allowances and paid plans vary. Do not assume your student account includes every feature.',{icon:'notes',tags:'notes productivity planning project tasks'});
  external('google-calendar','Google Calendar','life','https://workspace.google.com/products/calendar/','Coordinate classes, study sessions and everyday appointments.',
    ['Separate study and personal calendars.','Share availability for group work.','Use the Hub’s calendar page for its subscription options.'],
    'Check time zones and sharing settings. This directory does not connect to or read your calendar.',{icon:'calendar',tags:'schedule time management tasks appointments'});
  external('oecd','OECD Health Statistics','economics','https://www.oecd.org/en/data/datasets/oecd-health-statistics.html','Start from an official source for comparative health-system data.',
    ['Explore health indicators across countries.','Read indicator definitions and data notes.','Document units, coverage and reference years in your analysis.'],
    'Comparable-looking figures can differ in definitions, coverage and timing. Always retain the metadata.',{icon:'chart-column',tags:'dataset health expenditure OECD indicators economics'});
  external('eurostat','Eurostat Database','research','https://ec.europa.eu/eurostat/web/main/data/database','Find European statistics and follow each dataset’s metadata.',
    ['Explore the official database by topic.','Select countries, measures and time periods.','Record the exact dataset code and extraction date.'],
    'Check revisions, missing values and units. This card links to the provider, not a live Hub data dashboard.',{icon:'library',tags:'dataset Europe European statistics health population'});
  external('pubmed','PubMed','research','https://pubmed.ncbi.nlm.nih.gov/','Search biomedical and health literature at its original discovery source.',
    ['Search citations and abstracts.','Build a documented set of search terms.','Follow publisher or repository links for full text.'],
    'Not every indexed paper has free full text. Critically appraise study design and evidence.',{source:'https://pubmed.ncbi.nlm.nih.gov/about/',icon:'search',tags:'medicine biomedical literature research systematic review'});
  external('europass','Europass CV','career','https://europass.europa.eu/en/create-europass-cv','Create and maintain a structured CV for European applications.',
    ['Record experience, education and skills.','Prepare an application-specific version.','Use the provider’s CV-creation guidance.'],
    'Tailor the format and content to the employer. A CV tool cannot guarantee an interview or work eligibility.',{icon:'briefcase',tags:'CV resume skills career applications'});
  external('eures','EURES','career','https://eures.europa.eu/index_en','Explore European employment information and job-search resources.',
    ['Find job-search and labour-mobility information.','Read country and employer requirements.','Use opportunities as leads to verify independently.'],
    'Language and right-to-work conditions vary. This is not a guarantee of eligibility or an English-only job.',{icon:'briefcase',tags:'jobs internship Europe career employment'});
  external('esncard','ESNcard','life','https://esncard.org/','Explore the student-network card and its partner offers.',
    ['Check eligibility with the relevant ESN section.','Review participating offers and their conditions.','Compare the total cost before purchasing.'],
    'Eligibility, card cost, geography and offer conditions apply. No discount is guaranteed by the Hub.',{icon:'bookmark',tags:'student discounts Erasmus ESN travel'});
  external('9292','9292','cities','https://9292.nl/en/','Plan public-transport journeys in the Netherlands.',
    ['Search a route from an address or stop.','Check departure times and disruptions.','Read ticket and accessibility information.'],
    'Confirm the current route and ticket conditions with the provider before travel.',{icon:'route',cities:['rotterdam'],tags:'Rotterdam Netherlands transport bus metro train'});
  external('oebb','ÖBB Timetable / SCOTTY','cities','https://www.oebb.at/en/fahrplan','Plan rail connections and check travel information for Austria.',
    ['Search connections and departure times.','Check route information and disruption notices.','Review ticket conditions separately from the timetable.'],
    'Timetables and fares can change. A route result is not a reservation or a guaranteed student fare.',{icon:'route',cities:['innsbruck'],tags:'Innsbruck Austria rail train travel SCOTTY OBB'});
  external('splitwise','Splitwise','life','https://www.splitwise.com/','Keep a record of shared expenses with housemates or travel companions.',
    ['Record who paid for a shared expense.','Review group balances.','Agree a split and settlement method with your group.'],
    'Provider limits and paid features vary. The Hub does not process payments or access your expense records.',{icon:'calculator',tags:'budget expenses shared bills money housemates'});
  external('tper','TPER','cities','https://www.tper.it/','Find the operator’s transport information for Bologna and the region.',
    ['Check published routes and timetables.','Read the current ticket and pass information.','Use the provider’s notices before your journey.'],
    'The provider site is primarily Italian. Check eligibility and current conditions before buying a pass.',{icon:'route',cities:['bologna'],tags:'Bologna Italy bus transport timetable tickets'});

  // v2 additions: short, original descriptions checked against the linked provider.
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

  const plan = (id,title,category,summary,includes,extra={}) => add(id,title,category,'planned',summary,includes,{
    access:'Not available yet',note:'Proposed scope, not a working tool. No release date is committed. Saving this idea is a private bookmark, not a vote or notification subscription.',...extra
  });
  plan('test-finder','Statistical Test Finder','study','A guided route from your study question to a suitable analysis.',
    ['Could ask about outcome type, study design and paired versus independent data.','Could explain assumptions, alternatives and common mistakes.','Could link directly to the relevant existing calculator.'],{icon:'network',tags:'hypothesis decision tree choose test'});
  plan('excel-assistant','Excel Formula Assistant','study','Find a formula, understand its inputs and check a worked example.',
    ['Could organise formulas by exercise type.','Could explain sample versus population functions and quartile conventions.','Could offer locale-aware separators and copyable formulas.'],{icon:'calculator',tags:'Excel formulas spreadsheet'});
  plan('health-economics-calculator','Health Economics Calculator','economics','Explore cost-effectiveness without losing sight of the assumptions.',
    ['Could cover incremental costs and effects, ICER and net monetary benefit.','Could plot scenarios on the cost-effectiveness plane.','Could include discounting, dominance warnings and worked teaching examples.'],{icon:'scale',tags:'ICER QALY NMB costs effects evaluation',featured:true});
  plan('economics-graphs','Economics Graph Explorer','economics','Make economic concepts easier to understand by changing the graph.',
    ['Could explore supply, demand, elasticity and equilibrium.','Could compare baseline and changed scenarios.','Could connect visual changes to equations and course notes.'],{icon:'trending-up',tags:'supply demand elasticity graphs economics'});
  plan('study-session-planner','Study Session Planner','study','Turn an exam date and available time into a realistic revision plan.',
    ['Could prioritise topics and estimate study blocks.','Could combine retrieval practice, breaks and review sessions.','Could export a plan without silently creating calendar events.'],{icon:'calendar',tags:'exam revision time planning sessions'});
  plan('four-city-budget','Four-City Budget Planner','life','Compare your own living-cost scenarios across the four programme cities.',
    ['Could separate rent, food, transport, deposits and one-off moving costs.','Could compare Bologna, Oslo, Innsbruck and Rotterdam.','Could show EUR/NOK assumptions with a dated source or manual exchange rate.'],{icon:'calculator',cities:['bologna','oslo','innsbruck','rotterdam'],tags:'budget rent money expenses EUR NOK',featured:true});
  plan('moving-checklist','Moving Checklist','cities','Keep track of practical steps before the next semester in a new city.',
    ['Could separate before-departure and after-arrival tasks.','Could link to university and government instructions.','Could save checklist progress locally; requirements would still need personal verification.'],{icon:'list',tags:'mobility relocation housing registration arrival'});
  plan('document-deadlines','Document Deadline Tracker','life','Track dates without building a store of sensitive identity documents.',
    ['Could record a document type and expiry date, without uploading a scan.','Could show a local checklist of upcoming dates.','Could export reminder events; no background notification service is promised.'],{icon:'clock',tags:'documents expiry deadlines reminders permits insurance'});
  plan('language-kit','Language Survival Kit','cities','Find practical phrases for study and everyday life in each host country.',
    ['Could group Italian, Norwegian, German and Dutch phrases by situation.','Could include pronunciation guidance and common campus vocabulary.','Could connect students to official language-learning opportunities.'],{icon:'globe',tags:'Italian Norwegian German Dutch phrases language'});
  plan('research-question','Research Question Builder','research','Shape a broad interest into a question you can investigate.',
    ['Could guide PICO or PECO components when appropriate.','Could distinguish a topic from a focused research question.','Could suggest a search-term structure, without inventing references.'],{icon:'search',tags:'PICO PECO thesis research question'});
  plan('literature-matrix','Literature Review Matrix','research','Compare studies consistently rather than collecting disconnected notes.',
    ['Could record design, setting, sample, outcomes and limitations.','Could keep source identifiers beside each extracted claim.','Could export a matrix for a research team to review.'],{icon:'grid',tags:'review extraction evidence studies comparison'});
  plan('dataset-finder','Research Dataset Finder','research','A curated map from a health question to a suitable public data source.',
    ['Could index OECD, Eurostat and other official sources by topic.','Could explain units, coverage, missing values and reuse terms.','Could provide example questions and variable dictionaries.'],{icon:'library',tags:'data OECD Eurostat World Bank dataset metadata'});
  plan('career-tracker','Career Application Toolkit','career','Organise applications and prepare a stronger, more focused submission.',
    ['Could track opportunities, deadlines and follow-ups locally.','Could include CV, cover-letter and interview checklists.','Could distinguish job leads from verified eligibility requirements.'],{icon:'briefcase',tags:'career internship jobs CV interview applications'});
  plan('discount-finder','Student Discounts Finder','life','Compare relevant student offers with their conditions in view.',
    ['Could filter by country, service and eligibility.','Could show a source and last-review date for every offer.','Could distinguish free access from trials, paid cards and restricted offers.'],{icon:'bookmark',tags:'discount student offers savings eligibility'});
  plan('sample-size','Sample Size Planner','study','Explore how design assumptions affect the amount of data needed.',
    ['Could separate precision-based estimation from power-based planning.','Could make effect size, variability, significance and power explicit.','Could include assumption checks rather than a one-size-fits-all answer.'],{icon:'calculator',tags:'sample size power research design precision'});
  plan('travel-budget','Travel Budget Planner','cities','See the full cost of a journey before choosing a route.',
    ['Could include baggage, station transfers and overnight stays.','Could compare manually entered train, coach and flight scenarios.','Could keep estimates distinct from live quotes and bookings.'],{icon:'route',tags:'travel flight train budget transport'});

  const ids = new Set(items.map(t=>t.id));
  const byId = new Map(items.map(t=>[t.id,t]));
  function normalise(text) {
    return String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }
  function cleanState(raw={}) {
    return {
      q:String(raw.q||'').slice(0,160),
      category:categories.some(c=>c.id===raw.category)?raw.category:'all',
      kind:['all','builtin','external','planned'].includes(raw.kind)?raw.kind:'all',
      course:['all','fundamentals','statistics'].includes(raw.course)?raw.course:'all',
      saved:raw.saved==='1'||raw.saved===true,
      city:['bologna','oslo','innsbruck','rotterdam'].includes(raw.city)?raw.city:'all',
      fresh:raw.fresh==='1'||raw.fresh===true,
      sort:raw.sort==='az'?'az':'curated',
      view:raw.view==='list'?'list':'grid'
    };
  }
  function selectItems(raw={},saved=[]) {
    const s=cleanState(raw),words=normalise(s.q).split(/\s+/).filter(Boolean),set=new Set(saved);
    let list=items.filter(t=>(s.category==='all'||t.category===s.category)&&
      (s.kind==='all'||t.kind===s.kind)&&(s.course==='all'||(t.courses||[]).includes(s.course))&&
      (s.city==='all'||(t.cities||[]).includes(s.city))&&(!s.fresh||t.fresh===true)&&
      (!s.saved||set.has(t.id))&&words.every(w=>normalise([t.title,t.summary,t.tags||'',t.collection||'',...(t.includes||[]),...(t.cities||[])].join(' ')).includes(w)));
    if(s.sort==='az')list=list.slice().sort((a,b)=>a.title.localeCompare(b.title,'en'));
    else list=list.slice().sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
    return list;
  }
  function cleanPreferences(raw) {
    const r=raw&&typeof raw==='object'?raw:{};
    const valid=a=>Array.isArray(a)?[...new Set(a.filter(id=>typeof id==='string'&&ids.has(id)))]:[];
    return {version:1,saved:valid(r.saved),rememberRecent:r.rememberRecent===true,
      recent:r.rememberRecent===true?valid(r.recent).filter(id=>byId.get(id).kind!=='planned').slice(0,6):[]};
  }
  function safeHref(value,external=false) {
    if(typeof value!=='string'||/[\s<>\\]/.test(value))return false;
    if(external){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch(_){return false;}}
    return /^[a-z0-9-]+\.html(?:[?#][^<>\\]*)?$/.test(value);
  }
  return Object.freeze({version:1,reviewed,categories,items,byId,normalise,cleanState,selectItems,cleanPreferences,safeHref});
});
