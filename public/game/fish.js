(function () {
  const SPECIES_KEY = "duck-race-species";
  const savedSpecies = localStorage.getItem(SPECIES_KEY);
  let species = savedSpecies === "fish" || savedSpecies === "frog" || savedSpecies === "turtle" || savedSpecies === "seahorse" ? savedSpecies : "duck";
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
  let active = "costume";
  const packs = {};
  const plates = new Map();

  function fishOpaque() {
    return opaque;
  }

  function measureOpaque(canvas) {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
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

  function inEllipse(rx, ry, cx, cy, ex, ey) {
    const nx = (rx - cx) / ex;
    const ny = (ry - cy) / ey;
    return nx * nx + ny * ny <= 1;
  }

  function fishRole(box, x, y) {
    const rx = (x - box.x) / box.w;
    const ry = (y - box.y) / box.h;
    if (rx > 0.93 && ry > 0.34 && ry < 0.58) return "mouth";
    if (rx < 0.255) return "fin";
    if (ry < 0.20 && rx > 0.38 && rx < 0.62) return "fin";
    if (ry > 0.855 && rx > 0.42 && rx < 0.72) return "fin";
    if (inEllipse(rx, ry, 0.55, 0.70, 0.07, 0.07)) return "fin";
    return "body";
  }

  function paintBelly(copy, width, height, box) {
    const cx = box.x + box.w * 0.50;
    const cy = box.y + box.h * 0.52;
    const rx = box.w * 0.13;
    const ry = box.h * 0.10;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const offset = (y * width + x) * 4;
        if (copy[offset + 3] < 20) continue;
        if (Math.max(copy[offset], copy[offset + 1], copy[offset + 2]) < 70) continue;
        copy[offset] = 255;
        copy[offset + 1] = 255;
        copy[offset + 2] = 255;
      }
    }
  }

  function paintHat(ctx, box) {
    const cx = box.x + box.w * 0.73;
    const cy = box.y + box.h * 0.22;
    const radius = box.w * 0.09;
    ctx.lineJoin = "round";
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#161616";
    ctx.fillStyle = "#f08a14";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.45, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function recolor(source, kind) {
    const width = source.width;
    const height = source.height;
    const original = source.getContext("2d").getImageData(0, 0, width, height);
    const copy = new Uint8ClampedArray(original.data);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (copy[(y * width + x) * 4 + 3] < 20) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    const box = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        if (copy[offset + 3] < 20) continue;
        const red = copy[offset];
        const green = copy[offset + 1];
        const blue = copy[offset + 2];
        if (Math.max(red, green, blue) < 70) continue;
        if (red > 230 && green > 230 && blue > 230) continue;
        const detail = green < 120;
        const part = fishRole(box, x, y);
        const rx = (x - box.x) / box.w;
        const ry = (y - box.y) / box.h;
        let color = "#ffe14a";
        if (kind === "yellow") color = part === "body" ? "#ffe14a" : (detail ? "#d86e08" : "#f08a14");
        else if (kind === "costume") color = part === "mouth" ? "#f08a14" : (detail ? "#c41616" : "#ef3b3b");
        else if (part === "mouth") color = "#f08a14";
        else if (part === "fin" && rx < 0.255) color = detail ? "#c41616" : "#ef3b3b";
        else if (ry > 0.60) color = "#ef3b3b";
        else if (rx > 0.66) color = "#2f6fed";
        else color = "#ffe14a";
        const value = parseInt(color.slice(1), 16);
        copy[offset] = (value >> 16) & 255;
        copy[offset + 1] = (value >> 8) & 255;
        copy[offset + 2] = value & 255;
      }
    }
    if (kind !== "costume") paintBelly(copy, width, height, box);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(new ImageData(copy, width, height), 0, 0);
    if (kind === "costume") paintHat(ctx, box);
    return canvas;
  }

  function bodyPlate(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const box = measureOpaque(canvas);
    const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const x0 = box.x + box.w * 0.3;
    const x1 = box.x + box.w * 0.7;
    const y0 = box.y + box.h * 0.32;
    const y1 = box.y + box.h * 0.68;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let y = Math.floor(y0); y <= y1; y += 2) {
      for (let x = Math.floor(x0); x <= x1; x += 2) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (data[(y * width + x) * 4 + 3] < 20) continue;
        sx += x;
        sy += y;
        count += 1;
      }
    }
    const cx = count ? sx / count : box.x + box.w / 2;
    const cy = count ? sy / count : box.y + box.h / 2;
    // The duck plate is a wide rounded patch, about 1.4× as wide as it is tall.
    const horizontal = box.w >= box.h;
    let plateW;
    let plateH;
    if (horizontal) {
      plateW = Math.round(box.w * 0.4);
      plateH = Math.round(plateW / 1.4);
      plateH = Math.min(plateH, Math.round(box.h * 0.46));
    } else {
      plateH = Math.round(box.h * 0.32);
      plateW = Math.round(plateH / 1.35);
      plateW = Math.min(plateW, Math.round(box.w * 0.62));
    }
    plateW = Math.max(22, plateW);
    plateH = Math.max(16, plateH);
    let x = Math.round(cx - plateW / 2);
    let y = Math.round(cy - plateH / 2);
    x = Math.max(0, Math.min(width - plateW, x));
    y = Math.max(0, Math.min(height - plateH, y));
    return { x: x, y: y, w: plateW, h: plateH };
  }

  function coverPlate(canvas, plate) {
    if (!plate) return;
    const ctx = canvas.getContext("2d");
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;
    const pad = 8;
    let color = null;
    for (let y = plate.y - pad * 4; y < plate.y + plate.h + pad * 4 && !color; y += 2) {
      for (let x = plate.x - pad * 4; x < plate.x + plate.w + pad * 4; x += 2) {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
        if (x >= plate.x - pad && x < plate.x + plate.w + pad && y >= plate.y - pad && y < plate.y + plate.h + pad) continue;
        const index = (y * canvas.width + x) * 4;
        if (pixels[index + 3] < 40) continue;
        if (pixels[index] > 210 && pixels[index + 1] > 210 && pixels[index + 2] > 210) continue;
        color = [pixels[index], pixels[index + 1], pixels[index + 2]];
        break;
      }
    }
    if (!color) return;
    for (let y = plate.y - pad; y < plate.y + plate.h + pad; y += 1) {
      for (let x = plate.x - pad; x < plate.x + plate.w + pad; x += 1) {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
        const index = (y * canvas.width + x) * 4;
        if (pixels[index + 3] < 40) continue;
        const max = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
        const min = Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
        const inside = x >= plate.x && x < plate.x + plate.w && y >= plate.y && y < plate.y + plate.h;
        const white = min > 186;
        const ink = inside && max < 96;
        if (!white && !ink) continue;
        pixels[index] = color[0];
        pixels[index + 1] = color[1];
        pixels[index + 2] = color[2];
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function buildPacks(source) {
    const oldPlate = badge;
    ["costume", "yellow", "colors"].forEach(function (kind) {
      const canvas = recolor(source, kind);
      coverPlate(canvas, oldPlate);
      const plate = bodyPlate(canvas);
      packs[kind] = {
        canvas: canvas,
        badge: plate,
        pivot: oldPlate ? { x: oldPlate.x + oldPlate.w / 2, y: oldPlate.y + oldPlate.h / 2 } : { x: plate.x + plate.w / 2, y: plate.y + plate.h / 2 },
        opaque: measureOpaque(canvas)
      };
    });
  }

  function prepareAnimal(canvas, name, spot) {
    const box = measureOpaque(canvas);
    const oldPlate = {
      x: Math.round(box.x + box.w * spot.x),
      y: Math.round(box.y + box.h * spot.y),
      w: Math.round(box.w * spot.w),
      h: Math.round(box.h * spot.h)
    };
    const plate = bodyPlate(canvas);
    packs[name] = {
      canvas: canvas,
      badge: plate,
      pivot: { x: oldPlate.x + oldPlate.w / 2, y: oldPlate.y + oldPlate.h / 2 },
      opaque: measureOpaque(canvas)
    };
  }

  function useStyle(name) {
    const pack = packs[name];
    if (!pack) return;
    active = name;
    art = pack.canvas;
    badge = pack.badge;
    opaque = pack.opaque;
  }

  function currentStyle() {
    let frame = 0;
    let found = false;
    function walk(node, depth) {
      if (!node || depth > 12 || found) return;
      if (node.name === "choiceToggle") {
        frame = node.currentFrame || 0;
        found = true;
      }
      (node.children || []).forEach(function (kid) { walk(kid, depth + 1); });
    }
    if (window.exportRoot) walk(window.exportRoot, 0);
    return ["costume", "yellow", "colors"][frame] || "costume";
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

  const FROG_LOOKS = [3, 22, 40, 49, 19, 12, 9, 44];
  // mul is hat width divided by the pupil. above is how far the opening sits above the pupil, in pupil-widths.
  // back shifts the opening toward the tail. tilt rotates clockwise so a raised brim comes down over the face.
  const FROG_HAT_FIT = {
    3: { mul: 2.3, above: .09, back: 1.1, ax: 0.46, tilt: 0.12 },
    22: { mul: 2.0, above:  0.54, back: 0.5, ax: 0.5, tilt: 0 },
    40: { mul: 2.35, above: .35, back: .8, ax: 0.5, tilt: 0.12 },
    49: { mul: 1.9, above: 0.40, back: .8, ax: 0.5, tilt: 0 },
    19: { mul: 2.15, above: 0.54, back: 0.5, ax: 0.5, tilt: 0 },
    12: { mul: 2.35, above: .35, back: .8, ax: 0.5, tilt: 0.12 },
    9: { mul: 2.0, above:  0.54, back: 0.5, ax: 0.5, tilt: 0 },
    44: { mul: 2.35, above: .35, back: .8, ax: 0.5, tilt: 0.12 },

    
  };
  let frogLooks = null;

  const FROG_COLORS = [50, 330, 297, 119, 360, 270];
  let hatDeck = null;
  let colorDeck = null;
  let hatsLive = false;
  let hatSawRacing = false;
  let hatFinished = false;

  function shuffleDeck(values) {
    const deck = values.slice();
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const held = deck[i];
      deck[i] = deck[j];
      deck[j] = held;
    }
    return deck;
  }

  function shuffleHatDeck(racerCount) {
    const hats = shuffleDeck(FROG_LOOKS);
    const count = Math.max(1, racerCount || 5);
    if (count < 2) {
      hatDeck = Math.random() < 0.5 ? hats.concat([0]) : hats;
      return;
    }
    const window = Math.min(count, hats.length + 1);
    const start = hats.length - window + 1;
    const slot = start + Math.floor(Math.random() * window);
    hats.splice(slot, 0, 0);
    hatDeck = hats;
  }

  function shuffleColorDeck() {
    colorDeck = shuffleDeck(FROG_COLORS);
  }

  function dealFrogColor() {
    if (!colorDeck || !colorDeck.length) shuffleColorDeck();
    return colorDeck.pop();
  }

  function hslToRgb(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360 / 360;
    if (saturation <= 0) {
      const gray = Math.round(lightness * 255);
      return [gray, gray, gray];
    }
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    function channel(t) {
      let value = t;
      if (value < 0) value += 1;
      if (value > 1) value -= 1;
      if (value < 1 / 6) return p + (q - p) * 6 * value;
      if (value < 1 / 2) return q;
      if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
      return p;
    }
    return [
      Math.round(channel(h + 1 / 3) * 255),
      Math.round(channel(h) * 255),
      Math.round(channel(h - 1 / 3) * 255),
    ];
  }

  function tintFrog(source, hue) {
    if (!hue) return source;
    if (!source._frogTints) source._frogTints = new Map();
    if (source._frogTints.has(hue)) return source._frogTints.get(hue);
    const width = source.width;
    const height = source.height;
    const image = source.getContext("2d").getImageData(0, 0, width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 20) continue;
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      if (max < 72 || min > 210) continue;
      if (!(green > red + 10 && green > blue + 10)) continue;
      const rf = red / 255;
      const gf = green / 255;
      const bf = blue / 255;
      const hi = Math.max(rf, gf, bf);
      const lo = Math.min(rf, gf, bf);
      const lightness = (hi + lo) / 2;
      const span = hi - lo;
      const saturation = span === 0 ? 0 : span / (1 - Math.abs(2 * lightness - 1));
      const sat = Math.min(0.84, Math.max(0.7, saturation * 0.95));
      const next = hslToRgb(hue, sat, lightness);
      data[i] = next[0];
      data[i + 1] = next[1];
      data[i + 2] = next[2];
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").putImageData(image, 0, 0);
    source._frogTints.set(hue, canvas);
    return canvas;
  }

  function frogLookFrame(node, label) {
    let host = node;
    while (host) {
      if (host.name === "choiceToggle") return 0;
      host = host.parent;
    }
    const number = parseInt(label, 10);
    if (!Number.isFinite(number) || number <= 0) return 0;
    if (!hatsLive) return FROG_LOOKS[(number - 1) % FROG_LOOKS.length];
    if (node._frogHat == null) {
      if (!hatDeck || !hatDeck.length) shuffleHatDeck();
      node._frogHat = hatDeck.pop();
    }
    return node._frogHat;
  }

  function frogColor(node) {
    let host = node;
    while (host) {
      if (host.name === "choiceToggle") return 0;
      host = host.parent;
    }
    if (!hatsLive) return 0;
    if (node._frogColor == null) node._frogColor = dealFrogColor();
    return node._frogColor;
  }

  function rasterAccessory(clip, frame) {
    clip.gotoAndStop(frame);
    const accessory = (clip.children || []).find(function (kid) {
      return kid && kid.name && kid.name !== "duckColour" && kid.name !== "duckPattern";
    });
    if (!accessory) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    ctx.translate(180, 200);
    accessory.draw(ctx);
    const data = ctx.getImageData(0, 0, 360, 360).data;
    let minX = 360;
    let minY = 360;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    for (let y = 0; y < 360; y += 1) {
      for (let x = 0; x < 360; x += 1) {
        if (data[(y * 360 + x) * 4 + 3] < 20) continue;
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!count) return null;
    const trimmed = document.createElement("canvas");
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;
    trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return keepHatPiece(trimmed);
  }

  function keepHatPiece(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const seen = new Uint8Array(width * height);
    const keep = new Uint8Array(width * height);
    let bestCount = 0;
    let pieces = 0;
    for (let index = 0; index < width * height; index += 1) {
      if (seen[index] || data[index * 4 + 3] < 20) continue;
      const stack = [index];
      seen[index] = 1;
      const cells = [];
      while (stack.length) {
        const current = stack.pop();
        cells.push(current);
        const x = current % width;
        const y = (current / width) | 0;
        const neighbors = [current - 1, current + 1, current - width, current + width];
        for (let side = 0; side < 4; side += 1) {
          const next = neighbors[side];
          if (next < 0 || next >= width * height || seen[next] || data[next * 4 + 3] < 20) continue;
          const nx = next % width;
          const ny = (next / width) | 0;
          if (side < 2 && (ny !== y || Math.abs(nx - x) !== 1)) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      pieces += 1;
      if (cells.length > bestCount) {
        bestCount = cells.length;
        keep.fill(0);
        cells.forEach(function (cell) { keep[cell] = 1; });
      }
    }
    if (pieces > 1) {
      for (let index = 0; index < width * height; index += 1) {
        if (!keep[index]) data[index * 4 + 3] = 0;
      }
      ctx.putImageData(image, 0, 0);
    }
    return hatMetrics(canvas);
  }

  function hatMetrics(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    const rows = [];
    for (let y = 0; y < height; y += 1) {
      let count = 0;
      let sum = 0;
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] < 20) continue;
        count += 1;
        sum += x;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      if (count) rows.push({ y: y, count: count, cx: sum / count });
    }
    if (!rows.length) return { canvas: canvas, wear: 0.8, ax: 0.5 };
    const cut = document.createElement("canvas");
    cut.width = Math.max(1, maxX - minX + 1);
    cut.height = Math.max(1, maxY - minY + 1);
    cut.getContext("2d").drawImage(canvas, minX, minY, cut.width, cut.height, 0, 0, cut.width, cut.height);
    const maxCount = rows.reduce(function (best, row) { return Math.max(best, row.count); }, 1);
    const wide = rows.filter(function (row) { return row.count >= maxCount * 0.42; });
    const seat = wide.length ? wide[wide.length - 1] : rows[rows.length - 1];
    return {
      canvas: cut,
      wear: (seat.y - minY) / cut.height,
      ax: (seat.cx - minX) / cut.width,
    };
  }

  function ensureFrogLooks(clip) {
    if (frogLooks) return frogLooks;
    const saved = clip.currentFrame;
    const paused = clip.paused;
    frogLooks = [];
    try {
      for (let frame = 0; frame < clip.totalFrames; frame += 1) {
        const raster = rasterAccessory(clip, frame);
        frogLooks.push(raster ? { canvas: raster.canvas, wear: raster.wear, ax: raster.ax } : null);
      }
    } finally {
      clip.gotoAndStop(saved);
      clip.paused = paused;
    }
    return frogLooks;
  }

  function frogHead(canvas) {
    if (canvas._frogHead) return canvas._frogHead;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const data = ctx.getImageData(0, 0, width, height).data;
    const box = measureOpaque(canvas);
    const x0 = Math.floor(box.x + box.w * 0.52);
    const x1 = Math.floor(box.x + box.w * 0.9);
    const y0 = Math.floor(box.y + box.h * 0.04);
    const y1 = Math.floor(box.y + box.h * 0.4);
    const dark = new Uint8Array(width * height);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 220) continue;
        if (Math.max(data[offset], data[offset + 1], data[offset + 2]) > 42) continue;
        let edge = false;
        for (let oy = -2; oy <= 2 && !edge; oy += 2) {
          for (let ox = -2; ox <= 2; ox += 2) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height || data[(ny * width + nx) * 4 + 3] < 160) edge = true;
          }
        }
        if (!edge) dark[y * width + x] = 1;
      }
    }
    const seen = new Uint8Array(width * height);
    let pupil = null;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const start = y * width + x;
        if (!dark[start] || seen[start]) continue;
        const stack = [start];
        seen[start] = 1;
        let minX = x;
        let minY = y;
        let maxX = x;
        let maxY = y;
        let interior = 0;
        let sumX = 0;
        let sumY = 0;
        let sumN = 0;
        while (stack.length) {
          const index = stack.pop();
          const px = index % width;
          const py = (index / width) | 0;
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
          const filled = dark[index - 1] && dark[index + 1] && dark[index - width] && dark[index + width];
          if (filled) {
            interior += 1;
            sumX += px;
            sumY += py;
            sumN += 1;
          }
          const next = [index - 1, index + 1, index - width, index + width];
          for (let side = 0; side < 4; side += 1) {
            const ni = next[side];
            if (ni < 0 || ni >= dark.length || seen[ni] || !dark[ni]) continue;
            if (side < 2 && ((ni / width) | 0) !== py) continue;
            seen[ni] = 1;
            stack.push(ni);
          }
        }
        if (sumN < 40) continue;
        const blobW = maxX - minX;
        const blobH = maxY - minY;
        if (blobW < 12 || blobH < 12 || blobW > blobH * 1.8 || blobH > blobW * 1.8) continue;
        if (!pupil || interior > pupil.interior) {
          pupil = { interior: interior, cx: sumX / sumN, cy: sumY / sumN, w: blobW, h: blobH };
        }
      }
    }
    const pupilCx = pupil ? pupil.cx : box.x + box.w * 0.76;
    const pupilCy = pupil ? pupil.cy : box.y + box.h * 0.2;
    const pupilW = pupil ? pupil.w : box.w * 0.1;
    const pupilH = pupil ? pupil.h : pupilW;
    function whiteAt(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const offset = (y * width + x) * 4;
      return data[offset + 3] > 180 && data[offset] > 220 && data[offset + 1] > 220 && data[offset + 2] > 220;
    }
    const cap = Math.max(pupilW, pupilH) * 1.6;
    const cx = Math.round(pupilCx);
    const cy = Math.round(pupilCy);
    let eyeTop = Math.round(pupilCy - pupilH * 0.5);
    let eyeBottom = Math.round(pupilCy + pupilH * 0.5);
    let eyeLeft = Math.round(pupilCx - pupilW * 0.5);
    let eyeRight = Math.round(pupilCx + pupilW * 0.5);
    for (let y = eyeTop; y > cy - cap && y > box.y; y -= 1) {
      if (!whiteAt(cx, y)) break;
      eyeTop = y;
    }
    for (let y = eyeBottom; y < cy + cap && y < box.y + box.h; y += 1) {
      if (!whiteAt(cx, y)) break;
      eyeBottom = y;
    }
    for (let x = eyeLeft; x > cx - cap && x > box.x; x -= 1) {
      if (!whiteAt(x, cy)) break;
      eyeLeft = x;
    }
    for (let x = eyeRight; x < cx + cap && x < box.x + box.w; x += 1) {
      if (!whiteAt(x, cy)) break;
      eyeRight = x;
    }
    let crownY = eyeTop;
    for (let y = eyeTop; y >= box.y; y -= 1) {
      if (data[(y * width + cx) * 4 + 3] < 40) break;
      crownY = y;
    }
    canvas._frogHead = {
      crownY: crownY,
      pupilCx: pupilCx,
      pupilCy: pupilCy,
      pupilW: pupilW,
      pupilH: pupilH,
      eyeLeft: eyeLeft,
      eyeRight: eyeRight,
      eyeTop: eyeTop,
      eyeBottom: eyeBottom,
    };
    return canvas._frogHead;
  }

  function poseHat(look, tilt) {
    if (!tilt) return look;
    const key = String(tilt);
    if (!look._poses) look._poses = {};
    if (look._poses[key]) return look._poses[key];
    const src = look.canvas;
    const cos = Math.abs(Math.cos(tilt));
    const sin = Math.abs(Math.sin(tilt));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(src.width * cos + src.height * sin) + 4;
    canvas.height = Math.ceil(src.width * sin + src.height * cos) + 4;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(tilt);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    look._poses[key] = hatMetrics(canvas);
    return look._poses[key];
  }

  function planFrogHat(picture, frame, clip) {
    const looks = ensureFrogLooks(clip);
    const sourceLook = looks && looks[frame];
    if (!sourceLook) return null;
    const head = frogHead(picture);
    const fit = FROG_HAT_FIT[frame] || { mul: 1.1, drop: 1, forward: 0.5, ax: 0.5 };
    const look = poseHat(sourceLook, fit.tilt || 0);
    const ax = fit.ax == null ? look.ax : fit.ax;
    const wear = fit.wear == null ? look.wear : fit.wear;
    const hatW = head.pupilW * fit.mul;
    const hatH = hatW * (look.canvas.height / Math.max(1, look.canvas.width));
    const seatX = head.pupilCx - head.pupilW * (fit.back || 0);
    const seatY = head.pupilCy - head.pupilW * fit.above;
    return {
      canvas: look.canvas,
      x: seatX - ax * hatW,
      y: seatY - wear * hatH,
      w: hatW,
      h: hatH,
    };
  }

  // drop tucks the opening onto the skull, in pupil-widths below the crown.
  // back shifts the opening toward the spines. tilt tips a brim down over the snout.
  const SEA_HAT_FIT = {
    3: { mul: 2.05, drop: 0.85, back: 1.05, ax: 0.46, tilt: 0.1 },
    22: { mul: 1.7, drop: 0.52, back: .8, ax: 0.5, tilt: 0 },
    40: { mul: 2.15, drop: 0.6, back: 1.1, ax: 0.5, tilt: 0.06 },
    49: { mul: 1.85, drop: 0.52, back: 0.8, ax: 0.5, tilt: .1 },
    19: { mul: 1.95, drop: 0.45, back: 0.6, ax: 0.5, tilt: 0 },
    12: { mul: 1.85, drop: 0.37, back: 0.8, ax: 0.5, tilt: .1 },
    9: { mul: 1.6, drop: 0.3, back: 0.2, ax: 0.62, tilt: 0 },
    44: { mul: 1.65, drop: 0.37, back: 0.8, ax: 0.42, tilt: .3 },
  };

  function seahorseHead(canvas) {
    if (canvas._seaHead) return canvas._seaHead;
    const width = canvas.width;
    const height = canvas.height;
    const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const box = measureOpaque(canvas);
    const x0 = Math.floor(box.x + box.w * 0.28);
    const x1 = Math.floor(box.x + box.w * 0.8);
    const y0 = Math.floor(box.y + box.h * 0.01);
    const y1 = Math.floor(box.y + box.h * 0.3);
    const dark = new Uint8Array(width * height);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 220) continue;
        if (Math.max(data[offset], data[offset + 1], data[offset + 2]) > 42) continue;
        dark[y * width + x] = 1;
      }
    }
    const seen = new Uint8Array(width * height);
    let pupil = null;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const start = y * width + x;
        if (!dark[start] || seen[start]) continue;
        const stack = [start];
        seen[start] = 1;
        let minX = x;
        let minY = y;
        let maxX = x;
        let maxY = y;
        let interior = 0;
        let sumX = 0;
        let sumY = 0;
        let sumN = 0;
        while (stack.length) {
          const index = stack.pop();
          const px = index % width;
          const py = (index / width) | 0;
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
          const filled = dark[index - 1] && dark[index + 1] && dark[index - width] && dark[index + width];
          if (filled) {
            interior += 1;
            sumX += px;
            sumY += py;
            sumN += 1;
          }
          const next = [index - 1, index + 1, index - width, index + width];
          for (let side = 0; side < 4; side += 1) {
            const ni = next[side];
            if (ni < 0 || ni >= dark.length || seen[ni] || !dark[ni]) continue;
            if (side < 2 && ((ni / width) | 0) !== py) continue;
            seen[ni] = 1;
            stack.push(ni);
          }
        }
        const blobW = maxX - minX;
        const blobH = maxY - minY;
        if (sumN < 30 || blobW < 10 || blobH < 10 || blobW > blobH * 1.8 || blobH > blobW * 1.8) continue;
        if (!pupil || interior > pupil.interior) {
          pupil = { interior: interior, cx: sumX / sumN, cy: sumY / sumN, w: blobW, h: blobH };
        }
      }
    }
    const pupilCx = pupil ? pupil.cx : box.x + box.w * 0.55;
    const pupilCy = pupil ? pupil.cy : box.y + box.h * 0.14;
    const pupilW = pupil ? pupil.w : box.w * 0.12;
    const pupilH = pupil ? pupil.h : pupilW;
    const bandL = Math.max(0, Math.floor(pupilCx - pupilW * 0.28));
    const bandR = Math.min(width - 1, Math.ceil(pupilCx + pupilW * 0.12));
    const tops = [];
    for (let x = bandL; x <= bandR; x += 1) {
      for (let y = Math.max(0, y0 - 4); y < pupilCy; y += 1) {
        if (data[(y * width + x) * 4 + 3] < 40) continue;
        tops.push(y);
        break;
      }
    }
    tops.sort(function (a, b) { return a - b; });
    const crownY = tops.length ? tops[Math.floor(tops.length * 0.45)] : pupilCy - pupilH;
    function whiteAt(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const offset = (y * width + x) * 4;
      return data[offset + 3] > 180 && data[offset] > 220 && data[offset + 1] > 220 && data[offset + 2] > 220;
    }
    const cap = Math.max(pupilW, pupilH) * 1.7;
    const cx = Math.round(pupilCx);
    const cy = Math.round(pupilCy);
    let eyeTop = Math.round(pupilCy - pupilH * 0.5);
    let eyeBottom = Math.round(pupilCy + pupilH * 0.5);
    let eyeLeft = Math.round(pupilCx - pupilW * 0.5);
    let eyeRight = Math.round(pupilCx + pupilW * 0.5);
    for (let y = eyeTop; y > cy - cap && y > box.y; y -= 1) {
      if (!whiteAt(cx, y)) break;
      eyeTop = y;
    }
    for (let y = eyeBottom; y < cy + cap && y < box.y + box.h; y += 1) {
      if (!whiteAt(cx, y)) break;
      eyeBottom = y;
    }
    for (let x = eyeLeft; x > cx - cap && x > box.x; x -= 1) {
      if (!whiteAt(x, cy)) break;
      eyeLeft = x;
    }
    for (let x = eyeRight; x < cx + cap && x < box.x + box.w; x += 1) {
      if (!whiteAt(x, cy)) break;
      eyeRight = x;
    }
    canvas._seaHead = {
      crownY: crownY,
      pupilCx: pupilCx,
      pupilCy: pupilCy,
      pupilW: pupilW,
      pupilH: pupilH,
      eyeLeft: eyeLeft,
      eyeRight: eyeRight,
      eyeTop: eyeTop,
      eyeBottom: eyeBottom,
    };
    return canvas._seaHead;
  }

  function planSeahorseHat(picture, frame, clip) {
    const looks = ensureFrogLooks(clip);
    const sourceLook = looks && looks[frame];
    if (!sourceLook) return null;
    const head = seahorseHead(art);
    if (!head) return null;
    picture._frogHead = head;
    const fit = SEA_HAT_FIT[frame] || { mul: 2, drop: 0.04, back: 0.16, ax: 0.5, tilt: 0 };
    const look = poseHat(sourceLook, fit.tilt || 0);
    const ax = fit.ax == null ? look.ax : fit.ax;
    const wear = fit.wear == null ? look.wear : fit.wear;
    const hatW = head.pupilW * fit.mul;
    const hatH = hatW * (look.canvas.height / Math.max(1, look.canvas.width));
    const seatX = head.pupilCx - head.pupilW * (fit.back || 0);
    const seatY = head.crownY + head.pupilW * (fit.drop || 0);
    return {
      canvas: look.canvas,
      x: seatX - ax * hatW,
      y: seatY - wear * hatH,
      w: hatW,
      h: hatH,
    };
  }

  // drop tucks the opening onto the head, in pupil-widths below the crown.
  // back shifts the opening toward the tail, clear of the snout and the dorsal fin.
  const FISH_HAT_FIT = {
    3: { mul: 1.7, drop: 0.28, back: 0.06, ax: 0.46, tilt: 0.1 },
    22: { mul: 1.35, drop: 0.2, back: 0.02, ax: 0.5, tilt: 0 },
    40: { mul: 1.7, drop: 0.1, back: 0.12, ax: 0.5, tilt: 0.04 },
    49: { mul: 1.5, drop: 0.26, back: 0.04, ax: 0.5, tilt: 0 },
    19: { mul: 1.55, drop: 0.16, back: 0.0, ax: 0.5, tilt: 0 },
    12: { mul: 1.6, drop: 0.3, back: 0.04, ax: 0.5, tilt: 0 },
    9: { mul: 1.45, drop: 0.22, back: 0.1, ax: 0.52, tilt: 0 },
    44: { mul: 1.3, drop: 0.22, back: -0.58, ax: 0.36, tilt: 0 },
  };

  function fishHead(canvas) {
    if (canvas._fishHead) return canvas._fishHead;
    const width = canvas.width;
    const height = canvas.height;
    const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const box = measureOpaque(canvas);
    const x0 = Math.floor(box.x + box.w * 0.58);
    const x1 = Math.floor(box.x + box.w * 0.96);
    const y0 = Math.floor(box.y + box.h * 0.08);
    const y1 = Math.floor(box.y + box.h * 0.62);
    const dark = new Uint8Array(width * height);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 220) continue;
        if (Math.max(data[offset], data[offset + 1], data[offset + 2]) > 42) continue;
        dark[y * width + x] = 1;
      }
    }
    const seen = new Uint8Array(width * height);
    let pupil = null;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const start = y * width + x;
        if (!dark[start] || seen[start]) continue;
        const stack = [start];
        seen[start] = 1;
        let minX = x;
        let minY = y;
        let maxX = x;
        let maxY = y;
        let interior = 0;
        let sumX = 0;
        let sumY = 0;
        let sumN = 0;
        while (stack.length) {
          const index = stack.pop();
          const px = index % width;
          const py = (index / width) | 0;
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
          const filled = dark[index - 1] && dark[index + 1] && dark[index - width] && dark[index + width];
          if (filled) {
            interior += 1;
            sumX += px;
            sumY += py;
            sumN += 1;
          }
          const next = [index - 1, index + 1, index - width, index + width];
          for (let side = 0; side < 4; side += 1) {
            const ni = next[side];
            if (ni < 0 || ni >= dark.length || seen[ni] || !dark[ni]) continue;
            if (side < 2 && ((ni / width) | 0) !== py) continue;
            seen[ni] = 1;
            stack.push(ni);
          }
        }
        const blobW = maxX - minX;
        const blobH = maxY - minY;
        if (sumN < 30 || blobW < 10 || blobH < 10 || blobW > blobH * 1.8 || blobH > blobW * 1.8) continue;
        if (!pupil || interior > pupil.interior) {
          pupil = { interior: interior, cx: sumX / sumN, cy: sumY / sumN, w: blobW, h: blobH };
        }
      }
    }
    const pupilCx = pupil ? pupil.cx : box.x + box.w * 0.78;
    const pupilCy = pupil ? pupil.cy : box.y + box.h * 0.38;
    const pupilW = pupil ? pupil.w : box.w * 0.1;
    const pupilH = pupil ? pupil.h : pupilW;
    const bandL = Math.max(0, Math.floor(pupilCx - pupilW * 0.08));
    const bandR = Math.min(width - 1, Math.ceil(pupilCx + pupilW * 0.2));
    const tops = [];
    for (let x = bandL; x <= bandR; x += 1) {
      for (let y = box.y; y < pupilCy; y += 1) {
        if (data[(y * width + x) * 4 + 3] < 40) continue;
        tops.push(y);
        break;
      }
    }
    tops.sort(function (a, b) { return a - b; });
    const crownY = tops.length ? tops[Math.floor(tops.length * 0.72)] : pupilCy - pupilH;
    function whiteAt(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const offset = (y * width + x) * 4;
      return data[offset + 3] > 180 && data[offset] > 220 && data[offset + 1] > 220 && data[offset + 2] > 220;
    }
    const cap = Math.max(pupilW, pupilH) * 1.7;
    const cx = Math.round(pupilCx);
    const cy = Math.round(pupilCy);
    let eyeTop = Math.round(pupilCy - pupilH * 0.5);
    let eyeBottom = Math.round(pupilCy + pupilH * 0.5);
    let eyeLeft = Math.round(pupilCx - pupilW * 0.5);
    let eyeRight = Math.round(pupilCx + pupilW * 0.5);
    for (let y = eyeTop; y > cy - cap && y > box.y; y -= 1) {
      if (!whiteAt(cx, y)) break;
      eyeTop = y;
    }
    for (let y = eyeBottom; y < cy + cap && y < box.y + box.h; y += 1) {
      if (!whiteAt(cx, y)) break;
      eyeBottom = y;
    }
    for (let x = eyeLeft; x > cx - cap && x > box.x; x -= 1) {
      if (!whiteAt(x, cy)) break;
      eyeLeft = x;
    }
    for (let x = eyeRight; x < cx + cap && x < box.x + box.w; x += 1) {
      if (!whiteAt(x, cy)) break;
      eyeRight = x;
    }
    canvas._fishHead = {
      crownY: crownY,
      pupilCx: pupilCx,
      pupilCy: pupilCy,
      pupilW: pupilW,
      pupilH: pupilH,
      eyeLeft: eyeLeft,
      eyeRight: eyeRight,
      eyeTop: eyeTop,
      eyeBottom: eyeBottom,
    };
    return canvas._fishHead;
  }

  function planFishHat(picture, frame, clip) {
    const looks = ensureFrogLooks(clip);
    const sourceLook = looks && looks[frame];
    if (!sourceLook) return null;
    const head = fishHead(art);
    if (!head) return null;
    picture._frogHead = head;
    const fit = FISH_HAT_FIT[frame] || { mul: 1.7, drop: 0.06, back: 0.14, ax: 0.5, tilt: 0 };
    const look = poseHat(sourceLook, fit.tilt || 0);
    const ax = fit.ax == null ? look.ax : fit.ax;
    const wear = fit.wear == null ? look.wear : fit.wear;
    const hatW = head.pupilW * fit.mul;
    const hatH = hatW * (look.canvas.height / Math.max(1, look.canvas.width));
    const seatX = head.pupilCx - head.pupilW * (fit.back || 0);
    const seatY = head.crownY + head.pupilW * (fit.drop || 0);
    return {
      canvas: look.canvas,
      x: seatX - ax * hatW,
      y: seatY - wear * hatH,
      w: hatW,
      h: hatH,
    };
  }

  function revealEye(ctx, picture, padX, padY) {
    const head = picture._frogHead;
    if (!head) return;
    const src = picture.getContext("2d").getImageData(0, 0, picture.width, picture.height);
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const image = ctx.getImageData(0, 0, width, height);
    const cx = head.pupilCx;
    const cy = head.pupilCy;
    const rx = Math.max(head.pupilW, (head.eyeRight - head.eyeLeft) * 0.55) * 1.08;
    const ry = Math.max(head.pupilH, (head.eyeBottom - head.eyeTop) * 0.55) * 1.12;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(picture.width - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(picture.height - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const source = (y * picture.width + x) * 4;
        if (src.data[source + 3] < 30) continue;
        const red = src.data[source];
        const green = src.data[source + 1];
        const blue = src.data[source + 2];
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const eyePixel = min > 200 || max < 70;
        if (!eyePixel) continue;
        const dx = x + padX;
        const dy = y + padY;
        if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;
        const dest = (dy * width + dx) * 4;
        image.data[dest] = src.data[source];
        image.data[dest + 1] = src.data[source + 1];
        image.data[dest + 2] = src.data[source + 2];
        image.data[dest + 3] = src.data[source + 3];
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function stampNumber(digit, label, source, lookFrame, lookHost) {
    const picture = source || art;
    const hat = lookFrame && lookHost ? (active === "seahorse" ? planSeahorseHat(picture, lookFrame, lookHost) : species === "fish" ? planFishHat(picture, lookFrame, lookHost) : planFrogHat(picture, lookFrame, lookHost)) : null;
    const padX = hat ? Math.max(0, Math.ceil(-hat.x)) : 0;
    const padY = hat ? Math.max(0, Math.ceil(-hat.y)) : 0;
    const extraR = hat ? Math.max(0, Math.ceil(hat.x + hat.w - picture.width)) : 0;
    const extraB = hat ? Math.max(0, Math.ceil(hat.y + hat.h - picture.height)) : 0;
    const canvas = document.createElement("canvas");
    canvas.width = picture.width + padX + extraR;
    canvas.height = picture.height + padY + extraB;
    canvas._padX = padX;
    canvas._padY = padY;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(picture, padX, padY);
    if (hat) {
      ctx.drawImage(hat.canvas, hat.x + padX, hat.y + padY, hat.w, hat.h);
      revealEye(ctx, picture, padX, padY);
    }
    if (!badge) return canvas;
    const width = canvas.width;
    const height = canvas.height;
    const base = ctx.getImageData(0, 0, width, height);
    const pixels = base.data;
    const body = new Uint8Array(width * height);
    const outline = new Uint8Array(width * height);
    function nearClear(px, py) {
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          const nx = px + ox;
          const ny = py + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
          if (pixels[(ny * width + nx) * 4 + 3] < 40) return true;
        }
      }
      return false;
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const offset = index * 4;
        if (pixels[offset + 3] < 48) continue;
        const max = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
        if (max < 78 && nearClear(x, y)) outline[index] = 1;
        else body[index] = 1;
      }
    }
    const fringe = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (!outline[index]) continue;
        fringe[index - 1] = 1;
        fringe[index + 1] = 1;
        fringe[index - width] = 1;
        fringe[index + width] = 1;
      }
    }
    for (let i = 0; i < width * height; i += 1) {
      if (!fringe[i] || outline[i]) continue;
      outline[i] = 1;
      body[i] = 0;
    }
    let x = badge.x + padX;
    let y = badge.y + padY;
    let w = badge.w;
    let h = badge.h;
    function onBody(px, py) {
      const sx = Math.round(px);
      const sy = Math.round(py);
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;
      return body[sy * width + sx] === 1;
    }
    function plateInside(px, py, pw, ph) {
      const r = Math.min(pw, ph) * 0.28;
      const margin = Math.max(3, Math.round(Math.min(pw, ph) * 0.08));
      for (let i = 0; i <= 16; i += 1) {
        const t = i / 16;
        if (!onBody(px + r + (pw - r * 2) * t, py + margin)) return false;
        if (!onBody(px + r + (pw - r * 2) * t, py + ph - margin)) return false;
        if (!onBody(px + margin, py + r + (ph - r * 2) * t)) return false;
        if (!onBody(px + pw - margin, py + r + (ph - r * 2) * t)) return false;
      }
      const arc = r * 0.62;
      return onBody(px + arc, py + arc) && onBody(px + pw - arc, py + arc) && onBody(px + arc, py + ph - arc) && onBody(px + pw - arc, py + ph - arc);
    }
    for (let guard = 0; guard < 18 && w > 18 && h > 14 && !plateInside(x, y, w, h); guard += 1) {
      const dw = Math.max(1, Math.round(w * 0.05));
      const dh = Math.max(1, Math.round(h * 0.05));
      x += dw;
      y += dh;
      w -= dw * 2;
      h -= dh * 2;
    }
    const radius = Math.min(w, h) * 0.28;
    const line = Math.max(2, Math.round(Math.min(w, h) * 0.055));
    const layer = document.createElement("canvas");
    layer.width = width;
    layer.height = height;
    const plate = layer.getContext("2d");
    plate.fillStyle = "#ffffff";
    plate.beginPath();
    plate.roundRect(x, y, w, h, radius);
    plate.fill();
    const filled = plate.getImageData(0, 0, width, height);
    const fill = filled.data;
    for (let i = 0; i < width * height; i += 1) {
      if (fill[i * 4 + 3] < 16) continue;
      if (!body[i]) fill[i * 4 + 3] = 0;
    }
    plate.putImageData(filled, 0, 0);
    const edge = document.createElement("canvas");
    edge.width = width;
    edge.height = height;
    const stroke = edge.getContext("2d");
    stroke.strokeStyle = "#1a1a1a";
    stroke.lineJoin = "round";
    stroke.lineWidth = line;
    stroke.beginPath();
    stroke.roundRect(x + line / 2, y + line / 2, Math.max(1, w - line), Math.max(1, h - line), Math.max(2, radius - line / 2));
    stroke.stroke();
    const edged = stroke.getImageData(0, 0, width, height);
    const marks = edged.data;
    for (let i = 0; i < width * height; i += 1) {
      if (marks[i * 4 + 3] < 16) continue;
      if (!body[i]) marks[i * 4 + 3] = 0;
    }
    stroke.putImageData(edged, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.drawImage(edge, 0, 0);
    const inset = Math.max(3, Math.round(Math.min(w, h) * 0.2));
    const box = digit && drawnBox(digit);
    const innerW = Math.max(1, w - inset * 2);
    const innerH = Math.max(1, h - inset * 2);
    if (box && box.w < 24 && box.h < 28) {
      const scale = Math.min(innerW / box.w, innerH / box.h);
      const dw = box.w * scale;
      const dh = box.h * scale;
      ctx.drawImage(box.canvas, box.x, box.y, box.w, box.h, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 " + Math.round(innerH * 0.86) + "px Arial";
      ctx.fillText(label || "1", x + w / 2, y + h / 2 + innerH * 0.02);
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
    let scale;
    if (active === "seahorse") {
      const targetH = colourBounds && colourBounds.height > 30 ? colourBounds.height * (inCard ? 0.62 : inRace ? 0.92 : 1.05) : 86;
      scale = targetH / span.h;
    } else {
      const fit = active === "frog" ? 0.78 : 1;
      const targetW = colourBounds && colourBounds.width > 30 ? colourBounds.width * (inCard ? 0.58 : inRace ? 1.12 : 1.42) * fit : 150;
      scale = targetW / span.w;
    }
    bitmap.scaleX = scale;
    bitmap.scaleY = scale;
    if (inCard) {
      let center = anchor;
      if (colour && colourBounds) {
        const globalCenter = colour.localToGlobal(
          colourBounds.x + colourBounds.width / 2,
          colourBounds.y + colourBounds.height / 2
        );
        center = body.globalToLocal(globalCenter.x, globalCenter.y);
        const visualW = colourBounds.width * Math.abs(colour.scaleX || 1);
        const visualH = colourBounds.height * Math.abs(colour.scaleY || 1);
        const fitted = Math.min(visualW / span.w, visualH / span.h);
        bitmap.scaleX = fitted;
        bitmap.scaleY = fitted;
      }
      bitmap.regX = span.x + span.w / 2;
      bitmap.regY = span.y + span.h / 2;
      bitmap.x = center.x;
      bitmap.y = center.y;
      return;
    }
    const pivot = packs[active] && packs[active].pivot;
    const padX = bitmap.image && bitmap.image._padX ? bitmap.image._padX : 0;
    const padY = bitmap.image && bitmap.image._padY ? bitmap.image._padY : 0;
    if (active === "seahorse") {
      bitmap.regX = span.x + span.w / 2 + padX;
      bitmap.regY = span.y + span.h / 2 + padY;
    } else if (pivot) {
      bitmap.regX = pivot.x + padX;
      bitmap.regY = pivot.y + padY;
    } else {
      bitmap.regX = span.x + span.w * 0.42 + padX;
      bitmap.regY = span.y + span.h * 0.55 + padY;
    }
    bitmap.x = anchor.x;
    bitmap.y = anchor.y;
    bitmap.rotation = 0;
    if (active === "frog" && inRace && racing) hopFrog(bitmap, anchor, colourBounds ? colourBounds.height * 0.22 : 18);
    else if (active === "turtle" && inRace && racing) paddleTurtle(bitmap);
    else if (bitmap._plate && bitmap.image !== bitmap._plate) bitmap.image = bitmap._plate;
    hideLaneNumber(body);
    if (active === "frog") placeFrogName(body, bitmap);
  }

  function hideLaneNumber(body) {
    let host = body;
    for (let i = 0; host && i < 4; i += 1) {
      const num = (host.children || []).find(function (kid) {
        return kid && kid.name === "myNum";
      });
      if (num) num.visible = false;
      host = host.parent;
    }
  }

  function nameAnchor(image) {
    if (image._nameAnchor) return image._nameAnchor;
    const width = image.width;
    const height = image.height;
    const data = image.getContext("2d").getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (data[(y * width + x) * 4 + 3] < 24) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    const anchor = {
      x: minX + Math.max(1, maxX - minX) * 0.83,
      y: minY + Math.max(1, maxY - minY) * 0.95,
    };
    image._nameAnchor = anchor;
    return anchor;
  }

  function placeFrogName(body, bitmap) {
    const character = body.parent;
    if (!character || !bitmap.image) return;
    const bubble = (character.children || []).find(function (kid) {
      return kid && kid.name === "no";
    });
    if (!bubble) return;
    const anchor = nameAnchor(bitmap.image);
    const scaleX = bitmap.scaleX || 1;
    const scaleY = bitmap.scaleY || scaleX;
    const seatX = body.x + bitmap.x + (anchor.x - bitmap.regX) * scaleX;
    const seatY = body.y + bitmap.y + (anchor.y - bitmap.regY) * scaleY;
    const bounds = bubble.nominalBounds || { x: 0, y: 0, width: 80, height: 64 };
    const tail = (bubble.children || []).find(function (kid) {
      return kid && !kid.name && kid.y > 15;
    });
    const tailX = tail ? tail.x + 8 : bounds.x + bounds.width * 0.5;
    bubble.x = seatX - tailX;
    bubble.y = seatY - (bounds.y + bounds.height);
  }

  let racing = false;

  function readRacing() {
    let found = false;
    let running = false;
    function walk(node) {
      if (!node || found) return;
      if (node.name === "tStart") {
        found = true;
        running = node.text === "Pause";
        return;
      }
      (node.children || []).forEach(walk);
    }
    if (window.exportRoot) walk(window.exportRoot);
    racing = running;
  }

  function hopFrog(bitmap, anchor, lift) {
    if (bitmap._hopPhase == null) {
      const match = String(bitmap._number || "").match(/(\d)\s*$/);
      bitmap._hopPhase = match ? Number(match[1]) * 0.41 : 0;
    }
    const period = 480;
    const cycle = ((Date.now() + bitmap._hopPhase * period) % period) / period;
    const hop = cycle < 0.62 ? Math.sin((cycle / 0.62) * Math.PI) : 0;
    bitmap.y = anchor.y - hop * lift;
    bitmap.x = anchor.x + hop * lift * 0.18;
    bitmap.rotation = -hop * 8;
    bitmap.scaleY *= 1 + hop * 0.1;
    bitmap.scaleX *= 1 - hop * 0.06;
  }

  function makeBitmap(number, digit, label, source, lookFrame, lookHost) {
    const key = number || "plain";
    if (!plates.has(key)) plates.set(key, stampNumber(digit, label, source, lookFrame, lookHost));
    const bitmap = new createjs.Bitmap(plates.get(key));
    bitmap.name = "raceFish";
    bitmap.mouseEnabled = false;
    bitmap._number = key;
    bitmap._plate = plates.get(key);
    return bitmap;
  }

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const yi = points[i][1];
      const yj = points[j][1];
      const xi = points[i][0];
      const xj = points[j][0];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1) + xi) inside = !inside;
    }
    return inside;
  }

  function inTurtleBelly(x, y, box) {
    const rx = (x - box.x) / box.w;
    const ry = (y - box.y) / box.h;
    return rx > 0.18 && rx < 0.58 && ry > 0.64 && ry < 0.88;
  }

  function inTurtleShell(x, y, box) {
    const nx = (x - (box.x + box.w * 0.37)) / (box.w * 0.22);
    const ny = (y - (box.y + box.h * 0.34)) / (box.h * 0.27);
    return nx * nx + ny * ny <= 1;
  }

  function turtleLimbs(source) {
    const box = measureOpaque(source);
    const specs = [
      {
        pivot: [0.08, 0.78],
        polygon: [[0.00, 0.80], [0.14, 0.76], [0.15, 0.90], [0.08, 1.00], [0.00, 0.94]],
      },
      {
        pivot: [0.60, 0.80],
        polygon: [[0.54, 0.82], [0.74, 0.78], [0.78, 0.94], [0.62, 1.02], [0.52, 0.92]],
      },
    ];
    const image = source.getContext("2d").getImageData(0, 0, source.width, source.height);
    const data = image.data;
    return specs.map(function (spec) {
      const points = spec.polygon.map(function (point) {
        return [box.x + point[0] * box.w, box.y + point[1] * box.h];
      });
      let minX = source.width;
      let minY = source.height;
      let maxX = 0;
      let maxY = 0;
      points.forEach(function (point) {
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
      });
      minX = Math.max(0, Math.floor(minX) - 8);
      minY = Math.max(0, Math.floor(minY) - 8);
      maxX = Math.min(source.width - 1, Math.ceil(maxX) + 8);
      maxY = Math.min(source.height - 1, Math.ceil(maxY) + 8);
      const mask = new Uint8Array(source.width * source.height);
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (!pointInPolygon(x, y, points)) continue;
          if ((y - box.y) / box.h < 0.76) continue;
          if (inTurtleShell(x, y, box) || inTurtleBelly(x, y, box)) continue;
          const from = (y * source.width + x) * 4;
          if (data[from + 3] < 20) continue;
          const red = data[from];
          const green = data[from + 1];
          const blue = data[from + 2];
          if (red > 220 && green > 220 && blue > 220) continue;
          if (red > 160 && green > 120 && blue < 170 && red > blue + 30) continue;
          mask[y * source.width + x] = 1;
        }
      }
      for (let pass = 0; pass < 6; pass += 1) {
        const grow = [];
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const index = y * source.width + x;
            if (!mask[index]) continue;
            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= source.width || ny >= source.height) continue;
                if (!pointInPolygon(nx, ny, points) || (ny - box.y) / box.h < 0.76) continue;
                if (inTurtleShell(nx, ny, box) || inTurtleBelly(nx, ny, box)) continue;
                const next = ny * source.width + nx;
                if (mask[next]) continue;
                const from = next * 4;
                if (data[from + 3] < 20) continue;
                if (Math.max(data[from], data[from + 1], data[from + 2]) > 80) continue;
                grow.push(next);
              }
            }
          }
        }
        grow.forEach(function (index) { mask[index] = 1; });
      }
      let cutMinX = source.width;
      let cutMinY = source.height;
      let cutMaxX = 0;
      let cutMaxY = 0;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (!mask[y * source.width + x]) continue;
          if (x < cutMinX) cutMinX = x;
          if (y < cutMinY) cutMinY = y;
          if (x > cutMaxX) cutMaxX = x;
          if (y > cutMaxY) cutMaxY = y;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, cutMaxX - cutMinX + 1);
      canvas.height = Math.max(1, cutMaxY - cutMinY + 1);
      const cut = canvas.getContext("2d").createImageData(canvas.width, canvas.height);
      for (let y = cutMinY; y <= cutMaxY; y += 1) {
        for (let x = cutMinX; x <= cutMaxX; x += 1) {
          if (!mask[y * source.width + x]) continue;
          const from = (y * source.width + x) * 4;
          const to = ((y - cutMinY) * canvas.width + (x - cutMinX)) * 4;
          cut.data[to] = data[from];
          cut.data[to + 1] = data[from + 1];
          cut.data[to + 2] = data[from + 2];
          cut.data[to + 3] = data[from + 3];
        }
      }
      canvas.getContext("2d").putImageData(cut, 0, 0);
      const absX = box.x + spec.pivot[0] * box.w;
      const absY = box.y + spec.pivot[1] * box.h;
      return { canvas: canvas, mask: mask, pivotX: absX - cutMinX, pivotY: absY - cutMinY, absX: absX, absY: absY };
    });
  }

  function eraseTurtleLegs(plate) {
    const legs = packs.turtle && packs.turtle.legs;
    const canvas = document.createElement("canvas");
    canvas.width = plate.width;
    canvas.height = plate.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(plate, 0, 0);
    if (!legs) return canvas;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    legs.forEach(function (leg) {
      if (!leg.mask || leg.mask.length !== data.length / 4) return;
      for (let index = 0; index < leg.mask.length; index += 1) {
        if (leg.mask[index]) data[index * 4 + 3] = 0;
      }
    });
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function paddleTurtle(bitmap) {
    const legs = packs.turtle && packs.turtle.legs;
    const plate = bitmap._plate;
    if (!legs || !plate) return;
    if (!bitmap._body) bitmap._body = eraseTurtleLegs(plate);
    if (!bitmap._paddle) {
      bitmap._paddle = document.createElement("canvas");
      bitmap._paddle.width = plate.width;
      bitmap._paddle.height = plate.height;
    }
    if (bitmap._hopPhase == null) {
      const match = String(bitmap._number || "").match(/(\d)\s*$/);
      bitmap._hopPhase = match ? Number(match[1]) * 0.37 : 0;
    }
    const swing = Math.sin(Date.now() / 150 + bitmap._hopPhase * Math.PI * 2);
    const ctx = bitmap._paddle.getContext("2d");
    ctx.clearRect(0, 0, bitmap._paddle.width, bitmap._paddle.height);
    ctx.drawImage(bitmap._body, 0, 0);
    legs.forEach(function (leg, index) {
      const angle = swing * (index === 0 ? 0.5 : -0.58);
      ctx.save();
      ctx.translate(leg.absX, leg.absY);
      ctx.rotate(angle);
      ctx.drawImage(leg.canvas, -leg.pivotX, -leg.pivotY);
      ctx.restore();
      mendTurtleJoint(ctx, plate, leg.absX, leg.absY, 28);
    });
    bitmap.image = bitmap._paddle;
  }

  function mendTurtleJoint(ctx, plate, cx, cy, radius) {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(ctx.canvas.width, Math.ceil(cx + radius));
    const y1 = Math.min(ctx.canvas.height, Math.ceil(cy + radius));
    const width = x1 - x0;
    const height = y1 - y0;
    if (width <= 0 || height <= 0) return;
    const source = plate.getContext("2d").getImageData(x0, y0, width, height).data;
    const image = ctx.getImageData(x0, y0, width, height);
    const data = image.data;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = x0 + x - cx;
        const dy = y0 + y - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
        const index = (y * width + x) * 4;
        if (source[index + 3] < 20) continue;
        const red = source[index];
        const green = source[index + 1];
        const blue = source[index + 2];
        if (Math.max(red, green, blue) < 90) continue;
        if (red > 220 && green > 220 && blue > 220) continue;
        data[index] = red;
        data[index + 1] = green;
        data[index + 2] = blue;
        data[index + 3] = source[index + 3];
      }
    }
    ctx.putImageData(image, x0, y0);
  }

  let wetArt = null;
  let wetSource = null;
  let wetStart = 0;
  let wetEnd = 0;

  function submergedArt(start, end) {
    if (wetArt && wetSource === art && wetStart === start && wetEnd === end) return wetArt;
    const span = fishOpaque();
    const canvas = document.createElement("canvas");
    canvas.width = art.width;
    canvas.height = art.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(art, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const fadeTop = span.y + span.h * start;
    const fadeBottom = span.y + span.h * end;
    const spanPx = Math.max(1, fadeBottom - fadeTop);
    for (let y = Math.floor(fadeTop); y < canvas.height; y += 1) {
      const keep = y >= fadeBottom ? 0 : 1 - (y - fadeTop) / spanPx;
      const row = y * canvas.width;
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (row + x) * 4 + 3;
        data[offset] = Math.round(data[offset] * keep);
      }
    }
    ctx.putImageData(image, 0, 0);
    wetArt = canvas;
    wetSource = art;
    wetStart = start;
    wetEnd = end;
    return canvas;
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
    let host = node;
    let picture = null;
    while (host) {
      if (/^character\d/.test(host.name || "")) {
        if (active === "seahorse") picture = submergedArt(0.53, 0.66);
        else if (active === "costume" || active === "yellow" || active === "colors") picture = submergedArt(0.84, 0.97);
      }
      host = host.parent;
    }
    const lookFrame = active === "frog" || ((active === "seahorse" || species === "fish") && hatsLive) ? frogLookFrame(node, label) : 0;
    const color = active === "frog" ? frogColor(node) : 0;
    const number = active + ":" + (digit ? "d" + digit.id : "n" + (label || "1")) + (picture ? ":wet" : "") + (lookFrame ? ":look" + lookFrame : "") + (color ? ":c" + color : "");
    if (color) picture = tintFrog(picture || art, color);
    let fish = node.children.find(function (kid) {
      return kid && kid.name === "raceFish";
    });
    if (!fish || fish._number !== number) {
      if (fish) node.removeChild(fish);
      fish = makeBitmap(number, digit, label || "1", picture, lookFrame, node);
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
      if (node.name === "bg" && ((node.cacheCanvas && node.cacheCanvas.width > 800) || node._lakeReady)) ready = true;
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

  let speciesBar = null;
  let speciesBitmap = null;
  let speciesSlots = [];
  let speciesStamp = "";

  function listIsOpen() {
    const settings = findSettings();
    const list = settings && settings.list;
    if (!list) return false;
    return !!((list.btn_done && list.btn_done.parent) || (list.listCover && list.listCover.parent));
  }

  function roundBar(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function paintSpeciesBar() {
    if (!window.createjs || !window.exportRoot) return;
    const kinds = ["duck", "fish", "frog", "turtle", "seahorse"];
    const labels = { duck: "Duck", fish: "Fish", frog: "Frog", turtle: "Turtle", seahorse: "Seahorse" };
    const font = "700 26px 'Segoe UI', 'Trebuchet MS', Arial, sans-serif";
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = font;
    const icon = 64;
    const gap = 12;
    const padL = 14;
    const padR = 26;
    const padY = 10;
    const barPad = 10;
    const pixel = 2;
    const widths = kinds.map(function (kind) {
      return padL + icon + gap + Math.ceil(measure.measureText(labels[kind]).width) + padR;
    });
    const btnH = padY * 2 + icon;
    const barW = barPad * 2 + widths.reduce(function (sum, width) { return sum + width; }, 0);
    const barH = barPad * 2 + btnH;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(barW * pixel);
    canvas.height = Math.ceil(barH * pixel);
    const ctx = canvas.getContext("2d");
    ctx.scale(pixel, pixel);
    roundBar(ctx, 1, 1, barW - 2, barH - 2, barH / 2);
    const bg = ctx.createLinearGradient(0, 0, 0, barH);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#f6fbff");
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(186,214,232,0.95)";
    ctx.stroke();
    speciesSlots = [];
    let x = barPad;
    kinds.forEach(function (kind, index) {
      const w = widths[index];
      const selected = kind === species;
      const prevSelected = index > 0 && kinds[index - 1] === species;
      if (selected) {
        roundBar(ctx, x + 2, barPad + 2, w - 4, btnH - 4, (btnH - 4) / 2);
        const fill = ctx.createLinearGradient(0, barPad, 0, barPad + btnH);
        fill.addColorStop(0, "#e8f4ff");
        fill.addColorStop(1, "#d3e9fc");
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(146,194,228,0.75)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (index > 0 && !prevSelected) {
        ctx.fillStyle = "#d7e4ef";
        ctx.fillRect(x, barPad + btnH * 0.24, 1, btnH * 0.52);
      }
      ctx.drawImage(paintToggleIcon(kind), x + padL, barPad + padY, icon, icon);
      ctx.fillStyle = "#2a4560";
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[kind], x + padL + icon + gap, barPad + btnH / 2);
      speciesSlots.push({ kind: kind, x: x * pixel, w: w * pixel, h: barH * pixel });
      x += w;
    });
    if (!speciesBar) {
      speciesBar = new createjs.Container();
      speciesBar.name = "speciesBar";
      speciesBar.cursor = "pointer";
      speciesBar.mouseChildren = false;
      speciesBitmap = new createjs.Bitmap(canvas);
      speciesBar.addChild(speciesBitmap);
      speciesBar.on("mousedown", function (evt) {
        if (!speciesBitmap) return;
        const local = speciesBitmap.globalToLocal(evt.stageX, evt.stageY);
        const slot = speciesSlots.find(function (item) {
          return local.x >= item.x && local.x < item.x + item.w && local.y >= 0 && local.y <= item.h;
        });
        if (slot) choose(slot.kind);
      });
      window.exportRoot.addChild(speciesBar);
    } else {
      speciesBitmap.image = canvas;
      if (speciesBitmap.sourceRect) speciesBitmap.sourceRect = null;
    }
    speciesBar.slots = speciesSlots;
    speciesBar._layoutW = barW;
    speciesBar._layoutH = barH;
    speciesStamp = species + ":" + (packs.yellow ? "1" : "0") + (packs.frog ? "1" : "0") + (packs.turtle ? "1" : "0") + (packs.seahorse ? "1" : "0");
  }

  function placeToggle() {
    const legacy = document.getElementById("species-switch");
    if (legacy) legacy.remove();
    const settings = findSettings();
    const show = !!(settings && settings.visible !== false && !listIsOpen());
    if (!window.createjs || !window.exportRoot || !window.stage) return;
    const stamp = species + ":" + (packs.yellow ? "1" : "0") + (packs.frog ? "1" : "0") + (packs.turtle ? "1" : "0") + (packs.seahorse ? "1" : "0");
    if (!speciesBar || stamp !== speciesStamp) paintSpeciesBar();
    if (!speciesBar || !speciesBitmap || !speciesBitmap.image) return;
    if (!speciesBar.parent) window.exportRoot.addChild(speciesBar);
    speciesBar.visible = show;
    if (!show) {
      if (habitatBar) habitatBar.visible = false;
      return;
    }
    const stage = window.stage;
    const sx = stage.scaleX || 1;
    const sy = stage.scaleY || 1;
    const pixel = 2;
    const cssW = stage.canvas.clientWidth || stage.canvas.width;
    const ratio = stage.canvas.width / cssW || 1;
    const viewW = stage.canvas.width / sx;
    const viewH = stage.canvas.height / sy;
    let fit = 1;
    if (speciesBar._layoutW > cssW - 24) fit = (cssW - 24) / speciesBar._layoutW;
    speciesBitmap.scaleX = ratio * fit / (pixel * sx);
    speciesBitmap.scaleY = ratio * fit / (pixel * sy);
    const w = speciesBar._layoutW * ratio * fit / sx;
    const h = speciesBar._layoutH * ratio * fit / sy;
    const top = window.exportRoot.globalToLocal(0, 0);
    const bottom = window.exportRoot.globalToLocal(viewW, viewH);
    speciesBar.x = top.x + ((bottom.x - top.x) - w) / 2;
    speciesBar.y = bottom.y - h - (8 * ratio / sy);
    speciesBar.parent.setChildIndex(speciesBar, speciesBar.parent.numChildren - 1);
    placeHabitat(show, top, bottom, sx, sy, ratio);
  }

  let habitatBar = null;
  let habitatBitmap = null;
  let habitatSlots = [];
  let habitatStamp = "";

  function paintHabitatBar() {
    const api = window.duckHabitats;
    if (!api || !window.createjs || !window.exportRoot) return;
    const kinds = api.order;
    const pixel = 2;
    const cardW = 142;
    const cardH = 88;
    const gap = 7;
    const pad = 8;
    const barW = pad * 2 + cardW;
    const barH = pad * 2 + kinds.length * cardH + (kinds.length - 1) * gap;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(barW * pixel);
    canvas.height = Math.ceil(barH * pixel);
    const ctx = canvas.getContext("2d");
    ctx.scale(pixel, pixel);
    ctx.save();
    ctx.shadowColor = "rgba(24, 58, 82, 0.22)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundBar(ctx, 1, 1, barW - 2, barH - 2, 20);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fill();
    ctx.restore();
    roundBar(ctx, 1, 1, barW - 2, barH - 2, 20);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(186,214,232,0.95)";
    ctx.stroke();
    habitatSlots = [];
    kinds.forEach(function (kind, index) {
      const x = pad;
      const y = pad + index * (cardH + gap);
      const selected = kind === api.current();
      roundBar(ctx, x, y, cardW, cardH, 14);
      ctx.fillStyle = selected ? "#e7f3ff" : "#f8fbfe";
      ctx.fill();
      ctx.save();
      roundBar(ctx, x + 6, y + 6, cardW - 12, 48, 9);
      ctx.clip();
      const thumb = document.createElement("canvas");
      thumb.width = cardW - 12;
      thumb.height = 48;
      api.paint(thumb.getContext("2d"), thumb.width, thumb.height, kind);
      ctx.drawImage(thumb, x + 6, y + 6, cardW - 12, 48);
      ctx.restore();
      ctx.strokeStyle = selected ? "#2f86c4" : "rgba(186,214,232,0.9)";
      ctx.lineWidth = selected ? 2.5 : 1;
      roundBar(ctx, x, y, cardW, cardH, 14);
      ctx.stroke();
      ctx.fillStyle = "#1f3d57";
      ctx.font = "700 14px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(api.labels[kind], x + cardW / 2, y + 66);
      ctx.fillStyle = "#6d8798";
      ctx.font = "11px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(api.suits[kind], x + cardW / 2, y + 80);
      habitatSlots.push({ kind: kind, x: x * pixel, y: y * pixel, w: cardW * pixel, h: cardH * pixel });
    });
    if (!habitatBar) {
      habitatBar = new createjs.Container();
      habitatBar.name = "habitatBar";
      habitatBar.cursor = "pointer";
      habitatBar.mouseChildren = false;
      habitatBitmap = new createjs.Bitmap(canvas);
      habitatBar.addChild(habitatBitmap);
      habitatBar.on("mousedown", function (evt) {
        if (!habitatBitmap || !window.duckHabitats) return;
        const local = habitatBitmap.globalToLocal(evt.stageX, evt.stageY);
        const slot = habitatSlots.find(function (item) {
          return local.x >= item.x && local.x < item.x + item.w && local.y >= item.y && local.y < item.y + item.h;
        });
        if (slot) window.duckHabitats.select(slot.kind);
      });
      window.exportRoot.addChild(habitatBar);
    } else {
      habitatBitmap.image = canvas;
      if (habitatBitmap.sourceRect) habitatBitmap.sourceRect = null;
    }
    habitatBar._layoutW = barW;
    habitatBar._layoutH = barH;
    habitatStamp = api.current();
  }

  function placeHabitat(show, top, bottom, sx, sy, ratio) {
    const api = window.duckHabitats;
    if (!api) return;
    if (!show) {
      if (habitatBar) habitatBar.visible = false;
      return;
    }
    if (!habitatBar || habitatStamp !== api.current()) paintHabitatBar();
    if (!habitatBar || !habitatBitmap || !habitatBitmap.image || !speciesBar) return;
    if (!habitatBar.parent) window.exportRoot.addChild(habitatBar);
    habitatBar.visible = true;
    const pixel = 2;
    const marginX = 14 * ratio / sx;
    const marginY = 12 * ratio / sy;
    const viewW = bottom.x - top.x;
    const bandTop = top.y + marginY;
    const bandH = Math.max(80, speciesBar.y - marginY - bandTop);
    const maxW = viewW * 0.145 - marginX;
    let fit = Math.min(1, (maxW * sx) / (habitatBar._layoutW * ratio), (bandH * sy) / (habitatBar._layoutH * ratio));
    if (!Number.isFinite(fit) || fit <= 0) fit = 1;
    habitatBitmap.scaleX = ratio * fit / (pixel * sx);
    habitatBitmap.scaleY = ratio * fit / (pixel * sy);
    const w = habitatBar._layoutW * ratio * fit / sx;
    const h = habitatBar._layoutH * ratio * fit / sy;
    habitatBar.x = bottom.x - w - marginX;
    habitatBar.y = bandTop + Math.max(0, (bandH - h) / 2);
    habitatBar.parent.setChildIndex(habitatBar, habitatBar.parent.numChildren - 1);
  }

  function countRaceBodies(node) {
    let total = 0;
    function walk(current, card) {
      if (!current || !current.children) return;
      const inside = card || current.name === "choiceToggle";
      const duck = current.children.some(function (kid) {
        return kid && kid.name === "duckColour";
      });
      if (duck && !inside) {
        const label = parseInt(readNumber(current), 10);
        if (Number.isFinite(label) && label > 0) total += 1;
      }
      current.children.forEach(function (kid) {
        walk(kid, inside);
      });
    }
    walk(node, false);
    return total;
  }

  function hook(stage) {
    if (hooked) return;
    hooked = true;
    const original = stage.update.bind(stage);
    stage.update = function () {
      readRacing();
      const settings = findSettings();
      const onTrack = (species === "frog" || species === "seahorse" || species === "fish") && (racing || (settings && settings.visible === false));
      if (!onTrack) {
        if (hatsLive) {
          hatsLive = false;
          hatSawRacing = false;
          hatFinished = false;
          hatDeck = null;
          colorDeck = null;
          skinned.forEach(function (body) {
            body._frogHat = null;
            body._frogColor = null;
          });
        }
      } else if (!hatsLive || (racing && hatFinished)) {
        hatsLive = true;
        hatFinished = false;
        hatDeck = null;
        colorDeck = null;
        skinned.forEach(function (body) {
          body._frogHat = null;
          body._frogColor = null;
        });
        shuffleHatDeck(countRaceBodies(window.exportRoot));
        shuffleColorDeck();
      } else if (!racing && hatSawRacing) {
        hatFinished = true;
      }
      if (onTrack) hatSawRacing = racing;
      if (species !== "duck" && canSkin()) {
        const style = species === "fish" ? currentStyle() : species;
        if (packs[style]) {
          useStyle(style);
          applyFish(window.exportRoot);
        }
      } else if (species === "duck" && window.exportRoot) restore(window.exportRoot);
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
    } else if (kind === "fish" && packs.yellow) {
      const bounds = fishBounds(packs.yellow.canvas);
      ctx.drawImage(packs.yellow.canvas, bounds.x, bounds.y, bounds.w, bounds.h, 4, 14, 56, 36);
    } else if (kind === "frog" && packs.frog) {
      const bounds = fishBounds(packs.frog.canvas);
      ctx.drawImage(packs.frog.canvas, bounds.x, bounds.y, bounds.w, bounds.h, 6, 8, 52, 48);
    } else if (kind === "turtle" && packs.turtle) {
      const bounds = fishBounds(packs.turtle.canvas);
      ctx.drawImage(packs.turtle.canvas, bounds.x, bounds.y, bounds.w, bounds.h, 2, 16, 60, 34);
    } else if (kind === "seahorse" && packs.seahorse) {
      const bounds = fishBounds(packs.seahorse.canvas);
      const dw = Math.max(8, Math.round(56 * bounds.w / bounds.h));
      const dx = Math.round((64 - dw) / 2);
      ctx.drawImage(packs.seahorse.canvas, bounds.x, bounds.y, bounds.w, bounds.h, dx, 4, dw, 56);
    }
    return canvas;
  }

  function syncToggle() {
    speciesStamp = "";
  }

  function choose(next) {
    if (next === species) return;
    species = next;
    localStorage.setItem(SPECIES_KEY, species);
    if (window.duckHabitats) window.duckHabitats.select(window.duckHabitats.forSpecies(species));
    if (species === "duck" && window.exportRoot) restore(window.exportRoot);
    if (window.stage) window.stage.update();
    syncToggle();
  }

  function mountToggle() {
    const legacy = document.getElementById("species-switch");
    if (legacy) legacy.remove();
  }

  function refreshIcons() {
    speciesStamp = "";
  }

  function boot() {
    let fishReady = null;
    let frogReady = null;
    let turtleReady = null;
    let seahorseReady = null;
    let fishBadge = null;
    function tryBoot() {
      if (!fishReady || !frogReady || !turtleReady || !seahorseReady || !fishBadge) return;
      badge = fishBadge;
      buildPacks(fishReady);
      prepareAnimal(frogReady, "frog", { x: 0.08, y: 0.42, w: 0.16, h: 0.18 });
      prepareAnimal(turtleReady, "turtle", { x: 0.16, y: 0.46, w: 0.14, h: 0.22 });
      packs.turtle.legs = turtleLimbs(packs.turtle.canvas);
      prepareAnimal(seahorseReady, "seahorse", { x: 0.38, y: 0.37, w: 0.26, h: 0.13 });
      useStyle(species === "frog" || species === "turtle" || species === "seahorse" ? species : "yellow");
      mountToggle();
      refreshIcons();
      if (window.stage && window.exportRoot) {
        hook(window.stage);
        if (species !== "duck") window.stage.update();
      }
    }
    function load(src, done) {
      const img = new Image();
      img.onload = function () { done(knockout(img)); };
      img.src = src;
    }
    load("fish-ref.jpg", function (canvas) {
      fishReady = canvas;
      fishBadge = badge;
      tryBoot();
    });
    load("frog-ref.jpg", function (canvas) {
      frogReady = canvas;
      tryBoot();
    });
    load("turtle-ref.jpg", function (canvas) {
      turtleReady = canvas;
      tryBoot();
    });
    load("seahorse-ref.jpg", function (canvas) {
      seahorseReady = canvas;
      tryBoot();
    });
    const wait = window.setInterval(function () {
      if (!window.stage || !window.exportRoot || !document.getElementById("animation_container")) return;
      window.clearInterval(wait);
      mountToggle();
      if (art) {
        refreshIcons();
        hook(window.stage);
      }
    }, 200);
  }

  boot();
})();
