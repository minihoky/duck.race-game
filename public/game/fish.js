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

  function buildPacks(source) {
    const plate = badge;
    ["costume", "yellow", "colors"].forEach(function (kind) {
      const canvas = recolor(source, kind);
      packs[kind] = { canvas: canvas, badge: plate, opaque: measureOpaque(canvas) };
    });
  }

  function prepareAnimal(canvas, name, spot) {
    const box = measureOpaque(canvas);
    const plate = {
      x: Math.round(box.x + box.w * spot.x),
      y: Math.round(box.y + box.h * spot.y),
      w: Math.round(box.w * spot.w),
      h: Math.round(box.h * spot.h),
    };
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#161616";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(10, box.w * 0.012);
    ctx.beginPath();
    ctx.roundRect(plate.x, plate.y, plate.w, plate.h, Math.min(plate.w, plate.h) * 0.28);
    ctx.fill();
    ctx.stroke();
    packs[name] = { canvas: canvas, badge: plate, opaque: measureOpaque(canvas) };
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

  function stampNumber(digit, label, source) {
    const picture = source || art;
    const canvas = document.createElement("canvas");
    canvas.width = picture.width;
    canvas.height = picture.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(picture, 0, 0);
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
    if (active === "seahorse") {
      bitmap.regX = span.x + span.w / 2;
      bitmap.regY = span.y + span.h / 2;
    } else {
      bitmap.regX = badge ? badge.x + badge.w / 2 : span.x + span.w * 0.42;
      bitmap.regY = badge ? badge.y + badge.h / 2 : span.y + span.h * 0.55;
    }
    bitmap.x = anchor.x;
    bitmap.y = anchor.y;
    bitmap.rotation = 0;
    if (active === "frog" && inRace && racing) hopFrog(bitmap, anchor, colourBounds ? colourBounds.height * 0.22 : 18);
    else if (active === "turtle" && inRace && racing) paddleTurtle(bitmap);
    else if (bitmap._plate && bitmap.image !== bitmap._plate) bitmap.image = bitmap._plate;
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

  function makeBitmap(number, digit, label, source) {
    const key = number || "plain";
    if (!plates.has(key)) plates.set(key, stampNumber(digit, label, source));
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

  function turtleLimbs(source) {
    const box = measureOpaque(source);
    const specs = [
      {
        pivot: [0.14, 0.63],
        polygon: [[0.00, 0.63], [0.18, 0.60], [0.20, 0.82], [0.12, 0.97], [0.00, 0.90]],
      },
      {
        pivot: [0.56, 0.73],
        polygon: [[0.50, 0.73], [0.76, 0.70], [0.78, 0.92], [0.58, 1.02], [0.48, 0.90]],
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
          const from = (y * source.width + x) * 4;
          if (data[from + 3] < 20) continue;
          const red = data[from];
          const green = data[from + 1];
          const blue = data[from + 2];
          if (red > 220 && green > 220 && blue > 220) continue;
          if (red > 180 && green > 150 && blue < 150) continue;
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
      mendTurtleJoint(ctx, plate, leg.absX, leg.absY, 58);
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
    const number = active + ":" + (digit ? "d" + digit.id : "n" + (label || "1")) + (picture ? ":wet" : "");
    let fish = node.children.find(function (kid) {
      return kid && kid.name === "raceFish";
    });
    if (!fish || fish._number !== number) {
      if (fish) node.removeChild(fish);
      fish = makeBitmap(number, digit, label || "1", picture);
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
      readRacing();
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
      "#species-switch button{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#fff;font:800 16px/1 'Trebuchet MS','Segoe UI',Arial,sans-serif;border-radius:999px;padding:4px 10px 4px 5px;cursor:pointer;white-space:nowrap}",
      "#species-switch button.is-on{background:#3dce2b}",
      "#species-switch canvas{width:36px !important;height:36px !important;display:block !important;flex:0 0 36px !important;position:static !important;background:transparent !important}",
    ].join("");
    document.head.appendChild(style);
    const bar = document.createElement("div");
    bar.id = "species-switch";
    const labels = { duck: "Duck", fish: "Fish", frog: "Frog", turtle: "Turtle", seahorse: "Seahorse" };
    ["duck", "fish", "frog", "turtle", "seahorse"].forEach(function (kind) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.species = kind;
      button.appendChild(paintToggleIcon(kind));
      button.appendChild(document.createTextNode(labels[kind]));
      button.addEventListener("click", function () {
        choose(kind);
      });
      button.style.cssText = "display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#fff;font:800 16px/1 'Trebuchet MS','Segoe UI',Arial,sans-serif;border-radius:999px;padding:4px 10px 4px 5px;cursor:pointer;white-space:nowrap;";
      const icon = button.querySelector("canvas");
      if (icon) icon.style.cssText = "width:36px;height:36px;display:block;flex:0 0 36px;position:static;background:transparent;";
      bar.appendChild(button);
    });
    host.appendChild(bar);
    syncToggle();
  }

  function refreshIcons() {
    ["fish", "frog", "turtle", "seahorse"].forEach(function (kind) {
      const icon = document.querySelector('#species-switch button[data-species="' + kind + '"] canvas');
      if (!icon) return;
      const next = paintToggleIcon(kind);
      next.style.cssText = icon.style.cssText;
      icon.replaceWith(next);
    });
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
