(function () {
  const style = document.createElement("style");
  style.textContent = [
    "#keypad{position:absolute;inset:0;z-index:30;pointer-events:none}",
    "#keypad[hidden]{display:none !important}",
    "#keypad button{position:absolute;box-sizing:border-box;display:grid;place-items:center;margin:0;padding:0;border:3px solid #1c2836;border-radius:22px;cursor:pointer;pointer-events:auto;overflow:hidden;color:#1a2836;font-family:'Trebuchet MS','Segoe UI',Arial,sans-serif;font-weight:800;line-height:1;letter-spacing:-.02em;text-shadow:0 1px 0 rgba(255,255,255,.35);box-shadow:0 4px 0 rgba(16,24,32,.18),0 8px 14px rgba(8,20,32,.12),inset 0 1px 0 rgba(255,255,255,.65);transition:transform .08s ease,filter .12s ease}",
    "#keypad button.num{background:linear-gradient(180deg,#c8f56a 0%,#8ee024 46%,#62c40e 100%)}",
    "#keypad button.set{background:linear-gradient(180deg,#ffe56a 0%,#ffc21a 48%,#f0a000 100%)}",
    "#keypad button.clear{background:linear-gradient(180deg,#f7f9fc 0%,#e4e9ef 50%,#cfd6df 100%)}",
    "#keypad button:hover{filter:brightness(1.06)}",
    "#keypad button:active{transform:translateY(2px);filter:brightness(.98);box-shadow:0 2px 0 rgba(16,24,32,.18),inset 0 1px 0 rgba(255,255,255,.65)}",
    "#keypad .shine{position:absolute;left:7%;right:7%;top:8%;height:40%;border-radius:40%;background:linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,.08));pointer-events:none}",
    "#keypad .label{position:relative;z-index:1}"
  ].join("");
  document.head.appendChild(style);

  const keys = [
    ["btn0", "0", "num"], ["btn1", "1", "num"], ["btn2", "2", "num"], ["btn3", "3", "num"], ["btn4", "4", "num"],
    ["btn5", "5", "num"], ["btn6", "6", "num"], ["btn7", "7", "num"], ["btn8", "8", "num"], ["btn9", "9", "num"],
    ["btnset", "Set", "set"], ["btnclear", "Clear", "clear"]
  ];
  const pad = document.createElement("div");
  pad.id = "keypad";
  pad.hidden = true;
  keys.forEach(function (spec) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = spec[2];
    button.dataset.key = spec[0];
    button.innerHTML = '<span class="shine"></span><span class="label">' + spec[1] + "</span>";
    pad.appendChild(button);
  });

  pad.addEventListener("mousedown", function (event) {
    const button = event.target.closest("button");
    if (!button) return;
    event.preventDefault();
    const node = keyNode(button.dataset.key);
    if (!node || !window.createjs) return;
    node.dispatchEvent(new createjs.MouseEvent("mousedown", true, false, 0, 0));
  });
  pad.addEventListener("mouseup", function (event) {
    const button = event.target.closest("button");
    if (!button) return;
    const node = keyNode(button.dataset.key);
    if (!node || !window.createjs) return;
    node.dispatchEvent(new createjs.MouseEvent("pressup", true, false, 0, 0));
    node.dispatchEvent(new createjs.MouseEvent("click", true, false, 0, 0));
  });

  function keyNode(name) {
    const timer = window.exportRoot && window.exportRoot.settings && window.exportRoot.settings.timer;
    const oldWay = timer && timer.oldWay;
    return oldWay && oldWay[name];
  }

  function liveLabel(node, fallback) {
    let found = "";
    function walk(current, depth) {
      if (!current || depth > 5 || found) return;
      if (typeof current.text === "string" && current.text.trim()) found = current.text.trim();
      const children = current.children || [];
      for (let i = 0; i < children.length; i++) walk(children[i], depth + 1);
    }
    walk(node, 0);
    return found || fallback;
  }

  function screenBox(node) {
    const bounds = node.nominalBounds;
    const stage = window.stage;
    if (!bounds || !stage) return null;
    const sx = stage.scaleX || 1;
    const sy = stage.scaleY || 1;
    const topLeft = node.localToGlobal(bounds.x, bounds.y);
    const bottomRight = node.localToGlobal(bounds.x + bounds.width, bounds.y + bounds.height);
    return {
      x: Math.min(topLeft.x, bottomRight.x) * sx,
      y: Math.min(topLeft.y, bottomRight.y) * sy,
      r: Math.max(topLeft.x, bottomRight.x) * sx,
      b: Math.max(topLeft.y, bottomRight.y) * sy
    };
  }

  function sync() {
    const settings = window.exportRoot && window.exportRoot.settings;
    const timer = settings && settings.timer;
    const oldWay = timer && timer.oldWay;
    const show = !!(settings && settings.visible !== false && oldWay && oldWay.visible !== false && oldWay.btn5);
    pad.hidden = !show;
    if (!show) return;
    const stage = window.stage;
    const canvas = stage && stage.canvas;
    const host = pad.parentElement;
    if (!canvas || !host) return;
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const ox = canvasRect.left - hostRect.left;
    const oy = canvasRect.top - hostRect.top;
    pad.querySelectorAll("button").forEach(function (button) {
      const node = oldWay[button.dataset.key];
      if (node && node.visible !== false) {
        node._keyVisible = true;
        node.visible = false;
      }
      const box = node && screenBox(node);
      if (!box) return;
      const width = box.r - box.x;
      const height = box.b - box.y;
      button.style.left = (ox + box.x) + "px";
      button.style.top = (oy + box.y) + "px";
      button.style.width = width + "px";
      button.style.height = height + "px";
      button.style.borderRadius = Math.round(height * 0.28) + "px";
      button.style.fontSize = Math.round(height * (button.classList.contains("num") ? 0.52 : 0.40)) + "px";
      const label = button.querySelector(".label");
      const fallback = label.textContent;
      const next = liveLabel(node, fallback);
      if (next && next !== label.textContent) label.textContent = next;
    });
  }

  function hook(stage) {
    if (stage.__keypadHook) return;
    stage.__keypadHook = true;
    const original = stage.update.bind(stage);
    stage.update = function () {
      const result = original();
      sync();
      return result;
    };
    sync();
  }

  function boot() {
    const host = document.getElementById("animation_container");
    if (!host || !window.stage || !window.exportRoot) return false;
    if (!pad.parentElement) host.appendChild(pad);
    hook(window.stage);
    return true;
  }

  if (!boot()) {
    const wait = window.setInterval(function () {
      if (boot()) window.clearInterval(wait);
    }, 200);
  }
})();
