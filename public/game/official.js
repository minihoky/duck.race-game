(function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("official");
  if (!id || !window.Helper) return;
  let setup = null;
  try {
    setup = JSON.parse(sessionStorage.getItem("duck-official-setup") || "null");
  } catch (error) {
    setup = null;
  }
  if (!setup || setup.id !== id || !Array.isArray(setup.names)) return;
  const names = setup.names
    .map(function (name) {
      return String(name || "").replace(/,/g, " ").trim();
    })
    .filter(Boolean)
    .slice(0, 200);
  if (names.length < 2) return;
  window.Helper.defaultList = names.join(",");

  const wanted = params.get("countdown") || "";
  let announced = false;
  let timerApplied = false;

  function find(node, name) {
    if (!node) return null;
    if (node.name === name) return node;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i += 1) {
      const found = find(kids[i], name);
      if (found) return found;
    }
    return null;
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== "duck-official-stop" || event.data.id !== id) return;
    const start = find(window.exportRoot, "bStart") || find(window.exportRoot, "tStart");
    if (start && start.dispatchEvent) start.dispatchEvent("mousedown");
  });

  window.setInterval(function () {
    const root = window.exportRoot;
    if (!root) return;
    const settings = root.settings;
    const display = settings && settings.timer && settings.timer.oldWay && settings.timer.oldWay.display;
    if (!timerApplied && display && wanted && (display.text === "00:00:00" || !display.text)) {
      display.text = wanted;
      timerApplied = true;
    }
    if (announced) return;
    const button = find(root, "tStart");
    if (button && button.text === "Pause") {
      announced = true;
      window.parent.postMessage({ type: "duck-official-started", id: id }, window.location.origin);
    }
  }, 250);
})();
