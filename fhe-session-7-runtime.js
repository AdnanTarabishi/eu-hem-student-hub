// Runtime bridge: expose the custom Session 7 activities after shared content validation.
(function (root) {
  "use strict";
  const TOPIC_ID = "fund-health-economics.adverse-selection";
  const ACTIVITIES = [
    "selection-pool",
    "selection-zero-profit",
    "selection-contract-space",
    "selection-separating",
    "selection-government",
    "selection-premium-risk",
  ];
  const previous = root.loadLecture;
  if (typeof previous !== "function" || previous.__fheSession7RuntimeWrapped) return;
  const wrapped = async function (moduleData, topic, read) {
    const config = await previous.call(this, moduleData, topic, read);
    if (topic?.id === TOPIC_ID && config) return { ...config, activities: [...ACTIVITIES] };
    return config;
  };
  wrapped.__fheSession7RuntimeWrapped = true;
  root.loadLecture = wrapped;
})(window);
