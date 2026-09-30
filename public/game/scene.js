(function () {
  const HABITATS = ["pond", "stream", "marsh", "shore", "reef"];
  const LABELS = { pond: "Pond", stream: "Stream", marsh: "Marsh", shore: "Shore", reef: "Reef" };
  const SUITS = { pond: "Ducks", stream: "Fish", marsh: "Frogs", shore: "Turtles", reef: "Seahorses" };
  const FOR_SPECIES = { duck: "pond", fish: "stream", frog: "marsh", turtle: "shore", seahorse: "reef" };
  const KEY = "duck-race-habitat";

  let habitat = localStorage.getItem(KEY);
  if (HABITATS.indexOf(habitat) < 0) {
    const species = localStorage.getItem("duck-race-species");
    habitat = FOR_SPECIES[species] || "pond";
  }

  const setupImage = document.createElement("canvas");
  setupImage.width = 1400;
  setupImage.height = 788;
  const bankImage = document.createElement("canvas");
  bankImage.width = 942;
  bankImage.height = 160;
  const courseImage = document.createElement("canvas");
  courseImage.width = 986;
  courseImage.height = 396;
  let paintedSetup = "";
  let paintedRace = "";
  let lake = null;

  function rand(seed) {
    let value = seed % 2147483646;
    if (value < 1) value += 2147483646;
    return function () {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function unit(w, h) {
    return Math.min(w / 1400, h / 788);
  }

  function sky(ctx, w, h, top, bottom, horizon) {
    const wash = ctx.createLinearGradient(0, 0, 0, h * horizon);
    wash.addColorStop(0, top);
    wash.addColorStop(1, bottom);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h * horizon);
  }

  function water(ctx, w, h, horizon, top, bottom) {
    const wash = ctx.createLinearGradient(0, h * horizon, 0, h);
    wash.addColorStop(0, top);
    wash.addColorStop(1, bottom);
    ctx.fillStyle = wash;
    ctx.fillRect(0, h * horizon, w, h);
  }

  function sun(ctx, x, y, radius, color) {
    const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 2.4);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8d8";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function hill(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function reed(ctx, x, y, height, lean, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(height * 0.028, 0.8);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean, y - height * 0.55, x + lean * 0.35, y - height);
    ctx.stroke();
    ctx.fillStyle = "#6d4a22";
    ctx.beginPath();
    ctx.ellipse(x + lean * 0.35, y - height, height * 0.045, height * 0.11, lean * 0.01, 0, Math.PI * 2);
    ctx.fill();
  }

  function ripples(ctx, w, h, horizon, color, seed) {
    const u = unit(w, h);
    const roll = rand(seed);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, 2.2 * u);
    for (let i = 0; i < 16; i += 1) {
      const y = h * horizon + 18 * u + roll() * (h * (1 - horizon) - 36 * u);
      const x = roll() * w;
      const width = (28 + roll() * 80) * (w / 1400);
      ctx.globalAlpha = 0.18 + roll() * 0.32;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(1, width), Math.max(0.6, (3.5 + roll() * 4) * u), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintPond(ctx, w, h) {
    const u = unit(w, h);
    sky(ctx, w, h, "#7ec8f2", "#e7f7ff", 0.46);
    sun(ctx, w * 0.78, h * 0.16, Math.max(4, w * 0.045), "rgba(255,244,190,0.9)");
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.ellipse(w * 0.18, h * 0.14, w * 0.07, h * 0.035, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.24, h * 0.15, w * 0.05, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    hill(ctx, w * 0.18, h * 0.48, w * 0.28, h * 0.12, "#7dae55");
    hill(ctx, w * 0.52, h * 0.5, w * 0.34, h * 0.1, "#8fbe62");
    hill(ctx, w * 0.86, h * 0.49, w * 0.26, h * 0.11, "#6ea24c");
    water(ctx, w, h, 0.46, "#7ec8ea", "#2f86c4");
    ctx.fillStyle = "#d8f3c8";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.quadraticCurveTo(w * 0.2, h * 0.5, w * 0.34, h * 0.62);
    ctx.lineTo(0, h * 0.7);
    ctx.fill();
    ctx.fillStyle = "#c6eb9a";
    ctx.beginPath();
    ctx.moveTo(w, h * 0.56);
    ctx.quadraticCurveTo(w * 0.72, h * 0.48, w * 0.62, h * 0.64);
    ctx.lineTo(w, h * 0.72);
    ctx.fill();
    [[0.22, 0.6, 0.045], [0.3, 0.66, 0.032], [0.7, 0.6, 0.04], [0.78, 0.68, 0.028]].forEach(function (pad) {
      ctx.fillStyle = "#3f8f45";
      ctx.beginPath();
      ctx.ellipse(w * pad[0], h * pad[1], w * pad[2], h * pad[2] * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    for (let i = 0; i < 9; i += 1) reed(ctx, w * (0.04 + i * 0.025), h * 0.66, h * (0.16 + (i % 3) * 0.03), -18 * u, "#2f7a3a");
    for (let i = 0; i < 8; i += 1) reed(ctx, w * (0.78 + i * 0.025), h * 0.64, h * (0.14 + (i % 3) * 0.03), 16 * u, "#2f7a3a");
    ripples(ctx, w, h, 0.5, "#f4fbff", 11);
  }

  function paintStream(ctx, w, h) {
    const u = unit(w, h);
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, "#b7fff2");
    wash.addColorStop(0.18, "#5ec8c4");
    wash.addColorStop(1, "#14556e");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i += 1) {
      const x = w * (0.08 + i * 0.15);
      const ray = ctx.createLinearGradient(x, h * 0.02, x + 40 * u, h);
      ray.addColorStop(0, "rgba(255,255,255,0.34)");
      ray.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16 * u, 0);
      ctx.lineTo(x + 54 * u, h);
      ctx.lineTo(x + 28 * u, h);
      ctx.fill();
    }
    ctx.fillStyle = "#c4a882";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    ctx.quadraticCurveTo(w * 0.3, h * 0.7, w * 0.55, h * 0.8);
    ctx.quadraticCurveTo(w * 0.8, h * 0.9, w, h * 0.76);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    const roll = rand(21);
    for (let i = 0; i < 14; i += 1) {
      const x = w * (0.05 + (i % 7) * 0.13);
      const y = h * (0.82 + Math.floor(i / 7) * 0.08);
      ctx.fillStyle = i % 2 ? "#8d7b68" : "#d7c4ae";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.035, h * 0.02, roll() * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i += 1) {
      const x = w * (0.08 + i * 0.13);
      ctx.strokeStyle = i % 2 ? "#177a52" : "#2ea872";
      ctx.lineWidth = Math.max(0.8, h * 0.012);
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + 24 * u, h * 0.72, x - 12 * u, h * 0.38);
      ctx.stroke();
    }
  }

  function paintMarsh(ctx, w, h) {
    const u = unit(w, h);
    sky(ctx, w, h, "#c9d9a4", "#f4f6d4", 0.4);
    hill(ctx, w * 0.28, h * 0.44, w * 0.42, h * 0.09, "#6f8f45");
    hill(ctx, w * 0.74, h * 0.45, w * 0.38, h * 0.08, "#7ea352");
    water(ctx, w, h, 0.42, "#6f9650", "#2d5230");
    const roll = rand(31);
    for (let i = 0; i < 10; i += 1) {
      const x = w * (0.1 + roll() * 0.8);
      const y = h * (0.5 + roll() * 0.32);
      ctx.fillStyle = "#3c7630";
      ctx.beginPath();
      ctx.ellipse(x, y, w * (0.04 + roll() * 0.028), h * 0.026, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#6a4a2c";
    ctx.lineWidth = Math.max(1, 14 * u);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.78);
    ctx.quadraticCurveTo(w * 0.48, h * 0.7, w * 0.66, h * 0.76);
    ctx.stroke();
    for (let i = 0; i < 14; i += 1) {
      reed(ctx, w * (0.03 + (i % 7) * 0.035 + (i > 6 ? 0.72 : 0)), h * 0.68, h * (0.22 + (i % 4) * 0.03), (i % 2 ? 12 : -14) * u, "#245c30");
    }
    ctx.fillStyle = "#5c4630";
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
  }

  function paintShore(ctx, w, h) {
    const u = unit(w, h);
    sky(ctx, w, h, "#8ecff6", "#ffe7c2", 0.38);
    sun(ctx, w * 0.22, h * 0.15, Math.max(4, w * 0.04), "rgba(255,220,150,0.9)");
    water(ctx, w, h, 0.38, "#8fd8dc", "#2a8494");
    ctx.fillStyle = "#f6e2b8";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.7);
    ctx.quadraticCurveTo(w * 0.25, h * 0.56, w * 0.46, h * 0.68);
    ctx.quadraticCurveTo(w * 0.68, h * 0.82, w, h * 0.64);
    ctx.lineTo(w, h);
    ctx.fill();
    [[0.28, 0.69, "#8d97a1", 0.05], [0.4, 0.75, "#6e787f", 0.04], [0.72, 0.7, "#9aa4ac", 0.055]].forEach(function (rock) {
      ctx.fillStyle = rock[2];
      ctx.beginPath();
      ctx.ellipse(w * rock[0], h * rock[1], w * rock[3], h * rock[3] * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ripples(ctx, w, h, 0.4, "rgba(255,255,255,0.7)", 41);
    void u;
  }

  function paintReef(ctx, w, h) {
    const u = unit(w, h);
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, "#3aa0e0");
    wash.addColorStop(0.35, "#1767b0");
    wash.addColorStop(1, "#062844");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    const shaft = ctx.createLinearGradient(w * 0.35, 0, w * 0.55, h * 0.7);
    shaft.addColorStop(0, "rgba(190,230,255,0.28)");
    shaft.addColorStop(1, "rgba(190,230,255,0)");
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, 0);
    ctx.lineTo(w * 0.48, 0);
    ctx.lineTo(w * 0.62, h * 0.72);
    ctx.lineTo(w * 0.4, h * 0.72);
    ctx.fill();
    function coral(x, y, color, arms) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 9 * u);
      ctx.lineCap = "round";
      for (let i = 0; i < arms; i += 1) {
        const lean = (i - (arms - 1) / 2) * 26 * u;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + lean * 0.35, y - 46 * u, x + lean, y - (78 + (i % 2) * 22) * u);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#e7c99a";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.86);
    ctx.quadraticCurveTo(w * 0.4, h * 0.8, w, h * 0.88);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    coral(w * 0.14, h * 0.84, "#ff7a59", 5);
    coral(w * 0.34, h * 0.88, "#ffb703", 4);
    coral(w * 0.58, h * 0.86, "#ef476f", 5);
    coral(w * 0.8, h * 0.84, "#ff8fab", 4);
  }

  const painters = { pond: paintPond, stream: paintStream, marsh: paintMarsh, shore: paintShore, reef: paintReef };

  function paintInto(ctx, w, h, id) {
    ctx.clearRect(0, 0, w, h);
    (painters[id] || paintPond)(ctx, w, h);
  }

  function waves(ctx, w, y, color, width, amp, periods) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const yy = y + Math.sin((x / w) * periods * Math.PI * 2) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  function blot(ctx, w, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(((x % w) + w) % w, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    const wrapped = ((x % w) + w) % w;
    if (wrapped < rx) {
      ctx.beginPath();
      ctx.ellipse(wrapped + w, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (wrapped > w - rx) {
      ctx.beginPath();
      ctx.ellipse(wrapped - w, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintBank(ctx, id) {
    const w = bankImage.width;
    const h = bankImage.height;
    const looks = {
      pond: ["#9ed36a", "#67a84a", "#6b4423"],
      stream: ["#b7c6cc", "#7f969e", "#5c6b72"],
      marsh: ["#8aaa5c", "#5f8640", "#5a4630"],
      shore: ["#f6e2b8", "#efd09a", "#e0b87a"],
      reef: ["#49b4e4", "#1d74b8", "#145e96"],
    };
    const tone = looks[id] || looks.pond;
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, tone[0]);
    wash.addColorStop(0.78, tone[1]);
    wash.addColorStop(0.78, tone[2]);
    wash.addColorStop(1, tone[2]);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    if (id === "reef") {
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc((i + 0.5) * w / 8, 36 + (i % 3) * 18, 4 + (i % 2) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const clumps = id === "shore" ? 0 : 4;
    for (let i = 0; i < clumps; i += 1) {
      const x = (i + 0.5) * w / clumps;
      ctx.fillStyle = id === "stream" ? "#6d838b" : id === "marsh" ? "#4f7334" : "#3f8a32";
      ctx.beginPath();
      ctx.ellipse(x, h * 0.46, 34, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 22, h * 0.5, 24, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (id === "pond" || id === "marsh") {
      for (let i = 0; i < 8; i += 1) {
        reed(ctx, (i + 0.35) * w / 8, h * 0.78, 46 + (i % 3) * 8, i % 2 ? 8 : -8, id === "marsh" ? "#245c30" : "#2f7a3a");
      }
    }
    if (id === "shore") {
      for (let i = 0; i < 5; i += 1) blot(ctx, w, (i + 0.5) * w / 5, h * 0.42, 22, 12, i % 2 ? "#d7c4a2" : "#c9b48e");
    }
    if (id === "stream") {
      for (let i = 0; i < 7; i += 1) blot(ctx, w, (i + 0.5) * w / 7, h * 0.4, 18, 10, i % 2 ? "#d5dde0" : "#8ea0a6");
    }
  }

  function paintCourse(ctx, id) {
    const w = courseImage.width;
    const h = courseImage.height;
    const tones = {
      pond: ["#7ec4ea", "#3d92c8", "#f4fbff"],
      stream: ["#8fe0d4", "#1f7c90", "rgba(255,255,255,0.55)"],
      marsh: ["#86a85a", "#3c6840", "rgba(220,236,170,0.45)"],
      shore: ["#9ee0dc", "#2f8f9c", "rgba(255,255,255,0.6)"],
      reef: ["#1e78c4", "#0a3e68", "rgba(180,220,255,0.35)"],
    };
    const tone = tones[id] || tones.pond;
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, tone[0]);
    wash.addColorStop(1, tone[1]);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    if (id === "stream" || id === "reef") {
      for (let i = 0; i < 5; i += 1) {
        const x = (i + 0.5) * w / 5;
        const ray = ctx.createLinearGradient(x, 0, x, h * 0.7);
        ray.addColorStop(0, "rgba(255,255,255,0.22)");
        ray.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = ray;
        ctx.fillRect(x - 10, 0, 18, h * 0.7);
      }
    }
    [0.22, 0.4, 0.58, 0.76].forEach(function (band, index) {
      waves(ctx, w, h * band, tone[2], 7, 5 + (index % 2), 3 + (index % 2));
    });
    if (id === "pond" || id === "marsh") {
      for (let i = 0; i < 3; i += 1) {
        blot(ctx, w, (i + 0.5) * w / 3, h * 0.16, 28, 12, id === "marsh" ? "#3e7a32" : "#3f8f45");
      }
    }
    if (id === "stream" || id === "shore") {
      for (let i = 0; i < 8; i += 1) {
        blot(ctx, w, (i + 0.5) * w / 8, h * 0.86, 22, 12, i % 2 ? "#c4b5a0" : "#8d7b68");
      }
    }
    if (id === "reef") {
      ctx.fillStyle = "#e7c99a";
      ctx.fillRect(0, h * 0.9, w, h * 0.1);
      for (let i = 0; i < 5; i += 1) {
        const x = (i + 0.5) * w / 5;
        const color = ["#ff7a59", "#ffb703", "#ef476f", "#ff8fab", "#7d5cff"][i];
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        for (let arm = 0; arm < 4; arm += 1) {
          const lean = (arm - 1.5) * 16;
          ctx.beginPath();
          ctx.moveTo(x, h * 0.92);
          ctx.quadraticCurveTo(x + lean * 0.4, h * 0.78, x + lean, h * 0.68);
          ctx.stroke();
        }
      }
    }
    if (id === "stream") {
      ctx.strokeStyle = "#1f8f62";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i += 1) {
        const x = (i + 0.5) * w / 6;
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.quadraticCurveTo(x + 16, h * 0.78, x - 8, h * 0.7);
        ctx.stroke();
      }
    }
  }

  function ensureSetup() {
    if (paintedSetup === habitat) return;
    paintInto(setupImage.getContext("2d"), setupImage.width, setupImage.height, habitat);
    paintedSetup = habitat;
  }

  function ensureRace() {
    if (paintedRace === habitat) return;
    paintBank(bankImage.getContext("2d"), habitat);
    paintCourse(courseImage.getContext("2d"), habitat);
    paintedRace = habitat;
  }

  function drawLive(node) {
    if (!node || node.__habitatDraw) return;
    node.__habitatDraw = true;
    const proto = createjs.Container.prototype.draw;
    node.draw = function (ctx, ignoreCache) {
      return proto.call(this, ctx, true);
    };
  }

  function cover(part, canvas) {
    if (!part) return;
    const kids = part.children || [];
    let tile = null;
    for (let i = 0; i < kids.length; i += 1) if (kids[i].name === "habitatTile") tile = kids[i];
    if (!tile) {
      tile = new createjs.Bitmap(canvas);
      tile.name = "habitatTile";
      tile.mouseEnabled = false;
      part.addChild(tile);
    } else if (tile.image !== canvas) tile.image = canvas;
    const bounds = part.nominalBounds;
    if (bounds && bounds.width && bounds.height) {
      tile.x = bounds.x;
      tile.y = bounds.y;
      tile.scaleX = bounds.width / canvas.width;
      tile.scaleY = bounds.height / canvas.height;
    }
    if (part.__habitatDraw) return;
    part.__habitatDraw = true;
    const proto = createjs.Container.prototype.draw;
    part.draw = function (ctx, ignoreCache) {
      const list = this.children || [];
      for (let i = 0; i < list.length; i += 1) list[i].visible = list[i].name === "habitatTile";
      return proto.call(this, ctx, true);
    };
  }

  function skinStrip(node, canvas) {
    if (!node) return;
    drawLive(node);
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i += 1) {
      if (kids[i].name && kids[i].name.indexOf("part") === 0) cover(kids[i], canvas);
    }
  }

  function syncRace() {
    const root = window.exportRoot;
    if (!root || !root.water || !root.hills || !window.createjs) return;
    ensureRace();
    skinStrip(root.hills, bankImage);
    skinStrip(root.water, courseImage);
  }

  function hideScenery(bg) {
    const keep = new Set([bg, lake]);
    function mark(node) {
      let duck = node.name === "duckColour";
      const children = node.children || [];
      for (let i = 0; i < children.length; i += 1) if (mark(children[i])) duck = true;
      if (duck) keep.add(node);
      return duck;
    }
    mark(bg);
    function apply(node, underDuck) {
      const duck = underDuck || node.name === "duckColour";
      if (node !== bg && node !== lake) node.visible = !!(duck || keep.has(node));
      const children = node.children || [];
      for (let i = 0; i < children.length; i += 1) apply(children[i], duck);
    }
    apply(bg, false);
    if (lake) lake.visible = true;
  }

  function place(bg) {
    const stage = window.stage;
    if (!stage || !stage.canvas || !lake) return;
    const sx = stage.scaleX || 1;
    const sy = stage.scaleY || 1;
    const width = stage.canvas.width / sx;
    const height = stage.canvas.height / sy;
    const origin = bg.globalToLocal(0, 0);
    const far = bg.globalToLocal(width, height);
    const targetW = far.x - origin.x;
    const targetH = far.y - origin.y;
    const scale = Math.max(targetW / setupImage.width, targetH / setupImage.height);
    lake.scaleX = scale;
    lake.scaleY = scale;
    lake.x = origin.x + (targetW - setupImage.width * scale) / 2;
    lake.y = origin.y + (targetH - setupImage.height * scale) / 2;
  }

  function syncSetup() {
    const settings = window.exportRoot && window.exportRoot.settings;
    const bg = settings && settings.bg;
    if (!bg || !settings || settings.visible === false) return;
    if (!bg._lakeReady) {
      if (!bg.cacheCanvas || bg.cacheCanvas.width < 800) return;
      bg._lakeReady = true;
    }
    ensureSetup();
    if (bg.cacheCanvas && bg.uncache) bg.uncache();
    if (!lake) {
      lake = new createjs.Bitmap(setupImage);
      lake.mouseEnabled = false;
      lake.name = "lake";
    } else if (lake.image !== setupImage) lake.image = setupImage;
    if (lake.parent !== bg) bg.addChildAt(lake, 0);
    else bg.setChildIndex(lake, 0);
    hideScenery(bg);
    place(bg);
  }

  function hook(stage) {
    if (stage.__sceneHook) return;
    stage.__sceneHook = true;
    const original = stage.update.bind(stage);
    stage.update = function () {
      syncRace();
      const result = original();
      syncSetup();
      return result;
    };
    syncRace();
    syncSetup();
  }

  function boot() {
    if (!window.stage || !window.exportRoot || !window.createjs) return false;
    hook(window.stage);
    return true;
  }

  window.duckHabitats = {
    order: HABITATS,
    labels: LABELS,
    suits: SUITS,
    forSpecies: function (species) { return FOR_SPECIES[species] || "pond"; },
    current: function () { return habitat; },
    paint: paintInto,
    select: function (id) {
      if (HABITATS.indexOf(id) < 0 || id === habitat) return;
      habitat = id;
      try { localStorage.setItem(KEY, habitat); } catch (error) { /* keep the choice for this visit */ }
      paintedSetup = "";
      paintedRace = "";
      if (window.stage) window.stage.update();
    },
  };

  if (!boot()) {
    const wait = window.setInterval(function () {
      if (boot()) window.clearInterval(wait);
    }, 200);
  }
})();
