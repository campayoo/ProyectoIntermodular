/**
 * Microjuego "Planeta Limpio" - ODS 12
 * Evolución: Vista Top-Down, Luces Estáticas y Feedback Visual
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// UI Elements
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');
const roundElement = document.getElementById('round');
const targetElement = document.getElementById('target');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const feedbackText = document.getElementById('feedback-text');
const nextRoundScreen = document.getElementById('next-round');

// ---- DIFFICULTY SCALING ----
const urlParams = new URLSearchParams(window.location.search);
const multiplier = parseFloat(urlParams.get('multiplier')) || 1.0;
// ----------------------------

let score = 0;
let totalScore = 0;
let timeLeft = Math.max(5, Math.ceil(15 / multiplier)); // Rondas de 15 segundos
let currentRound = 1;
let trashGoal = 5;
let gameActive = true;
let objects = [];
let floatingTexts = [];
let spawnRate = 0.02 * multiplier; // Empieza más fácil
let maxObjects = Math.ceil(4 * multiplier);  // Pocas cosas al principio
let mouseX = canvas.width / 2;
let particles = [];
let lightPulse = 0;

// Iconos vectoriales
const TRASH_ICONS = ['🥫', '🥤', '🥡', '🧴'];
const REUSABLE_ICONS = ['🍃', '🍎', '♻️', '🥗'];
const CATCHER_ICON = '🗑️';

/**
 * Clase para el feedback visual de puntos
 */
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.opacity = 1;
        this.speedY = -1.5;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }

    update() {
        this.y += this.speedY;
        this.opacity -= 0.02;
        return this.opacity > 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 6;
        this.speedY = (Math.random() - 0.5) * 6;
        this.opacity = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.opacity -= 0.03;
        return this.opacity > 0;
    }
}

class Catcher {
    constructor() {
        this.width = 80;
        this.height = 80;
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.icon = CATCHER_ICON;
    }

    draw() {
        ctx.save();
        ctx.font = '70px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, this.x, this.y);
        ctx.restore();
    }

    update(mx) {
        // Suavizar el movimiento del recolector
        this.x += (mx - this.x) * 0.2;

        // Limitar a los bordes del canvas
        if (this.x < this.width / 2) this.x = this.width / 2;
        if (this.x > canvas.width - this.width / 2) this.x = canvas.width - this.width / 2;
    }
}

const catcher = new Catcher();

class Waste {
    constructor() {
        this.radius = 28;
        this.x = Math.random() * (canvas.width - 120) + 60;
        this.y = -50; // Aparece desde arriba

        this.opacity = 1; // Directamente visible
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.04;
        
        // ---- DIFFICULTY SCALING ----
        this.fallSpeed = (1.5 + Math.random() * 1.5 + (currentRound * 0.3)) * multiplier;
        // ----------------------------

        const randomType = Math.random();
        if (randomType < 0.75) {
            this.type = 'trash';
            this.icon = TRASH_ICONS[Math.floor(Math.random() * TRASH_ICONS.length)];
            this.points = 1;
        } else {
            this.type = 'reusable';
            this.icon = REUSABLE_ICONS[Math.floor(Math.random() * REUSABLE_ICONS.length)];
            this.points = -3;
        }

        this.spawnTime = Date.now();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;

        ctx.font = `${this.radius * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Efecto Bloom/Glow para los objetos
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.type === 'trash' ? 'rgba(139, 195, 74, 0.4)' : 'rgba(211, 47, 47, 0.4)';

        ctx.fillText(this.icon, 0, 0);
        ctx.restore();
    }

    update() {
        this.y += this.fallSpeed;
        this.rotation += this.rotationSpeed;

        // Si sale por debajo de la pantalla, desaparece
        return this.y < canvas.height + 50;
    }

    checkCollision(catcher) {
        const dist = Math.sqrt((this.x - catcher.x) ** 2 + (this.y - catcher.y) ** 2);
        return dist < this.radius + 30;
    }
}

function drawCityTopDown() {
    // Fondo base - Asfalto oscuro
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Textura de asfalto (grano sutil)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < canvas.width; i += 40) {
        for (let j = 0; j < canvas.height; j += 40) {
            ctx.fillRect(i + Math.random() * 40, j + Math.random() * 40, 2, 2);
        }
    }

    // Configuración de Carreteras (Cuadrícula)
    const roadWidth = 80;
    const roadsX = [canvas.width * 0.25, canvas.width * 0.75];
    const roadsY = [canvas.height * 0.3, canvas.height * 0.7];

    // Dibujar Carreteras
    ctx.fillStyle = '#222';
    roadsX.forEach(x => ctx.fillRect(x - roadWidth / 2, 0, roadWidth, canvas.height));
    roadsY.forEach(y => ctx.fillRect(0, y - roadWidth / 2, canvas.width, roadWidth));

    // Líneas de Carretera (Pintura)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([20, 20]);
    ctx.lineWidth = 2;

    roadsX.forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    });
    roadsY.forEach(y => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    });
    ctx.setLineDash([]);

    // Manzanas y Edificios
    const blocks = [
        { x: 0, y: 0, w: roadsX[0] - roadWidth / 2, h: roadsY[0] - roadWidth / 2 },
        { x: roadsX[0] + roadWidth / 2, y: 0, w: roadsX[1] - roadsX[0] - roadWidth, h: roadsY[0] - roadWidth / 2 },
        { x: roadsX[1] + roadWidth / 2, y: 0, w: canvas.width - (roadsX[1] + roadWidth / 2), h: roadsY[0] - roadWidth / 2 },

        { x: 0, y: roadsY[0] + roadWidth / 2, w: roadsX[0] - roadWidth / 2, h: roadsY[1] - roadsY[0] - roadWidth },
        { x: roadsX[0] + roadWidth / 2, y: roadsY[0] + roadWidth / 2, w: roadsX[1] - roadsX[0] - roadWidth, h: roadsY[1] - roadsY[0] - roadWidth },
        { x: roadsX[1] + roadWidth / 2, y: roadsY[0] + roadWidth / 2, w: canvas.width - (roadsX[1] + roadWidth / 2), h: roadsY[1] - roadsY[0] - roadWidth },

        { x: 0, y: roadsY[1] + roadWidth / 2, w: roadsX[0] - roadWidth / 2, h: canvas.height - (roadsY[1] + roadWidth / 2) },
        { x: roadsX[0] + roadWidth / 2, y: roadsY[1] + roadWidth / 2, w: roadsX[1] - roadsX[0] - roadWidth, h: canvas.height - (roadsY[1] + roadWidth / 2) },
        { x: roadsX[1] + roadWidth / 2, y: roadsY[1] + roadWidth / 2, w: canvas.width - (roadsX[1] + roadWidth / 2), h: canvas.height - (roadsY[1] + roadWidth / 2) }
    ];

    blocks.forEach((b, index) => {
        // Aceras
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);

        // Espacios Verdes (algunos bloques)
        if (index % 3 === 0) {
            ctx.fillStyle = '#1b2e1b';
            ctx.fillRect(b.x + 15, b.y + 15, b.w - 30, b.h - 30);
        }

        // Edificios
        const buildPadding = 25;
        if (b.w > 60 && b.h > 60) {
            // Sombra
            ctx.fillStyle = '#050505';
            ctx.fillRect(b.x + buildPadding + 5, b.y + buildPadding + 5, b.w - buildPadding * 2, b.h - buildPadding * 2);
            // Estructura
            ctx.fillStyle = index % 2 === 0 ? '#111' : '#151515';
            ctx.fillRect(b.x + buildPadding, b.y + buildPadding, b.w - buildPadding * 2, b.h - buildPadding * 2);
            // Detalles de tejado/ventanas (muy sutil)
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.strokeRect(b.x + buildPadding + 10, b.y + buildPadding + 10, b.w - buildPadding * 2 - 20, b.h - buildPadding * 2 - 20);
        }
    });

    // Pasos de Cebra en intersecciones
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    roadsX.forEach(rx => {
        roadsY.forEach(ry => {
            // Horizontal stripes
            for (let i = -roadWidth / 2; i < roadWidth / 2; i += 15) {
                ctx.fillRect(rx - 30, ry + i, 60, 5);
            }
        });
    });

    // Luces de la Calle (Farolas)
    lightPulse += 0.04;
    const pulse = Math.sin(lightPulse) * 4;

    const lampPositions = [];
    roadsX.forEach(x => {
        roadsY.forEach(y => {
            lampPositions.push({ x: x - roadWidth / 2 - 10, y: y - roadWidth / 2 - 10 });
            lampPositions.push({ x: x + roadWidth / 2 + 10, y: y + roadWidth / 2 + 10 });
        });
    });

    lampPositions.forEach(lp => {
        // Aura de luz
        const grad = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 25 + pulse);
        grad.addColorStop(0, 'rgba(241, 196, 15, 0.3)');
        grad.addColorStop(1, 'rgba(241, 196, 15, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 30 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Bombilla
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function handleObjects() {
    if (Math.random() < spawnRate + (currentRound * 0.005 * multiplier) && objects.length < maxObjects + currentRound) {
        objects.push(new Waste());
    }

    objects = objects.filter(obj => {
        const keeps = obj.update();
        if (keeps) {
            obj.draw();
            // Comprobar colisión con el recolector
            if (obj.checkCollision(catcher)) {
                score += obj.points;
                if (obj.points > 0) totalScore += obj.points;

                // Crear partículas
                const pColor = obj.points > 0 ? '#8bc34a' : '#ff7675';
                for (let i = 0; i < 8; i++) {
                    particles.push(new Particle(obj.x, obj.y, pColor));
                }

                // Crear texto flotante
                const color = obj.points > 0 ? '#55efc4' : '#ff7675';
                const text = obj.points > 0 ? `+${obj.points}` : `${obj.points}`;
                floatingTexts.push(new FloatingText(obj.x, obj.y, text, color));

                updateUI();
                return false; // Eliminar objeto recolectado
            }
        }
        return keeps;
    });

    particles = particles.filter(p => {
        const keeps = p.update();
        if (keeps) p.draw();
        return keeps;
    });

    floatingTexts = floatingTexts.filter(ft => {
        const keeps = ft.update();
        if (keeps) ft.draw();
        return keeps;
    });
}

function gameLoop() {
    // Seguir ejecutando el loop incluso si gameActive es false (para animar UI o fondo)
    drawCityTopDown();

    if (gameActive) {
        catcher.update(mouseX);
        handleObjects();
    }

    catcher.draw();

    // EFECTO DE ILUMINACIÓN GLOBAL (Iluminación ambiental clara)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Mínima oscuridad para que el juego se vea muy brillante
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    // Spotlight alrededor del recolector
    const spotlight = ctx.createRadialGradient(catcher.x, catcher.y, 0, catcher.x, catcher.y, 200);
    spotlight.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    spotlight.addColorStop(0.5, 'rgba(255, 255, 150, 0.05)');
    spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
});

function updateUI() {
    scoreElement.innerText = score;
    roundElement.innerText = currentRound;
    targetElement.innerText = trashGoal;
}

const gameTimer = setInterval(() => {
    if (!gameActive) return;

    if (timeLeft > 0) {
        timeLeft--;
        timerElement.innerText = timeLeft;
    } else {
        checkRoundEnd();
    }
}, 1000);

function checkRoundEnd() {
    if (score >= trashGoal) {
        startNextRound();
    } else {
        endGame();
    }
}

function startNextRound() {
    // ---- INFINITE MODE SIGNAL ----
    const isInfinite = location.search.includes('multiplier');
    if (isInfinite && window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'onGameComplete' }, '*');
        return; 
    }
    // ------------------------------

    gameActive = false; // Pausa el juego
    nextRoundScreen.style.display = 'flex';
}

function continueToNextRound() {
    // Limpiar objetos de la ronda anterior
    objects = [];
    particles = [];
    floatingTexts = [];

    currentRound++;
    trashGoal += 4;
    score = 0;
    timeLeft = Math.max(5, Math.ceil(15 / multiplier));

    // Dificultad Progresiva
    spawnRate += 0.008 * multiplier;
    maxObjects += 1;

    nextRoundScreen.style.display = 'none';
    gameActive = true;
    updateUI();
}

function endGame() {
    // ---- INFINITE MODE SIGNAL ----
    const isInfinite = location.search.includes('multiplier');
    if (isInfinite && window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'onLifeLost' }, '*');
        return; 
    }
    // ------------------------------

    gameActive = false;
    clearInterval(gameTimer);
    if (gameOverScreen) {
        gameOverScreen.style.display = 'flex';
    }
    finalScoreElement.innerText = totalScore;
    feedbackText.innerText = `Limpieza finalizada en la Ronda ${currentRound}.`;
}

function resetGame() {
    location.reload();
}

gameLoop();
