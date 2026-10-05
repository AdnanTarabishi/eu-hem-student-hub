# Setting up the two Google Forms

The site has two form buttons that show "form coming soon" until a link is added to
`content/settings.json`:

| Setting | Button | Where it appears |
|---|---|---|
| `contributeFormUrl` | **Contribute** | Notes & Resources pages |
| `reportErrorFormUrl` | **Report an error** | course notes pages; can also serve the Contact page and the thesis classification feedback |

**Privacy:** in each form, go to **Settings → Responses** and turn **off** "Collect email addresses",
and make sure **"Limit to 1 response"** (which requires sign-in) is **off**. Only ask for contact details
as an *optional* question. The answers stay in your Google account. They are never published on the site.

## Form 1: "Contribute to the EU-HEM Student Hub"
Description: *Share notes, summaries or useful links for other EU-HEM students. Please do not upload
official lecture slides or recordings from Virtuale. Link to Virtuale instead.*

1. **What would you like to share?** (multiple choice, required): Notes or summary · Useful link or resource · Exam tip or practice question · Other
2. **Which course is it for?** (short answer, optional)
3. **Link to your file or resource** (short answer, required). For example, a Google Drive link set to "Anyone with the link can view".
4. **Short description** (paragraph, optional)
5. **May we show your first name as the contributor?** (multiple choice, required): Yes, my first name: ____ · No, keep it anonymous
6. **Confirmation** (checkbox, required): *This is my own work or freely shareable, and it is not an official Virtuale lecture file.*

## Form 2: "Report an error or send feedback"
Description: *Spotted a mistake, an outdated date or a wrong thesis classification? Or have an idea?
Tell us. No personal data is needed.*

1. **What is it about?** (multiple choice, required): Wrong or outdated information · Thesis topic or classification · Broken link · Idea or feature request · Other / general contact
2. **Which page?** (short answer, optional). You can paste the page address.
3. **What should be changed?** (paragraph, required)
4. **Optional: how can we reach you if we have a question?** (short answer, optional). *Only if you want a reply.*

## After creating them
1. In each form: **Send → link icon → Copy** (tick "Shorten URL" if you like).
2. Send both links to Claude, or paste them into `content/settings.json`:
   ```json
   "contributeFormUrl": "https://forms.gle/…",
   "reportErrorFormUrl": "https://forms.gle/…",
   ```
3. Run `node scripts/check-content.js`: the two "form coming soon" warnings disappear.
