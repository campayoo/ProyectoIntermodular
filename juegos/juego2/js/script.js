/**
 * Vital Rhythm (ODS 3)
 * Core Game Engine - Dual System (Health Bar + Lives)
 */

const game = {
    state: 'MENU',
    score: 0,
    health: 100, // Percentage bar
    round: 1,
    timer: 15,
    speed: 3,
    baseSpeed: 3,
    spawnRate: 1500,
    lastSpawn: 0,
    lastFrame: 0,
    lastTick: 0,
    notes: [],
    keys: {
        'd': { index: 0, pressed: false },
        'f': { index: 1, pressed: false },
        'j': { index: 2, pressed: false },
        'k': { index: 3, pressed: false }
    }
};

const UI = {
    score: document.getElementById('score-val'),
    healthFill: document.getElementById('health-fill'),
    healthText: document.getElementById('health-percent'),
    speedVal: document.getElementById('speed-val'),
    levelVal: document.getElementById('level-val'),
    timerVal: document.getElementById('timer-val'),
    bioVal: document.getElementById('bio-val'),
    notesLayer: document.getElementById('notes-layer'),
    ripples: document.getElementById('ripple-container'),
    particles: document.getElementById('particle-container'),
    heartEmoji: document.getElementById('heart-emoji'),
    startScreen: document.getElementById('start-screen'),
    overScreen: document.getElementById('game-over-screen'),
    roundModal: document.getElementById('round-modal'),
    finalScore: document.getElementById('final-score'),
    lanes: [
        document.getElementById('lane-0'),
        document.getElementById('lane-1'),
        document.getElementById('lane-2'),
        document.getElementById('lane-3')
    ]
};

function init() {
    setupInputs();
    setupButtons();
    updateHUD();
}

function setupInputs() {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (game.keys[key] && !game.keys[key].pressed) {
            game.keys[key].pressed = true;
            checkHit(game.keys[key].index);
            UI.lanes[game.keys[key].index].classList.add('active');
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (game.keys[key]) {
            game.keys[key].pressed = false;
            UI.lanes[game.keys[key].index].classList.remove('active');
        }
    });
}

function setupButtons() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('next-round-btn').addEventListener('click', resumeFromRoundModal);
}

function startGame() {
    game.state = 'PLAYING';
    game.score = 0;
    game.health = 100;
    game.round = 1;
    game.timer = 15;
    game.speed = game.baseSpeed;
    game.spawnRate = 1200;
    game.lastSpawn = performance.now();
    game.lastFrame = performance.now();
    game.lastTick = performance.now();

    clearActiveNotes();

    document.getElementById('ui-overlay').classList.add('hidden');
    UI.startScreen.classList.add('hidden');
    UI.overScreen.classList.add('hidden');
    UI.roundModal.classList.add('hidden');
    UI.heartEmoji.style.opacity = '1';

    updateHUD();
    requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
    if (game.state !== 'PLAYING') return;

    const dt = now - game.lastFrame;
    game.lastFrame = now;

    // Timer logic
    if (now - game.lastTick >= 1000) {
        game.timer--;
        game.lastTick = now;
        if (game.timer <= 0) {
            pauseForNextRound();
        }
        updateHUD();
        triggerRipple();
    }

    // Spawning logic
    if (now - game.lastSpawn > game.spawnRate) {
        spawnNote();
        game.lastSpawn = now;
    }

    // Update notes
    const missY = UI.lanes[0].offsetHeight;
    for (let i = game.notes.length - 1; i >= 0; i--) {
        const note = game.notes[i];
        note.y += game.speed * (dt / 16.6);
        note.el.style.top = `${note.y}px`;

        if (note.y > missY) {
            handleMiss(i);
        }
    }

    requestAnimationFrame(gameLoop);
}

function clearActiveNotes() {
    game.notes.forEach(note => note.el.remove());
    game.notes = [];
    UI.lanes.forEach(lane => {
        const strays = lane.querySelectorAll('.note');
        strays.forEach(s => s.remove());
    });
}

function pauseForNextRound() {
    game.state = 'PAUSED';
    game.round++;
    clearActiveNotes();

    // Show round modal
    document.getElementById('ui-overlay').classList.remove('hidden');
    UI.roundModal.classList.remove('hidden');

    const titleEl = document.getElementById('next-round-title');
    const descEl = UI.roundModal.querySelector('p');

    titleEl.textContent = `RONDA ${game.round - 1} COMPLETADA`;
    titleEl.style.color = '#4C9F38';
    descEl.textContent = `La frecuencia aumenta. ¡Buen trabajo!`;
}

function resumeFromRoundModal() {
    game.timer = 15;
    game.health = 100;

    game.speed *= 1.15;
    game.spawnRate *= 0.9;

    game.state = 'PLAYING';
    document.getElementById('ui-overlay').classList.add('hidden');
    UI.roundModal.classList.add('hidden');

    game.lastFrame = performance.now();
    game.lastSpawn = performance.now();
    game.lastTick = performance.now();

    requestAnimationFrame(gameLoop);
}

function spawnNote() {
    const laneIndex = Math.floor(Math.random() * 4);
    if (game.round > 2 && Math.random() < 0.25) {
        createNoteEl(laneIndex);
        let secondLane = (laneIndex + 1) % 4;
        createNoteEl(secondLane, true);
    } else {
        createNoteEl(laneIndex);
    }
}

function createNoteEl(lane, isDouble = false) {
    const noteEl = document.createElement('div');
    noteEl.className = `note ${isDouble ? 'note-double' : ''}`;
    noteEl.style.top = `-60px`;
    UI.lanes[lane].appendChild(noteEl);

    game.notes.push({
        el: noteEl,
        lane: lane,
        y: -60,
        isDouble: isDouble
    });
}

function checkHit(laneIndex) {
    if (game.state !== 'PLAYING') return;

    const hitThreshold = 75;
    const targetY = UI.lanes[0].offsetHeight - 50;

    for (let i = 0; i < game.notes.length; i++) {
        const note = game.notes[i];
        if (note.lane === laneIndex) {
            const dist = Math.abs(note.y - targetY);
            if (dist < hitThreshold) {
                handleHit(i);
                return;
            }
        }
    }
}

function handleHit(index) {
    const note = game.notes[index];
    const rect = note.el.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);

    note.el.remove();
    game.notes.splice(index, 1);

    game.score += 50;
    game.health = Math.min(100, game.health + 4); // Small regen on hit
    updateHUD();
}

function handleMiss(index) {
    const note = game.notes[index];
    note.el.remove();
    game.notes.splice(index, 1);

    game.health = Math.max(0, game.health - 15); // Bar goes down on miss
    updateHUD();

    if (game.health <= 0) endGame();
}

function spawnParticles(x, y) {
    const targetRect = UI.heartEmoji.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.background = '#4C9F38';
        UI.particles.appendChild(p);

        setTimeout(() => {
            p.style.transform = `translate(${targetX - x}px, ${targetY - y}px) scale(0.2)`;
            p.style.opacity = '0';
        }, 10);
        setTimeout(() => p.remove(), 600);
    }
}

function triggerRipple() {
    const r = document.createElement('div');
    r.className = 'ripple';
    UI.ripples.appendChild(r);
    setTimeout(() => r.remove(), 1500);
}

function updateHUD() {
    if (!UI.score) return;

    UI.score.textContent = game.score.toString().padStart(4, '0');
    UI.levelVal.textContent = game.round.toString().padStart(2, '0');
    UI.timerVal.textContent = `${game.timer}s`;
    UI.speedVal.textContent = (game.speed / game.baseSpeed).toFixed(1) + 'x';

    // Update Health Bar
    UI.healthFill.style.width = `${game.health}%`;
    UI.healthText.textContent = `${Math.floor(game.health)}%`;

    const h = game.health;
    let emoji = '❤️';
    let color = '#ef4444';
    let state = 'VIBRANTE';

    if (h > 70) {
        emoji = '❤️'; color = '#ef4444'; state = 'VIBRANTE';
    } else if (h > 40) {
        emoji = '💛'; color = '#eab308'; state = 'ESTABLE';
    } else if (h > 15) {
        emoji = '💜'; color = '#a855f7'; state = 'DÉBIL';
    } else {
        emoji = '🖤'; color = '#1e293b'; state = 'CRÍTICO';
    }

    if (UI.heartEmoji) {
        UI.heartEmoji.textContent = emoji;
        const beatSpeed = Math.max(0.3, 1.2 - (game.round * 0.12));
        UI.heartEmoji.style.animationDuration = `${beatSpeed}s`;
    }

    UI.score.style.color = color;
    UI.bioVal.textContent = state;
    UI.bioVal.style.color = color;
}

function endGame() {
    game.state = 'ENDED';
    UI.finalScore.textContent = game.score.toString().padStart(4, '0');

    document.body.classList.add('screen-shake');
    if (UI.heartEmoji) UI.heartEmoji.style.opacity = '0.5';

    setTimeout(() => {
        document.body.classList.remove('screen-shake');
        document.getElementById('ui-overlay').classList.remove('hidden');
        UI.overScreen.classList.remove('hidden');
    }, 800);
}

init();
