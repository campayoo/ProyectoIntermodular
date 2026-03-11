/**
 * ODS 11: Ciudades y Comunidades Sostenibles - Cruce Sostenible
 * Gestión de tráfico para evitar accidentes y mejorar la movilidad.
 */

// --- Configuración ---
// ---- DIFFICULTY SCALING ----
const urlParams = new URLSearchParams(window.location.search);
const multiplier = parseFloat(urlParams.get('multiplier')) || 1.0;
// ----------------------------

const CONFIG = {
    baseRoundTime: Math.max(5, Math.ceil(15 / multiplier)),
    baseTargetScore: 5,
    baseSpawnRate: 1000 / multiplier,    // ms
    baseSpeed: 3 * multiplier,           // px por frame
    startingLives: 3,
    carSize: 50,
    intersectionSize: 120,
    stopOffset: 70
};

// --- Estado ---
let gameState = {
    score: 0,
    lives: CONFIG.startingLives,
    timeLeft: CONFIG.baseRoundTime,
    currentRound: 1,
    targetScore: CONFIG.baseTargetScore,
    isPaused: true,
    activeLightH: 'green',
    activeLightV: 'red',
    cars: [],
    spawnIntervals: [], // Array para limpiar todos los intervalos (spawn y timer)
    gameLoopId: null
};

// --- Elementos DOM ---
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const livesContainer = document.getElementById('lives-container');
const roundEl = document.getElementById('round-number');
const targetEl = document.getElementById('target-score');
const gameCanvas = document.getElementById('game-canvas');
const lightH = document.getElementById('light-h');
const lightV = document.getElementById('light-v');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const actionBtn = document.getElementById('action-button');

// --- Inicialización ---
function init() {
    console.log("ODS 11: Juego Iniciado");
    actionBtn.onclick = startRound;
    lightH.onclick = () => { if (!gameState.isPaused) toggleLight('horizontal'); };
    lightV.onclick = () => { if (!gameState.isPaused) toggleLight('vertical'); };

    window.addEventListener('keydown', (e) => {
        if (gameState.isPaused) return;
        if (e.key.toLowerCase() === 'h') toggleLight('horizontal');
        if (e.key.toLowerCase() === 'v') toggleLight('vertical');
    });
    updateUI();
    // MOSTRAR PANEL INICIAL AL CARGAR
    showOverlay('CRUCE SOSTENIBLE', 'Gestiona el tráfico urbano. Los coches solo vienen de IZQUIERDA y ARRIBA. ¡Evita colisiones para una ciudad más segura!', 'Iniciar Misión');
}

// --- Lógica de Semáforos Independientes ---
function toggleLight(type) {
    if (type === 'horizontal') {
        gameState.activeLightH = gameState.activeLightH === 'green' ? 'red' : 'green';
    } else {
        gameState.activeLightV = gameState.activeLightV === 'green' ? 'red' : 'green';
    }
    updateLightsUI();
}

function updateLightsUI() {
    lightH.className = `traffic-light horizontal ${gameState.activeLightH}`;
    lightV.className = `traffic-light vertical ${gameState.activeLightV}`;
}

// --- Lógica del Juego ---
function startRound() {
    console.log("Iniciando Ronda:", gameState.currentRound);
    overlay.classList.add('hidden');
    resetStates();
    gameState.isPaused = false;

    // Intervalo de aparición (Escalado más agresivo)
    const currentSpawnRate = CONFIG.baseSpawnRate / Math.pow(gameState.currentRound, 0.6);
    const spawnInt = setInterval(spawnCar, currentSpawnRate);
    gameState.spawnIntervals.push(spawnInt);

    // Temporizador
    const timerInt = setInterval(() => {
        if (gameState.isPaused) return;
        gameState.timeLeft--;
        timerEl.textContent = gameState.timeLeft;
        if (gameState.timeLeft <= 0) {
            clearInterval(timerInt);
            endRound();
        }
    }, 1000);
    gameState.spawnIntervals.push(timerInt);

    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

function resetStates() {
    gameState.timeLeft = CONFIG.baseRoundTime;
    gameState.targetScore = CONFIG.baseTargetScore + (gameState.currentRound - 1) * 3;
    gameState.cars.forEach(car => car.el.remove());
    gameState.cars = [];

    // Limpiar TODOS los intervalos previos
    gameState.spawnIntervals.forEach(clearInterval);
    gameState.spawnIntervals = [];

    cancelAnimationFrame(gameState.gameLoopId);
    gameState.activeLightH = 'green';
    gameState.activeLightV = 'red';
    updateLightsUI();
    updateUI();
}

function spawnCar() {
    if (gameState.isPaused) return;

    // SOLO DOS DIRECCIONES: 0 (Izquierda->Derecha) y 2 (Arriba->Abajo)
    const availableDirs = [0, 2];
    const dir = availableDirs[Math.floor(Math.random() * availableDirs.length)];

    const canvasW = 800; // Hardcoded for reliability
    const canvasH = 600;

    let startX, startY, vx, vy, type, dirClass;
    const speed = (CONFIG.baseSpeed + (gameState.currentRound * 0.5) + (Math.random())); // CONFIG.baseSpeed is already scaled

    switch (dir) {
        case 0: // L to R (Bottom Lane)
            // Road is 120px height, centered at 300. Bottom lane center is 330.
            // Car height 28. y = 330 - 14 = 316.
            startX = -60;
            startY = 316;
            vx = speed; vy = 0;
            type = 'horizontal'; dirClass = 'left-to-right';
            break;
        case 2: // T to B (Right Lane)
            // Road is 120px width, centered at 400. Right lane center is 430.
            // Car width 28. x = 430 - 14 = 416.
            startX = 416;
            startY = -60;
            vx = 0; vy = speed;
            type = 'vertical'; dirClass = 'top-to-bottom';
            break;
    }

    const el = document.createElement('div');
    el.className = `car ${type} ${dirClass}`;
    gameCanvas.appendChild(el);

    gameState.cars.push({
        el, type, dir, x: startX, y: startY, vx, vy, speed,
        passed: false,
        stopping: false
    });
}

function gameLoop() {
    if (gameState.isPaused) return;

    updateCars();
    checkCollisions();
    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

function updateCars() {
    const canvasW = gameCanvas.offsetWidth;
    const canvasH = gameCanvas.offsetHeight;
    const centerX = canvasW / 2;
    const centerY = canvasH / 2;

    for (let i = gameState.cars.length - 1; i >= 0; i--) {
        const car = gameState.cars[i];

        let shouldStop = false;

        // Lógica de frenado en semáforo rojo
        if (!car.passed) {
            const isRed = (car.type === 'horizontal' && gameState.activeLightH === 'red') ||
                (car.type === 'vertical' && gameState.activeLightV === 'red');

            if (isRed) {
                const centerX = 400;
                const centerY = 300;
                // Verificar si está llegando a la línea de parada (frente del coche)
                const carFrontH = car.x + car.el.offsetWidth;
                const carFrontV = car.y + car.el.offsetHeight;
                const stopLineH = centerX - CONFIG.stopOffset;
                const stopLineV = centerY - CONFIG.stopOffset;

                if (car.dir === 0 && carFrontH < stopLineH && carFrontH + car.vx >= stopLineH) shouldStop = true;
                if (car.dir === 2 && carFrontV < stopLineV && carFrontV + car.vy >= stopLineV) shouldStop = true;

                // Verificar si hay un coche delante parado
                if (!shouldStop) {
                    for (let j = 0; j < gameState.cars.length; j++) {
                        const other = gameState.cars[j];
                        if (i === j || other.type !== car.type || other.dir !== car.dir || !other.stopping) continue;

                        const dist = getDistanceBetweenCars(car, other);
                        if (dist > 0 && dist < 15) { // Distancia de seguridad
                            shouldStop = true;
                            break;
                        }
                    }
                }
            }
        }

        if (shouldStop) {
            car.stopping = true;
        } else {
            car.stopping = false;
            car.x += car.vx;
            car.y += car.vy;
            car.el.style.left = `${car.x}px`;
            car.el.style.top = `${car.y}px`;
        }

        // Marcar como pasado si cruza el centro
        if (!car.passed) {
            const centerX = 400;
            const centerY = 300;
            if ((car.dir === 0 && car.x > centerX) ||
                (car.dir === 2 && car.y > centerY)) {
                car.passed = true;
                changeScore(1);
            }
        }

        // Eliminar si sale de pantalla
        if (car.x < -100 || car.x > 900 || car.y < -100 || car.y > 700) {
            car.el.remove();
            gameState.cars.splice(i, 1);
        }
    }
}

function getDistanceBetweenCars(c1, c2) {
    if (c1.dir === 0) return (c2.x - (c1.x + 50)); // L to R
    if (c1.dir === 1) return (c1.x - (c2.x + 50)); // R to L
    if (c1.dir === 2) return (c2.y - (c1.y + 50)); // T to B
    if (c1.dir === 3) return (c1.y - (c2.y + 50)); // B to T
    return 1000;
}

function checkCollisions() {
    // Solo comprobamos coches horizontales contra verticales
    const horizontalCars = gameState.cars.filter(c => c.type === 'horizontal');
    const verticalCars = gameState.cars.filter(c => c.type === 'vertical');

    for (let h of horizontalCars) {
        for (let v of verticalCars) {
            const hRect = h.el.getBoundingClientRect();
            const vRect = v.el.getBoundingClientRect();

            if (isColliding(hRect, vRect)) {
                // CHOQUE DETECTADO
                createExplosion((hRect.left + hRect.right) / 2 - gameCanvas.getBoundingClientRect().left, (vRect.top + vRect.bottom) / 2 - gameCanvas.getBoundingClientRect().top);
                changeLives(-1);

                // Eliminar ambos coches
                h.el.remove();
                v.el.remove();
                gameState.cars = gameState.cars.filter(c => c !== h && c !== v);
                return; // Solo un choque por frame
            }
        }
    }
}

function isColliding(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function createExplosion(x, y) {
    const exp = document.createElement('div');
    exp.className = 'explosion';
    exp.style.left = `${x - 50}px`;
    exp.style.top = `${y - 50}px`;
    gameCanvas.appendChild(exp);
    setTimeout(() => exp.remove(), 500);
}

// --- UI y Feedback ---
function updateUI() {
    scoreEl.textContent = gameState.score;
    timerEl.textContent = gameState.timeLeft;
    roundEl.textContent = gameState.currentRound;
    targetEl.textContent = gameState.targetScore;

    // Vidas
    const hearts = livesContainer.querySelectorAll('.life');
    hearts.forEach((h, i) => {
        if (i >= gameState.lives) h.classList.add('lost');
        else h.classList.remove('lost');
    });
}

function changeScore(val) {
    gameState.score += val;
    scoreEl.textContent = gameState.score;
    scoreEl.classList.add('pulse');
    setTimeout(() => scoreEl.classList.remove('pulse'), 200);
}

function changeLives(val) {
    gameState.lives += val;
    updateUI();
    if (gameState.lives <= 0) gameOver('¡DEMASIADOS ACCIDENTES!');
}

function endRound() {
    // ---- INFINITE MODE SIGNAL ----
    const isInfinite = location.search.includes('multiplier');
    if (isInfinite && window.parent && window.parent.postMessage) {
        if (gameState.score >= gameState.targetScore) {
            window.parent.postMessage({ type: 'onGameComplete' }, '*');
        } else {
            window.parent.postMessage({ type: 'onLifeLost' }, '*');
        }
        return; 
    }
    // ------------------------------

    gameState.isPaused = true;
    if (gameState.score >= gameState.targetScore) {
        gameState.currentRound++;
        showOverlay('¡RONDA SUPERADA!', `Has gestionado el tráfico con éxito. Objetivo para Ronda ${gameState.currentRound}: ${gameState.targetScore + 3} coches.`, 'Siguiente Ronda');
        gameState.score = 0;
    } else {
        gameOver(`OBJETIVO NO ALCANZADO (Necesitabas ${gameState.targetScore})`);
    }
}

function gameOver(reason) {
    // ---- INFINITE MODE SIGNAL ----
    const isInfinite = location.search.includes('multiplier');
    if (isInfinite && window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'onLifeLost' }, '*');
        return; 
    }
    // ------------------------------

    gameState.isPaused = true;
    gameState.spawnIntervals.forEach(clearInterval);
    gameState.spawnIntervals = [];
    cancelAnimationFrame(gameState.gameLoopId);
    showOverlay('GAME OVER', `${reason}. Puntuación final: ${gameState.score} en Ronda ${gameState.currentRound}.`, 'Reiniciar Misión');

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

init();
