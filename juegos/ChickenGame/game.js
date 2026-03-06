// ============================================================
//  CHICKEN CROSSING – game.js
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 600, H = 700;
canvas.width = W;
canvas.height = H;

// ---- DOM ----
const hudLevel = document.getElementById('hud-level');
const hudLives = document.getElementById('hud-lives');
const hudTimer = document.getElementById('hud-timer'); // Changed from score
const goScore = document.getElementById('go-score');
const goMsg = document.getElementById('go-msg');
const winMsg = document.getElementById('win-msg');

const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const winScreen = document.getElementById('win-screen');

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-next').addEventListener('click', nextLevel);

// ============================================================
//  LAYOUT CONSTANTS
// ============================================================
const HUD_H = 36;   // pixels reserved for HUD at top
const SAFE_TOP = HUD_H + 10;
const SAFE_BOT = H - 10;
const ROAD_TOP = HUD_H + 80;
const ROAD_BOT = H - 80;
const ROAD_H = ROAD_BOT - ROAD_TOP;

const LANE_COUNT = 4;
const LANE_H = ROAD_H / LANE_COUNT;

// Chicken constants
const CHICK_W = 36, CHICK_H = 36;
const CHICK_START_X = W / 2;
const CHICK_START_Y = ROAD_BOT + 30;
const CHICK_MOVE_DIST = LANE_H;   // one lane per move
const CHICK_MOVE_SPEED = 5.5;     // Balanced responsiveness

// ============================================================
//  STATE
// ============================================================
let state = 'start';
let level = 1;
let lives = 3;
let animId;
let keys = {};

let chicken, lanes, particles;
let deathFlash = 0;   // frames of red flash on death
let timeLeft = 15;
let lastTimerUpdate = 0;

// ============================================================
//  INPUT
// ============================================================
window.addEventListener('keydown', e => {
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (state !== 'playing') return;

    if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !chicken.moving) {
        startMove('up');
    }
    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && !chicken.moving) {
        startMove('left');
    }
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && !chicken.moving) {
        startMove('right');
    }
    // Allow moving backwards (down) too
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !chicken.moving) {
        startMove('down');
    }
});

window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { keys = {}; });
window.addEventListener('focus', () => { keys = {}; });

// ============================================================
//  HELPERS
// ============================================================
function rand(a, b) { return Math.random() * (b - a) + a; }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

function showScreen(el) {
    [startScreen, gameoverScreen, winScreen].forEach(s => s.classList.remove('active'));
    if (el) el.classList.add('active');
}

function updateHUD() {
    hudLevel.textContent = level;
    hudLives.textContent = lives;
    hudTimer.textContent = timeLeft;
}

// ============================================================
//  PARTICLES
// ============================================================
function spawnParticles(x, y, color, n = 10, spd = 3) {
    for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        particles.push({
            x, y,
            vx: Math.cos(a) * rand(0.5, spd),
            vy: Math.sin(a) * rand(0.5, spd),
            r: rand(3, 8),
            life: 1,
            decay: rand(0.025, 0.055),
            color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.08;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

// ============================================================
//  CHICKEN
// ============================================================
function createChicken() {
    return {
        x: CHICK_START_X,
        y: CHICK_START_Y,
        targetX: CHICK_START_X,
        targetY: CHICK_START_Y,
        moving: false,
        facing: 1,       // 1 = right, -1 = left
        wingPhase: 0,
        laneIndex: -1,   // -1 = safe zone below road
        dead: false,
        safe: false,     // reached the other side
        stepsTaken: 0
    };
}

function startMove(dir) {
    if (chicken.dead || chicken.safe) return;

    // Always sync current position to targets before starting a new move
    // to prevent any accumulated drift or diagonal jumps
    chicken.targetX = chicken.x;
    chicken.targetY = chicken.y;

    if (dir === 'left' || dir === 'right') {
        const step = dir === 'left' ? -LANE_H / 2 : LANE_H / 2;
        const newX = chicken.x + step;
        if (newX < 30 || newX > W - 30) return;
        chicken.targetX = newX;
        chicken.facing = dir === 'left' ? -1 : 1;
    } else {
        const step = dir === 'up' ? -LANE_H : LANE_H;
        const newY = chicken.y + step;
        if (newY < ROAD_TOP - LANE_H) return;
        if (newY > CHICK_START_Y + 5) return;
        chicken.targetY = newY;
    }

    chicken.moving = true;
    if (dir === 'up') chicken.stepsTaken++;
}

function updateChicken() {
    chicken.wingPhase += 0.18;

    if (chicken.dead) return; // Stop all movement logic if already dead

    if (chicken.moving) {
        const dx = chicken.targetX - chicken.x;
        const dy = chicken.targetY - chicken.y;

        if (Math.abs(dx) <= CHICK_MOVE_SPEED && Math.abs(dy) <= CHICK_MOVE_SPEED) {
            chicken.x = chicken.targetX;
            chicken.y = chicken.targetY;
            chicken.moving = false;
            // Check if reached safe zone on other side (y <= top safe zone boundary)
            if (chicken.y <= ROAD_TOP - LANE_H * 0.5 && state === 'playing') {
                chicken.safe = true;
                spawnParticles(chicken.x, chicken.y, '#ffe44d', 20, 4);
                spawnParticles(chicken.x, chicken.y, '#fff', 10, 2);
                setTimeout(() => {
                    if (!chicken.dead) onChickenSafe();
                }, 600);
            }
        } else {
            chicken.x += Math.sign(dx) * CHICK_MOVE_SPEED;
            chicken.y += Math.sign(dy) * CHICK_MOVE_SPEED;
        }
    }

    // Determine current lane index (0 = top lane, LANE_COUNT-1 = bottom lane)
    chicken.laneIndex = Math.floor((chicken.y - ROAD_TOP) / LANE_H);
}

function drawChicken() {
    const { x, y, facing, wingPhase, dead } = chicken;
    if (dead) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing flap
    const wf = Math.sin(wingPhase) * 5;
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.ellipse(-12, -2 + wf, 10, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 18);
    bodyGrad.addColorStop(0, '#fff5e0');
    bodyGrad.addColorStop(1, '#d4a017');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail feathers
    ctx.fillStyle = '#c8920a';
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-22, -14);
    ctx.lineTo(-18, -3);
    ctx.lineTo(-22, 4);
    ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#fff5e0';
    ctx.beginPath();
    ctx.arc(10, -12, 10, 0, Math.PI * 2);
    ctx.fill();

    // Comb
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(6, -20);
    ctx.lineTo(9, -26);
    ctx.lineTo(12, -20);
    ctx.lineTo(15, -26);
    ctx.lineTo(18, -20);
    ctx.closePath();
    ctx.fill();

    // Wattle
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.ellipse(14, -6, 4, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f4a261';
    ctx.beginPath();
    ctx.moveTo(19, -12);
    ctx.lineTo(27, -10);
    ctx.lineTo(19, -8);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(14, -14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15, -15, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#f4a261';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const legSwing = Math.sin(wingPhase * 2) * 4;
    ctx.beginPath();
    ctx.moveTo(-3, 14); ctx.lineTo(-3 + legSwing, 22);
    ctx.moveTo(5, 14); ctx.lineTo(5 - legSwing, 22);
    ctx.stroke();

    ctx.restore();
}

// ============================================================
//  LANES & VEHICLES
// ============================================================
const VEHICLE_TYPES = [
    { emoji: '🚗', w: 52, h: 28, color: '#e63946' },
    { emoji: '🚕', w: 52, h: 28, color: '#f4a261' },
    { emoji: '🚙', w: 58, h: 30, color: '#457b9d' },
    { emoji: '🚌', w: 80, h: 32, color: '#2a9d8f' },
    { emoji: '🚛', w: 90, h: 32, color: '#6d6875' },
    { emoji: '🏎️', w: 56, h: 24, color: '#e9c46a' },
    { emoji: '🚐', w: 68, h: 30, color: '#264653' },
];

function getLaneConfig(laneIdx) {
    // Alternate directions per lane
    const dir = laneIdx % 2 === 0 ? 1 : -1;
    // Add a bit of speed variation between lanes so they don't move in lock-step
    const speed = (0.6 + level * 0.12) + rand(-0.1, 0.1);
    const gap = Math.max(200 - level * 8, 100);
    return { dir, speed, gap };
}

function createLane(laneIdx) {
    const cfg = getLaneConfig(laneIdx);
    const y = ROAD_TOP + laneIdx * LANE_H + LANE_H / 2;
    const vehicles = [];

    const wrapExtra = 200;
    const totalLen = W + wrapExtra;
    const maxCars = 2 + Math.min(Math.floor(level / 5), 2); // Slightly reduced density
    const step = totalLen / maxCars;

    // Add a random offset for the whole lane to break symmetry with other lanes
    const laneOffset = rand(0, totalLen);

    for (let i = 0; i < maxCars; i++) {
        const vt = VEHICLE_TYPES[randInt(0, VEHICLE_TYPES.length - 1)];
        // Add a micro-offset to individual cars so they aren't perfectly periodic
        const jitter = rand(-40, 40);
        const carX = (i * step + laneOffset + jitter) % totalLen;

        vehicles.push({
            x: cfg.dir > 0 ? carX : totalLen - carX,
            y,
            ...vt,
            dir: cfg.dir,
            speed: cfg.speed
        });
    }

    return { laneIdx, y, dir: cfg.dir, speed: cfg.speed, gap: cfg.gap, vehicles };
}

function updateLanes() {
    const wrapExtra = 200;
    const totalLen = W + wrapExtra;

    lanes.forEach(lane => {
        lane.vehicles.forEach(v => {
            v.x += v.speed * v.dir;

            // Circular movement: if it goes out one end, it comes in the other
            // This is mathematically guaranteed to preserve distance if speeds are identical
            if (v.dir > 0) {
                if (v.x > W + 100) v.x -= totalLen;
            } else {
                if (v.x < -100) v.x += totalLen;
            }
        });
    });
}

function drawRoad() {
    // Road background
    const roadGrad = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOT);
    roadGrad.addColorStop(0, '#2b2d42');
    roadGrad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, ROAD_TOP, W, ROAD_H);

    // Lane dividers
    for (let i = 1; i < LANE_COUNT; i++) {
        const ly = ROAD_TOP + i * LANE_H;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([20, 15]);
        ctx.beginPath();
        ctx.moveTo(0, ly); ctx.lineTo(W, ly);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Road edges
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, ROAD_TOP); ctx.lineTo(W, ROAD_TOP);
    ctx.moveTo(0, ROAD_BOT); ctx.lineTo(W, ROAD_BOT);
    ctx.stroke();

    // Direction arrows on lanes
    lanes.forEach(lane => {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.textBaseline = 'middle';
        for (let ax = 60; ax < W; ax += 120) {
            ctx.fillText(lane.dir > 0 ? '→' : '←', ax, lane.y);
        }
        ctx.restore();
    });
}

function drawVehicles() {
    lanes.forEach(lane => {
        lane.vehicles.forEach(v => {
            ctx.save();
            ctx.translate(v.x, v.y);
            if (v.dir < 0) ctx.scale(-1, 1);

            // Car body
            const vGrad = ctx.createLinearGradient(0, -v.h / 2, 0, v.h / 2);
            vGrad.addColorStop(0, lighten(v.color, 30));
            vGrad.addColorStop(1, v.color);
            ctx.fillStyle = vGrad;
            ctx.beginPath();
            ctx.roundRect(-v.w / 2, -v.h / 2, v.w, v.h, 6);
            ctx.fill();

            // Windows
            ctx.fillStyle = 'rgba(150,220,255,0.5)';
            ctx.beginPath();
            ctx.roundRect(-v.w / 2 + 8, -v.h / 2 + 4, v.w * 0.45, v.h - 8, 3);
            ctx.fill();

            // Headlights
            ctx.fillStyle = '#ffe44d';
            ctx.beginPath();
            ctx.ellipse(v.w / 2 - 5, -v.h / 4, 4, 3, 0, 0, Math.PI * 2);
            ctx.ellipse(v.w / 2 - 5, v.h / 4, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Taillights
            ctx.fillStyle = '#e63946';
            ctx.beginPath();
            ctx.ellipse(-v.w / 2 + 5, -v.h / 4, 3, 2.5, 0, 0, Math.PI * 2);
            ctx.ellipse(-v.w / 2 + 5, v.h / 4, 3, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    });
}

function lighten(hex, amt) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (num >> 16) + amt);
    const g = Math.min(255, ((num >> 8) & 0xff) + amt);
    const b = Math.min(255, (num & 0xff) + amt);
    return `rgb(${r},${g},${b})`;
}

// ============================================================
//  SAFE ZONES
// ============================================================
function drawSafeZones() {
    // Bottom safe zone (start)
    const botGrad = ctx.createLinearGradient(0, ROAD_BOT, 0, H);
    botGrad.addColorStop(0, '#2d6a4f');
    botGrad.addColorStop(1, '#1b4332');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, ROAD_BOT, W, H - ROAD_BOT);

    // Top safe zone (goal)
    const topGrad = ctx.createLinearGradient(0, HUD_H, 0, ROAD_TOP);
    topGrad.addColorStop(0, '#1b4332');
    topGrad.addColorStop(1, '#2d6a4f');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, HUD_H, W, ROAD_TOP - HUD_H);

    // Grass tufts bottom
    drawGrass(ROAD_BOT, H, 1);
    // Grass tufts top
    drawGrass(HUD_H, ROAD_TOP, -1);

    // Goal line indicator
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffe44d';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, ROAD_TOP - 2); ctx.lineTo(W, ROAD_TOP - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 13px Nunito, sans-serif';
    ctx.fillStyle = '#ffe44d';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 META', W / 2, ROAD_TOP - 10);
    ctx.restore();
}

function drawGrass(yTop, yBot, dir) {
    ctx.fillStyle = '#40916c';
    const h = yBot - yTop;
    for (let gx = 5; gx < W; gx += 18) {
        ctx.beginPath();
        ctx.moveTo(gx, dir > 0 ? yTop : yBot);
        ctx.lineTo(gx + 5, dir > 0 ? yTop - 12 : yBot + 12);
        ctx.lineTo(gx + 10, dir > 0 ? yTop : yBot);
        ctx.fill();
    }
}

// ============================================================
//  COLLISION DETECTION
// ============================================================
function checkCollisions() {
    // Immediate return if already dead or transitioning to win
    if (chicken.dead || chicken.safe) return;

    // Skip if chicken is in either safe zone (top or bottom)
    if (chicken.y >= ROAD_BOT - 5) return;
    if (chicken.y <= ROAD_TOP - 5) return;

    const cx = chicken.x;
    const cy = chicken.y;
    const cw = CHICK_W * 0.75; // Tighter, more realistic hitbox
    const ch = CHICK_H * 0.75;

    for (const lane of lanes) {
        for (const v of lane.vehicles) {
            const vLeft = v.x - v.w / 2;
            const vRight = v.x + v.w / 2;
            const vTop = v.y - v.h / 2;
            const vBot = v.y + v.h / 2;

            if (
                cx + cw > vLeft && cx - cw < vRight &&
                cy + ch > vTop && cy - ch < vBot
            ) {
                killChicken(v);
                return;
            }
        }
    }
}

function killChicken(v) {
    if (chicken.safe || chicken.dead || state !== 'playing') return; // Guard against multi-death or winning transition

    chicken.dead = true;
    deathFlash = 20;
    spawnParticles(chicken.x, chicken.y, '#ff6b6b', 18, 4);
    spawnParticles(chicken.x, chicken.y, '#fff5e0', 10, 2);
    setTimeout(() => {
        if (chicken.safe || state !== 'playing') return; // Final verification before processing life loss
        lives--;
        updateHUD();
        if (lives <= 0) {
            endGame(`Atropellada por un ${v.emoji}`);
        } else {
            // Respawn
            chicken.x = CHICK_START_X;
            chicken.y = CHICK_START_Y;
            chicken.targetX = CHICK_START_X;
            chicken.targetY = CHICK_START_Y;
            chicken.dead = false;
            chicken.moving = false;
            chicken.stepsTaken = 0;
        }
    }, 900);
}

function onChickenSafe() {
    if (chicken.dead || state !== 'playing') return; // Final guard
    updateHUD();
    spawnParticles(chicken.x, chicken.y, '#ffe44d', 25, 5);

    // One cross per level
    setTimeout(() => {
        if (chicken.dead || state !== 'playing') return;
        state = 'win';
        cancelAnimationFrame(animId);
        winMsg.textContent = `¡Cruzaste a tiempo! Nivel ${level} superado.`;
        showScreen(winScreen);
    }, 700);
}

function endGame(reason) {
    state = 'dead';
    cancelAnimationFrame(animId);
    goMsg.textContent = reason;
    goScore.textContent = `Nivel ${level}`; // Adapted from score
    showScreen(gameoverScreen);
}

// ============================================================
//  TIMING INDICATOR (gap finder)
// ============================================================
function drawTimingIndicator() {
    // For the lane the chicken is about to enter, show gap indicator
    const nextLane = chicken.laneIndex - 1;
    if (nextLane < 0 || nextLane >= LANE_COUNT) return;
    if (chicken.safe || chicken.dead) return;

    const lane = lanes[nextLane];
    if (!lane) return;

    // Find nearest gap
    const y = lane.y;
    const cx = chicken.x;

    // Check if chicken's x position is in a gap
    let inGap = true;
    let nearestVehicle = null;
    let nearestDist = Infinity;

    lane.vehicles.forEach(v => {
        const vLeft = v.x - v.w / 2 - 10;
        const vRight = v.x + v.w / 2 + 10;
        if (cx > vLeft && cx < vRight) inGap = false;
        const d = Math.abs(v.x - cx);
        if (d < nearestDist) { nearestDist = d; nearestVehicle = v; }
    });

    // Draw a small indicator above the chicken
    ctx.save();
    ctx.font = 'bold 13px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (inGap) {
        ctx.fillStyle = '#52b788';
        ctx.globalAlpha = 0.9;
        ctx.fillText('✓ ¡AHORA!', chicken.x, chicken.y - 50);
    } else {
        ctx.fillStyle = '#ff6b6b';
        ctx.globalAlpha = 0.7;
        ctx.fillText('⚠ espera...', chicken.x, chicken.y - 50);
    }
    ctx.restore();
}

// ============================================================
//  CROSSING PROGRESS UI (Removed)
// ============================================================
function drawCrossingProgress() {
    // Hidden since it's 1-to-1 crossing now, no need.
}

// ============================================================
//  BACKGROUND
// ============================================================
function drawBackground() {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, HUD_H);
    sky.addColorStop(0, '#0d1117');
    sky.addColorStop(1, '#1a2a3a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HUD_H);
}

// ============================================================
//  MAIN LOOP
// ============================================================
let lastTime = 0;

function gameLoop(ts) {
    const dt = ts - lastTime;
    lastTime = ts;

    ctx.clearRect(0, 0, W, H);

    drawBackground();
    drawSafeZones();
    drawRoad();
    updateLanes();
    drawVehicles();
    drawCrossingProgress();
    drawTimingIndicator();
    updateChicken();
    checkCollisions();
    updateParticles();
    drawParticles();
    drawChicken();

    // Timer logic 
    if (state === 'playing' && !chicken.safe) {
        if (ts - lastTimerUpdate > 1000) {
            timeLeft--;
            lastTimerUpdate = ts;
            updateHUD();

            if (timeLeft <= 0) {
                endGame('¡Tiempo Agotado!');
                return; // Stop rendering this loop
            }
        }
    }

    // Death flash
    if (deathFlash > 0) {
        ctx.save();
        ctx.globalAlpha = (deathFlash / 20) * 0.45;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        deathFlash--;
    }

    if (state === 'playing') {
        animId = requestAnimationFrame(gameLoop);
    }
}

// ============================================================
//  INIT
// ============================================================
function initLevel() {
    particles = [];
    chicken = createChicken();
    lanes = [];
    for (let i = 0; i < LANE_COUNT; i++) {
        lanes.push(createLane(i));
    }
    updateHUD();
}

function startGame() {
    level = 1;
    lives = 3;
    timeLeft = 15;
    state = 'playing';
    showScreen(null);
    initLevel();
    lastTime = performance.now();
    lastTimerUpdate = lastTime;
    animId = requestAnimationFrame(gameLoop);
}

function nextLevel() {
    level++;
    lives = 3;
    timeLeft = 15;
    state = 'playing';
    showScreen(null);
    initLevel();
    lastTime = performance.now();
    lastTimerUpdate = lastTime;
    animId = requestAnimationFrame(gameLoop);
}
