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
  seahorse: { label: "Seahorse", habitat: "Coral reef" },
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
  frog(g, color, skin) {
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

    toe(700, 545, 760, 552, under);
    toe(690, 545, 712, 570, under);
    g.beginPath();
    g.moveTo(640, 430);
    g.bezierCurveTo(675, 470, 690, 515, 700, 548);
    g.lineTo(730, 552);
    g.bezierCurveTo(710, 500, 700, 460, 690, 420);
    g.closePath();
    outline(under);

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

    toe(330, 540, 150, 522, color);
    toe(335, 552, 178, 572, color);
    toe(350, 560, 232, 592, color);
    g.beginPath();
    g.moveTo(190, 455);
    g.bezierCurveTo(230, 535, 330, 568, 440, 560);
    g.bezierCurveTo(455, 545, 450, 520, 430, 512);
    g.bezierCurveTo(340, 515, 270, 480, 240, 420);
    g.closePath();
    outline(under);

    const thigh = () => {
      g.beginPath();
      g.moveTo(175, 400);
      g.bezierCurveTo(170, 340, 260, 320, 330, 345);
      g.bezierCurveTo(400, 370, 445, 430, 440, 495);
      g.bezierCurveTo(435, 535, 380, 540, 330, 515);
      g.bezierCurveTo(260, 480, 180, 460, 175, 400);
      g.closePath();
    };
    thigh();
    outline(color);
    g.save();
    thigh();
    g.clip();
    g.beginPath();
    g.ellipse(300, 480, 170, 60, 0.35, 0, Math.PI * 2);
    g.fillStyle = under;
    g.fill();
    blots(spots.thigh);
    g.restore();
    thigh();
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.stroke();

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

export function bakeSprite(animal, skin, pose) {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_W * BAKE;
  canvas.height = SPRITE_H * BAKE;
  const g = canvas.getContext("2d");
  g.scale(BAKE, BAKE);
  g.lineJoin = "round";
  const draw = BODIES[animal] || BODIES.rabbit;
  const anchors = draw(g, skin.color, skin, pose);
  accessory(g, skin.accessory, anchors, skin.color);
  return canvas;
}

export function bakeFrames(animal, skin) {
  if (animal !== "rabbit") return [bakeSprite(animal, skin)];
  return [bakeSprite(animal, skin, RABBIT_REST), ...RABBIT_RUN.map((pose) => bakeSprite(animal, skin, pose))];
}
