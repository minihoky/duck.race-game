import { hashString, mulberry32 } from "./motion";

export const SPRITE_W = 120;
export const SPRITE_H = 90;
const BAKE = 2;
const INK = "#1c2836";

export const ANIMALS = {
  rabbit: { label: "Rabbit", habitat: "Meadow" },
  frog: { label: "Frog", habitat: "Marsh" },
  fish: { label: "Fish", habitat: "Stream" },
  turtle: { label: "Turtle", habitat: "Beach" },
  snail: { label: "Snail", habitat: "Garden" },
};

export const PALETTE = [
  "#ffd23a", "#ff6b6b", "#4dabf7", "#69db7c", "#f783ac", "#ffa94d", "#b197fc", "#63e6be",
  "#f8f9fa", "#ff922b", "#3bc9db", "#e599f7", "#7ec41f", "#fab005", "#ff8787", "#748ffc",
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

const FROG_CLASSIC = {
  back: [[445, 262, 50, 32, -0.15], [558, 228, 33, 25, -0.3], [632, 192, 19, 16], [530, 298, 23, 20], [445, 325, 18, 13], [352, 285, 16, 10], [350, 330, 52, 30, -0.2]],
  thigh: [[270, 388, 34, 20, 0.1], [355, 428, 30, 22, 0.3], [232, 440, 13, 10], [270, 476, 10, 8], [305, 492, 8, 6]],
  arm: [[580, 408, 18, 20], [540, 452, 13, 13], [570, 515, 15, 13]],
};

function scaleSpots(set, factor, shift = 0) {
  const map = (list) => list.map(([x, y, rx, ry, rot = 0]) => [x + shift, y, rx * factor, ry * factor, rot]);
  return { back: map(set.back), thigh: map(set.thigh), arm: map(set.arm) };
}

const FROG_SPOTS = {
  none: FROG_CLASSIC,
  spots: {
    back: [...FROG_CLASSIC.back, [600, 260, 14, 11], [490, 230, 12, 9], [400, 290, 13, 10], [680, 240, 10, 8]],
    thigh: [...FROG_CLASSIC.thigh, [320, 360, 12, 9], [395, 470, 12, 10]],
    arm: FROG_CLASSIC.arm,
  },
  stripes: scaleSpots(FROG_CLASSIC, 1.35, -6),
  belly: scaleSpots(FROG_CLASSIC, 0.6, 4),
};

const TURTLE_REST = { front: 0, back: 0, backFar: 0, head: 0, rock: 0, bob: 0 };
const TURTLE_SWIM = Array.from({ length: 8 }, (_, k) => {
  const a = (k / 8) * Math.PI * 2;
  return {
    front: Math.sin(a) * 0.55,
    back: -Math.sin(a) * 0.38,
    backFar: -Math.sin(a + 0.6) * 0.32,
    head: -Math.sin(a) * 0.05,
    rock: Math.sin(a) * 0.03,
    bob: -Math.cos(a) * 1.2,
  };
});

const smooth = (v) => v * v * (3 - 2 * v);

export const FROG_TAKEOFF = 0.2;
export const FROG_LANDING = 0.86;
export const FROG_FRAMES = 12;
const FROG_REST = { kick: 0, reach: 0 };

function frogPose(c) {
  let kick = 0;
  if (c >= 0.08 && c < 0.26) kick = smooth((c - 0.08) / 0.18);
  else if (c >= 0.26 && c < 0.56) kick = 1;
  else if (c >= 0.56 && c < FROG_LANDING) kick = 1 - smooth((c - 0.56) / (FROG_LANDING - 0.56));
  let reach = 0;
  if (c >= 0.42 && c < 0.78) reach = smooth((c - 0.42) / 0.36);
  else if (c >= 0.78 && c < 0.96) reach = 1 - smooth((c - 0.78) / 0.18);
  return { kick, reach };
}

const FROG_HOP = Array.from({ length: FROG_FRAMES }, (_, i) => frogPose((i + 0.5) / FROG_FRAMES));

const SNAIL_REST = { reach: 0, tail: 0, shell: 0, lift: 0, rock: 0, wave: 0, stalkNear: 0, stalkFar: 0 };
const SNAIL_CRAWL = Array.from({ length: 8 }, (_, k) => {
  const a = (k / 8) * Math.PI * 2;
  return {
    reach: (1 - Math.cos(a)) * 14,
    tail: (1 - Math.cos(a - 2)) * 9,
    shell: (1 - Math.cos(a - 1.1)) * 6,
    lift: -Math.max(0, Math.sin(a - 1.1)) * 6,
    rock: Math.sin(a - 1.1) * 0.025,
    wave: a,
    stalkNear: Math.sin(a + 0.5) * 0.12,
    stalkFar: Math.sin(a + 1.5) * 0.14,
  };
});

const FISH_REST = { tail: 0, fin: 0 };
const FISH_WAG = Array.from({ length: 8 }, (_, k) => {
  const a = (k / 8) * Math.PI * 2;
  return { tail: Math.sin(a) * 0.3, fin: Math.sin(a - Math.PI / 2) * 0.18 };
});
const FISH_CLASSIC = [[565, 255, 26, 24], [482, 288, 30, 27], [530, 326, 29, 26], [422, 338, 25, 23], [468, 372, 25, 22]];
const FISH_SPOTS = {
  none: { dots: FISH_CLASSIC, bands: [] },
  spots: { dots: [...FISH_CLASSIC, [610, 300, 18, 16], [395, 300, 16, 14], [520, 230, 14, 12], [585, 360, 14, 12]], bands: [] },
  stripes: { dots: [], bands: [470, 620] },
  belly: { dots: FISH_CLASSIC.map(([x, y, rx, ry]) => [x, y, rx * 0.6, ry * 0.6]), bands: [] },
};

export const RABBIT_REST = { hind: 0, foot: 0, front: 0, tilt: 0, lift: 0, ears: 0 };

const RABBIT_RUN = [
  { hind: -0.25, foot: -0.1, front: 0.35, tilt: 0.06, lift: 0, ears: -0.15 },
  { hind: 0.35, foot: 2.05, front: 0.1, tilt: -0.08, lift: -90, ears: -0.25 },
  { hind: 0.45, foot: 2.3, front: -0.6, tilt: -0.1, lift: -60, ears: -0.4 },
  { hind: 0.6, foot: 2.0, front: -0.9, tilt: 0, lift: -70, ears: -0.35 },
  { hind: 0.15, foot: -0.25, front: -0.3, tilt: 0.1, lift: -30, ears: -0.2 },
  { hind: -0.1, foot: 0, front: 0.2, tilt: 0.04, lift: 0, ears: -0.15 },
];

const BODIES = {
  rabbit(g, color, skin, pose = RABBIT_REST) {
    const S = 0.12;
    const OX = 0;
    const OY = 10;
    const K = "#121212";
    const line = 16;
    const soft = shade(color, -0.08);
    const far = shade(color, -0.06);
    const pink = "#f4a3b4";
    const center = [520, 430];
    const hip = [380, 440];
    const heel = [300, 625];
    const shoulder = [645, 470];
    const earBase = [660, 240];

    const ink = (width = line) => {
      g.lineWidth = width;
      g.strokeStyle = K;
      g.stroke();
    };
    const paint = (fill, width = line) => {
      g.fillStyle = fill;
      g.fill();
      ink(width);
    };
    const turn = ([px, py], angle) => {
      g.translate(px, py);
      g.rotate(angle);
      g.translate(-px, -py);
    };

    const foot = (fill) => {
      g.beginPath();
      g.moveTo(0, -28);
      g.bezierCurveTo(60, -36, 160, -30, 205, -18);
      g.bezierCurveTo(238, -10, 242, 22, 215, 30);
      g.lineTo(10, 30);
      g.bezierCurveTo(-16, 28, -22, -20, 0, -28);
      g.closePath();
      paint(fill);
      g.beginPath();
      g.moveTo(172, 4);
      g.lineTo(184, 28);
      g.moveTo(198, 0);
      g.lineTo(210, 26);
      ink(8);
    };
    const hindLeg = (fill, footAngle) => {
      g.save();
      turn(hip, pose.hind);
      g.save();
      g.translate(heel[0], heel[1]);
      g.rotate(footAngle);
      foot(fill);
      g.restore();
      g.beginPath();
      g.moveTo(250, 470);
      g.bezierCurveTo(250, 400, 330, 370, 410, 400);
      g.bezierCurveTo(480, 425, 512, 480, 506, 540);
      g.bezierCurveTo(500, 580, 460, 600, 400, 600);
      g.lineTo(300, 600);
      g.bezierCurveTo(264, 584, 250, 530, 250, 470);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      if (Math.abs(pose.hind) > 0.15) ink();
      else {
        g.beginPath();
        g.moveTo(410, 400);
        g.bezierCurveTo(480, 425, 512, 480, 506, 540);
        g.bezierCurveTo(502, 575, 485, 598, 465, 606);
        ink();
      }
      g.restore();
    };
    const frontLeg = (fill, pivot, dx, dy) => {
      g.save();
      g.translate(dx, dy);
      turn(pivot, pose.front);
      g.beginPath();
      g.moveTo(598, 440);
      g.bezierCurveTo(582, 520, 588, 580, 600, 618);
      g.lineTo(690, 620);
      g.bezierCurveTo(702, 580, 702, 520, 692, 440);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.beginPath();
      g.moveTo(592, 480);
      g.bezierCurveTo(582, 530, 588, 580, 600, 618);
      g.moveTo(690, 620);
      g.bezierCurveTo(702, 580, 702, 540, 696, 505);
      ink();
      g.beginPath();
      g.moveTo(598, 606);
      g.bezierCurveTo(592, 652, 720, 658, 728, 630);
      g.bezierCurveTo(732, 608, 704, 600, 688, 602);
      g.closePath();
      paint(fill);
      g.beginPath();
      g.moveTo(656, 628);
      g.lineTo(660, 648);
      g.moveTo(686, 624);
      g.lineTo(692, 644);
      ink(8);
      g.restore();
    };
    const tail = () => {
      const [tx, ty] = [195, 460];
      for (let i = 0; i < 11; i += 1) {
        const a = (i / 11) * Math.PI * 2;
        g.beginPath();
        g.arc(tx + Math.cos(a) * 46, ty + Math.sin(a) * 50, 22, 0, Math.PI * 2);
        paint(color);
      }
      g.beginPath();
      g.ellipse(tx, ty, 50, 54, 0, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.beginPath();
      g.ellipse(tx + 8, ty + 14, 28, 26, 0, 0, Math.PI * 2);
      g.fillStyle = soft;
      g.fill();
    };
    const body = (c) => {
      c.beginPath();
      c.moveTo(600, 330);
      c.bezierCurveTo(520, 298, 400, 288, 330, 305);
      c.bezierCurveTo(268, 320, 238, 382, 244, 442);
      c.bezierCurveTo(250, 520, 290, 580, 330, 604);
      c.lineTo(560, 604);
      c.bezierCurveTo(605, 594, 650, 560, 705, 520);
      c.bezierCurveTo(745, 490, 742, 458, 720, 440);
      c.closePath();
    };
    const head = (c) => {
      c.beginPath();
      c.moveTo(600, 252);
      c.bezierCurveTo(640, 205, 720, 190, 790, 200);
      c.bezierCurveTo(852, 210, 892, 262, 906, 310);
      c.bezierCurveTo(926, 346, 906, 382, 870, 396);
      c.bezierCurveTo(830, 420, 790, 446, 740, 456);
      c.bezierCurveTo(690, 462, 640, 450, 610, 420);
      c.bezierCurveTo(570, 370, 570, 290, 600, 252);
      c.closePath();
    };
    const earShape = (c, back) => {
      c.beginPath();
      if (back) {
        c.moveTo(640, 242);
        c.bezierCurveTo(600, 170, 540, 80, 545, 35);
        c.bezierCurveTo(550, 5, 600, 10, 640, 60);
        c.bezierCurveTo(690, 120, 722, 190, 716, 238);
      } else {
        c.moveTo(692, 246);
        c.bezierCurveTo(640, 180, 560, 95, 480, 65);
        c.bezierCurveTo(434, 50, 424, 96, 455, 140);
        c.bezierCurveTo(500, 200, 560, 240, 612, 262);
      }
      c.closePath();
    };

    g.save();
    g.translate(OX, OY);
    g.scale(S, S);
    g.lineJoin = "round";
    g.lineCap = "round";
    g.translate(0, pose.lift);
    turn(center, pose.tilt);

    frontLeg(far, [shoulder[0] + 80, shoulder[1] - 10], 80, -10);
    if (pose !== RABBIT_REST) {
      g.save();
      g.translate(30, -14);
      hindLeg(far, pose.foot * 0.8 + 0.2);
      g.restore();
    }
    g.save();
    turn(earBase, pose.ears);
    earShape(g, true);
    paint(soft);
    g.restore();
    tail();
    body(g);
    paint(color);
    g.save();
    body(g);
    g.clip();
    g.beginPath();
    g.ellipse(480, 610, 230, 70, 0, 0, Math.PI * 2);
    g.fillStyle = soft;
    g.fill();
    g.restore();
    pattern(g, skin.pattern, body, color, [250, 300, 470, 300]);
    body(g);
    ink();
    hindLeg(color, pose.foot);
    frontLeg(color, shoulder, 0, 0);
    head(g);
    paint(color);
    g.save();
    turn(earBase, pose.ears);
    earShape(g, false);
    paint(color);
    g.beginPath();
    g.moveTo(662, 236);
    g.bezierCurveTo(612, 180, 540, 115, 486, 90);
    g.bezierCurveTo(470, 96, 480, 130, 506, 160);
    g.bezierCurveTo(552, 206, 602, 236, 642, 250);
    g.closePath();
    g.fillStyle = pink;
    g.fill();
    g.restore();

    g.beginPath();
    g.ellipse(770, 315, 58, 60, 0, 0, Math.PI * 2);
    paint("#fff");
    g.beginPath();
    g.arc(796, 312, 34, 0, Math.PI * 2);
    g.fillStyle = "#111";
    g.fill();
    g.beginPath();
    g.arc(810, 293, 10, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();
    g.beginPath();
    g.ellipse(897, 335, 20, 15, 0.2, 0, Math.PI * 2);
    paint(pink, 10);
    g.beginPath();
    g.moveTo(850, 402);
    g.quadraticCurveTo(868, 406, 884, 392);
    ink(9);
    g.beginPath();
    g.moveTo(845, 368);
    g.lineTo(786, 362);
    g.moveTo(848, 382);
    g.lineTo(790, 390);
    g.moveTo(850, 396);
    g.lineTo(800, 414);
    ink(5);
    g.restore();

    const at = (x, y) => {
      const a = pose.tilt;
      const rx = center[0] + (x - center[0]) * Math.cos(a) - (y - center[1]) * Math.sin(a);
      const ry = center[1] + (x - center[0]) * Math.sin(a) + (y - center[1]) * Math.cos(a) + pose.lift;
      return [OX + rx * S, OY + ry * S];
    };
    return { hat: [...at(760, 205), 0.9], eyes: [[...at(778, 315), 58 * S]], neck: at(700, 452) };
  },
  frog(g, color, skin, pose = FROG_REST) {
    const S = 0.112;
    const OX = 3;
    const OY = 6;
    const line = 15;
    const dark = shade(color, -0.42);
    const under = shade(color, -0.14);
    const belly = "#fbe9a0";
    const spots = FROG_SPOTS[skin.pattern] || FROG_SPOTS.none;
    const INK = "#121212";

    g.save();
    g.translate(OX, OY);
    g.scale(S, S);
    g.lineJoin = "round";
    g.lineCap = "round";

    const outline = (fill, width = line) => {
      g.fillStyle = fill;
      g.fill();
      g.lineWidth = width;
      g.strokeStyle = INK;
      g.stroke();
    };
    const toe = (x1, y1, x2, y2, fill) => {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.lineWidth = 34 + line * 2;
      g.strokeStyle = INK;
      g.stroke();
      g.beginPath();
      g.arc(x2, y2, 22 + line, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.lineWidth = 34;
      g.strokeStyle = fill;
      g.stroke();
      g.beginPath();
      g.arc(x2, y2, 22, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.fill();
    };
    const blots = (list) => {
      g.fillStyle = dark;
      for (const [x, y, rx, ry, rot = 0] of list) {
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        g.fill();
      }
    };

    const swing = (pivot, angle) => {
      g.translate(pivot[0], pivot[1]);
      g.rotate(angle);
      g.translate(-pivot[0], -pivot[1]);
    };
    const place = (from, to, angle) => {
      g.translate(to[0], to[1]);
      g.rotate(angle);
      g.translate(-from[0], -from[1]);
    };
    const turnPoint = (pivot, point, angle) => {
      const dx = point[0] - pivot[0];
      const dy = point[1] - pivot[1];
      return [pivot[0] + dx * Math.cos(angle) - dy * Math.sin(angle), pivot[1] + dx * Math.sin(angle) + dy * Math.cos(angle)];
    };
    const kick = pose.kick;
    const reach = pose.reach;
    const hip = [410, 450];
    const knee0 = [215, 438];
    const ankle0 = [435, 536];
    const thighTurn = -0.37 * kick;
    const shinTurn = 2.43 * kick;
    const footTurn = -0.15 * kick;
    const knee = turnPoint(hip, knee0, thighTurn);
    const ankle = turnPoint([0, 0], [ankle0[0] - knee0[0], ankle0[1] - knee0[1]], shinTurn);
    ankle[0] += knee[0];
    ankle[1] += knee[1];

    const thigh = () => {
      g.beginPath();
      g.moveTo(175, 400);
      g.bezierCurveTo(170, 340, 260, 320, 330, 345);
      g.bezierCurveTo(400, 370, 445, 430, 440, 495);
      g.bezierCurveTo(435, 535, 380, 540, 330, 515);
      g.bezierCurveTo(260, 480, 180, 460, 175, 400);
      g.closePath();
    };
    const hindLeg = (fill, shadow, near) => {
      g.save();
      place(ankle0, ankle, footTurn);
      if (kick > 0.05) toe(ankle0[0], ankle0[1], 345, 552, fill);
      toe(330, 540, 150, 522, fill);
      toe(335, 552, 178, 572, fill);
      toe(350, 560, 232, 592, fill);
      g.restore();
      g.save();
      place(knee0, knee, shinTurn);
      g.beginPath();
      g.moveTo(190, 455);
      g.bezierCurveTo(230, 535, 330, 568, 440, 560);
      g.bezierCurveTo(455, 545, 450, 520, 430, 512);
      g.bezierCurveTo(340, 515, 270, 480, 240, 420);
      g.closePath();
      outline(shadow);
      g.restore();

      g.save();
      swing(hip, thighTurn);
      thigh();
      outline(fill);
      g.save();
      thigh();
      g.clip();
      g.beginPath();
      g.ellipse(300, 480, 170, 60, 0.35, 0, Math.PI * 2);
      g.fillStyle = shadow;
      g.fill();
      if (near) blots(spots.thigh);
      g.restore();
      thigh();
      g.lineWidth = line;
      g.strokeStyle = INK;
      g.stroke();
      g.restore();
    };

    g.save();
    g.translate(40, -62);
    hindLeg(shade(color, -0.22), shade(color, -0.34), false);
    g.restore();

    g.save();
    swing([665, 430], -0.4 * reach);
    toe(700, 545, 760, 552, under);
    toe(690, 545, 712, 570, under);
    g.beginPath();
    g.moveTo(640, 430);
    g.bezierCurveTo(675, 470, 690, 515, 700, 548);
    g.lineTo(730, 552);
    g.bezierCurveTo(710, 500, 700, 460, 690, 420);
    g.closePath();
    outline(under);
    g.restore();

    const body = () => {
      g.beginPath();
      g.moveTo(245, 360);
      g.bezierCurveTo(320, 280, 450, 225, 560, 205);
      g.bezierCurveTo(610, 195, 640, 175, 660, 140);
      g.bezierCurveTo(675, 60, 830, 45, 850, 140);
      g.bezierCurveTo(875, 162, 900, 170, 922, 188);
      g.bezierCurveTo(950, 210, 945, 245, 915, 262);
      g.bezierCurveTo(912, 300, 880, 320, 830, 345);
      g.bezierCurveTo(790, 365, 760, 380, 740, 410);
      g.bezierCurveTo(700, 480, 640, 540, 520, 548);
      g.bezierCurveTo(420, 552, 320, 520, 268, 470);
      g.bezierCurveTo(232, 435, 225, 390, 245, 360);
      g.closePath();
    };
    body();
    outline(color);
    g.save();
    body();
    g.clip();
    g.beginPath();
    g.moveTo(650, 280);
    g.bezierCurveTo(760, 292, 860, 290, 930, 262);
    g.lineTo(980, 262);
    g.lineTo(980, 700);
    g.lineTo(400, 700);
    g.lineTo(400, 515);
    g.bezierCurveTo(480, 500, 580, 485, 625, 440);
    g.bezierCurveTo(665, 400, 660, 340, 650, 280);
    g.closePath();
    g.fillStyle = belly;
    g.fill();
    blots(spots.back);
    g.restore();
    body();
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.stroke();

    hindLeg(color, under, true);

    g.save();
    swing([615, 345], -0.45 * reach);
    toe(605, 565, 585, 598, color);
    toe(612, 568, 695, 594, color);
    toe(618, 560, 770, 552, color);
    const armLeft = (path) => {
      path.moveTo(590, 330);
      path.bezierCurveTo(530, 370, 495, 425, 515, 480);
      path.bezierCurveTo(532, 520, 565, 548, 590, 572);
    };
    const armRight = (path) => {
      path.moveTo(655, 566);
      path.bezierCurveTo(625, 530, 598, 490, 598, 445);
      path.bezierCurveTo(598, 405, 615, 378, 640, 355);
    };
    const arm = () => {
      g.beginPath();
      armLeft(g);
      g.lineTo(655, 566);
      g.bezierCurveTo(625, 530, 598, 490, 598, 445);
      g.bezierCurveTo(598, 405, 615, 378, 640, 355);
      g.closePath();
    };
    arm();
    g.fillStyle = color;
    g.fill();
    g.save();
    arm();
    g.clip();
    blots(spots.arm);
    g.restore();
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.beginPath();
    armLeft(g);
    g.lineTo(655, 566);
    g.stroke();
    g.beginPath();
    armRight(g);
    g.stroke();
    g.restore();

    g.beginPath();
    g.arc(765, 172, 64, 0, Math.PI * 2);
    outline("#fff");
    g.beginPath();
    g.arc(792, 170, 38, 0, Math.PI * 2);
    g.fillStyle = "#111";
    g.fill();
    g.beginPath();
    g.arc(805, 153, 13, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();

    g.beginPath();
    g.ellipse(906, 207, 9, 6, 0.4, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();

    g.beginPath();
    g.moveTo(808, 284);
    g.bezierCurveTo(840, 284, 880, 280, 906, 268);
    g.bezierCurveTo(908, 292, 885, 306, 858, 306);
    g.bezierCurveTo(830, 305, 812, 296, 808, 284);
    g.closePath();
    outline("#e8472d", 10);
    g.beginPath();
    g.moveTo(688, 270);
    g.bezierCurveTo(740, 285, 840, 290, 912, 262);
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.stroke();

    g.restore();
    const at = (x, y) => [OX + x * S, OY + y * S];
    return { hat: [...at(765, 104), 0.85], eyes: [[...at(772, 172), 64 * S]], neck: at(840, 330) };
  },
  fish(g, color, skin, pose = FISH_REST) {
    const S = 0.138;
    const OX = -11;
    const OY = -2;
    const K = "#121212";
    const line = 15;
    const fin = shade(color, -0.1);
    const dark = shade(color, -0.3);
    const light = shade(color, 0.4);
    const belly = "#f7ead6";
    const joint = [338, 392];
    const spots = FISH_SPOTS[skin.pattern] || FISH_SPOTS.none;

    const ink = (width = line) => {
      g.lineWidth = width;
      g.strokeStyle = K;
      g.stroke();
    };
    const paint = (fill, width = line) => {
      g.fillStyle = fill;
      g.fill();
      ink(width);
    };
    const rays = (list, width = 13) => {
      g.strokeStyle = dark;
      g.lineWidth = width;
      g.globalAlpha = 0.55;
      for (const [x1, y1, x2, y2] of list) {
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    const body = (c) => {
      c.beginPath();
      c.moveTo(332, 352);
      c.bezierCurveTo(400, 270, 520, 190, 660, 180);
      c.bezierCurveTo(770, 172, 860, 230, 885, 318);
      c.bezierCurveTo(892, 345, 892, 380, 878, 420);
      c.bezierCurveTo(850, 500, 760, 568, 640, 578);
      c.bezierCurveTo(520, 586, 410, 530, 332, 432);
      c.bezierCurveTo(325, 410, 325, 375, 332, 352);
      c.closePath();
    };

    g.save();
    g.translate(OX, OY);
    g.scale(S, S);
    g.lineJoin = "round";
    g.lineCap = "round";

    g.save();
    g.translate(joint[0], joint[1]);
    g.rotate(pose.tail);
    g.scale(1 - Math.abs(pose.tail) * 0.35, 1);
    g.translate(-joint[0], -joint[1]);
    g.beginPath();
    g.moveTo(345, 360);
    g.bezierCurveTo(290, 290, 200, 225, 112, 214);
    g.bezierCurveTo(86, 212, 92, 245, 104, 268);
    g.bezierCurveTo(130, 320, 165, 360, 195, 392);
    g.bezierCurveTo(160, 440, 125, 500, 112, 548);
    g.bezierCurveTo(105, 575, 130, 578, 150, 570);
    g.bezierCurveTo(230, 540, 300, 480, 345, 425);
    g.closePath();
    paint(color);
    rays([[300, 340, 175, 285], [280, 375, 200, 375], [300, 430, 180, 500]]);
    g.restore();

    g.beginPath();
    g.moveTo(432, 250);
    g.bezierCurveTo(420, 190, 420, 120, 440, 98);
    g.bezierCurveTo(470, 80, 560, 95, 650, 165);
    g.bezierCurveTo(600, 180, 560, 190, 520, 200);
    g.closePath();
    paint(fin);
    rays([[460, 150, 470, 230], [510, 125, 530, 200], [565, 135, 585, 185]]);

    g.save();
    g.translate(450, 570);
    g.rotate(pose.fin * 0.6);
    g.translate(-450, -570);
    g.beginPath();
    g.moveTo(400, 545);
    g.bezierCurveTo(380, 575, 390, 610, 430, 610);
    g.bezierCurveTo(470, 610, 510, 600, 530, 585);
    g.bezierCurveTo(500, 565, 460, 550, 440, 540);
    g.closePath();
    paint(fin);
    g.restore();

    g.beginPath();
    g.ellipse(896, 348, 28, 22, 0, 0, Math.PI * 2);
    paint(color);

    body(g);
    paint(color);
    g.save();
    body(g);
    g.clip();
    g.beginPath();
    g.moveTo(340, 440);
    g.bezierCurveTo(420, 470, 520, 470, 600, 445);
    g.bezierCurveTo(680, 420, 760, 400, 900, 385);
    g.lineTo(900, 620);
    g.lineTo(320, 620);
    g.closePath();
    g.fillStyle = belly;
    g.fill();
    g.fillStyle = light;
    g.globalAlpha = 0.7;
    g.beginPath();
    g.ellipse(745, 205, 55, 14, 0.12, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = dark;
    for (const [x, y, rx, ry] of spots.dots) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.85;
    for (const x of spots.bands) {
      g.beginPath();
      g.moveTo(x - 22, 150);
      g.bezierCurveTo(x - 40, 300, x - 40, 420, x - 26, 600);
      g.lineTo(x + 26, 600);
      g.bezierCurveTo(x + 12, 420, x + 12, 300, x + 22, 150);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
    body(g);
    ink();

    g.beginPath();
    g.moveTo(848, 392);
    g.bezierCurveTo(870, 382, 892, 388, 894, 406);
    g.bezierCurveTo(896, 428, 870, 434, 858, 424);
    g.bezierCurveTo(846, 414, 842, 400, 848, 392);
    g.closePath();
    paint("#ef6050", 10);

    g.save();
    g.translate(455, 450);
    g.rotate(pose.fin);
    g.translate(-455, -450);
    g.beginPath();
    g.moveTo(455, 450);
    g.bezierCurveTo(470, 410, 540, 395, 610, 420);
    g.bezierCurveTo(615, 470, 590, 515, 540, 525);
    g.bezierCurveTo(490, 530, 450, 505, 455, 450);
    g.closePath();
    paint(fin);
    rays([[500, 440, 590, 432], [500, 470, 585, 470], [510, 500, 570, 505]], 11);
    g.restore();

    g.beginPath();
    g.arc(740, 335, 78, 0, Math.PI * 2);
    paint("#fff");
    g.beginPath();
    g.arc(772, 326, 46, 0, Math.PI * 2);
    g.fillStyle = "#111";
    g.fill();
    g.beginPath();
    g.arc(792, 308, 15, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();

    g.restore();
    const at = (x, y) => [OX + x * S, OY + y * S];
    return { hat: [...at(735, 186), 1], eyes: [[...at(752, 335), 78 * S]], neck: at(800, 500) };
  },
  turtle(g, color, skin, pose = TURTLE_REST) {
    const S = 0.134;
    const OX = -9;
    const OY = -1;
    const K = "#121212";
    const line = 15;
    const skinTone = "#7dc42a";
    const skinDark = "#4f9a1c";
    const scute = shade(color, -0.38);
    const rim = shade(color, -0.12);
    const top = shade(color, 0.22);
    const plastron = "#f7c95f";
    const variant = skin.pattern;

    const ink = (width = line) => {
      g.lineWidth = width;
      g.strokeStyle = K;
      g.stroke();
    };
    const paint = (fill, width = line) => {
      g.fillStyle = fill;
      g.fill();
      ink(width);
    };
    const turn = ([px, py], angle) => {
      g.translate(px, py);
      g.rotate(angle);
      g.translate(-px, -py);
    };
    const flipper = (pivot, angle, cx, cy, rx, ry, rot, spots) => {
      g.save();
      turn(pivot, angle);
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      paint(skinTone);
      g.fillStyle = skinDark;
      for (const [x, y, r] of spots) {
        g.beginPath();
        g.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    };
    const dome = (c) => {
      c.beginPath();
      c.moveTo(198, 352);
      c.bezierCurveTo(205, 225, 300, 130, 430, 126);
      c.bezierCurveTo(560, 122, 655, 215, 666, 350);
      c.bezierCurveTo(650, 395, 540, 432, 430, 434);
      c.bezierCurveTo(320, 434, 215, 400, 198, 352);
      c.closePath();
    };

    g.save();
    g.translate(OX, OY + pose.bob);
    g.scale(S, S);
    g.lineJoin = "round";
    g.lineCap = "round";
    turn([430, 330], pose.rock);

    flipper([228, 372], pose.backFar, 182, 356, 46, 27, 0.5, []);

    g.beginPath();
    g.moveTo(300, 430);
    g.bezierCurveTo(330, 505, 520, 510, 570, 440);
    g.closePath();
    paint(plastron);
    g.beginPath();
    g.moveTo(390, 452);
    g.bezierCurveTo(392, 470, 396, 488, 398, 500);
    g.moveTo(482, 455);
    g.bezierCurveTo(478, 472, 470, 488, 464, 498);
    g.strokeStyle = "#6b3b10";
    g.lineWidth = 10;
    g.stroke();

    g.save();
    turn([650, 300], pose.head * 0.5);
    g.beginPath();
    g.moveTo(620, 345);
    g.bezierCurveTo(660, 380, 700, 420, 740, 410);
    g.lineTo(700, 330);
    g.closePath();
    paint(skinTone);
    g.restore();

    flipper([300, 425], pose.back, 214, 476, 96, 44, -0.45, [[180, 462, 17], [222, 452, 16], [240, 488, 15], [196, 500, 13], [160, 488, 11]]);
    flipper([598, 432], pose.front, 650, 500, 48, 92, -0.38, [[612, 452, 14], [650, 470, 16], [664, 512, 15], [628, 494, 13], [668, 548, 12]]);

    dome(g);
    paint(color);
    g.save();
    dome(g);
    g.clip();
    g.fillStyle = top;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.ellipse(410, 190, 190, 70, -0.05, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.beginPath();
    g.moveTo(190, 330);
    g.bezierCurveTo(320, 395, 540, 400, 680, 330);
    g.lineTo(700, 460);
    g.lineTo(180, 460);
    g.closePath();
    g.fillStyle = variant === "stripes" ? shade(color, 0.45) : rim;
    g.fill();
    g.strokeStyle = scute;
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(195, 330);
    g.bezierCurveTo(320, 395, 540, 400, 680, 330);
    g.stroke();
    const hex = [[385, 214], [505, 214], [538, 282], [492, 348], [380, 348], [350, 282]];
    g.beginPath();
    hex.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.stroke();
    for (const [[x1, y1], [x2, y2]] of [
      [[385, 214], [362, 150]], [[505, 214], [548, 160]], [[350, 282], [235, 300]], [[538, 282], [655, 292]],
      [[380, 348], [368, 386]], [[492, 348], [508, 386]], [[235, 300], [222, 345]], [[655, 292], [650, 348]],
      [[362, 150], [250, 230]], [[548, 160], [632, 225]],
      [[280, 372], [276, 410]], [[430, 388], [430, 432]], [[580, 372], [586, 408]],
    ]) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }
    if (variant === "spots") {
      g.fillStyle = shade(color, 0.4);
      for (const [x, y, r] of [[445, 280, 26], [300, 265, 18], [590, 262, 18], [440, 170, 16], [300, 340, 12], [590, 335, 12]]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    } else if (variant === "belly") {
      g.fillStyle = shade(color, -0.25);
      g.beginPath();
      hex.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
    }
    g.restore();
    dome(g);
    ink();

    g.save();
    turn([660, 330], pose.head);
    g.beginPath();
    g.moveTo(655, 300);
    g.bezierCurveTo(655, 190, 740, 140, 822, 148);
    g.bezierCurveTo(900, 158, 932, 222, 924, 268);
    g.bezierCurveTo(948, 270, 950, 296, 926, 304);
    g.bezierCurveTo(905, 360, 840, 400, 760, 402);
    g.bezierCurveTo(700, 404, 655, 370, 655, 300);
    g.closePath();
    paint(skinTone);
    g.fillStyle = skinDark;
    for (const [x, y, rx, ry] of [[728, 204, 20, 16], [696, 246, 19, 18], [704, 292, 12, 11]]) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(805, 256, 64, 0, Math.PI * 2);
    paint("#fff");
    g.beginPath();
    g.arc(830, 256, 37, 0, Math.PI * 2);
    g.fillStyle = "#111";
    g.fill();
    g.beginPath();
    g.arc(848, 240, 12, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();
    g.beginPath();
    g.moveTo(846, 342);
    g.bezierCurveTo(870, 334, 894, 336, 906, 346);
    g.bezierCurveTo(904, 372, 884, 384, 868, 376);
    g.bezierCurveTo(854, 368, 846, 356, 846, 342);
    g.closePath();
    paint("#ef5a3a", 10);
    g.restore();

    g.restore();
    const at = (x, y) => [OX + x * S, OY + pose.bob + y * S];
    return { hat: [...at(800, 150), 0.95], eyes: [[...at(812, 256), 64 * S]], neck: at(720, 400) };
  },
  snail(g, color, skin, pose = SNAIL_REST) {
    const S = 0.136;
    const OX = -15;
    const OY = -4;
    const K = "#121212";
    const line = 15;
    const flesh = "#f6c54a";
    const fleshLight = "#fde3a0";
    const fleshDark = "#d8923a";
    const variant = skin.pattern;
    const reach = pose.reach;
    const drag = pose.tail;
    const ripple = (x) => Math.sin(x / 70 - pose.wave) * 7;

    const ink = (width = line) => {
      g.lineWidth = width;
      g.strokeStyle = K;
      g.stroke();
    };
    const paint = (fill, width = line) => {
      g.fillStyle = fill;
      g.fill();
      ink(width);
    };
    const body = (c) => {
      c.beginPath();
      c.moveTo(135 + drag, 578);
      c.bezierCurveTo(170 + drag, 556, 205 + drag, 545, 250, 532);
      c.lineTo(560, 495);
      c.bezierCurveTo(610 + reach * 0.4, 440, 650 + reach * 0.7, 330, 712 + reach, 292);
      c.bezierCurveTo(760 + reach, 262, 840 + reach, 262, 868 + reach, 318);
      c.bezierCurveTo(880 + reach, 345, 884 + reach, 368, 888 + reach, 380);
      c.bezierCurveTo(912 + reach, 386, 916 + reach, 420, 892 + reach, 430);
      c.bezierCurveTo(872 + reach, 450, 840 + reach, 462, 812 + reach, 468);
      c.bezierCurveTo(770 + reach * 0.9, 480, 745 + reach * 0.8, 520, 742 + reach * 0.7, 560);
      c.bezierCurveTo(742 + reach * 0.6, 590, 720 + reach * 0.5, 604, 690 + reach * 0.5, 604 + ripple(690));
      for (let x = 650; x >= 170; x -= 40) {
        const px = x + (drag * (650 - x)) / 480;
        c.lineTo(px, 608 + ripple(x));
      }
      c.bezierCurveTo(150 + drag, 604, 128 + drag, 596, 135 + drag, 578);
      c.closePath();
    };
    const stalk = (base, tip, angle, eyeR, pupil) => {
      g.save();
      g.translate(base[0] + reach, base[1]);
      g.rotate(angle);
      g.translate(-base[0] - reach, -base[1]);
      g.beginPath();
      g.moveTo(base[0] + reach, base[1]);
      g.quadraticCurveTo(base[0] + reach + (tip[0] - base[0]) * 0.3, (base[1] + tip[1]) / 2, tip[0] + reach, tip[1]);
      g.lineCap = "round";
      g.lineWidth = 50;
      g.strokeStyle = K;
      g.stroke();
      g.lineWidth = 22;
      g.strokeStyle = flesh;
      g.stroke();
      g.beginPath();
      g.arc(tip[0] + reach, tip[1] - eyeR * 0.7, eyeR, 0, Math.PI * 2);
      paint("#fff", 13);
      g.beginPath();
      g.arc(tip[0] + reach + pupil[0], tip[1] - eyeR * 0.7 + pupil[1], eyeR * 0.6, 0, Math.PI * 2);
      g.fillStyle = "#111";
      g.fill();
      g.beginPath();
      g.arc(tip[0] + reach + pupil[0] + eyeR * 0.22, tip[1] - eyeR * 0.7 + pupil[1] - eyeR * 0.22, eyeR * 0.18, 0, Math.PI * 2);
      g.fillStyle = "#fff";
      g.fill();
      g.restore();
    };

    g.save();
    g.translate(OX, OY);
    g.scale(S, S);
    g.lineJoin = "round";
    g.lineCap = "round";

    stalk([828, 292], [882, 205], pose.stalkFar, 42, [14, 0]);
    stalk([772, 290], [770, 172], pose.stalkNear, 46, [16, 2]);

    body(g);
    paint(flesh);
    g.save();
    body(g);
    g.clip();
    g.fillStyle = fleshLight;
    g.beginPath();
    g.moveTo(120, 590);
    g.bezierCurveTo(330, 572, 560, 560, 760 + reach, 520);
    g.lineTo(780 + reach, 660);
    g.lineTo(120, 660);
    g.closePath();
    g.fill();
    g.fillStyle = fleshDark;
    for (const [x, y, rx, ry] of [[678, 428, 17, 13], [648, 466, 16, 12], [610, 504, 14, 10]]) {
      g.beginPath();
      g.ellipse(x + reach * 0.6, y, rx, ry, -0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    body(g);
    ink();

    g.beginPath();
    g.arc(800 + reach, 360, 56, 0, Math.PI * 2);
    paint("#fff", 13);
    g.beginPath();
    g.arc(826 + reach, 356, 32, 0, Math.PI * 2);
    g.fillStyle = "#111";
    g.fill();
    g.beginPath();
    g.arc(838 + reach, 344, 10, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();
    g.beginPath();
    g.moveTo(836 + reach, 428);
    g.quadraticCurveTo(858 + reach, 446, 880 + reach, 424);
    ink(11);

    const shift = pose.shell;
    g.save();
    g.translate(shift, pose.lift);
    g.translate(410, 520);
    g.rotate(pose.rock);
    g.translate(-410, -520);
    const shell = (c) => {
      c.beginPath();
      c.ellipse(410, 335, 248, 212, -0.08, 0, Math.PI * 2);
    };
    shell(g);
    const tone = g.createRadialGradient(470, 230, 30, 410, 335, 270);
    tone.addColorStop(0, shade(color, 0.18));
    tone.addColorStop(0.65, color);
    tone.addColorStop(1, shade(color, -0.3));
    paint(tone);
    g.save();
    shell(g);
    g.clip();
    if (variant === "belly") {
      g.lineWidth = 60;
      g.strokeStyle = shade(color, -0.32);
      shell(g);
      g.stroke();
    }
    const spiral = (from, to) => {
      g.beginPath();
      for (let a = from; a <= to; a += 0.08) {
        const r = 6 + a * 11.5;
        const x = 292 + r * 0.3 + Math.cos(a + 0.4) * r;
        const y = 366 - r * 0.1 + Math.sin(a + 0.4) * r * 0.94;
        if (a === from) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    };
    spiral(0.5, 13);
    g.lineWidth = 44;
    g.strokeStyle = shade(color, -0.3);
    g.globalAlpha = 0.55;
    g.stroke();
    g.globalAlpha = 1;
    if (variant === "stripes") {
      g.save();
      g.translate(-24, -16);
      spiral(4, 13);
      g.restore();
      g.lineWidth = 14;
      g.strokeStyle = shade(color, 0.45);
      g.stroke();
    }
    if (variant === "spots") {
      g.fillStyle = shade(color, 0.42);
      for (const [x, y, r] of [[520, 260, 18], [560, 380, 16], [430, 470, 15], [250, 470, 13], [420, 170, 14], [600, 300, 12]]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = "#fff";
    g.globalAlpha = 0.38;
    for (const [x, y, rx, ry, rot] of [[492, 168, 54, 15, 0.22], [384, 286, 38, 11, 0.32], [300, 345, 16, 7, 0.9]]) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    spiral(0.5, 13);
    ink(14);
    g.restore();
    shell(g);
    ink();
    g.restore();

    g.restore();
    const at = (x, y) => [OX + x * S, OY + y * S];
    return { hat: [...at(796 + reach, 268), 0.75], eyes: [[...at(806 + reach, 360), 56 * S]], neck: at(780 + reach, 476) };
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
    for (const [ex, ey, er = 5] of anchors.eyes) {
      g.beginPath();
      g.ellipse(ex, ey, er * 1.2, er * 0.9, 0, 0, Math.PI * 2);
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

export const NO_PAD = { left: 0, top: 0, right: 0, bottom: 0 };
const PADS = { frog: { left: 64, top: 6, right: 0, bottom: 26 } };

export function bakeSprite(animal, skin, pose, pad = NO_PAD) {
  const canvas = document.createElement("canvas");
  canvas.width = (SPRITE_W + pad.left + pad.right) * BAKE;
  canvas.height = (SPRITE_H + pad.top + pad.bottom) * BAKE;
  const g = canvas.getContext("2d");
  g.scale(BAKE, BAKE);
  g.translate(pad.left, pad.top);
  g.lineJoin = "round";
  const draw = BODIES[animal] || BODIES.rabbit;
  const anchors = draw(g, skin.color, skin, pose);
  accessory(g, skin.accessory, anchors, skin.color);
  canvas.pad = pad;
  return canvas;
}

const CYCLES = {
  rabbit: [RABBIT_REST, RABBIT_RUN],
  fish: [FISH_REST, FISH_WAG],
  turtle: [TURTLE_REST, TURTLE_SWIM],
  snail: [SNAIL_REST, SNAIL_CRAWL],
  frog: [FROG_REST, FROG_HOP],
};

export function bakeFrames(animal, skin) {
  const cycle = CYCLES[animal];
  if (!cycle) return [bakeSprite(animal, skin)];
  const [rest, moving] = cycle;
  const pad = PADS[animal] || NO_PAD;
  return [bakeSprite(animal, skin, rest, pad), ...moving.map((pose) => bakeSprite(animal, skin, pose, pad))];
}
