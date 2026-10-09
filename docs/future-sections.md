# Future section previews

These public pages establish the navigation, visual design and planned content of three future Hub sections. They are structure previews, not completed collections or working membership services. All three explain their development status on the page.

## Navigation and implementation

| Menu | Page | Preview sections |
| --- | --- | --- |
| Resources | `beyond-euhem.html` | Career Paths; Opportunities; Alumni Paths; Prepare & Apply; Further Study |
| Community | `events.html` | Upcoming; Activities; Past Events; Publishing Principles |
| Community | `gallery.html` | City Albums; Community Albums; Visibility; Contributions |

The pages share `future-pages.css` and `future-pages.js`, existing design tokens, local fonts and the icon sprite. No framework, remote service or new data collection is introduced. The existing shared menus, search and service worker include the previews. Search results label them as in development and link directly to their sections.

Section links work as ordinary anchors with all content visible without JavaScript. JavaScript adds accessible tabs, URL hashes, keyboard navigation and Back/Forward support. Printing shows every section. Decorative illustrations contain no student photos or personal information, and respect reduced-motion preferences.

## Beyond EU-HEM

Career Paths outlines six broad fields rather than promising employment outcomes. Prepare & Apply and Further Study connect to tools already available in the Hub. Future guides will be reviewed before being added.

Opportunities will contain sourced jobs, internships, research positions, funded study and professional learning opportunities. Each published entry should show its original source, organisation, location, eligibility, deadline with time zone and last-checked date. Missing details stay unknown. Expired or withdrawn listings must be separated from active openings. The preview publishes no actual vacancies or deadlines.

Alumni Paths is the home for the requested deeper research into graduates and former students. Research has not been completed as part of this preview. Start with university-published interviews and voluntary contributions; record source dates and review dates. Keep historical cohort and track names. Do not infer employment or other missing details from someone's name or degree. Original profiles and contributed stories require graduate approval and review, with correction and removal routes. The existing Student Experiences collection is linked as a useful resource today.

## Events

The preview covers university and programme activities, research talks, workshops, projects, student-led activities, trips and social gatherings. Future records should identify the organiser and original announcement, audience, cost when applicable, accessibility information when supplied, date, explicit local time zone, location, registration source, deadline and current status.

When event publishing is activated, Events and Calendar should use one reviewed record through the existing editorial workflow rather than separate conflicting copies. Show cancellations and postponements clearly. Past events can link to approved recaps and Gallery albums with their correct audience. The preview does not activate publishing, accept registrations or collect attendee information.

## Gallery

City albums cover Bologna, Oslo, Rotterdam and Innsbruck. Community albums cover student life, events and shared projects. The preview contains no student photos, upload form or populated albums.

The two planned audiences are:

- **Public:** approved photos visible to anyone visiting the Hub, with the photographer's permission and consent from identifiable people for public display.
- **Members only / private:** approved photos visible to verified EU-HEM members. This means verified members, not only the uploader.

Member access is not available yet. Before it opens, verified student sign-in and protected photo storage must cover originals, thumbnails and downloads. Public GitHub files, search indexes and service-worker caches must never contain private photo assets or private records. Hiding a publicly accessible image is insufficient. The existing editor login is not student membership verification.

The contribution plan includes photographer credit, agreed audience, consent from identifiable people, editorial review and correction/removal controls. Audience changes must preserve the consent given. No upload or account system is introduced by this work.

## Development sequence

1. Publish these browsable structures and collect feedback through the existing Contact page.
2. Add reviewed career guidance, sourced opportunities and researched alumni stories when content is ready.
3. Connect reviewed event records to Calendar after the existing editorial publishing workflow is activated.
4. Prepare public Gallery contributions with permissions and moderation; enable members-only albums only after verified access and protected storage are approved and ready.

These steps have no new delivery dates. The roadmap links to the structure previews and keeps the unfinished collections in progress; its overall progress estimate and historical release evidence are unchanged.

## Validation

Run `npm run test:future-pages` for content checks and the real-browser preview suite. It checks responsive layouts and both themes, shared navigation, section links and keyboard/history behaviour, no-JavaScript access, labelled search results, icon references and offline availability. Use `node scripts/check-contrast.js` for shared color contrast. After changing HTML, CSS or JavaScript, regenerate social tags when needed and run `node scripts/stamp-versions.js` before the final checks.
