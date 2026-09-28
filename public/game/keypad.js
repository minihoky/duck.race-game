(function () {
  const legacyPad = document.getElementById("keypad");
  if (legacyPad) legacyPad.remove();

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
    const radius = height * 0.28;
    const inset = Math.max(1.2, height * 0.04);
    ctx.save();
    ctx.shadowColor = "rgba(16,24,32,0.28)";
    ctx.shadowBlur = height * 0.08;
    ctx.shadowOffsetY = height * 0.06;
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
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.28, width * 0.36, height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#1a2836";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 " + Math.round(height * (kind === "num" ? 0.46 : 0.38)) + "px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    ctx.fillText(label, width / 2, height * 0.56);
    ctx.restore();
    return canvas;
  }

  function muteArt(node) {
    if (!node || node._mutedArt) {
      if (node) {
        node.visible = false;
        node.alpha = 0;
      }
      return;
    }
    node._mutedArt = true;
    node.visible = false;
    node.alpha = 0;
    node.mouseEnabled = false;
    node.draw = function () { return true; };
  }

  function guardGloss(node) {
    if (!node || node._glossGuard) return;
    node._glossGuard = true;
    if (typeof node._updateTimeline === "function") node._updateTimeline = function () {};
    node.draw = function (ctx, ignoreCache) {
      if (this.cacheCanvas && this.uncache) this.uncache();
      const live = this.children;
      if (live) {
        for (let i = live.length - 1; i >= 0; i--) {
          const kid = live[i];
          if (!kid || kid.name === "glossKey") continue;
          if (kid.cacheCanvas && kid.uncache) kid.uncache();
          this.removeChildAt(i);
        }
      }
      const gloss = this.getChildByName ? this.getChildByName("glossKey") : null;
      if (gloss) {
        gloss.visible = true;
        gloss.alpha = 1;
      }
      return createjs.Container.prototype.draw.call(this, ctx, ignoreCache);
    };
  }

  function paintCanvasKeys(oldWay) {
    if (!oldWay || !window.createjs) return;
    const specs = [
      ["btn0", "", "num"], ["btn1", "", "num"], ["btn2", "", "num"], ["btn3", "", "num"], ["btn4", "", "num"],
      ["btn5", "", "num"], ["btn6", "", "num"], ["btn7", "", "num"], ["btn8", "", "num"], ["btn9", "", "num"],
      ["btnset", oldWay.txt_set && oldWay.txt_set.text ? String(oldWay.txt_set.text).trim() : "Set", "set"],
      ["btnclear", oldWay.txt_clear && oldWay.txt_clear.text ? String(oldWay.txt_clear.text).trim() : "Clear", "clear"]
    ];
    muteArt(oldWay.txt_set);
    muteArt(oldWay.txt_clear);
    specs.forEach(function (spec) {
      const node = oldWay[spec[0]];
      const bounds = node && node.nominalBounds;
      if (!node || !bounds) return;
      node.visible = true;
      let gloss = null;
      (node.children || []).forEach(function (kid) {
        if (kid && kid.name === "glossKey") gloss = kid;
        else if (kid) muteArt(kid);
      });
      if (!gloss || gloss._label !== spec[1]) {
        if (gloss) node.removeChild(gloss);
        const canvas = drawKey(bounds.width, bounds.height, spec[1], spec[2]);
        gloss = new createjs.Bitmap(canvas);
        gloss.name = "glossKey";
        gloss.mouseEnabled = false;
        gloss._label = spec[1];
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
    });
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
    const clock = document.getElementById("modern-clock");
    const species = document.getElementById("species-switch");
    const legacy = document.getElementById("keypad");
    if (legacy) legacy.remove();
    if (editing) {
      if (list._editShape) list._editShape.visible = true;
      if (list.btn_done) list.btn_done.visible = true;
      if (clock) clock.hidden = true;
      if (species) species.style.visibility = "hidden";
    } else if (list && list.btn_editList) {
      list.btn_editList.visible = true;
      if (list.editList) list.editList.visible = true;
      if (list._editShape) list._editShape.visible = true;
    }
    if (showKeys) paintCanvasKeys(oldWay);
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
