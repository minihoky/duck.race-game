(function () {
  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawKey(width, height, label, kind) {
    const pixel = 4;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width * pixel));
    canvas.height = Math.max(1, Math.ceil(height * pixel));
    const ctx = canvas.getContext("2d");
    ctx.scale(pixel, pixel);
    const colors = kind === "set" ? ["#ffe56a", "#ffc21a", "#f0a000"]
      : kind === "clear" ? ["#f7f9fc", "#e4e9ef", "#cfd6df"]
      : ["#c8f56a", "#8ee024", "#62c40e"];
    const radius = height * (kind === "edit" ? 0.5 : 0.28);
    const inset = Math.max(1.2, height * 0.04);
    ctx.save();
    ctx.shadowColor = "rgba(16,24,32,0.22)";
    ctx.shadowBlur = height * 0.05;
    ctx.shadowOffsetY = height * 0.04;
    roundRect(ctx, inset, inset, width - inset * 2, height - inset * 2, radius);
    const fill = ctx.createLinearGradient(0, 0, 0, height);
    fill.addColorStop(0, colors[0]);
    fill.addColorStop(0.46, colors[1]);
    fill.addColorStop(1, colors[2]);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = Math.max(1.6, height * 0.065);
    ctx.strokeStyle = "#1c2836";
    ctx.stroke();
    ctx.save();
    roundRect(ctx, inset, inset, width - inset * 2, height - inset * 2, radius);
    ctx.clip();
    const shine = ctx.createLinearGradient(0, inset, 0, height * 0.42);
    shine.addColorStop(0, "rgba(255,255,255,0.85)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(inset, inset, width - inset * 2, height * 0.34);
    ctx.restore();
    ctx.fillStyle = "#1a2836";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontScale = kind === "num" ? 0.42 : kind === "edit" ? 0.4 : 0.38;
    ctx.font = "800 " + Math.round(height * fontScale) + "px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    ctx.fillText(label, width / 2, height * 0.54);
    ctx.restore();
    return canvas;
  }

  function guardGloss(node) {
    if (!node || node._glossGuard) return;
    node._glossGuard = true;
    const baseDraw = node.draw;
    node.draw = function (ctx, ignoreCache) {
      if (this.cacheCanvas && this.uncache) this.uncache();
      const live = this.children;
      if (live) {
        let gloss = null;
        for (let i = 0; i < live.length; i++) {
          const kid = live[i];
          if (!kid) continue;
          if (kid.name === "glossKey") gloss = kid;
          else kid.visible = false;
        }
        if (gloss) {
          gloss.visible = true;
          if (live[live.length - 1] !== gloss) this.setChildIndex(gloss, live.length - 1);
        }
      }
      return baseDraw.call(this, ctx, ignoreCache);
    };
  }

  function paintGloss(node, label, kind) {
    const bounds = node && node.nominalBounds;
    if (!node || !bounds || !window.createjs) return;
    node.visible = true;
    node.mouseChildren = false;
    node.cursor = "pointer";
    let gloss = null;
    (node.children || []).forEach(function (kid) {
      if (kid && kid.name === "glossKey") gloss = kid;
    });
    if (!gloss || gloss._label !== label || gloss._kind !== kind) {
      if (gloss) node.removeChild(gloss);
      const canvas = drawKey(bounds.width, bounds.height, label, kind);
      gloss = new createjs.Bitmap(canvas);
      gloss.name = "glossKey";
      gloss.mouseEnabled = false;
      gloss._label = label;
      gloss._kind = kind;
      gloss.x = bounds.x;
      gloss.y = bounds.y;
      gloss.scaleX = bounds.width / canvas.width;
      gloss.scaleY = bounds.height / canvas.height;
      node.addChild(gloss);
    }
    guardGloss(node);
    if (!node.hitArea) {
      const hit = new createjs.Shape();
      hit.graphics.beginFill("#000").drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
      node.hitArea = hit;
    }
    if (node.cacheCanvas && node.uncache) node.uncache();
  }

  function paintCanvasKeys(oldWay) {
    if (!oldWay) return;
    const specs = [
      ["btn0", "0", "num"], ["btn1", "1", "num"], ["btn2", "2", "num"], ["btn3", "3", "num"], ["btn4", "4", "num"],
      ["btn5", "5", "num"], ["btn6", "6", "num"], ["btn7", "7", "num"], ["btn8", "8", "num"], ["btn9", "9", "num"],
      ["btnset", oldWay.txt_set && oldWay.txt_set.text ? String(oldWay.txt_set.text).trim() : "Set", "set"],
      ["btnclear", oldWay.txt_clear && oldWay.txt_clear.text ? String(oldWay.txt_clear.text).trim() : "Clear", "clear"]
    ];
    silence(oldWay.txt_set);
    silence(oldWay.txt_clear);
    specs.forEach(function (spec) {
      paintGloss(oldWay[spec[0]], spec[1], spec[2]);
    });
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

  function silence(node) {
    if (!node || node._editDraw) return;
    node._editDraw = node.draw;
    node.draw = function () { return true; };
    node.visible = false;
    node.mouseEnabled = false;
  }

  function restoreDraw(node) {
    if (!node || !node._editDraw) return;
    node.draw = node._editDraw;
    node._editDraw = null;
    node.visible = true;
    node.mouseEnabled = false;
  }

  function editShape(list, button) {
    const hit = screenBox(button);
    if (!hit) return list._editShape || null;
    let found = list._editShape || null;
    (list.children || []).forEach(function (kid) {
      if (!kid || kid === button || kid.name === "bg" || kid.name === "dragBarCover" || /^btn_/.test(kid.name || "")) return;
      const bounds = screenBox(kid);
      if (!bounds) return;
      const width = bounds.r - bounds.x;
      const height = bounds.b - bounds.y;
      const buttonW = hit.r - hit.x;
      const buttonH = hit.b - hit.y;
      if (Math.abs(bounds.y - hit.y) < 16 && Math.abs(height - buttonH) < 16 && Math.abs(width - buttonW) < 40) {
        found = kid;
      }
    });
    list._editShape = found;
    return found;
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
    const legacy = document.getElementById("species-switch");
    const legacyPad = document.getElementById("keypad");
    if (legacy) legacy.style.display = "none";
    if (legacyPad) legacyPad.hidden = true;
    if (editing) {
      if (list.editList) restoreDraw(list.editList);
      if (list._editShape) restoreDraw(list._editShape);
      if (list.doneList) list.doneList.mouseEnabled = false;
      if (list.btn_done) {
        list.btn_done.visible = true;
        list.btn_done.mouseEnabled = true;
        if (!list.btn_done.hitArea && list.btn_done.nominalBounds && window.createjs) {
          const bounds = list.btn_done.nominalBounds;
          const hit = new createjs.Shape();
          hit.graphics.beginFill("#000").drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
          list.btn_done.hitArea = hit;
        }
      }
      if (clock) clock.hidden = true;
    }
    if (showKeys) paintCanvasKeys(oldWay);
    if (!showEdit) return;
    const label = list.editList && list.editList.text ? String(list.editList.text).trim() : "Edit List";
    silence(list.editList);
    silence(editShape(list, list.btn_editList));
    paintGloss(list.btn_editList, label || "Edit List", "edit");
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
    hook(window.stage);
    return true;
  }

  if (!boot()) {
    const wait = window.setInterval(function () {
      if (boot()) window.clearInterval(wait);
    }, 200);
  }
})();
