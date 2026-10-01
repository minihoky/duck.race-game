import { hashString, mulberry32 } from "./motion";

export const SPRITE_W = 120;
export const SPRITE_H = 90;
const BAKE = 2;
const INK = "#1c2836";

export const ANIMALS = {
  duck: { label: "Duck", habitat: "Pond" },
  frog: { label: "Frog", habitat: "Marsh" },
  fish: { label: "Fish", habitat: "Stream" },
  turtle: { label: "Turtle", habitat: "Beach" },
  seahorse: { label: "Seahorse", habitat: "Coral reef" },
};

export const PALETTE = [
  "#ffd23a", "#ff6b6b", "#4dabf7", "#69db7c", "#f783ac", "#ffa94d", "#b197fc", "#63e6be",
  "#f8f9fa", "#ff922b", "#3bc9db", "#e599f7", "#a9e34b", "#fab005", "#ff8787", "#748ffc",
];
const PATTERNS = ["none", "spots", "stripes", "belly"];
const ACCESSORIES = ["none", "cap", "crown", "tophat", "party", "sunglasses", "bow", "headband"];

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const mix = (channel) => Math.max(0, Math.min(255, Math.round(channel + (amount < 0 ? channel : 255 - channel) * amount)));
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);
  return `rgb(${r},${g},${b})`;
}

function ellipse(g, x, y, rx, ry, rotation = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
}

function fillStroke(g, fill, width = 2.2) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = width;
  g.strokeStyle = INK;
  g.stroke();
}

function eye(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = "#161616";
  g.fill();
  g.beginPath();
  g.arc(x + r * 0.35, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
  g.fillStyle = "#fff";
  g.fill();
}

function pattern(g, kind, shape, color, box) {
  if (kind === "none") return;
  g.save();
  shape(g);
  g.clip();
  const [x, y, w, h] = box;
  if (kind === "spots") {
    g.fillStyle = shade(color, -0.28);
    const spots = [[0.25, 0.3, 0.09], [0.55, 0.22, 0.07], [0.42, 0.62, 0.1], [0.75, 0.55, 0.08], [0.15, 0.7, 0.06]];
    for (const [sx, sy, r] of spots) {
      g.beginPath();
      g.arc(x + w * sx, y + h * sy, w * r, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === "stripes") {
    g.fillStyle = shade(color, -0.25);
    for (let i = 0; i < 4; i += 1) g.fillRect(x + w * (0.18 + i * 0.2), y, w * 0.08, h);
  } else if (kind === "belly") {
    g.fillStyle = shade(color, 0.55);
    ellipse(g, x + w * 0.5, y + h * 0.95, w * 0.42, h * 0.42);
    g.fill();
  }
  g.restore();
}

const BODIES = {
  duck(g, color, skin) {
    const body = (c) => ellipse(c, 52, 60, 34, 19);
    g.beginPath();
    g.moveTo(22, 54);
    g.lineTo(8, 40);
    g.lineTo(26, 62);
    g.closePath();
    fillStroke(g, color);
    body(g);
    fillStroke(g, color);
    pattern(g, skin.pattern, body, color, [18, 41, 68, 38]);
    body(g);
    g.lineWidth = 2.2;
    g.strokeStyle = INK;
    g.stroke();
    ellipse(g, 48, 58, 17, 9, -0.2);
    fillStroke(g, shade(color, -0.15), 1.8);
    ellipse(g, 84, 34, 16, 15);
    fillStroke(g, color);
    g.beginPath();
    g.moveTo(97, 31);
    g.quadraticCurveTo(116, 34, 113, 39);
    g.quadraticCurveTo(105, 43, 97, 41);
    g.closePath();
    fillStroke(g, "#f08a14", 2);
    eye(g, 89, 30, 2.8);
    return { hat: [84, 20, 1], eyes: [[89, 30]], neck: [80, 50] };
  },
  frog(g, color, skin) {
    const body = (c) => ellipse(c, 58, 60, 36, 22);
    ellipse(g, 30, 70, 17, 10, 0.25);
    fillStroke(g, shade(color, -0.2));
    body(g);
    fillStroke(g, color);
    pattern(g, skin.pattern, body, color, [22, 38, 72, 44]);
    body(g);
    g.lineWidth = 2.2;
    g.strokeStyle = INK;
    g.stroke();
    ellipse(g, 82, 76, 11, 6);
    fillStroke(g, shade(color, -0.1));
    for (const [x, y, r] of [[68, 38, 10], [90, 40, 9]]) {
      ellipse(g, x, y, r, r);
      fillStroke(g, color);
      ellipse(g, x + 1, y - 1, r * 0.62, r * 0.62);
      g.fillStyle = "#fff";
      g.fill();
      eye(g, x + 2.5, y - 1, r * 0.34);
    }
    g.beginPath();
    g.moveTo(72, 60);
    g.quadraticCurveTo(88, 66, 102, 54);
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
    return { hat: [79, 30, 0.95], eyes: [[69, 37], [91, 39]], neck: [84, 62] };
  },
  fish(g, color, skin) {
    const body = (c) => ellipse(c, 62, 48, 36, 21);
    g.beginPath();
    g.moveTo(30, 48);
    g.lineTo(6, 30);
    g.quadraticCurveTo(14, 48, 6, 66);
    g.closePath();
    fillStroke(g, shade(color, -0.12));
    g.beginPath();
    g.moveTo(46, 30);
    g.quadraticCurveTo(60, 10, 78, 30);
    g.closePath();
    fillStroke(g, shade(color, -0.12));
    body(g);
    fillStroke(g, color);
    pattern(g, skin.pattern, body, color, [26, 27, 72, 42]);
    body(g);
    g.lineWidth = 2.2;
    g.strokeStyle = INK;
    g.stroke();
    ellipse(g, 58, 56, 10, 5, 0.5);
    fillStroke(g, shade(color, -0.18), 1.6);
    eye(g, 84, 42, 4);
    g.beginPath();
    g.arc(96, 52, 3, 0.2, Math.PI - 0.2);
    g.lineWidth = 1.8;
    g.stroke();
    return { hat: [78, 29, 0.9], eyes: [[84, 42]], neck: [88, 62] };
  },
  turtle(g, color, skin) {
    const skinTone = "#8fc46a";
    for (const [x, y] of [[36, 74], [78, 74], [28, 66], [86, 66]]) {
      ellipse(g, x, y, 9, 6);
      fillStroke(g, skinTone, 1.8);
    }
    ellipse(g, 99, 56, 12, 10);
    fillStroke(g, skinTone);
    eye(g, 103, 53, 2.6);
    const shell = (c) => {
      c.beginPath();
      c.moveTo(24, 66);
      c.bezierCurveTo(24, 26, 96, 26, 96, 66);
      c.closePath();
    };
    shell(g);
    fillStroke(g, color);
    pattern(g, skin.pattern === "none" ? "spots" : skin.pattern, shell, color, [24, 34, 72, 32]);
    g.save();
    shell(g);
    g.clip();
    g.strokeStyle = shade(color, -0.35);
    g.lineWidth = 1.6;
    for (const [x, y] of [[44, 50], [60, 44], [76, 50], [52, 60], [68, 60]]) {
      g.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i;
        g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 7);
      }
      g.closePath();
      g.stroke();
    }
    g.restore();
    shell(g);
    g.lineWidth = 2.2;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = shade(color, -0.3);
    g.fillRect(24, 64, 72, 4);
    return { hat: [99, 46, 0.75], eyes: [[103, 53]], neck: [92, 66] };
  },
  seahorse(g, color, skin) {
    g.beginPath();
    g.moveTo(58, 60);
    g.quadraticCurveTo(66, 80, 54, 84);
    g.quadraticCurveTo(42, 84, 44, 76);
    g.quadraticCurveTo(46, 70, 52, 74);
    g.lineWidth = 11;
    g.lineCap = "round";
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 7;
    g.strokeStyle = color;
    g.stroke();
    g.lineCap = "butt";
    g.beginPath();
    g.moveTo(50, 36);
    g.quadraticCurveTo(34, 46, 50, 58);
    g.closePath();
    fillStroke(g, shade(color, 0.35), 1.8);
    const body = (c) => ellipse(c, 60, 48, 13, 19, -0.15);
    body(g);
    fillStroke(g, color);
    pattern(g, skin.pattern, body, color, [46, 29, 28, 38]);
    body(g);
    g.lineWidth = 2.2;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.moveTo(74, 19);
    g.lineTo(96, 21);
    g.quadraticCurveTo(99, 25, 96, 28);
    g.lineTo(74, 28);
    g.closePath();
    fillStroke(g, color);
    ellipse(g, 68, 23, 12, 11);
    fillStroke(g, color);
    eye(g, 71, 21, 2.8);
    return { hat: [66, 13, 0.85], eyes: [[71, 21]], neck: [62, 36] };
  },
};

function accessory(g, kind, anchors, color) {
  const [hx, hy, s] = anchors.hat;
  g.save();
  g.lineWidth = 1.8;
  g.strokeStyle = INK;
  if (kind === "cap") {
    g.translate(hx, hy);
    g.scale(s, s);
    g.beginPath();
    g.arc(0, 2, 12, Math.PI, 0);
    g.closePath();
    g.fillStyle = shade(color, -0.45);
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(12, 2, 9, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (kind === "crown") {
    g.translate(hx, hy);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(-11, 3);
    g.lineTo(-11, -8);
    g.lineTo(-5, -2);
    g.lineTo(0, -11);
    g.lineTo(5, -2);
    g.lineTo(11, -8);
    g.lineTo(11, 3);
    g.closePath();
    g.fillStyle = "#ffcc33";
    g.fill();
    g.stroke();
    g.fillStyle = "#e03131";
    g.beginPath();
    g.arc(0, -1, 2, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "tophat") {
    g.translate(hx, hy);
    g.scale(s, s);
    g.fillStyle = "#212529";
    g.fillRect(-13, 0, 26, 4);
    g.strokeRect(-13, 0, 26, 4);
    g.fillRect(-8, -16, 16, 16);
    g.strokeRect(-8, -16, 16, 16);
    g.fillStyle = shade(color, -0.3);
    g.fillRect(-8, -5, 16, 4);
  } else if (kind === "party") {
    g.translate(hx, hy);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(-9, 3);
    g.lineTo(0, -20);
    g.lineTo(9, 3);
    g.closePath();
    g.fillStyle = "#4dabf7";
    g.fill();
    g.stroke();
    g.fillStyle = "#ffd43b";
    g.beginPath();
    g.arc(0, -20, 3.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (kind === "headband") {
    g.translate(hx, hy + 6);
    g.scale(s, s);
    g.fillStyle = "#fa5252";
    g.fillRect(-12, -3, 24, 6);
    g.strokeRect(-12, -3, 24, 6);
    g.beginPath();
    g.moveTo(-12, 0);
    g.lineTo(-20, -4);
    g.lineTo(-19, 5);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (kind === "bow") {
    const [nx, ny] = anchors.neck;
    g.translate(nx, ny);
    g.fillStyle = "#e64980";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-8, -6);
    g.lineTo(-8, 6);
    g.closePath();
    g.moveTo(0, 0);
    g.lineTo(8, -6);
    g.lineTo(8, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 2.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (kind === "sunglasses") {
    g.fillStyle = "#111";
    for (const [ex, ey] of anchors.eyes) {
      g.beginPath();
      g.ellipse(ex, ey, 6, 4.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    const [first] = anchors.eyes;
    const last = anchors.eyes[anchors.eyes.length - 1];
    g.beginPath();
    g.moveTo(first[0] - 6, first[1]);
    g.lineTo(last[0] + 6, last[1]);
    g.lineWidth = 1.6;
    g.stroke();
  }
  g.restore();
}

export function skinsFor(race) {
  const total = PALETTE.length * PATTERNS.length * ACCESSORIES.length;
  const combos = Array.from({ length: total }, (_, index) => index);
  const rand = mulberry32(hashString(`skins:${race.id}`));
  for (let i = combos.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }
  return (lane) => {
    const combo = combos[lane % total];
    return {
      color: PALETTE[combo % PALETTE.length],
      pattern: PATTERNS[Math.floor(combo / PALETTE.length) % PATTERNS.length],
      accessory: ACCESSORIES[Math.floor(combo / (PALETTE.length * PATTERNS.length)) % ACCESSORIES.length],
    };
  };
}

export function bakeSprite(animal, skin) {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_W * BAKE;
  canvas.height = SPRITE_H * BAKE;
  const g = canvas.getContext("2d");
  g.scale(BAKE, BAKE);
  g.lineJoin = "round";
  const draw = BODIES[animal] || BODIES.duck;
  const anchors = draw(g, skin.color, skin);
  accessory(g, skin.accessory, anchors, skin.color);
  return canvas;
}
