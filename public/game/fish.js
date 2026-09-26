(function () {
  const SPECIES_KEY = "duck-race-species";
  let species = localStorage.getItem(SPECIES_KEY) === "fish" ? "fish" : "duck";
  let art = null;
  let badge = null;
  let hooked = false;

  function knockout(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const w = canvas.width;
    const h = canvas.height;
    const seen = new Uint8Array(w * h);
    const stack = [];

    function tryPush(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const index = y * w + x;
      if (seen[index]) return;
      const offset = index * 4;
      if (data[offset] > 246 && data[offset + 1] > 246 && data[offset + 2] > 246) {
        seen[index] = 1;
        stack.push(index);
      }
    }

    for (let x = 0; x < w; x += 1) {
      tryPush(x, 0);
      tryPush(x, h - 1);
    }
    for (let y = 0; y < h; y += 1) {
      tryPush(0, y);
      tryPush(w - 1, y);
    }
    while (stack.length) {
      const index = stack.pop();
      data[index * 4 + 3] = 0;
      const x = index % w;
      const y = (index / w) | 0;
      tryPush(x + 1, y);
      tryPush(x - 1, y);
      tryPush(x, y + 1);
      tryPush(x, y - 1);
    }
    ctx.putImageData(image, 0, 0);

    const white = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i += 1) {
      const offset = i * 4;
      white[i] = data[offset + 3] > 200 && data[offset] > 248 && data[offset + 1] > 248 && data[offset + 2] > 248 ? 1 : 0;
    }
    const visited = new Uint8Array(w * h);
    let best = null;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const start = y * w + x;
        if (!white[start] || visited[start]) continue;
        let minX = x;
        let minY = y;
        let maxX = x;
        let maxY = y;
        let count = 0;
        const pile = [start];
        visited[start] = 1;
        while (pile.length) {
          const index = pile.pop();
          count += 1;
          const cx = index % w;
          const cy = (index / w) | 0;
          if (cx < minX) minX = cx;
          if (cy < minY) minY = cy;
          if (cx > maxX) maxX = cx;
          if (cy > maxY) maxY = cy;
          for (const next of [index - 2, index + 2, index - w * 2, index + w * 2]) {
            if (next < 0 || next >= white.length || visited[next] || !white[next]) continue;
            visited[next] = 1;
            pile.push(next);
          }
        }
        if (!best || count > best.count) best = { count, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
    }
    badge = best && best.count > 30 ? best : null;
    return canvas;
  }

  let opaque = null;
  const plates = new Map();

  function fishOpaque() {
    if (opaque) return opaque;
    const ctx = art.getContext("2d");
    const data = ctx.getImageData(0, 0, art.width, art.height).data;
    let minX = art.width;
    let minY = art.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < art.height; y += 2) {
      for (let x = 0; x < art.width; x += 2) {
        if (data[(y * art.width + x) * 4 + 3] < 20) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    opaque = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    return opaque;
  }

  function drawnBox(node) {
    if (node._fishBox) return node._fishBox;
    const canvas = document.createElement("canvas");
    canvas.width = 90;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    ctx.translate(45, 45);
    try { node.draw(ctx); } catch (error) {
      node._fishBox = null;
      return null;
    }
    const data = ctx.getImageData(0, 0, 90, 90).data;
    let minX = 90;
    let minY = 90;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    for (let y = 0; y < 90; y += 1) {
      for (let x = 0; x < 90; x += 1) {
        if (data[(y * 90 + x) * 4 + 3] < 30) continue;
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    node._fishBox = count ? { count, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, canvas } : null;
    return node._fishBox;
  }

  function stampNumber(digit, label) {
    const canvas = document.createElement("canvas");
    canvas.width = art.width;
    canvas.height = art.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(art, 0, 0);
    if (!badge) return canvas;
    const inset = Math.max(4, Math.round(Math.min(badge.w, badge.h) * 0.16));
    const x = badge.x + inset;
    const y = badge.y + inset;
    const w = Math.max(1, badge.w - inset * 2);
    const h = Math.max(1, badge.h - inset * 2);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.28);
    ctx.fill();
    const box = digit && drawnBox(digit);
    if (box && box.w < 24 && box.h < 28) {
      const scale = Math.min(w / box.w, h / box.h) * 0.86;
      const dw = box.w * scale;
      const dh = box.h * scale;
      ctx.drawImage(box.canvas, box.x, box.y, box.w, box.h, badge.x + (badge.w - dw) / 2, badge.y + (badge.h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#161616";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 " + Math.round(h * 0.92) + "px Arial";
      ctx.fillText(label || "1", badge.x + badge.w / 2, badge.y + badge.h / 2 + h * 0.06);
    }
    return canvas;
  }

  function readNumber(node) {
    function findMyNum(item, depth) {
      if (!item || depth > 6) return "";
      if (item.name === "myNum" && /^\d+$/.test(String(item.text || "").trim())) return String(item.text).trim();
      for (const kid of item.children || []) {
        const found = findMyNum(kid, depth + 1);
        if (found) return found;
      }
      return "";
    }
    let current = node;
    for (let i = 0; current && i < 5; i += 1) {
      const label = findMyNum(current, 0);
      if (label) return label;
      current = current.parent;
    }
    return "";
  }

  function findDigit(body) {
    const origin = body.localToGlobal(36, 58);
    let best = null;
    let bestDist = 48;
    function consider(kid) {
      if (!kid || kid === body || kid.name === "raceFish" || !kid.graphics || (kid.numChildren || 0) > 0) return;
      const box = drawnBox(kid);
      if (!box || box.h < 8 || box.h > 26 || box.w > 20 || box.h < box.w || box.count < 8) return;
      const point = kid.localToGlobal(0, 0);
      const dist = Math.hypot(point.x - origin.x, point.y - origin.y);
      if (dist < bestDist) {
        best = kid;
        bestDist = dist;
      }
    }
    (body.children || []).forEach(consider);
    (body.parent && body.parent.children || []).forEach(consider);
    return best;
  }

  function layoutFish(body, bitmap, digit) {
    const colour = (body.children || []).find(function (kid) {
      return kid && kid.name === "duckColour";
    });
    const colourBounds = colour && colour.nominalBounds;
    let anchor = { x: 36, y: 58 };
    if (digit) {
      const point = digit.localToGlobal(0, 0);
      anchor = body.globalToLocal(point.x, point.y);
    } else if (colour && colourBounds) {
      anchor = {
        x: colour.x + colourBounds.x + colourBounds.width * 0.22,
        y: colour.y + colourBounds.y + colourBounds.height * 0.5,
      };
    }
    let host = body;
    let inCard = false;
    let inRace = false;
    while (host) {
      if (host.name === "choiceToggle") inCard = true;
      if (/^character\d/.test(host.name || "")) inRace = true;
      host = host.parent;
    }
    const span = fishOpaque();
    const targetW = colourBounds && colourBounds.width > 30 ? colourBounds.width * (inCard ? 0.78 : inRace ? 1.12 : 1.42) : 150;
    const scale = targetW / span.w;
    bitmap.scaleX = scale;
    bitmap.scaleY = scale;
    if (inCard) {
      let card = body;
      while (card && card.name !== "choiceToggle") card = card.parent;
      const box = card && card.nominalBounds;
      const globalCenter = box ? card.localToGlobal(box.x + box.width * 0.431, box.y + box.height * 0.4) : null;
      const center = globalCenter ? body.globalToLocal(globalCenter.x, globalCenter.y) : anchor;
      bitmap.regX = span.x + span.w / 2;
      bitmap.regY = span.y + span.h / 2;
      bitmap.x = center.x;
      bitmap.y = center.y;
      return;
    }
    bitmap.regX = badge ? badge.x + badge.w / 2 : span.x + span.w * 0.42;
    bitmap.regY = badge ? badge.y + badge.h / 2 : span.y + span.h * 0.55;
    bitmap.x = anchor.x;
    bitmap.y = anchor.y;
  }

  function makeBitmap(number, digit, label) {
    const key = number || "plain";
    if (!plates.has(key)) plates.set(key, stampNumber(digit, label));
    const bitmap = new createjs.Bitmap(plates.get(key));
    bitmap.name = "raceFish";
    bitmap.mouseEnabled = false;
    bitmap._number = key;
    return bitmap;
  }

  function hatSibling(node) {
    const siblings = node.parent && node.parent.children;
    if (!siblings) return [];
    return siblings.filter(function (kid) {
      return kid !== node && (kid.numChildren || 0) >= 10;
    });
  }

  const skinned = new Set();
  const marked = new Set();

  function markHidden(kid) {
    if (!kid || kid.name === "raceFish" || kid._fishMarked) return;
    kid._fishMarked = true;
    kid._fishWasVisible = kid.visible !== false;
    kid.visible = false;
    marked.add(kid);
  }

  function applyFish(node) {
    if (!node || !node.children || !art) return;
    const duck = node.children.find(function (kid) {
      return kid && kid.name === "duckColour";
    });
    if (!duck) {
      node.children.forEach(applyFish);
      return;
    }
    skinned.add(node);
    hatSibling(node).forEach(markHidden);
    const digit = findDigit(node);
    if (digit) markHidden(digit);
    const label = readNumber(node);
    const number = digit ? "d" + digit.id : "n" + (label || "1");
    let fish = node.children.find(function (kid) {
      return kid && kid.name === "raceFish";
    });
    if (!fish || fish._number !== number) {
      if (fish) node.removeChild(fish);
      fish = makeBitmap(number, digit, label || "1");
      node.addChild(fish);
    } else {
      node.setChildIndex(fish, node.numChildren - 1);
    }
    layoutFish(node, fish, digit);
    node.children.forEach(function (kid) {
      if (kid && kid.name !== "raceFish") markHidden(kid);
    });
    refreshCache(node);
  }

  function refreshCache(node) {
    let current = node;
    while (current) {
      if (current.cacheCanvas) {
        const bounds = current.bitmapCache;
        if (current.name === "inner" && bounds && current.uncache) {
          if (!current._fishCache) {
            current._fishCache = {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
              scale: bounds.scale || 1,
            };
          }
          current.uncache();
        }
        else if (current.updateCache) {
          try { current.updateCache(); } catch (error) { /* keep the live fish if a cache cannot refresh */ }
        }
      }
      current = current.parent;
    }
  }

  function restore(node) {
    const touched = [];
    function strip(current) {
      if (!current || !current.children) return;
      const leftovers = [];
      current.children.forEach(function (kid) {
        if (!kid) return;
        if (kid.name === "raceFish") leftovers.push(kid);
        strip(kid);
      });
      leftovers.forEach(function (kid) {
        current.removeChild(kid);
        touched.push(current);
      });
    }
    marked.forEach(function (kid) {
      if (!kid || !kid._fishMarked) return;
      kid.visible = kid._fishWasVisible !== false;
      kid._fishMarked = false;
    });
    marked.clear();
    skinned.forEach(function (body) {
      strip(body);
      const holder = body.parent;
      if (holder) strip(holder);
    });
    skinned.clear();
    if (node) strip(node);
    const seen = new Set();
    touched.forEach(function (body) {
      let current = body;
      while (current && !seen.has(current)) {
        seen.add(current);
        const saved = current._fishCache;
        if (saved && current.cache) {
          try {
            current.cache(saved.x, saved.y, saved.width, saved.height, saved.scale);
            current._fishCache = null;
          } catch (error) { /* draw the duck live if its cache cannot be rebuilt */ }
        } else if (current.cacheCanvas && current.updateCache) {
          try { current.updateCache(); } catch (error) { /* leave the previous frame if this cache cannot redraw */ }
        }
        current = current.parent;
      }
    });
    return touched.length > 0;
  }

  let settingsClip = null;
  let settledFrames = 0;
  let wasRacing = false;

  function findSettings() {
    if (settingsClip && settingsClip.parent) return settingsClip;
    settingsClip = null;
    function walk(node, depth) {
      if (!node || depth > 8 || settingsClip) return;
      if (node.name === "settings") settingsClip = node;
      for (const kid of node.children || []) walk(kid, depth + 1);
    }
    if (window.exportRoot) walk(window.exportRoot, 0);
    return settingsClip;
  }

  function setupCacheReady() {
    let ready = false;
    function walk(node, depth) {
      if (!node || depth > 8 || ready) return;
      if (node.name === "bg" && node.cacheCanvas && node.cacheCanvas.width > 800) ready = true;
      for (const kid of node.children || []) walk(kid, depth + 1);
    }
    if (window.exportRoot) walk(window.exportRoot, 0);
    return ready;
  }

  function canSkin() {
    const settings = findSettings();
    if (!settings) return false;
    if (settings.visible === false) {
      wasRacing = true;
      return true;
    }
    if (wasRacing) {
      wasRacing = false;
      settledFrames = 0;
    }
    if (!setupCacheReady()) {
      settledFrames = 0;
      return false;
    }
    settledFrames += 1;
    return settledFrames > 6;
  }

  function placeToggle() {
    const bar = document.getElementById("species-switch");
    if (!bar) return;
    const settings = findSettings();
    bar.style.visibility = settings && settings.visible === false ? "hidden" : "visible";
    bar.style.left = "8px";
    bar.style.bottom = "8px";
  }

  function hook(stage) {
    if (hooked) return;
    hooked = true;
    const original = stage.update.bind(stage);
    stage.update = function () {
      if (species === "fish" && canSkin()) applyFish(window.exportRoot);
      else if (species === "duck" && window.exportRoot) restore(window.exportRoot);
      placeToggle();
      return original();
    };
  }

  function fishBounds(canvas) {
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        if (data[(y * canvas.width + x) * 4 + 3] < 20) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }

  function paintToggleIcon(kind) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#161616";
    if (kind === "duck") {
      ctx.fillStyle = "#ffd23a";
      ctx.beginPath();
      ctx.ellipse(30, 38, 18, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(44, 28, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f08a14";
      ctx.beginPath();
      ctx.moveTo(50, 28);
      ctx.lineTo(62, 32);
      ctx.lineTo(50, 35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#161616";
      ctx.beginPath();
      ctx.arc(47, 26, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (art) {
      const bounds = fishBounds(art);
      ctx.drawImage(art, bounds.x, bounds.y, bounds.w, bounds.h, 4, 14, 56, 36);
    }
    return canvas;
  }

  function syncToggle() {
    const root = document.getElementById("species-switch");
    if (!root) return;
    root.querySelectorAll("button").forEach(function (button) {
      const on = button.dataset.species === species;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function choose(next) {
    if (next === species) return;
    species = next;
    localStorage.setItem(SPECIES_KEY, species);
    if (species === "duck" && window.exportRoot) restore(window.exportRoot);
    if (window.stage) window.stage.update();
    syncToggle();
  }

  function mountToggle() {
    const host = document.getElementById("animation_container");
    if (!host || document.getElementById("species-switch")) return;
    const style = document.createElement("style");
    style.textContent = [
      "#species-switch{position:absolute;left:8px;bottom:8px;z-index:40;display:flex;align-items:center;gap:0;padding:4px;background:#2b2b2b;border-radius:999px;box-shadow:0 1px 0 rgba(255,255,255,.14) inset, 0 2px 5px rgba(0,0,0,.45);pointer-events:auto}",
      "#species-switch button{display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#fff;font:800 20px/1 'Trebuchet MS','Segoe UI',Arial,sans-serif;border-radius:999px;padding:5px 16px 5px 7px;cursor:pointer;white-space:nowrap}",
      "#species-switch button.is-on{background:#3dce2b}",
      "#species-switch canvas{width:36px !important;height:36px !important;display:block !important;flex:0 0 36px !important;position:static !important;background:transparent !important}",
    ].join("");
    document.head.appendChild(style);
    const bar = document.createElement("div");
    bar.id = "species-switch";
    ["duck", "fish"].forEach(function (kind) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.species = kind;
      button.appendChild(paintToggleIcon(kind));
      button.appendChild(document.createTextNode(kind === "duck" ? "Duck" : "Fish"));
      button.addEventListener("click", function () {
        choose(kind);
      });
      button.style.cssText = "display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#fff;font:800 20px/1 'Trebuchet MS','Segoe UI',Arial,sans-serif;border-radius:999px;padding:5px 16px 5px 7px;cursor:pointer;white-space:nowrap;";
      const icon = button.querySelector("canvas");
      if (icon) icon.style.cssText = "width:36px;height:36px;display:block;flex:0 0 36px;position:static;background:transparent;";
      bar.appendChild(button);
    });
    host.appendChild(bar);
    syncToggle();
  }

  function boot() {
    const img = new Image();
    img.onload = function () {
      art = knockout(img);
      mountToggle();
      const fishIcon = document.querySelector('#species-switch button[data-species="fish"] canvas');
      if (fishIcon) {
        const next = paintToggleIcon("fish");
        next.style.cssText = fishIcon.style.cssText;
        fishIcon.replaceWith(next);
      }
      if (window.stage && window.exportRoot) {
        hook(window.stage);
        if (species === "fish") window.stage.update();
      }
    };
    img.src = "fish-ref.jpg";
    const wait = window.setInterval(function () {
      if (!window.stage || !window.exportRoot || !document.getElementById("animation_container")) return;
      window.clearInterval(wait);
      mountToggle();
      if (art) hook(window.stage);
    }, 200);
  }

  boot();
})();
