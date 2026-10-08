/* Public contact delivery configuration. An empty endpoint keeps the established
   email route visible. Never put a Sheet ID, credential or secret in this file. */
window.CONTACT_CONFIG = Object.freeze({
  endpoint: "",
  noticeVersion: "contact-v1-2026-10",
});

window.ContactConfig = Object.freeze({
  isConfigured(config = window.CONTACT_CONFIG) {
    if (!config || config.noticeVersion !== "contact-v1-2026-10" || typeof config.endpoint !== "string") return false;
    // Exact deployment URL only: no preview endpoint, alternate host, query,
    // fragment, user information or extra path. This does not ping the backend.
    return config.endpoint === config.endpoint.trim() && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint);
  },
});
