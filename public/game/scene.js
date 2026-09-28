(function () {
  const image = new Image();
  let lake = null;
  let ready = false;
  image.onload = function () { ready = true; };
  image.src = "lake.jpg";

  function hasDuck(node) {
    if (!node) return false;
    if (node.name === "duckColour") return true;
    const children = node.children || [];
    for (let i = 0; i < children.length; i++) if (hasDuck(children[i])) return true;
    return false;
  }

  function hideScenery(bg) {
    const keep = new Set([bg, lake]);
    function mark(node) {
      let duck = node.name === "duckColour";
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) if (mark(children[i])) duck = true;
      if (duck) keep.add(node);
      return duck;
    }
    mark(bg);
    function apply(node, underDuck) {
      const duck = underDuck || node.name === "duckColour";
      if (node !== bg && node !== lake) node.visible = !!(duck || keep.has(node));
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) apply(children[i], duck);
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
    const scale = Math.max(targetW / image.width, targetH / image.height);
    lake.scaleX = scale;
    lake.scaleY = scale;
    lake.x = origin.x + (targetW - image.width * scale) / 2;
    lake.y = origin.y + (targetH - image.height * scale) / 2;
  }

  function sync() {
    const settings = window.exportRoot && window.exportRoot.settings;
    const bg = settings && settings.bg;
    if (!ready || !bg || !settings || settings.visible === false) return;
    if (!bg._lakeReady) {
      if (!bg.cacheCanvas || bg.cacheCanvas.width < 800) return;
      bg._lakeReady = true;
    }
    if (bg.cacheCanvas && bg.uncache) bg.uncache();
    if (!lake) {
      lake = new createjs.Bitmap(image);
      lake.mouseEnabled = false;
      lake.name = "lake";
    }
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
      const result = original();
      sync();
      return result;
    };
    sync();
  }

  function boot() {
    if (!window.stage || !window.exportRoot || !window.createjs) return false;
    hook(window.stage);
    return true;
  }

  if (!boot()) {
    const wait = window.setInterval(function () {
      if (boot()) window.clearInterval(wait);
    }, 200);
  }
})();
