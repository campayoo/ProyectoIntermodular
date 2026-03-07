/**
 * ODS 13: Acción por el Clima - Juego de Energía Solar
 * Concepto: Proteger los paneles solares de las nubes y recolectar rayos de sol.
 */

// --- Configuración y Estado ---
const CONFIG = {
    baseRoundTime: 20,
    baseTargetScore: 10,
    baseSpawnRateSun: 1200,    // ms
    baseSpawnRateCloud: 2000,  // ms
    baseFallSpeed: 2,          // px por frame
    difficultyMultiplier: 1.2,
    startingLives: 3
};

let gameState = {
    score: 0,
    lives: CONFIG.startingLives,
    timeLeft: CONFIG.baseRoundTime,
    currentRound: 1,
    targetScore: CONFIG.baseTargetScore,
    isPaused: true,
    objects: [], // Almacena soles y nubes activos
    spawnIntervals: []
};

// --- Elementos DOM ---
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const livesContainer = document.getElementById('lives-container');
const roundEl = document.getElementById('round-number');
const targetEl = document.getElementById('target-score');
const gameCanvas = document.getElementById('game-canvas');
const houseEl = document.getElementById('house');
const panelsEl = document.querySelector('.solar-panels');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const actionBtn = document.getElementById('action-button');

// --- Inicialización ---
function init() {
    actionBtn.onclick = startRound;
    window.addEventListener('resize', handleResize);
    updateUI();
    showOverlay('¡ENERGÍA SOLAR!', 'Usa los paneles solares para recolectar energía. ¡Haz clic en las nubes para eliminarlas antes de que bloqueen el sol o dañen la casa!', 'Empezar Juego');
}

// --- Lógica del Juego ---
function startRound() {
    hideOverlay();
    resetRoundState();
    gameState.isPaused = false;

    // Iniciar intervalos de aparición
    const currentSpawnSun = CONFIG.baseSpawnRateSun / Math.pow(gameState.currentRound, 0.6);
    const currentSpawnCloud = CONFIG.baseSpawnRateCloud / Math.pow(gameState.currentRound, 0.7);

    gameState.spawnIntervals.push(setInterval(spawnSun, currentSpawnSun));
    gameState.spawnIntervals.push(setInterval(spawnCloud, currentSpawnCloud));

    // Temporizador
    const timerInterval = setInterval(() => {
        if (gameState.isPaused) return;
        gameState.timeLeft--;
        timerEl.textContent = gameState.timeLeft;

        if (gameState.timeLeft <= 0) {
            clearInterval(timerInterval);
            endRound();
        }
    }, 1000);

    gameState.spawnIntervals.push(timerInterval);

    // Bucle principal
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameState.isPaused) return;

    updateObjects();
    requestAnimationFrame(gameLoop);
}

function resetRoundState() {
    gameState.timeLeft = CONFIG.baseRoundTime;
    gameState.targetScore = CONFIG.baseTargetScore + (gameState.currentRound - 1) * 8;
    gameState.isPaused = true;

    // Limpiar intervalos previos
    gameState.spawnIntervals.forEach(clearInterval);
    gameState.spawnIntervals = [];

    // Limpiar objetos visuales
    const elements = document.querySelectorAll('.sun-ray, .cloud');
    elements.forEach(el => el.remove());
    gameState.objects = [];

    updateUI();
}

function spawnSun() {
    if (gameState.isPaused) return;
    createGameObject('sun-ray');
}

function spawnCloud() {
    if (gameState.isPaused) return;
    createGameObject('cloud');
}

function createGameObject(type) {
    const el = document.createElement('div');
    el.className = type;

    // Posición inicial (aleatoria en la parte superior)
    const startX = Math.random() * (gameCanvas.offsetWidth - 80);
    const startY = -100;

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;

    gameCanvas.appendChild(el);

    // Calcular objetivo (centro de la casa/paneles)
    const houseRect = houseEl.getBoundingClientRect();
    const canvasRect = gameCanvas.getBoundingClientRect();

    // Punto de destino relativo al canvas
    const targetX = (houseRect.left + houseRect.width / 2) - canvasRect.left;
    const targetY = (houseRect.top + houseRect.height / 4) - canvasRect.top;

    // Vector de dirección
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const speed = CONFIG.baseFallSpeed + (gameState.currentRound * 0.8) + (Math.random() * 2);

    const obj = {
        el: el,
        type: type,
        startX: startX,
        startY: startY,
        x: startX,
        y: startY,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        isDestroyed: false
    };

    if (type === 'cloud') {
        el.onmousedown = (e) => {
            e.stopPropagation();
            popCloud(obj);
        };
    }

    gameState.objects.push(obj);
}

function updateObjects() {
    const houseRect = houseEl.getBoundingClientRect();
    const panelsRect = panelsEl.getBoundingClientRect();

    for (let i = gameState.objects.length - 1; i >= 0; i--) {
        const obj = gameState.objects[i];
        if (obj.isDestroyed) continue;

        // Mover siguiendo el vector de velocidad
        obj.x += obj.vx;
        obj.y += obj.vy;

        obj.el.style.left = `${obj.x}px`;
        obj.el.style.top = `${obj.y}px`;

        const rect = obj.el.getBoundingClientRect();

        // Colisión con paneles (Soles)
        if (obj.type === 'sun-ray' && isColliding(rect, panelsRect)) {
            changeScore(1);
            removeObject(i);
            showFeedback('+', obj.x, obj.y, false);
            continue;
        }

        // Colisión con casa (Soles que no dan puntos pero se destruyen)
        if (obj.type === 'sun-ray' && isColliding(rect, houseRect)) {
            removeObject(i);
            continue;
        }

        // Colisión con casa (Nubes)
        if (obj.type === 'cloud' && isColliding(rect, houseRect)) {
            changeLives(-1);
            removeObject(i);
            showFeedback('-1 ❤', obj.x, obj.y, true);
            continue;
        }

        // Salir de pantalla (por seguridad si fallan colisiones)
        if (obj.y > gameCanvas.offsetHeight + 100 || obj.x < -100 || obj.x > gameCanvas.offsetWidth + 100) {
            removeObject(i);
        }
    }
}

function isColliding(a, b) {
    return !(
        a.bottom < b.top ||
        a.top > b.bottom ||
        a.right < b.left ||
        a.left > b.right
    );
}

function removeObject(index) {
    const obj = gameState.objects[index];
    if (obj && obj.el) {
        obj.el.remove();
    }
    gameState.objects.splice(index, 1);
}

function popCloud(obj) {
    if (obj.isDestroyed) return;
    obj.isDestroyed = true;
    obj.el.classList.add('cloud-pop');
    obj.el.onmousedown = null; // Evitar múltiples clics
    setTimeout(() => {
        const index = gameState.objects.indexOf(obj);
        if (index > -1) removeObject(index);
    }, 300);
}

// --- UI y Feedback ---
function updateUI() {
    scoreEl.textContent = gameState.score;
    timerEl.textContent = gameState.timeLeft;
    roundEl.textContent = gameState.currentRound;
    targetEl.textContent = gameState.targetScore;

    // Actualizar vidas
    const hearts = livesContainer.querySelectorAll('.life');
    hearts.forEach((heart, index) => {
        if (index >= gameState.lives) {
            heart.classList.add('lost');
        } else {
            heart.classList.remove('lost');
        }
    });
}

function changeScore(val) {
    gameState.score += val;
    scoreEl.textContent = gameState.score;
    scoreEl.parentElement.classList.add('pulse');
    setTimeout(() => scoreEl.parentElement.classList.remove('pulse'), 300);
}

function changeLives(val) {
    gameState.lives += val;
    updateUI();
    if (gameState.lives <= 0) {
        gameOver('TE HAS QUEDADO SIN VIDAS');
    }
}

function showFeedback(text, x, y, isNegative) {
    const fb = document.createElement('div');
    fb.className = `feedback ${isNegative ? 'negative' : ''}`;
    fb.textContent = text;
    fb.style.left = `${x}px`;
    fb.style.top = `${y}px`;
    gameCanvas.appendChild(fb);
    setTimeout(() => fb.remove(), 800);
}

// --- Estados Finales ---
function endRound() {
    gameState.isPaused = true;
    if (gameState.score >= gameState.targetScore) {
        gameState.currentRound++;
        showOverlay('¡RONDA COMPLETADA!', `Has conseguido ${gameState.score} puntos. El objetivo era ${gameState.targetScore}. Progresando a la ronda ${gameState.currentRound}...`, 'Siguiente Ronda');
        gameState.score = 0; // Reiniciar puntos para la nueva ronda
    } else {
        gameOver(`OBJETIVO NO ALCANZADO (Necesitabas ${gameState.targetScore})`);
    }
}

function gameOver(reason) {
    gameState.isPaused = true;
    gameState.spawnIntervals.forEach(clearInterval);
    showOverlay('GAME OVER', `${reason}. Puntuación final: ${gameState.score} en la Ronda ${gameState.currentRound}.`, 'Reiniciar Juego');

    // Resetear todo al reiniciar
    gameState.currentRound = 1;
    gameState.score = 0;
    gameState.lives = CONFIG.startingLives;
}

function showOverlay(title, text, btnText) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    actionBtn.textContent = btnText;
    overlay.classList.remove('hidden');
}

function hideOverlay() {
    overlay.classList.add('hidden');
}

function handleResize() {
    // Si la casa queda fuera tras redimensionar
    // (Aunque con CSS se mantiene centrada)
}

// Iniciar
init();
