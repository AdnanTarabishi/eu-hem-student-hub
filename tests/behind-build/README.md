# Behind the Build checks

Run from the repository root after generating the page and stamping asset versions:

```sh
node tests/behind-build/data.test.mjs .
node tests/behind-build/browser.test.mjs .
```

The browser check uses the real shared styles and navigation. It blocks external
requests and uses no private data. Screenshots cover desktop, tablet and phone
layouts in light and dark modes. JavaScript-free reading is checked separately.

The initial snapshot is owner-reported: 60 hours, allocated illustratively across
six workstreams. The data test intentionally checks that approved total.
