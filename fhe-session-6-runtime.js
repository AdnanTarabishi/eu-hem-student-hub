// Runtime bridge: expose the custom Session 6 activities after shared content validation.
(function (root) {
  "use strict";
  const TOPIC_ID = "fund-health-economics.insurance-demand";
  const ACTIVITIES = [
    "insurance-risk-utility",
    "insurance-pool",
    "insurance-coverage-path",
    "insurance-contract-lab",
    "insurance-contract-compare",
  ];
  const previous = root.loadLecture;
  if (typeof previous !== "function" || previous.__fheSession6RuntimeWrapped) return;
  const wrapped = async function (moduleData, topic, read) {
    const config = await previous.call(this, moduleData, topic, read);
    if (topic?.id === TOPIC_ID && config) {
      return { ...config, activities: [...ACTIVITIES] };
    }
    return config;
  };
  wrapped.__fheSession6RuntimeWrapped = true;
  root.loadLecture = wrapped;
})(window);
