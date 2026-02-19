const state = {
    score: 0,
    energy: 0,
    lives: 4,
    timeLeft: 5,
    gameActive: false,
    timerStarted: false,
    baseEnergyPerClick: 7, // Harder: ~15 clicks needed initially
    difficultyRate: 0.5
};

const elements = {
    score: document.getElementById('score'),
    timer: document.getElementById('timer'),
    energyBar: document.getElementById('energy-progress'),
    percent: document.getElementById('percent'),
    btn: document.getElementById('generate-btn'),
    overlay: document.getElementById('message-overlay'),
    resultText: document.getElementById('result-text'),
    restartBtn: document.getElementById('restart-btn'),
    parts: document.querySelectorAll('.city-part'),
    station: document.getElementById('power-station'),
    lives: document.querySelectorAll('.life')
};

let shuffledParts = [];

function shuffle(array) {
    const arr = Array.from(array);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[arr[j] ? j : i]] = [arr[j], arr[i]];
    }
    return arr;
}

function initGame() {
    state.energy = 0;
    state.timeLeft = 5;
    state.gameActive = true;
    state.timerStarted = false;
    elements.overlay.classList.add('hidden');
    elements.overlay.classList.remove('win', 'loss');
    elements.timer.textContent = state.timeLeft;

    // Clear visuals
    elements.parts.forEach(p => p.classList.remove('active'));
    elements.station.classList.remove('active');
    elements.lives.forEach(l => l.classList.remove('exploding'));

    // Randomize illumination order
    shuffledParts = shuffle(elements.parts);

    updateUI();
}

function startTimer() {
    state.timerStarted = true;
    const timerInterval = setInterval(() => {
        if (!state.gameActive) {
            clearInterval(timerInterval);
            return;
        }
        state.timeLeft--;
        elements.timer.textContent = state.timeLeft;

        if (state.timeLeft <= 0) {
            endRound();
        }
    }, 1000);
}

function updateUI() {
    elements.energyBar.style.width = `${state.energy}%`;
    elements.percent.textContent = Math.floor(state.energy);

    // Update lives UI
    elements.lives.forEach((l, i) => {
        if (i < state.lives) {
            l.classList.remove('lost');
        } else {
            l.classList.add('lost');
        }
    });

    // Light up parts based on energy
    const countToLight = Math.floor((state.energy / 100) * shuffledParts.length);
    shuffledParts.forEach((p, index) => {
        if (index < countToLight) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    // Station lights up at 100%
    if (state.energy >= 100) {
        elements.station.classList.add('active');
    }
}

function endRound() {
    state.gameActive = false;
    const won = state.energy >= 99;

    elements.overlay.classList.remove('win', 'loss');

    if (won) {
        state.score++;
        elements.resultText.textContent = "CIUDAD RADIANTE";
        elements.overlay.classList.add('win');
    } else {
        state.lives--;
        updateUI();

        if (state.lives <= 0) {
            elements.resultText.textContent = "GAME OVER";
            state.score = 0; // Reset score on Game Over
            state.lives = 4; // Reset for next time btn is clicked after overlay
            elements.restartBtn.textContent = "Reintentar Misión";
        } else {
            elements.resultText.textContent = "APAGÓN TOTAL";
            elements.restartBtn.textContent = "Siguiente Ronda";
        }
        elements.overlay.classList.add('loss');
    }

    elements.score.textContent = state.score;
    // Update final score display hidden in HTML
    const finalScore = document.getElementById('final-score-display');
    if (finalScore) finalScore.textContent = state.score;

    elements.overlay.classList.remove('hidden');
}

elements.btn.addEventListener('click', () => {
    if (!state.gameActive && !elements.overlay.classList.contains('hidden')) return;

    if (!state.gameActive) {
        initGame();
        return;
    }

    if (!state.timerStarted) {
        startTimer();
    }

    // Increased difficulty: gain decreases with score
    const currentGain = Math.max(3, state.baseEnergyPerClick - (state.score * state.difficultyRate));
    state.energy = Math.min(100, state.energy + currentGain);
    updateUI();

    if (state.energy >= 100) {
        setTimeout(endRound, 200);
    }
});

elements.restartBtn.addEventListener('click', () => {
    initGame();
});

// Initial Setup
updateUI(); // Show initial lives
state.gameActive = false; // Stay idle until btn clicked
