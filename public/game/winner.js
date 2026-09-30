(function () {
  const LABELS = { duck: "Duck", fish: "Fish", frog: "Frog", turtle: "Turtle", seahorse: "Seahorse" };
  const COLORS = ["#ffe56a", "#ff4d6d", "#3ec6ff", "#7dff6a", "#e879f9", "#ff9a3c", "#fff6c8", "#ff77c8", "#67e8f9", "#facc15"];
  let running = false;
  let shown = false;
  let overlay = null;
  let canvas = null;
  let ctx = null;
  let bits = [];
  let last = 0;
  let raf = 0;
  let nextBurst = 0;
  let opened = false;

  function species() {
    let saved = "";
    try { saved = localStorage.getItem("duck-race-species") || ""; } catch (error) { saved = ""; }
    return LABELS[saved] ? saved : "duck";
  }

  function title() {
    const id = new URLSearchParams(window.location.search).get("official");
    if (!id) return "Duck Race";
    try {
      const setup = JSON.parse(sessionStorage.getItem("duck-official-setup") || "null");
      if (setup && setup.id === id && setup.name) return String(setup.name);
    } catch (error) { /* the canvas race still has a title */ }
    return "Duck Race";
  }

  function find(node, name, depth) {
    if (!node || depth > 12) return null;
    if (node.name === name) return node;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i += 1) {
      const found = find(kids[i], name, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function texts(node, bag, depth) {
    if (!node || depth > 10) return;
    if (node.text != null && String(node.text).trim()) bag.push(node);
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i += 1) texts(kids[i], bag, depth + 1);
  }

  function characters() {
    const list = [];
    function walk(node, depth) {
      if (!node || depth > 8) return;
      if (/^character\d/.test(node.name || "")) list.push(node);
      const kids = node.children || [];
      for (let i = 0; i < kids.length; i += 1) walk(kids[i], depth + 1);
    }
    if (window.exportRoot) walk(window.exportRoot, 0);
    return list;
  }

  function placeOf(node) {
    try {
      return node.localToGlobal(0, 0).x;
    } catch (error) {
      return node.x || 0;
    }
  }

  function readRacer(node) {
    const bag = [];
    texts(node, bag, 0);
    const direct = node.myNum && node.myNum.text != null ? String(node.myNum.text).trim() : "";
    const numberNode = bag.find(function (item) {
      return item.name === "myNum" && /^\d+$/.test(String(item.text).trim());
    });
    const nameNode = bag.find(function (item) {
      return item.name === "txt" && String(item.text).trim();
    });
    return {
      number: /^\d+$/.test(direct) ? direct : (numberNode ? String(numberNode.text).trim() : ""),
      name: nameNode ? String(nameNode.text).trim() : "",
      x: placeOf(node),
      node: node,
    };
  }

  function winnerFromStage(winnerName) {
    const wanted = String(winnerName || "").trim().toLowerCase();
    const racers = characters().map(readRacer);
    let match = null;
    let lead = null;
    racers.forEach(function (racer) {
      if (!lead || racer.x > lead.x) lead = racer;
      if (wanted && racer.name.toLowerCase() === wanted) match = racer;
    });
    const chosen = match || lead || { name: winnerName || "", number: "" };
    return {
      name: chosen.name || winnerName || "Winner",
      number: chosen.number || "",
      node: chosen.node || null,
    };
  }

  function findArt(node, depth) {
    if (!node || depth > 8) return null;
    if (node.name === "raceFish" && node._open) return node._open;
    if (node.name === "raceFish" && node._plate && node._plate._plain) return node._plate._plain;
    if (node.name === "raceFish" && node.image) return node.image;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i += 1) {
      const found = findArt(kids[i], depth + 1);
      if (found) return found;
    }
    return null;
  }

  function portraitOf(node) {
    if (!node) return "";
    const art = findArt(node, 0);
    let plate = art;
    if (!plate && node.draw) {
      const hidden = [];
      function mute(item, depth) {
        if (!item || depth > 8) return;
        if (item.name === "no" || item.name === "myNum") {
          hidden.push(item);
          item.visible = false;
        }
        const kids = item.children || [];
        for (let i = 0; i < kids.length; i += 1) mute(kids[i], depth + 1);
      }
      mute(node, 0);
      const size = 1600;
      plate = document.createElement("canvas");
      plate.width = size;
      plate.height = size;
      const pen = plate.getContext("2d");
      pen.translate(size / 2, size / 2);
      try { node.draw(pen, true); } catch (error) { plate = null; }
      hidden.forEach(function (item) { item.visible = true; });
    }
    if (!plate) return "";
    const pen = plate.getContext("2d");
    const pixels = pen.getImageData(0, 0, plate.width, plate.height);
    const data = pixels.data;
    let minX = plate.width;
    let minY = plate.height;
    let maxX = 0;
    let maxY = 0;
    for (let py = 0; py < plate.height; py += 2) {
      for (let px = 0; px < plate.width; px += 2) {
        if (data[(py * plate.width + px) * 4 + 3] < 20) continue;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
    }
    if (maxX <= minX || maxY <= minY) return "";
    const margin = 18;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(plate.width - 1, maxX + margin);
    maxY = Math.min(plate.height - 1, maxY + margin);
    const cut = document.createElement("canvas");
    cut.width = maxX - minX + 1;
    cut.height = maxY - minY + 1;
    cut.getContext("2d").drawImage(plate, minX, minY, cut.width, cut.height, 0, 0, cut.width, cut.height);
    return cut.toDataURL("image/png");
  }

  function trophyArt() {
    return '<svg viewBox="0 0 160 188" aria-hidden="true"><defs><linearGradient id="cup" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7c8"/><stop offset="0.45" stop-color="#ffd15c"/><stop offset="1" stop-color="#e08912"/></linearGradient><linearGradient id="stem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#c98412"/></linearGradient></defs><ellipse cx="80" cy="168" rx="46" ry="10" fill="rgba(0,0,0,.28)"/><path d="M46 34h68c2 28-8 48-34 54-26-6-36-26-34-54z" fill="url(#cup)" stroke="#fff3b0" stroke-width="3"/><path d="M58 42c8 18 36 18 44 0" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="4" stroke-linecap="round"/><path d="M46 42c-16 2-24 16-18 28 6 10 18 10 24-2" fill="none" stroke="url(#cup)" stroke-width="8" stroke-linecap="round"/><path d="M114 42c16 2 24 16 18 28-6 10-18 10-24-2" fill="none" stroke="url(#cup)" stroke-width="8" stroke-linecap="round"/><path d="M72 88h16l6 28H66z" fill="url(#stem)"/><path d="M52 116h56c4 0 8 6 6 12H46c-2-6 2-12 6-12z" fill="url(#cup)" stroke="#fff3b0" stroke-width="2"/><path d="M80 28l4 10 10 1-8 6 3 10-9-6-9 6 3-10-8-6 10-1z" fill="#fff"/></svg>';
  }

  function burst(x, y, count) {
    bits.push({ x: x, y: y, vx: 0, vy: 0, w: 150, h: 150, rot: 0, vr: 0, color: "#fff6c8", life: 0.42, age: 0, kind: "flash" });
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = 420 + Math.random() * 980;
      const streak = i % 2 === 0;
      bits.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        w: streak ? 22 + Math.random() * 28 : 8 + Math.random() * 10,
        h: streak ? 4 : 8 + Math.random() * 8,
        rot: angle,
        vr: streak ? 0 : (Math.random() - 0.5) * 16,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1.35 + Math.random() * 0.9,
        age: 0,
        kind: streak ? "streak" : "chip",
      });
    }
  }

  function resize() {
    if (!canvas || !overlay) return;
    const rect = overlay.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.style.setProperty("display", "block", "important");
    canvas.style.setProperty("position", "fixed", "important");
    canvas.style.setProperty("width", width + "px", "important");
    canvas.style.setProperty("height", height + "px", "important");
    canvas.style.setProperty("left", "0", "important");
    canvas.style.setProperty("top", "0", "important");
    canvas.style.background = "transparent";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function frame(now) {
    if (!overlay || !ctx) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (canvas.getBoundingClientRect().width < 2) resize();
    const rect = overlay.getBoundingClientRect();
    const viewW = rect.width || window.innerWidth;
    const viewH = rect.height || window.innerHeight;
    overlay.dataset.frames = String(Number(overlay.dataset.frames || 0) + 1);
    if (!opened && viewW > 2) {
      opened = true;
      burst(viewW * 0.5, viewH * 0.42, 120);
      burst(viewW * 0.12, viewH * 0.22, 70);
      burst(viewW * 0.88, viewH * 0.2, 70);
      burst(viewW * 0.28, viewH * 0.72, 64);
      burst(viewW * 0.72, viewH * 0.74, 64);
      burst(viewW * 0.5, viewH * 0.12, 80);
      nextBurst = now + 180;
    } else if (opened && now > nextBurst) {
      burst(viewW * (0.08 + Math.random() * 0.84), viewH * (0.08 + Math.random() * 0.7), 48);
      nextBurst = now + 180;
    }
    ctx.clearRect(0, 0, viewW, viewH);
    bits = bits.filter(function (bit) {
      bit.age += dt;
      if (bit.age >= bit.life) return false;
      bit.vy += 640 * dt;
      bit.vx *= 0.99;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.rot += bit.vr * dt;
      const fade = 1 - bit.age / bit.life;
      ctx.save();
      ctx.translate(bit.x, bit.y);
      ctx.globalAlpha = Math.max(0, fade);
      if (bit.kind === "flash") {
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, bit.w);
        glow.addColorStop(0, "rgba(255,246,200,0.95)");
        glow.addColorStop(1, "rgba(255,246,200,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, bit.w * fade, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(bit.rot);
        ctx.fillStyle = bit.color;
        ctx.shadowColor = bit.color;
        ctx.shadowBlur = 16;
        ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
      }
      ctx.restore();
      return bit.y < viewH + 40;
    });
    raf = window.requestAnimationFrame(frame);
  }

  function close() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    bits = [];
    opened = false;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    canvas = null;
    ctx = null;
    window.removeEventListener("keydown", onKey);
  }

  function onKey(event) {
    if (event.key === "Escape") close();
  }

  function ensureStyle() {
    if (document.getElementById("finish-style")) return;
    const style = document.createElement("style");
    style.id = "finish-style";
    style.textContent = [
      "#finish-celebration{position:fixed;inset:0;z-index:1000000000;display:grid;place-items:center;background:radial-gradient(circle at 50% 42%,rgba(88,28,135,.28),rgba(4,8,20,.62));font-family:'Trebuchet MS','Segoe UI',sans-serif}",
      "#finish-celebration .finish-sky{position:fixed;inset:0;z-index:1000000001;pointer-events:none}",
      "#finish-celebration .finish-card{position:relative;z-index:1000000002;width:min(440px,calc(100% - 36px));padding:28px 28px 22px;border-radius:32px;text-align:center;color:#fff;background:radial-gradient(circle at 50% 0%,#3a2a86 0%,#1a1460 42%,#120b3a 100%);box-shadow:0 0 0 3px #ffd76a,0 0 0 7px rgba(255,215,106,.35),0 30px 80px rgba(0,0,0,.45),inset 0 0 40px rgba(255,210,90,.18);animation:finish-pop .55s cubic-bezier(.18,1.35,.36,1) both,finish-glow 1.4s ease-in-out infinite}",
      "#finish-celebration .finish-kicker{margin:0;letter-spacing:.28em;text-transform:uppercase;font-size:12px;font-weight:800;color:#ffe08a;text-shadow:0 0 12px rgba(255,208,90,.8)}",
      "#finish-celebration .finish-title{margin:8px 0 0;font-size:36px;line-height:1.05;font-weight:800;background:linear-gradient(180deg,#fff,#ffe08a);-webkit-background-clip:text;background-clip:text;color:transparent}",
      "#finish-celebration .finish-hero{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px;overflow:visible}",
      "#finish-celebration .finish-portrait{width:180px;height:150px;object-fit:contain;overflow:visible;filter:drop-shadow(0 10px 0 rgba(0,0,0,.18)) drop-shadow(0 0 16px rgba(255,214,102,.45))}",
      "#finish-celebration .finish-kind{font-size:30px;font-weight:800;text-shadow:0 4px 0 rgba(0,0,0,.25)}",
      "#finish-celebration .finish-name{margin:4px 0 0;font-size:42px;font-weight:800;line-height:1.05;text-shadow:0 4px 0 #5b2a86,0 0 18px rgba(255,214,102,.45)}",
      "#finish-celebration .finish-trophy{position:relative;width:148px;height:168px;margin:8px auto 0;filter:drop-shadow(0 12px 0 rgba(120,70,10,.35)) drop-shadow(0 0 18px rgba(255,210,80,.7))}",
      "#finish-celebration .finish-trophy svg{width:100%;height:100%;display:block}",
      "#finish-celebration .finish-trophy strong{position:absolute;left:0;right:0;top:58px;font-size:36px;line-height:1;color:#6a3b08;text-shadow:0 1px 0 rgba(255,255,255,.65)}",
      "#finish-celebration .finish-close{margin-top:8px;border:0;border-radius:999px;padding:12px 28px;background:linear-gradient(180deg,#d8ff67,#3dce45);color:#143018;font:800 16px 'Trebuchet MS','Segoe UI',sans-serif;cursor:pointer;box-shadow:0 6px 0 #178a32,0 0 16px rgba(120,255,90,.45)}",
      "@keyframes finish-pop{from{transform:scale(.78) rotate(-2deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}",
      "@keyframes finish-glow{0%,100%{box-shadow:0 0 0 3px #ffd76a,0 0 0 7px rgba(255,215,106,.28),0 30px 80px rgba(0,0,0,.45),inset 0 0 40px rgba(255,210,90,.18)}50%{box-shadow:0 0 0 3px #fff1a8,0 0 0 12px rgba(255,215,106,.45),0 30px 80px rgba(0,0,0,.45),inset 0 0 54px rgba(255,210,90,.32)}}",
      "@media (prefers-reduced-motion: reduce){#finish-celebration .finish-card{animation:none}}",
    ].join("");
    document.head.appendChild(style);
  }

  function celebrate(winnerName) {
    if (shown) return;
    shown = true;
    const info = winnerFromStage(winnerName);
    const kind = species();
    close();
    shown = true;
    ensureStyle();
    overlay = document.createElement("div");
    overlay.id = "finish-celebration";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Race winner");
    const quiet = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    overlay.innerHTML =
      '<canvas class="finish-sky" aria-hidden="true"></canvas>' +
      '<section class="finish-card">' +
      '<p class="finish-kicker">Finish line</p>' +
      '<h2 class="finish-title"></h2>' +
      '<div class="finish-hero"><img class="finish-portrait" alt="" /><span class="finish-kind"></span></div>' +
      '<p class="finish-name"></p>' +
      '<div class="finish-trophy">' + trophyArt() + '<strong></strong></div>' +
      '<button type="button" class="finish-close">Continue</button>' +
      "</section>";
    overlay.querySelector(".finish-title").textContent = title();
    overlay.querySelector(".finish-kind").textContent = LABELS[kind];
    overlay.querySelector(".finish-name").textContent = info.name;
    overlay.querySelector(".finish-portrait").alt = info.name;
    const plate = overlay.querySelector(".finish-trophy strong");
    if (info.number) plate.textContent = info.number;
    else plate.remove();
    const winnerNode = info.node;
    window.setTimeout(function () {
      const picture = overlay && overlay.querySelector(".finish-portrait");
      if (!picture) return;
      const url = portraitOf(winnerNode);
      if (url) picture.src = url;
    }, 0);
    overlay.querySelector(".finish-close").addEventListener("click", close);
    document.body.appendChild(overlay);
    canvas = overlay.querySelector("canvas");
    ctx = canvas.getContext("2d");
    resize();
    if (!quiet) {
      last = performance.now();
      frame(last);
    }
    window.addEventListener("keydown", onKey);
  }

  const parentWindow = window.parent;
  const send = parentWindow.postMessage.bind(parentWindow);
  parentWindow.postMessage = function (message, target, transfer) {
    if (message && message.type === "raceWinner") celebrate(message.winner);
    return send(message, target, transfer);
  };

  window.setInterval(function () {
    const button = find(window.exportRoot, "tStart", 0);
    const text = button && button.text;
    if (text === "Pause") {
      running = true;
      if (shown) {
        shown = false;
        close();
      }
      return;
    }
    if (running && text === "") {
      running = false;
      celebrate("");
    }
  }, 200);

  window.addEventListener("resize", resize);
})();
