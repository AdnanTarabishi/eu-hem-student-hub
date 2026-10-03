// ===== City guide =====
// One template page for every city. It loads the city's Markdown file,
// converts it to HTML with the "marked" library, then adds:
// a notice box, a table of contents, new-tab external links and phone-friendly tables.

// The cities we have guides for. To add a city: write docs/content/<city>-guide.md
// and add one line here. Only cities in this list can be loaded.
// A city with file: null is planned: its page says "Coming soon" until the guide is written.
const CITY_GUIDES = {
  bologna: { name: "Bologna", country: "Italy", file: "docs/content/bologna-guide.md" },
  oslo: { name: "Oslo", country: "Norway", file: null },
  innsbruck: { name: "Innsbruck", country: "Austria", file: null },
  rotterdam: { name: "Rotterdam", country: "Netherlands", file: null },
};
const DEFAULT_CITY = "bologna";

const guideArticle = document.getElementById("guide");

// "1. First-week checklist" -> "first-week-checklist"
function headingId(text) {
  return text
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// A planned city without a guide yet
function showComingSoon(guide) {
  document.title = `${guide.name} City Guide – EU-HEM Student Hub`;
  guideArticle.innerHTML = "";
  guideArticle.appendChild(createElement("p", "coming-soon-badge", "Coming soon"));
  guideArticle.appendChild(createElement("h1", null, `${guide.name} City Guide`));
  guideArticle.appendChild(createElement("p", null,
    `A practical guide to living and studying in ${guide.name} (${guide.country}): housing, transport, healthcare, study places and student tips, written by EU-HEM students.`));
  const back = createElement("a", "button", "← Back to the homepage");
  back.href = "index.html";
  guideArticle.appendChild(back);
}

function showGuideError(message) {
  guideArticle.innerHTML = "";
  guideArticle.appendChild(createElement("p", "placeholder", message));
}

// The first quote block (the "> Last checked ..." lines) becomes a highlighted notice
function styleNoticeBox() {
  const notice = guideArticle.querySelector("h1 + blockquote") || guideArticle.querySelector("blockquote");
  if (!notice) return;
  notice.className = "guide-notice";
  notice.innerHTML = notice.innerHTML.replace(/(Last checked:[^.<]*\.?)/, "<strong>$1</strong>");
}

// Other quote blocks (like "Student tips") use the site's normal note style
function styleOtherQuotes() {
  for (const quote of guideArticle.querySelectorAll("blockquote:not(.guide-notice)")) {
    quote.classList.add("note");
  }
}

// Gives every section heading an id, and builds the "Contents" box from them
function buildTableOfContents() {
  const headings = [...guideArticle.querySelectorAll("h2")];
  if (headings.length === 0) return;

  const toc = createElement("nav", "guide-toc");
  toc.id = "contents";
  toc.setAttribute("aria-label", "Contents");
  toc.appendChild(createElement("h2", null, "Contents"));
  const list = createElement("ul");

  for (const heading of headings) {
    heading.id = headingId(heading.textContent);
    const link = createElement("a", null, heading.textContent);
    link.href = "#" + heading.id;
    const item = createElement("li");
    item.appendChild(link);
    list.appendChild(item);
  }
  toc.appendChild(list);

  // Put the contents box after the notice box (or after the title if there is none)
  const anchor = guideArticle.querySelector(".guide-notice") || guideArticle.querySelector("h1");
  anchor.after(toc);

  // A "back to contents" link at the end of each section, handy on long phone pages
  const backLink = () => {
    const link = createElement("a", "guide-back", "↑ Back to contents");
    link.href = "#contents";
    return link;
  };
  for (const heading of headings.slice(1)) {
    // Sections are separated by a line (<hr>); put the link before it
    const before = heading.previousElementSibling?.tagName === "HR" ? heading.previousElementSibling : heading;
    before.before(backLink());
  }
  guideArticle.appendChild(backLink());
}

// Wide tables scroll sideways inside their own box instead of stretching the page
function wrapTables() {
  for (const table of guideArticle.querySelectorAll("table")) {
    const wrapper = createElement("div", "table-wrapper");
    table.before(wrapper);
    wrapper.appendChild(table);
  }
}

async function loadGuide() {
  const cityKey = new URLSearchParams(window.location.search).get("city") || DEFAULT_CITY;
  const guide = CITY_GUIDES[cityKey.toLowerCase()];
  if (!guide) {
    showGuideError(`Sorry, there is no guide for "${cityKey}" yet.`);
    return;
  }
  if (!guide.file) {
    showComingSoon(guide);
    return;
  }

  try {
    if (typeof marked === "undefined") throw new Error("Markdown library did not load");

    const response = await fetch(guide.file);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();

    // The guide is written by us, so it is trusted. If students can submit
    // content later (Phase 2), it must be cleaned with a sanitizer first.
    // breaks: true keeps single line breaks (e.g. "Last checked" and the disclaimer on separate lines)
    guideArticle.innerHTML = marked.parse(markdown, { breaks: true });

    document.title = `${guide.name} City Guide – EU-HEM Student Hub`;
    styleNoticeBox();
    styleOtherQuotes();
    buildTableOfContents();
    openExternalLinksInNewTab(guideArticle);
    wrapTables();

    // If the address already points at a section (e.g. #housing), jump there now that it exists
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  } catch (error) {
    console.error("Could not load guide:", error);
    showGuideError("Sorry, the guide could not be loaded right now. Please try again later.");
  }
}

loadGuide();
