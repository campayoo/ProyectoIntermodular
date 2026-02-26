// ============================================================
//  OCEAN CLEANUP – game.js
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── DOM refs ──────────────────────────────────────────────
const trashCountEl = document.getElementById('trash-count');
const fishCountEl = document.getElementById('fish-count');
const escapedCountEl = document.getElementById('escaped-count');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endMessage = document.getElementById('end-message');
const finalScoreEl = document.getElementById('final-score');
const finalTrashEl = document.getElementById('final-trash');
const penaltyPopup = document.getElementById('penalty-popup');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// ── Canvas size ───────────────────────────────────────────
function resizeCanvas() {
    const wrapper = document.getElementById('game-wrapper');
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
}
resizeCanvas();

// ── Constants ─────────────────────────────────────────────
const FISH_LIMIT = 5;   // max fish clicks before lose
const ESCAPED_LIMIT = 8;   // max trash escaped before lose
const GAME_DURATION = 15;  // seconds
const HUD_HEIGHT = 50;  // px reserved for HUD

// ── Trash types ───────────────────────────────────────────
const TRASH_TYPES = [
    { emoji: '🧴', label: 'Botella', points: 10, size: 38 },
    { emoji: '🛍️', label: 'Bolsa', points: 10, size: 40 },
    { emoji: '🥤', label: 'Vaso', points: 10, size: 34 },
    { emoji: '🪣', label: 'Cubo', points: 15, size: 42 },
    { emoji: '🔧', label: 'Herramienta', points: 12, size: 36 },
    { emoji: '📦', label: 'Caja', points: 12, size: 40 },
    { emoji: '🧲', label: 'Metal', points: 15, size: 36 },
    { emoji: '🪝', label: 'Anzuelo', points: 10, size: 34 },
];

// ── Fish types ────────────────────────────────────────────
const FISH_TYPES = [
    { emoji: '🐟', label: 'Pez común', protected: false, penalty: 5, penaltyFish: 1, size: 38 },
    { emoji: '🐠', label: 'Pez payaso', protected: false, penalty: 5, penaltyFish: 1, size: 38 },
    { emoji: '🐡', label: 'Pez globo', protected: false, penalty: 8, penaltyFish: 1, size: 40 },
    { emoji: '🦈', label: 'Tiburón', protected: true, penalty: 20, penaltyFish: 2, size: 52 },
    { emoji: '🐬', label: 'Delfín', protected: true, penalty: 20, penaltyFish: 2, size: 50 },
    { emoji: '🐢', label: 'Tortuga marina', protected: true, penalty: 25, penaltyFish: 2, size: 46 },
    { emoji: '🦭', label: 'Foca', protected: true, penalty: 20, penaltyFish: 2, size: 48 },
];

// ── Game state ────────────────────────────────────────────
let entities = [];
let score = 0;
let trashCount = 0;
let fishClicked = 0;
let escaped = 0;
let timeLeft = GAME_DURATION;
let running = false;
let spawnTimer = null;
let countdownTimer = null;
let animFrame = null;
let particles = [];
let bubbles = [];
let waveOffset = 0;

// ── Utility ───────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Ocean background layers ───────────────────────────────
function drawOcean() {
    const W = canvas.width, H = canvas.height;

    // Deep gradient
    const grad = ctx.createLinearGradient(0, HUD_HEIGHT, 0, H);
    grad.addColorStop(0, '#0a3a6e');
    grad.addColorStop(0.4, '#063060');
    grad.addColorStop(1, '#020f2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, HUD_HEIGHT, W, H - HUD_HEIGHT);

    // Light rays
    ctx.save();
    for (let i = 0; i < 6; i++) {
        const x = (W / 6) * i + W / 12;
        const rayGrad = ctx.createLinearGradient(x, HUD_HEIGHT, x + 60, H);
        rayGrad.addColorStop(0, 'rgba(100,200,255,0.06)');
        rayGrad.addColorStop(1, 'rgba(100,200,255,0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(x - 20, HUD_HEIGHT);
        ctx.lineTo(x + 80, H);
        ctx.lineTo(x + 20, H);
        ctx.lineTo(x - 80, HUD_HEIGHT);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    // Animated wave at top of ocean
    waveOffset += 0.02;
    ctx.save();
    ctx.fillStyle = 'rgba(0,180,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    for (let x = 0; x <= W; x += 10) {
        ctx.lineTo(x, HUD_HEIGHT + Math.sin(x * 0.02 + waveOffset) * 6);
    }
    ctx.lineTo(W, HUD_HEIGHT + 20);
    ctx.lineTo(0, HUD_HEIGHT + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sand bottom
    const sandGrad = ctx.createLinearGradient(0, H - 60, 0, H);
    sandGrad.addColorStop(0, 'rgba(180,140,60,0)');
    sandGrad.addColorStop(1, 'rgba(180,140,60,0.35)');
    ctx.fillStyle = sandGrad;
    ctx.fillRect(0, H - 60, W, 60);
}

// ── Bubbles ───────────────────────────────────────────────
function spawnBubbles() {
    for (let i = 0; i < 15; i++) {
        bubbles.push({
            x: rand(0, canvas.width),
            y: rand(HUD_HEIGHT, canvas.height),
            r: rand(2, 7),
            speed: rand(0.3, 1.2),
            alpha: rand(0.1, 0.4),
        });
    }
}

function updateDrawBubbles() {
    for (const b of bubbles) {
        b.y -= b.speed;
        if (b.y < HUD_HEIGHT) {
            b.y = canvas.height;
            b.x = rand(0, canvas.width);
        }
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.strokeStyle = '#7ee8ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// ── Particles (click feedback) ────────────────────────────
function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(1.5, 5);
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            color,
            r: rand(3, 7),
        });
    }
}

function updateDrawParticles() {
    particles = particles.filter(p => p.alpha > 0.02);
    for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.alpha -= 0.03;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ── Entity creation ───────────────────────────────────────
function createEntity() {
    const W = canvas.width, H = canvas.height;
    const isTrash = Math.random() < 0.35; // 35% trash, 65% fish
    const type = isTrash ? pick(TRASH_TYPES) : pick(FISH_TYPES);

    // Spawn from left or right edge, travel across
    const fromLeft = Math.random() < 0.5;
    const y = rand(HUD_HEIGHT + 40, H - 40);
    const speed = rand(3.5, 7.5);

    return {
        isTrash,
        type,
        x: fromLeft ? -type.size : W + type.size,
        y,
        vx: fromLeft ? speed : -speed,
        vy: rand(-0.3, 0.3),
        size: type.size,
        emoji: type.emoji,
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.05, 0.12),
        scale: 1,
        scaleDir: 0,
        alive: true,
        // glow for protected fish
        protected: !isTrash && type.protected,
    };
}

function spawnEntity() {
    if (!running) return;
    entities.push(createEntity());
    // Vary spawn interval: faster as time runs out
    const elapsed = GAME_DURATION - timeLeft;
    const interval = Math.max(200, 700 - elapsed * 30);
    spawnTimer = setTimeout(spawnEntity, interval);
}

// ── Draw entity ───────────────────────────────────────────
function drawEntity(e) {
    ctx.save();
    ctx.translate(e.x, e.y + Math.sin(e.wobble) * 4);

    // Glow for protected species
    if (e.protected) {
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 18;
    } else if (e.isTrash) {
        ctx.shadowColor = 'rgba(255,200,0,0.5)';
        ctx.shadowBlur = 10;
    }

    ctx.font = `${e.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Flip emoji if moving left
    if (e.vx < 0) {
        ctx.scale(-1, 1);
    }

    ctx.fillText(e.emoji, 0, 0);

    // Protected badge
    if (e.protected) {
        ctx.shadowBlur = 0;
        ctx.font = '14px serif';
        ctx.fillText('⚠️', e.size * 0.5 * (e.vx < 0 ? -1 : 1), -e.size * 0.5);
    }

    ctx.restore();
}

// ── Hit test ──────────────────────────────────────────────
function hitTest(e, cx, cy) {
    const dx = e.x - cx;
    const dy = (e.y + Math.sin(e.wobble) * 4) - cy;
    return Math.sqrt(dx * dx + dy * dy) < e.size * 0.6;
}

// ── Show floating text ────────────────────────────────────
function showPopup(text, x, y, color) {
    const el = penaltyPopup;
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${x}px`;
    el.style.top = `${y - 20}px`;
    el.style.opacity = '1';
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.classList.add('hidden'), 300);
    }, 700);
}

// ── Update HUD ────────────────────────────────────────────
function updateHUD() {
    trashCountEl.textContent = trashCount;
    fishCountEl.textContent = fishClicked;
    escapedCountEl.textContent = escaped;
    scoreEl.textContent = score;
    timerEl.textContent = timeLeft;
}

// ── Check lose conditions ─────────────────────────────────
function checkLose() {
    if (fishClicked >= FISH_LIMIT) {
        endGame(false, '¡Capturaste demasiados peces! El ecosistema está dañado. 🐟');
        return true;
    }
    if (escaped >= ESCAPED_LIMIT) {
        endGame(false, '¡Demasiada basura escapó al fondo del océano! 🌊');
        return true;
    }
    return false;
}

// ── End game ──────────────────────────────────────────────
function endGame(win, message) {
    running = false;
    clearTimeout(spawnTimer);
    clearInterval(countdownTimer);
    cancelAnimationFrame(animFrame);

    endTitle.textContent = win ? '¡Océano limpio! 🌊✨' : '¡Game Over! 💀';
    endMessage.textContent = message;
    finalScoreEl.textContent = score;
    finalTrashEl.textContent = trashCount;
    endScreen.classList.remove('hidden');
}

// ── Main game loop ────────────────────────────────────────
function gameLoop() {
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    drawOcean();
    updateDrawBubbles();

    // Update & draw entities
    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        if (!e.alive) { entities.splice(i, 1); continue; }

        e.x += e.vx;
        e.y += e.vy;
        e.wobble += e.wobbleSpeed;

        // Bounce vertically within ocean area
        if (e.y < HUD_HEIGHT + e.size || e.y > H - e.size) e.vy *= -1;

        // Off screen → escaped (only trash counts)
        const offLeft = e.x < -e.size * 2;
        const offRight = e.x > W + e.size * 2;
        if (offLeft || offRight) {
            if (e.isTrash) {
                escaped++;
                spawnParticles(offLeft ? 0 : W, e.y, '#ff6600', 6);
                if (checkLose()) return;
                updateHUD();
            }
            entities.splice(i, 1);
            continue;
        }

        drawEntity(e);
    }

    updateDrawParticles();

    if (running) animFrame = requestAnimationFrame(gameLoop);
}

// ── Canvas click handler ──────────────────────────────────
canvas.addEventListener('click', (ev) => {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (ev.clientY - rect.top) * (canvas.height / rect.height);

    // Check entities in reverse (top-most first)
    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        if (!e.alive) continue;
        if (!hitTest(e, cx, cy)) continue;

        e.alive = false;

        if (e.isTrash) {
            // ✅ Good click – trash collected
            score += e.type.points;
            trashCount++;
            spawnParticles(e.x, e.y, '#00e5ff', 12);
            showPopup(`+${e.type.points} ♻️`, ev.clientX - rect.left, ev.clientY - rect.top, '#00e5ff');
        } else {
            // ❌ Bad click – fish caught
            const ft = e.type;
            score = Math.max(0, score - ft.penalty);
            fishClicked += ft.penaltyFish;
            spawnParticles(e.x, e.y, e.protected ? '#ff2222' : '#ff9900', 14);
            const label = e.protected ? `⚠️ ${ft.label} PROTEGIDO -${ft.penalty}` : `-${ft.penalty} 🐟`;
            showPopup(label, ev.clientX - rect.left, ev.clientY - rect.top, e.protected ? '#ff4444' : '#ffaa00');
            if (checkLose()) return;
        }

        updateHUD();
        break;
    }
});

// ── Start / Restart ───────────────────────────────────────
function startGame() {
    // Reset state
    entities = [];
    particles = [];
    score = 0;
    trashCount = 0;
    fishClicked = 0;
    escaped = 0;
    timeLeft = GAME_DURATION;
    running = true;

    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    penaltyPopup.classList.add('hidden');

    spawnBubbles();
    updateHUD();

    // Countdown
    countdownTimer = setInterval(() => {
        if (!running) return;
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            endGame(true, `¡Tiempo agotado! Recogiste ${trashCount} basuras y salvaste el océano. 🌊`);
        }
    }, 1000);

    // Spawn first entity after short delay
    spawnTimer = setTimeout(spawnEntity, 500);

    // Start loop
    gameLoop();
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// ── Initial bubble render (title screen) ─────────────────
spawnBubbles();
(function titleLoop() {
    if (running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawOcean();
    updateDrawBubbles();
    requestAnimationFrame(titleLoop);
})();
