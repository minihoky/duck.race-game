(function () {
  const style = document.createElement("style");
  style.textContent = [
    "#modern-clock{position:absolute;z-index:30;display:flex;align-items:center;gap:12px;box-sizing:border-box;padding:8px 12px;border-radius:22px;background:linear-gradient(180deg,#1f6f8a 0%,#14556e 42%,#0d3d52 100%);border:3px solid #10212b;box-shadow:0 5px 0 #10212b,0 12px 22px rgba(8,24,36,.28),inset 0 1px 0 rgba(255,255,255,.28);color:#f4fbff;font-family:'Trebuchet MS','Segoe UI',Arial,sans-serif;user-select:none;pointer-events:auto}",
    "#modern-clock[hidden]{display:none !important}",
    "#modern-clock button{border:2px solid #10212b;background:linear-gradient(180deg,#3c8eaa,#1d6078);color:#f4fbff;border-radius:14px;cursor:pointer;display:grid;place-items:center;padding:0;flex:0 0 auto;box-shadow:0 3px 0 #10212b,inset 0 1px 0 rgba(255,255,255,.35);transition:transform .12s ease,filter .12s ease}",
    "#modern-clock button:hover{filter:brightness(1.08)}",
    "#modern-clock button:active{transform:translateY(2px);box-shadow:0 1px 0 #10212b,inset 0 1px 0 rgba(255,255,255,.35)}",
    "#modern-clock [data-act='clock']{border-radius:50%;background:linear-gradient(180deg,#ffe58a,#f5b301);color:#1c2b3a}",
    "#modern-clock .screen{flex:1;min-width:0;align-self:stretch;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 6px;border-radius:16px;background:rgba(6,22,32,.38);box-shadow:inset 0 3px 0 rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.06)}",
    "#modern-clock .time{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0}",
    "#modern-clock .group{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:2.5ch;line-height:1}",
    "#modern-clock .group b{font-family:'Arial Black','Trebuchet MS',Arial,sans-serif;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.04em;color:#f7fbff;text-shadow:0 3px 0 rgba(0,0,0,.35)}",
    "#modern-clock .group small{margin-top:4px;font-size:10px;font-weight:800;letter-spacing:.16em;color:#ffd56a}",
    "#modern-clock .colon{font-style:normal;font-weight:900;color:#ffd56a;text-shadow:0 2px 0 rgba(0,0,0,.35);animation:clock-blink 1s steps(1) infinite}",
    "#modern-clock .raw{text-align:center;font-family:'Arial Black','Trebuchet MS',Arial,sans-serif;font-weight:900;letter-spacing:-.03em;text-shadow:0 3px 0 rgba(0,0,0,.35)}",
    "#modern-clock .time[hidden],#modern-clock .raw[hidden],#modern-clock .group[hidden],#modern-clock .colon[hidden]{display:none !important}",
    "#modern-clock .side{display:flex;flex-direction:column;gap:6px;flex:0 0 auto}",
    "#modern-clock .hms{font-size:9px;font-weight:800;letter-spacing:.06em;line-height:1.05;color:#f4fbff}",
    "@keyframes clock-blink{50%{opacity:.35}}"
  ].join("");
  document.head.appendChild(style);

  const labels = ["HRS", "MIN", "SEC", "CS"];
  const card = document.createElement("div");
  card.id = "modern-clock";
  card.hidden = true;
  card.innerHTML = [
    '<button type="button" data-act="clock" title="Alarm clock mode" aria-label="Alarm clock mode">',
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5.2 6.2 8.2 8.6M18.8 6.2 15.8 8.6" stroke-linecap="round"/><circle cx="12" cy="13.2" r="6.6"/><path d="M12 10.2v3.2l2.3 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "</button>",
    '<div class="screen">',
    '<div class="time" aria-live="polite">',
    group(0), '<i class="colon">:</i>',
    group(1), '<i class="colon">:</i>',
    group(2), '<i class="colon">:</i>',
    group(3),
    "</div>",
    '<div class="raw" hidden></div>',
    "</div>",
    '<div class="side">',
    '<button type="button" data-act="format" title="Change the timer display" aria-label="Change the timer display"><span class="hms">HH<br>MM<br>SS</span></button>',
    '<button type="button" data-act="sound" title="Change the alarm sound" aria-label="Change the alarm sound">',
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.4 2h-13.8l1.4-2z" stroke-linejoin="round"/><path d="M10 18.5a2 2 0 0 0 4 0" stroke-linecap="round"/></svg>',
    "</button>",
    "</div>"
  ].join("");

  function group(index) {
    return '<div class="group" data-i="' + index + '"><b>00</b><small>' + labels[index] + "</small></div>";
  }

  const groups = card.querySelectorAll(".group");
  const colons = card.querySelectorAll(".colon");
  const nums = card.querySelectorAll(".group b");
  const captions = card.querySelectorAll(".group small");
  const timeRow = card.querySelector(".time");
  const raw = card.querySelector(".raw");
  let shown = "";

  card.addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button) return;
    const timer = clockTimer();
    if (!timer) return;
    const node = button.dataset.act === "clock" ? timer.btn_clock
      : button.dataset.act === "sound" ? timer.btn_changesound
      : timer.btn_hhmmss;
    if (!node || !window.createjs) return;
    node.dispatchEvent(new createjs.MouseEvent("mousedown", true, false, 0, 0));
  });

  function clockTimer() {
    const settings = window.exportRoot && window.exportRoot.settings;
    return settings && settings.timer;
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

  function paint(text) {
    if (text === shown) return;
    shown = text;
    const parts = text.match(/\d{1,2}/g);
    const shaped = parts && /^[\d: ]+$/.test(text) && parts.length >= 2 && parts.length <= 4;
    if (!shaped) {
      timeRow.hidden = true;
      raw.hidden = false;
      raw.textContent = text;
      return;
    }
    timeRow.hidden = false;
    raw.hidden = true;
    const names = parts.length === 4 ? labels
      : parts.length === 2 ? ["MIN", "SEC"]
      : ["HRS", "MIN", "SEC"];
    groups.forEach(function (node, index) {
      node.hidden = index >= parts.length;
      if (index < parts.length) {
        nums[index].textContent = parts[index].padStart(2, "0");
        captions[index].textContent = names[index];
      }
    });
    colons.forEach(function (node, index) {
      node.hidden = index >= parts.length - 1;
    });
  }

  function sync() {
    const settings = window.exportRoot && window.exportRoot.settings;
    const timer = settings && settings.timer;
    const digital = timer && timer.oldWay && timer.oldWay.visible !== false;
    const show = !!(settings && settings.visible !== false && digital && timer.btn_clock && timer.btn_hhmmss && timer.btn_changesound);
    card.hidden = !show;
    if (!show) return;
    const clock = screenBox(timer.btn_clock);
    const format = screenBox(timer.btn_hhmmss);
    const sound = screenBox(timer.btn_changesound);
    const stage = window.stage;
    const canvas = stage && stage.canvas;
    const host = card.parentElement;
    if (!clock || !format || !sound || !canvas || !host) return;
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const clockW = clock.r - clock.x;
    const formatW = format.r - format.x;
    const formatH = format.b - format.y;
    const soundH = sound.b - sound.y;
    const left = clock.x - clockW * 0.30;
    const top = format.y - formatH * 0.28;
    const right = format.r + formatW * 0.48;
    const bottom = sound.b + soundH * 0.09;
    const width = Math.max(240, right - left);
    const height = Math.max(72, bottom - top);
    card.style.left = (canvasRect.left - hostRect.left + left) + "px";
    card.style.top = (canvasRect.top - hostRect.top + top) + "px";
    card.style.width = width + "px";
    card.style.height = height + "px";
    const digit = Math.max(28, Math.round(height * 0.40));
    nums.forEach(function (node) { node.style.fontSize = digit + "px"; });
    captions.forEach(function (node) { node.style.fontSize = Math.max(10, Math.round(height * 0.09)) + "px"; });
    colons.forEach(function (node) { node.style.fontSize = Math.round(digit * 0.78) + "px"; });
    raw.style.fontSize = Math.round(digit * 0.72) + "px";
    const main = card.querySelector('[data-act="clock"]');
    const mainSize = Math.round(height * 0.62);
    main.style.width = mainSize + "px";
    main.style.height = mainSize + "px";
    const side = Math.max(28, Math.round((height - 16 - 6) / 2));
    card.querySelectorAll(".side button").forEach(function (node) {
      node.style.width = Math.round(side * 1.15) + "px";
      node.style.height = side + "px";
    });
    paint(String(timer.oldWay.display.text || "00:00:00"));
  }

  function hook(stage) {
    if (stage.__clockHook) return;
    stage.__clockHook = true;
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
    if (!card.parentElement) host.appendChild(card);
    hook(window.stage);
    return true;
  }

  if (!boot()) {
    const wait = window.setInterval(function () {
      if (boot()) window.clearInterval(wait);
    }, 200);
  }
})();
