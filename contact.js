/* The contact actions are ordinary mailto links. JavaScript only adds a copy
   convenience; it never sends a message or saves any contact-page input. */
(function () {
  if (typeof document === "undefined") return;
  const address = document.getElementById("contact-email");
  const copyButton = document.getElementById("contact-copy-email");
  const status = document.getElementById("contact-copy-status");
  const fallback = document.getElementById("contact-copy-fallback");
  const copyValue = document.getElementById("contact-copy-value");
  if (!address || !copyButton || !status || !fallback || !copyValue) return;

  const email = address.textContent.trim();
  let copying = false;
  copyValue.value = email;
  copyButton.hidden = false;

  copyButton.addEventListener("click", async () => {
    if (copying) return;
    copying = true;
    copyButton.setAttribute("aria-busy", "true");
    status.textContent = "";
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      fallback.hidden = true;
      status.textContent = "Email address copied.";
    } catch {
      fallback.hidden = false;
      status.textContent = "Automatic copying is unavailable. Select the address below and copy it.";
      copyValue.focus();
      copyValue.select();
      copyValue.setSelectionRange(0, email.length);
    } finally {
      copying = false;
      copyButton.removeAttribute("aria-busy");
    }
  });
})();
