// ===== Rendering notes: Markdown, maths and images =====
// Shared by all Notes & Resources pages.
// - Markdown -> HTML with "marked"
// - Maths: $...$ inside a sentence, $$...$$ on its own line, typeset with KaTeX
// - Images in notes: paths relative to the course folder, click to zoom

// Matches $$...$$ (can span lines) and $...$ (one line, not starting/ending with a space)
const MATH_PATTERN = /\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?(?<!\s)\$/g;

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Markdown would change maths (e.g. "_" means italics), so formulas are set aside first,
// replaced by placeholders, and put back after the Markdown -> HTML conversion.
function protectMath(markdown) {
  const formulas = [];
  const text = markdown.replace(MATH_PATTERN, (formula) => {
    formulas.push(formula);
    return `MATHPLACEHOLDER${formulas.length - 1}END`;
  });
  return { text, formulas };
}

function restoreMath(html, formulas) {
  return html.replace(/MATHPLACEHOLDER(\d+)END/g, (_, i) => escapeHtml(formulas[Number(i)]));
}

// Markdown -> HTML (with maths kept intact). If "marked" couldn't load, plain paragraphs.
function markdownToHtml(markdown) {
  const { text, formulas } = protectMath(markdown);
  if (typeof marked === "undefined") {
    return text.split(/\n\s*\n/).map((p) => `<p class="plain-markdown">${restoreMath(escapeHtml(p), formulas)}</p>`).join("");
  }
  return restoreMath(marked.parse(text), formulas);
}

// Typesets every formula inside "container" (if KaTeX loaded; otherwise the $...$ text stays)
function typesetMath(container) {
  if (typeof renderMathInElement !== "function") return;
  renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false, // a typo in a formula shows the formula in red instead of breaking the page
  });
}

// An element with plain text (e.g. a flashcard). Formulas in it are typeset later by typesetMath().
function renderRichText(tag, text, className) {
  return createElement(tag, className, text);
}

// ----- Images -----

// Is this a path inside our site (not https://..., not /..., not data:...)?
function isRelativePath(src) {
  return !!src && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(src);
}

// Images in notes are written relative to the course folder ("images/demand-curve.svg").
// The page is at the site root, so we add the course folder in front.
function fixImagePaths(container, folder) {
  for (const image of container.querySelectorAll("img")) {
    const src = image.getAttribute("src");
    if (isRelativePath(src)) image.setAttribute("src", folder + src);
    image.loading = "lazy";
  }
}

// Each image gets a caption (from its description) and opens bigger when clicked
function setUpImages(container) {
  for (const image of container.querySelectorAll("img")) {
    const figure = createElement("figure", "notes-figure");
    image.replaceWith(figure);
    const button = createElement("button", "zoom-button");
    button.type = "button";
    button.setAttribute("aria-label", `Enlarge image: ${image.alt || "image"}`);
    button.appendChild(image);
    button.addEventListener("click", () => openImageZoom(image.src, image.alt));
    figure.appendChild(button);
    if (image.alt) figure.appendChild(createElement("figcaption", null, image.alt));
    // If the paragraph only held the image, unwrap it so the figure isn't inside a <p>
    const parent = figure.parentElement;
    if (parent && parent.tagName === "P" && parent.childNodes.length === 1) parent.replaceWith(figure);
  }
}

// One shared "zoom" window, using the browser's built-in <dialog> (Esc closes it)
function openImageZoom(src, alt) {
  let dialog = document.getElementById("image-zoom");
  if (!dialog) {
    dialog = createElement("dialog", "image-zoom");
    dialog.id = "image-zoom";
    const close = createElement("button", "image-zoom-close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => dialog.close());
    dialog.appendChild(close);
    dialog.appendChild(createElement("img"));
    dialog.appendChild(createElement("p", "image-zoom-caption"));
    // Clicking outside the picture also closes it
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
  }
  const image = dialog.querySelector("img");
  image.src = src;
  image.alt = alt || "";
  dialog.querySelector(".image-zoom-caption").textContent = alt || "";
  dialog.showModal();
}

// Renders Markdown notes into "container": HTML, external links, images, maths
function renderNotesInto(container, markdown, courseFolder) {
  // Notes are written by us and checked before publishing, so they are trusted.
  // If notes could ever be submitted directly by visitors, they must be sanitized first.
  container.innerHTML = markdownToHtml(markdown);
  openExternalLinksInNewTab(container);
  fixImagePaths(container, courseFolder);
  setUpImages(container);
  typesetMath(container);
}

if (typeof module !== "undefined") {
  module.exports = { protectMath, restoreMath, isRelativePath, MATH_PATTERN };
}
