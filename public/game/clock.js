(function () {
  const legacy = document.getElementById("modern-clock");
  if (legacy) legacy.remove();

  let clockPanel = null;
  let clockBitmap = null;
  let clockRegions = null;
  let clockStamp = "";

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

  function clockTimer() {
    const settings = window.exportRoot && window.exportRoot.settings;
    return settings && settings.timer;
  }

  function editingList() {
    const settings = window.exportRoot && window.exportRoot.settings;
    const list = settings && settings.list;
    if (!list) return false;
    return !!((list.btn_done && list.btn_done.parent) || (list.listCover && list.listCover.parent));
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

  function readTime(text) {
    const parts = String(text || "00:00:00").match(/\d{1,2}/g);
    const shaped = parts && /^[\d: ]+$/.test(String(text || "")) && parts.length >= 2 && parts.length <= 4;
    if (!shaped) return { raw: String(text || "") };
    const names = parts.length === 4 ? ["HRS", "MIN", "SEC", "CS"]
      : parts.length === 2 ? ["MIN", "SEC"]
      : ["HRS", "MIN", "SEC"];
    return {
      parts: parts.map(function (part) { return part.padStart(2, "0"); }),
      names: names
    };
  }

  function drawClockIcon(ctx, cx, cy, radius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "#1c2b3a";
    ctx.lineWidth = Math.max(2, radius * 0.11);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.62, -radius * 0.62);
    ctx.lineTo(-radius * 0.28, -radius * 0.28);
    ctx.moveTo(radius * 0.62, -radius * 0.62);
    ctx.lineTo(radius * 0.28, -radius * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, radius * 0.08, radius * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.16);
    ctx.lineTo(0, radius * 0.14);
    ctx.lineTo(radius * 0.2, radius * 0.28);
    ctx.stroke();
    ctx.restore();
  }

  function drawBell(ctx, cx, cy, radius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "#f4fbff";
    ctx.lineWidth = Math.max(2, radius * 0.14);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.55, radius * 0.15);
    ctx.lineTo(-radius * 0.55, -radius * 0.12);
    ctx.arc(0, -radius * 0.12, radius * 0.55, Math.PI, 0);
    ctx.lineTo(radius * 0.55, radius * 0.15);
    ctx.lineTo(-radius * 0.72, radius * 0.42);
    ctx.lineTo(radius * 0.72, radius * 0.42);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, radius * 0.58, radius * 0.22, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  function drawPanel(width, height, time) {
    const pixel = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.ceil(width * pixel));
    canvas.height = Math.max(2, Math.ceil(height * pixel));
    const ctx = canvas.getContext("2d");
    ctx.scale(pixel, pixel);
    const pad = Math.max(8, height * 0.07);
    const gap = Math.max(8, height * 0.06);
    const radius = Math.max(16, height * 0.16);
    roundRect(ctx, 1.5, 1.5, width - 3, height - 3, radius);
    const body = ctx.createLinearGradient(0, 0, 0, height);
    body.addColorStop(0, "#1f6f8a");
    body.addColorStop(0.42, "#14556e");
    body.addColorStop(1, "#0d3d52");
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = Math.max(3, height * 0.025);
    ctx.strokeStyle = "#10212b";
    ctx.stroke();

    const clockSize = height * 0.62;
    const clockX = pad;
    const clockY = (height - clockSize) / 2;
    const sideW = Math.max(36, height * 0.34);
    const sideX = width - pad - sideW;
    const sideGap = Math.max(6, height * 0.045);
    const sideH = (height - pad * 2 - sideGap) / 2;
    const screenX = clockX + clockSize + gap;
    const screenW = Math.max(20, sideX - gap - screenX);
    const screenY = pad;
    const screenH = height - pad * 2;

    roundRect(ctx, screenX, screenY, screenW, screenH, Math.max(12, height * 0.1));
    ctx.fillStyle = "rgba(6,22,32,0.38)";
    ctx.fill();

    const gold = ctx.createLinearGradient(clockX, clockY, clockX, clockY + clockSize);
    gold.addColorStop(0, "#ffe58a");
    gold.addColorStop(1, "#f5b301");
    ctx.beginPath();
    ctx.arc(clockX + clockSize / 2, clockY + clockSize / 2, clockSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.lineWidth = Math.max(2, height * 0.018);
    ctx.strokeStyle = "#10212b";
    ctx.stroke();
    drawClockIcon(ctx, clockX + clockSize / 2, clockY + clockSize / 2, clockSize * 0.34);

    function sideButton(y, drawIcon) {
      roundRect(ctx, sideX, y, sideW, sideH, Math.max(10, sideH * 0.28));
      const fill = ctx.createLinearGradient(sideX, y, sideX, y + sideH);
      fill.addColorStop(0, "#3c8eaa");
      fill.addColorStop(1, "#1d6078");
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "#10212b";
      ctx.lineWidth = Math.max(2, height * 0.016);
      ctx.stroke();
      drawIcon();
    }

    sideButton(pad, function () {
      ctx.fillStyle = "#f4fbff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 " + Math.max(8, Math.round(sideH * 0.2)) + "px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
      const cx = sideX + sideW / 2;
      const cy = pad + sideH / 2;
      ctx.fillText("HH", cx, cy - sideH * 0.26);
      ctx.fillText("MM", cx, cy);
      ctx.fillText("SS", cx, cy + sideH * 0.26);
    });
    sideButton(pad + sideH + sideGap, function () {
      drawBell(ctx, sideX + sideW / 2, pad + sideH + sideGap + sideH / 2, Math.min(sideW, sideH) * 0.28);
    });

    ctx.save();
    roundRect(ctx, screenX, screenY, screenW, screenH, Math.max(12, height * 0.1));
    ctx.clip();
    if (time.raw) {
      ctx.fillStyle = "#f7fbff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 " + Math.round(height * 0.28) + "px 'Arial Black', 'Trebuchet MS', Arial, sans-serif";
      ctx.fillText(time.raw, screenX + screenW / 2, screenY + screenH / 2);
    } else {
      const digitSize = Math.max(22, Math.round(height * 0.38));
      const labelSize = Math.max(9, Math.round(height * 0.09));
      ctx.textAlign = "center";
      ctx.font = "900 " + digitSize + "px 'Arial Black', 'Trebuchet MS', Arial, sans-serif";
      const colon = ":";
      const colonW = ctx.measureText(colon).width;
      const widths = time.parts.map(function (part) { return Math.max(ctx.measureText(part).width, ctx.measureText("00").width); });
      const total = widths.reduce(function (sum, width) { return sum + width; }, 0) + colonW * (time.parts.length - 1) + 8 * (time.parts.length - 1);
      let x = screenX + (screenW - total) / 2;
      const digitY = screenY + screenH * 0.40;
      const labelY = screenY + screenH * 0.78;
      time.parts.forEach(function (part, index) {
        const w = widths[index];
        ctx.fillStyle = "#f7fbff";
        ctx.font = "900 " + digitSize + "px 'Arial Black', 'Trebuchet MS', Arial, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(part, x + w / 2, digitY);
        ctx.fillStyle = "#ffd56a";
        ctx.font = "800 " + labelSize + "px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
        ctx.fillText(time.names[index], x + w / 2, labelY);
        x += w;
        if (index < time.parts.length - 1) {
          ctx.font = "900 " + Math.round(digitSize * 0.72) + "px 'Arial Black', 'Trebuchet MS', Arial, sans-serif";
          ctx.textBaseline = "middle";
          ctx.fillText(colon, x + 4 + colonW / 2, digitY);
          x += colonW + 8;
        }
      });
    }
    ctx.restore();

    return {
      canvas: canvas,
      regions: {
        clock: { x: clockX * pixel, y: clockY * pixel, w: clockSize * pixel, h: clockSize * pixel },
        format: { x: sideX * pixel, y: pad * pixel, w: sideW * pixel, h: sideH * pixel },
        sound: { x: sideX * pixel, y: (pad + sideH + sideGap) * pixel, w: sideW * pixel, h: sideH * pixel }
      }
    };
  }

  function press(node) {
    if (!node || !window.createjs) return;
    node.dispatchEvent(new createjs.MouseEvent("mousedown", true, false, 0, 0));
    node.dispatchEvent(new createjs.MouseEvent("pressup", true, false, 0, 0));
    node.dispatchEvent(new createjs.MouseEvent("click", true, false, 0, 0));
  }

  function hitRegion(local, region) {
    return local.x >= region.x && local.x <= region.x + region.w && local.y >= region.y && local.y <= region.y + region.h;
  }

  function ensurePanel() {
    if (clockPanel || !window.createjs || !window.exportRoot) return;
    clockPanel = new createjs.Container();
    clockPanel.name = "scoreClock";
    clockPanel.mouseChildren = false;
    clockPanel.cursor = "pointer";
    clockBitmap = new createjs.Bitmap(document.createElement("canvas"));
    clockPanel.addChild(clockBitmap);
    clockPanel.on("mousedown", function (evt) {
      if (!clockBitmap || !clockRegions) return;
      const local = clockBitmap.globalToLocal(evt.stageX, evt.stageY);
      const timer = clockTimer();
      if (!timer) return;
      if (hitRegion(local, clockRegions.clock)) press(timer.btn_clock);
      else if (hitRegion(local, clockRegions.format)) press(timer.btn_hhmmss);
      else if (hitRegion(local, clockRegions.sound)) press(timer.btn_changesound);
    });
    window.exportRoot.addChild(clockPanel);
  }

  function sync() {
    const oldCard = document.getElementById("modern-clock");
    if (oldCard) oldCard.remove();
    const settings = window.exportRoot && window.exportRoot.settings;
    const timer = settings && settings.timer;
    const digital = timer && timer.oldWay && timer.oldWay.visible !== false;
    const show = !editingList() && !!(settings && settings.visible !== false && digital && timer.btn_clock && timer.btn_hhmmss && timer.btn_changesound);
    if (!show) {
      if (clockPanel) clockPanel.visible = false;
      return;
    }
    const clock = screenBox(timer.btn_clock);
    const format = screenBox(timer.btn_hhmmss);
    const sound = screenBox(timer.btn_changesound);
    const stage = window.stage;
    if (!clock || !format || !sound || !stage || !window.exportRoot) return;
    const clockW = clock.r - clock.x;
    const formatW = format.r - format.x;
    const formatH = format.b - format.y;
    const soundH = sound.b - sound.y;
    const left = clock.x - clockW * 0.30;
    const top = format.y - formatH * 0.28;
    const right = format.r + formatW * 0.48;
    const bottom = sound.b + soundH * 0.09;
    const width = Math.max(240, Math.round(right - left));
    const height = Math.max(72, Math.round(bottom - top));
    const text = String(timer.oldWay.display.text || "00:00:00");
    const stamp = width + "x" + height + "|" + text;
    ensurePanel();
    if (!clockPanel || !clockBitmap) return;
    if (stamp !== clockStamp) {
      const drawn = drawPanel(width, height, readTime(text));
      clockBitmap.image = drawn.canvas;
      if (clockBitmap.sourceRect) clockBitmap.sourceRect = null;
      clockRegions = drawn.regions;
      clockPanel.regions = clockRegions;
      clockStamp = stamp;
      clockPanel._layoutW = width;
      clockPanel._layoutH = height;
    }
    const sx = stage.scaleX || 1;
    const sy = stage.scaleY || 1;
    const pixel = 2;
    const p = window.exportRoot.globalToLocal(left / sx, top / sy);
    const q = window.exportRoot.globalToLocal((left + width) / sx, (top + height) / sy);
    clockBitmap.scaleX = (q.x - p.x) / (width * pixel);
    clockBitmap.scaleY = (q.y - p.y) / (height * pixel);
    clockPanel.x = p.x;
    clockPanel.y = p.y;
    clockPanel.visible = true;
    if (clockPanel.parent) clockPanel.parent.setChildIndex(clockPanel, clockPanel.parent.numChildren - 1);
  }

  function hook(stage) {
    if (stage.__clockHook) return;
    stage.__clockHook = true;
    const original = stage.update.bind(stage);
    stage.update = function () {
      sync();
      return original();
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
