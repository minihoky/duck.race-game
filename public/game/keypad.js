(function () {
  const style = document.createElement("style");
  style.textContent = [
    "#keypad{position:absolute;inset:0;z-index:30;pointer-events:none}",
    "#keypad button[hidden]{display:none !important}",
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
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "num";
  editButton.dataset.key = "edit";
  editButton.innerHTML = '<span class="shine"></span><span class="label">Edit List</span>';
  pad.appendChild(editButton);

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
    const settings = window.exportRoot && window.exportRoot.settings;
    if (name === "edit") {
      const list = settings && settings.list;
      return list && list.btn_editList;
    }
    const timer = settings && settings.timer;
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

  function hideEditArt(list, hit) {
    if (list.editList) list.editList.visible = false;
    let box = hit;
    (list.children || []).forEach(function (kid) {
      if (!kid || kid === list.btn_editList || kid.name === "bg" || kid.name === "dragBarCover" || /^btn_/.test(kid.name || "")) return;
      const bounds = screenBox(kid);
      if (!bounds) return;
      const width = bounds.r - bounds.x;
      const height = bounds.b - bounds.y;
      const buttonW = hit.r - hit.x;
      const buttonH = hit.b - hit.y;
      if (Math.abs(bounds.y - hit.y) < 16 && Math.abs(height - buttonH) < 16 && Math.abs(width - buttonW) < 40) {
        kid.visible = false;
        list._editShape = kid;
        if (width >= buttonW) box = bounds;
      }
    });
    const bleed = 3;
    return { x: box.x - bleed, y: box.y - bleed, r: box.r + bleed, b: box.b + bleed };
  }

  function placeButton(button, box, ox, oy) {
    const width = box.r - box.x;
    const height = box.b - box.y;
    button.style.left = (ox + box.x) + "px";
    button.style.top = (oy + box.y) + "px";
    button.style.width = width + "px";
    button.style.height = height + "px";
    button.style.borderRadius = Math.round(height * 0.28) + "px";
    button.style.fontSize = Math.round(height * (button.dataset.key === "edit" ? 0.42 : button.classList.contains("num") ? 0.52 : 0.40)) + "px";
  }

  function editingList(list) {
    if (!list) return false;
    return !!((list.btn_done && list.btn_done.parent) || (list.listCover && list.listCover.parent));
  }

  function sync() {
    const settings = window.exportRoot && window.exportRoot.settings;
    const timer = settings && settings.timer;
    const oldWay = timer && timer.oldWay;
    const list = settings && settings.list;
    const editing = editingList(list);
    const showKeys = !editing && !!(settings && settings.visible !== false && oldWay && oldWay.visible !== false && oldWay.btn5);
    const showEdit = !editing && !!(showKeys && list && list.visible !== false && list.btn_editList);
    const clock = document.getElementById("modern-clock");
    const species = document.getElementById("species-switch");
    if (editing) {
      if (list._editShape) list._editShape.visible = true;
      if (list.btn_done) list.btn_done.visible = true;
      if (clock) clock.hidden = true;
      if (species) species.style.visibility = "hidden";
    }
    pad.hidden = !(showKeys || showEdit);
    if (!showKeys && !showEdit) return;
    const stage = window.stage;
    const canvas = stage && stage.canvas;
    const host = pad.parentElement;
    if (!canvas || !host) return;
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const ox = canvasRect.left - hostRect.left;
    const oy = canvasRect.top - hostRect.top;
    pad.querySelectorAll("button").forEach(function (button) {
      if (button.dataset.key === "edit") {
        button.hidden = !showEdit;
        if (!showEdit) return;
        const node = list.btn_editList;
        if (node.visible !== false) node.visible = false;
        const box = hideEditArt(list, screenBox(node));
        if (!box) return;
        placeButton(button, box, ox, oy);
        button.style.borderRadius = Math.round((box.b - box.y) / 2) + "px";
        const label = button.querySelector(".label");
        const next = list.editList && list.editList.text ? String(list.editList.text).trim() : "Edit List";
        if (next && next !== label.textContent) label.textContent = next;
        return;
      }
      button.hidden = !showKeys;
      if (!showKeys) return;
      const node = oldWay[button.dataset.key];
      if (node && node.visible !== false) {
        node._keyVisible = true;
        node.visible = false;
      }
      const box = node && screenBox(node);
      if (!box) return;
      placeButton(button, box, ox, oy);
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
