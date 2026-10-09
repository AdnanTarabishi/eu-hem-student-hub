# Behind the Build checks

Run from the repository root after generating the page and stamping asset versions:

```sh
node tests/behind-build/data.test.mjs .
node tests/behind-build/browser.test.mjs .
```

The browser check uses the real shared styles and navigation. It blocks external
requests and uses no private data. Screenshots cover desktop, tablet and phone
layouts in light and dark modes. JavaScript-free reading is checked separately.

The current snapshot is an approximate 60-hour personal-effort estimate, restored
at the owner's request on 9 October 2026 and allocated illustratively across six
workstreams. The data test checks the revised total, its estimate basis and the
7 October cohort beta date shared with the Roadmap.
