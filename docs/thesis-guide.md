# Thesis Explorer & Guide

`thesis.html` combines a practical research guide with the existing historical thesis archive. The interface is in English and uses only local HTML, CSS and JavaScript.

## Content and authority

Edit `content/thesis-guide.json` for the roadmap, illustrative questions, methods, checklists, writing guidance and resources. Its `sources` identify official programme information and research support. `sourceIds` connect facts and guidance to their references. Suggested workflows and example questions are Student Hub guidance, not approved projects or official deadlines.

The current cohort's thesis guidelines and host university procedures remain authoritative for supervision, approval, data access, ethics, permitted AI use, submission and assessment. Confirm these details rather than inferring requirements from another university or an earlier cohort.

The historical metadata in `content/thesis-archive.json` is unchanged. Use the existing import workflow to update it. Its legacy track labels, title-based classifications and limited metadata remain explicitly labelled.

## Interface and local drafts

`thesis-guide.js` renders the guide independently of the archive. `thesis-guide-data.js` contains pure draft, checklist and backup helpers. `thesis-guide.css` scopes the new visual identity to the thesis page. The five guide views use `#guide-roadmap`, `#guide-topics`, `#guide-toolkit`, `#guide-planner` and `#guide-archive`; historical search and topic query links still open the archive.

Personal research drafts stay in the browser under `euhem-thesis-guide-v1`. The guide reads the shared track preference for context and never automatically changes the student's Study Plan. A storage failure leaves the current tab usable and clearly reports that persistence is unavailable. Backup files and research briefs are downloaded locally; they are not submitted to a supervisor or university.

## Validation

Run `npm run test:thesis-guide`, then `node scripts/stamp-versions.js` before publishing changes to scripts or styles. Browser checks cover the archive, guide navigation, local planning, recovery and responsive light/dark layouts. The hosting environment must allow a local HTTP server and have Playwright Chromium installed.
