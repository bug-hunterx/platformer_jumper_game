/* =====================================================================
   LAVA DASH — an auto-running platformer
   - Character runs left→right automatically; tap / Space to jump.
   - Double jump supported. Run speed ramps up the longer you survive.
   - Miss a platform and you fall into the lava. Game over.
   - Built mobile-landscape first: full-viewport, DPR-aware, touch driven.
   ===================================================================== */

(() => {
  "use strict";

  // ---------- Canvas setup ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // Logical (CSS-pixel) dimensions of the play area.
  let W = 0;
  let H = 0;
  let dpr = 1;

  // A scale unit derived from screen height keeps the game feeling the
  // same whether you're on a tiny phone or a large landscape display.
  let U = 1;

  // World layout (recomputed on resize, all derived from H).
  let groundY = 0; // top surface of the platforms
  let lavaTop = 0; // y where the lava begins (death line for the feet)

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    H = window.innerHeight;
    U = H / 720; // reference design height = 720

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    groundY = H * 0.72;
    lavaTop = H * 0.86;

    // Rescale existing platforms horizontally so an orientation change
    // mid-run doesn't break the layout.
    if (state === "playing" && lastW) {
      const r = W / lastW;
      for (const p of platforms) {
        p.x *= r;
        p.w *= r;
      }
    }
    lastW = W;

    // Keep the player glued to the surface / its run position.
    player.x = W * 0.22;
    if (state !== "playing") player.y = groundY - player.h;
  }
  let lastW = 0;

  // ---------- Tunable gameplay constants (all scaled by U at use) ----------
  const REF = {
    gravity: 2500,       // px/s^2
    jumpV: 980,          // initial jump velocity (px/s)
    doubleMult: 0.92,    // 2nd jump strength relative to first
    baseSpeed: 360,      // starting scroll speed (px/s)
    speedRamp: 9,        // speed gained per second survived
    maxSpeed: 760,       // speed cap
    playerW: 44,
    playerH: 52,
    minPlatW: 150,
    maxPlatW: 360,
    minGap: 95,
  };

  // ---------- Game state ----------
  let state = "start"; // "start" | "playing" | "dead"
  let speed = 0;
  let elapsed = 0;

  const player = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    vy: 0,
    grounded: true,
    jumps: 0,        // how many jumps used since leaving ground
    squash: 0,       // visual squash/stretch (-1..1), eased back to 0
  };

  let platforms = []; // { x, w }  (top is always groundY)
  let particles = [];
  let embers = [];
  let bgScroll = 0;

  // ---------- Helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);

  function airTime() {
    // Time the player spends airborne on a single jump (2*v/g).
    return (2 * REF.jumpV * U) / (REF.gravity * U);
  }

  // Largest gap that is still clearable with a single jump at the current
  // speed, with margin. Keeps the game fair as speed ramps up.
  function maxClearableGap() {
    return speed * airTime() * 0.62;
  }

  function spawnPlatform(x) {
    const w = rand(REF.minPlatW, REF.maxPlatW) * U;
    platforms.push({ x, w });
    return x + w;
  }

  function rightmostEdge() {
    let e = 0;
    for (const p of platforms) e = Math.max(e, p.x + p.w);
    return e;
  }

  function maybeSpawn() {
    // Keep spawning platforms until we have coverage past the right edge.
    while (rightmostEdge() < W + 260 * U) {
      const minG = REF.minGap * U;
      const maxG = Math.max(minG + 20 * U, maxClearableGap());
      const gap = rand(minG, maxG);
      spawnPlatform(rightmostEdge() + gap);
    }
  }

  // Is there a platform directly beneath this world x-coordinate?
  function supportedAt(cx) {
    for (const p of platforms) {
      if (cx >= p.x && cx <= p.x + p.w) return true;
    }
    return false;
  }

  // ---------- Lifecycle ----------
  function resetGame() {
    speed = REF.baseSpeed * U;
    elapsed = 0;
    particles = [];
    embers = [];

    player.w = REF.playerW * U;
    player.h = REF.playerH * U;
    player.x = W * 0.22;
    player.y = groundY - player.h;
    player.vy = 0;
    player.grounded = true;
    player.jumps = 0;
    player.squash = 0;

    // Build a generous opening platform under the player, then fill out.
    platforms = [{ x: -120 * U, w: W * 0.55 }];
    maybeSpawn();
  }

  function startGame() {
    resetGame();
    state = "playing";
    hide(startScreen);
    hide(gameoverScreen);
  }

  function gameOver() {
    state = "dead";
    spawnDeathBurst();
    show(gameoverScreen);
  }

  // ---------- Input ----------
  function jump() {
    if (player.grounded) {
      player.vy = -REF.jumpV * U;
      player.grounded = false;
      player.jumps = 1;
      player.squash = 0.6;
      spawnJumpPuff(false);
    } else if (player.jumps < 2) {
      player.vy = -REF.jumpV * U * REF.doubleMult;
      player.jumps = 2;
      player.squash = 0.6;
      spawnJumpPuff(true);
    }
  }

  function handleAction() {
    if (state === "playing") {
      jump();
    } else if (state === "start") {
      startGame();
    } else if (state === "dead") {
      startGame();
    }
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Space" || e.key === " " || e.code === "ArrowUp") {
        e.preventDefault();
        handleAction();
      }
    },
    { passive: false }
  );

  // Pointer events cover mouse + touch. Buttons also call handleAction.
  const wrap = document.getElementById("game-wrap");
  wrap.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      handleAction();
    },
    { passive: false }
  );

  // Stop iOS double-tap zoom / context menus from interrupting play.
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  const startScreen = document.getElementById("start-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const show = (el) => el.classList.remove("hidden");
  const hide = (el) => el.classList.add("hidden");
  // The on-screen buttons share the same action; pointerdown above already
  // fires, so we just prevent the click from doing anything extra.
  document.getElementById("start-btn").addEventListener("click", (e) => e.preventDefault());
  document.getElementById("restart-btn").addEventListener("click", (e) => e.preventDefault());

  // ---------- Particles ----------
  function spawnJumpPuff(isDouble) {
    const n = isDouble ? 14 : 8;
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h;
    for (let i = 0; i < n; i++) {
      const a = isDouble ? rand(0, Math.PI * 2) : rand(Math.PI * 0.15, Math.PI * 0.85);
      const sp = rand(40, 160) * U;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp - speed * 0.15,
        vy: (isDouble ? Math.sin(a) : Math.abs(Math.sin(a))) * sp,
        life: 1,
        r: rand(2, 5) * U,
        col: isDouble ? "180, 230, 255" : "255, 255, 255",
      });
    }
  }

  function spawnDeathBurst() {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 360) * U;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120 * U,
        life: 1,
        r: rand(2, 6) * U,
        col: i % 2 ? "255, 150, 60" : "255, 90, 70",
        grav: true,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.grav) p.vy += REF.gravity * U * 0.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.6;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Lava embers drifting upward for ambience.
    if (Math.random() < 0.4) {
      embers.push({
        x: rand(0, W),
        y: lavaTop + rand(0, 12) * U,
        vy: -rand(20, 60) * U,
        vx: rand(-15, 15) * U,
        life: 1,
        r: rand(1.5, 3.5) * U,
      });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt * 0.5;
      if (e.life <= 0) embers.splice(i, 1);
    }
  }

  // ---------- Update ----------
  function update(dt) {
    if (state !== "playing") {
      updateParticles(dt);
      bgScroll += 20 * U * dt;
      return;
    }

    elapsed += dt;
    speed = Math.min(REF.maxSpeed * U, (REF.baseSpeed + REF.speedRamp * elapsed) * U);
    bgScroll += speed * 0.25 * dt;

    // Scroll the world.
    for (const p of platforms) p.x -= speed * dt;
    while (platforms.length && platforms[0].x + platforms[0].w < -60 * U) {
      platforms.shift();
    }
    maybeSpawn();

    // Vertical physics with a clean "crossing the surface" landing test.
    const prevFeet = player.y + player.h;
    player.vy += REF.gravity * U * dt;
    player.y += player.vy * dt;
    const feet = player.y + player.h;
    const cx = player.x + player.w / 2;

    if (player.vy >= 0 && prevFeet <= groundY + 1 && feet >= groundY && supportedAt(cx)) {
      // Landed on a platform.
      player.y = groundY - player.h;
      player.vy = 0;
      if (!player.grounded) player.squash = -0.5; // landing squash
      player.grounded = true;
      player.jumps = 0;
    } else if (player.grounded && !supportedAt(cx)) {
      // Ran off the edge of a platform into a gap.
      player.grounded = false;
      if (player.jumps === 0) player.jumps = 1; // no free jump after walking off
    }

    // Ease the squash/stretch back to neutral.
    player.squash += (0 - player.squash) * Math.min(1, dt * 12);

    // Death: feet dip into the lava (or below the screen).
    if (feet > lavaTop + player.h * 0.15 || player.y > H) {
      gameOver();
    }

    updateParticles(dt);
  }

  // ---------- Rendering ----------
  function drawBackground() {
    // Sky gradient.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1b1030");
    sky.addColorStop(0.55, "#3a1840");
    sky.addColorStop(1, "#5e1f3a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Soft glowing orb (distant sun/moon) with slow parallax.
    const orbX = W * 0.78 - (bgScroll * 0.02) % (W + 400);
    const orbY = H * 0.26;
    const og = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 160 * U);
    og.addColorStop(0, "rgba(255, 200, 120, 0.55)");
    og.addColorStop(1, "rgba(255, 200, 120, 0)");
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, W, H);

    // Parallax ridge silhouette.
    drawRidge(0.5, H * 0.62, 70 * U, "rgba(20, 10, 28, 0.6)", 0.045);
    drawRidge(0.85, H * 0.66, 50 * U, "rgba(12, 6, 18, 0.8)", 0.08);
  }

  function drawRidge(phase, baseY, amp, color, parallax) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const step = 40;
    const off = bgScroll * parallax;
    for (let x = 0; x <= W + step; x += step) {
      const y =
        baseY +
        Math.sin((x + off) * 0.006 + phase * 10) * amp +
        Math.sin((x + off) * 0.013 + phase * 3) * amp * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawLava(time) {
    const amp = 6 * U;
    const flicker = 0.85 + Math.sin(time * 6) * 0.05 + Math.random() * 0.04;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, lavaTop);
    const step = 22;
    for (let x = 0; x <= W; x += step) {
      const y = lavaTop + Math.sin(x * 0.03 + time * 3) * amp + Math.sin(x * 0.07 - time * 2) * amp * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();

    const lg = ctx.createLinearGradient(0, lavaTop - 20 * U, 0, H);
    lg.addColorStop(0, `rgba(255, 240, 150, ${flicker})`);
    lg.addColorStop(0.18, "#ff8a2b");
    lg.addColorStop(0.6, "#e23c1e");
    lg.addColorStop(1, "#7a0d10");
    ctx.fillStyle = lg;
    ctx.fill();

    // Glowing surface line.
    ctx.shadowColor = "rgba(255, 170, 60, 0.9)";
    ctx.shadowBlur = 28 * U;
    ctx.strokeStyle = `rgba(255, 220, 130, ${flicker})`;
    ctx.lineWidth = 3 * U;
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) {
      const y = lavaTop + Math.sin(x * 0.03 + time * 3) * amp + Math.sin(x * 0.07 - time * 2) * amp * 0.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Embers.
    for (const e of embers) {
      ctx.globalAlpha = Math.max(0, e.life) * 0.9;
      ctx.fillStyle = "rgba(255, 190, 90, 1)";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPlatforms() {
    const bottom = lavaTop + 4 * U;
    for (const p of platforms) {
      const h = bottom - groundY;
      // Body.
      const g = ctx.createLinearGradient(0, groundY, 0, bottom);
      g.addColorStop(0, "#46506b");
      g.addColorStop(1, "#252a3d");
      ctx.fillStyle = g;
      roundRectPath(p.x, groundY, p.w, h, 10 * U);
      ctx.fill();

      // Neon top edge.
      ctx.save();
      ctx.shadowColor = "rgba(120, 220, 255, 0.8)";
      ctx.shadowBlur = 14 * U;
      ctx.fillStyle = "#8fe6ff";
      roundRectPath(p.x, groundY, p.w, 6 * U, 3 * U);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer() {
    if (state === "dead") return; // burst takes over

    const sx = 1 - player.squash * 0.4;
    const sy = 1 + player.squash * 0.4;
    const w = player.w * sx;
    const h = player.h * sy;
    const x = player.x + (player.w - w) / 2;
    const y = player.y + (player.h - h);

    ctx.save();
    ctx.shadowColor = "rgba(120, 255, 220, 0.8)";
    ctx.shadowBlur = 20 * U;

    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#9bffd9");
    g.addColorStop(1, "#22c3a6");
    ctx.fillStyle = g;
    roundRectPath(x, y, w, h, 12 * U);
    ctx.fill();
    ctx.restore();

    // Eyes (facing the run direction).
    ctx.fillStyle = "#0c2a26";
    const eyeR = 3.4 * U;
    const eyeY = y + h * 0.4;
    ctx.beginPath();
    ctx.arc(x + w * 0.62, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(x + w * 0.86, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = `rgba(${p.col}, 1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render(time) {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawPlatforms();
    drawPlayer();
    drawParticles();
    drawLava(time);
  }

  // ---------- Main loop ----------
  let lastT = 0;
  function loop(t) {
    const time = t / 1000;
    let dt = lastT ? time - lastT : 0;
    lastT = time;
    // Clamp dt so tab-switches / hitches don't tunnel the player through gaps.
    if (dt > 0.033) dt = 0.033;

    update(dt);
    render(time);
    requestAnimationFrame(loop);
  }

  // ---------- Boot ----------
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 120));

  resize();
  resetGame();      // pre-build a scene to show behind the start overlay
  state = "start";
  requestAnimationFrame(loop);
})();
