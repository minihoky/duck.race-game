(function () {
  const LABELS = { duck: "Duck", fish: "Fish", frog: "Frog", turtle: "Turtle", seahorse: "Seahorse" };
  const COLORS = ["#ffe56a", "#ff5d73", "#3ec6ff", "#7dffb2", "#d9a6ff", "#ff9a3c", "#fff6c8", "#ff77c8"];
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
    };
  }

  function animalArt(kind) {
    const art = {
      duck: '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="30" cy="40" rx="16" ry="12" fill="#ffd15c"/><circle cx="44" cy="28" r="11" fill="#ffe56a"/><circle cx="48" cy="26" r="2" fill="#1b2430"/><path d="M52 30h10l-8 5z" fill="#ff8a3d"/><ellipse cx="22" cy="50" rx="8" ry="3" fill="#f0b429"/></svg>',
      fish: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 32c10-14 28-16 40-8 4 8 4 16 0 24-12 8-30 6-40-8z" fill="#ff8a3d"/><path d="M48 24c8-8 12-8 14-2-6 4-10 8-14 10z" fill="#ffb057"/><circle cx="22" cy="30" r="2.4" fill="#1b2430"/><path d="M18 28h16" stroke="#fff3" stroke-width="2"/></svg>',
      frog: '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="40" rx="16" ry="12" fill="#7dff6a"/><circle cx="22" cy="26" r="8" fill="#8dff78"/><circle cx="42" cy="26" r="8" fill="#8dff78"/><circle cx="22" cy="26" r="3" fill="#1b2430"/><circle cx="42" cy="26" r="3" fill="#1b2430"/><path d="M28 40h8" stroke="#1b2430" stroke-width="2" stroke-linecap="round"/></svg>',
      turtle: '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="36" rx="16" ry="12" fill="#63c46a"/><ellipse cx="32" cy="36" rx="10" ry="7" fill="#8ee08a"/><circle cx="48" cy="34" r="7" fill="#b6e7a0"/><circle cx="50" cy="33" r="1.6" fill="#1b2430"/><path d="M18 44c-6 4-8 8-6 10M46 46c6 3 8 7 6 9" stroke="#8ee08a" stroke-width="3" stroke-linecap="round"/></svg>',
      seahorse: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M40 10c8 4 10 12 6 18-2 4-2 6 0 8 4 4 4 12-2 16-6 4-8 8-6 12" fill="none" stroke="#ff77c8" stroke-width="8" stroke-linecap="round"/><circle cx="44" cy="16" r="2" fill="#1b2430"/><path d="M28 22c-8 2-10 8-6 10" stroke="#ff9ad4" stroke-width="3" stroke-linecap="round"/></svg>',
    };
    return art[kind] || art.duck;
  }

  function burst(x, y, count) {
    bits.push({ x: x, y: y, vx: 0, vy: 0, w: 70, h: 70, rot: 0, vr: 0, color: "#fff6c8", life: 0.28, age: 0, kind: "flash" });
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 220 + Math.random() * 560;
      const streak = i % 3 === 0;
      bits.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        w: streak ? 16 + Math.random() * 18 : 7 + Math.random() * 8,
        h: streak ? 3 : 7 + Math.random() * 6,
        rot: angle,
        vr: streak ? 0 : (Math.random() - 0.5) * 10,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1.15 + Math.random() * 0.75,
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
      burst(viewW * 0.5, viewH * 0.34, 90);
      burst(viewW * 0.18, viewH * 0.28, 48);
      burst(viewW * 0.82, viewH * 0.26, 48);
      burst(viewW * 0.32, viewH * 0.62, 36);
      burst(viewW * 0.7, viewH * 0.66, 36);
      nextBurst = now + 380;
    } else if (opened && now > nextBurst) {
      burst(viewW * (0.2 + Math.random() * 0.6), viewH * (0.18 + Math.random() * 0.35), 26);
      nextBurst = now + 420;
    }
    ctx.clearRect(0, 0, viewW, viewH);
    bits = bits.filter(function (bit) {
      bit.age += dt;
      if (bit.age >= bit.life) return false;
      bit.vy += 520 * dt;
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
        ctx.shadowBlur = 8;
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
      "#finish-celebration{position:fixed;inset:0;z-index:1000000000;display:grid;place-items:center;background:rgba(5,16,32,.42);font-family:'Trebuchet MS','Segoe UI',sans-serif}",
      "#finish-celebration .finish-sky{position:fixed;inset:0;z-index:1000000001;pointer-events:none}",
      "#finish-celebration .finish-card{position:relative;z-index:1000000002;width:min(420px,calc(100% - 40px));padding:26px 28px 22px;border-radius:28px;text-align:center;color:#fff;background:linear-gradient(180deg,#1a4e86 0%,#102848 55%,#0c1c33 100%);border:3px solid #ffd15c;box-shadow:0 24px 70px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.35);animation:finish-pop .55s cubic-bezier(.18,1.35,.36,1) both}",
      "#finish-celebration .finish-kicker{margin:0;letter-spacing:.22em;text-transform:uppercase;font-size:12px;font-weight:700;color:#ffd15c}",
      "#finish-celebration .finish-title{margin:8px 0 0;font-size:34px;line-height:1.05;font-weight:800}",
      "#finish-celebration .finish-animal{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:16px}",
      "#finish-celebration .finish-animal svg{width:72px;height:72px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.12))}",
      "#finish-celebration .finish-animal span{font-size:28px;font-weight:800}",
      "#finish-celebration .finish-name{margin:6px 0 0;font-size:40px;font-weight:800;line-height:1.1}",
      "#finish-celebration .finish-medal{display:grid;place-items:center;width:108px;height:108px;margin:16px auto 0;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff4c2,#ffd15c 42%,#f0a202);color:#3a2a08;box-shadow:0 10px 0 #c9860a,0 16px 24px rgba(0,0,0,.25)}",
      "#finish-celebration .finish-medal span{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}",
      "#finish-celebration .finish-medal strong{font-size:42px;line-height:.9}",
      "#finish-celebration .finish-close{margin-top:18px;border:0;border-radius:999px;padding:12px 28px;background:#7dff6a;color:#143018;font:800 16px 'Trebuchet MS','Segoe UI',sans-serif;cursor:pointer;box-shadow:0 6px 0 #3aaa32}",
      "@keyframes finish-pop{from{transform:scale(.82);opacity:0}to{transform:scale(1);opacity:1}}",
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
      '<div class="finish-animal">' + animalArt(kind) + '<span></span></div>' +
      '<p class="finish-name"></p>' +
      '<div class="finish-medal"><span>Number</span><strong></strong></div>' +
      '<button type="button" class="finish-close">Continue</button>' +
      "</section>";
    overlay.querySelector(".finish-title").textContent = title();
    overlay.querySelector(".finish-animal span").textContent = LABELS[kind];
    overlay.querySelector(".finish-name").textContent = info.name;
    const medal = overlay.querySelector(".finish-medal");
    if (info.number) medal.querySelector("strong").textContent = info.number;
    else medal.remove();
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
