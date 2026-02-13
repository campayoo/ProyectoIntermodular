/*
 * script.js
 * Logic for Gaia-Tech Infinite Mode & Game Interface
 */

document.addEventListener('DOMContentLoaded', () => {
    // Game State
    const gameState = {
        lives: 4,
        maxLives: 4,
        score: 0,
        difficulty: 0, // 0 to 100
        active: false,
        currentGameIndex: -1
    };

    // Mock Games Database
    const gamesCatalog = [
        { title: "Juego Alpha", type: "Plataformas 2D" },
        { title: "Cosmic Racer", type: "Arcade Racing" },
        { title: "Neon Knight", type: "Rhythm Combat" },
        { title: "Cyber Puzzle", type: "Logic / Puzzle" },
        { title: "Pixel Sniper", type: "Shooter / Reflex" },
        { title: "Retro Drift", type: "Driving Simulation" },
        { title: "Mega Snake", type: "Classic Arcade" },
        { title: "Block Breaker", type: "Physics Arcade" },
        { title: "Ghost Hunter", type: "Survival Horror" }
    ];

    // DOM Elements
    const elements = {
        livesContainer: document.getElementById('lives-display'),
        scoreDisplay: document.getElementById('score-val'),
        difficultyBar: document.getElementById('difficulty-bar'),
        gameMessage: document.getElementById('game-message'),
        gameIndicator: document.getElementById('current-game-indicator'),
        btnNext: document.getElementById('next-game-btn'),
        btnFail: document.getElementById('simulate-fail-btn'),
        btnStart: document.getElementById('start-infinite-btn')
    };

    // Initialize System
    initSystem();

    // Event Listeners
    if (elements.btnNext) elements.btnNext.addEventListener('click', nextGame);
    if (elements.btnFail) elements.btnFail.addEventListener('click', handleFailsimulation);

    // Optional: Link the hero button if not handled inline
    if (elements.btnStart) {
        elements.btnStart.addEventListener('click', () => {
            startInfiniteMode();
        });
    }

    /**
     * System Initialization
     */
    function initSystem() {
        renderLives();
        logSystem("Gaia-Tech OS Initialized. Waiting for user input.");
    }

    /**
     * Start the Infinite Mode Loop
     */
    function startInfiniteMode() {
        gameState.lives = gameState.maxLives;
        gameState.score = 0;
        gameState.difficulty = 5; // Start with minimal difficulty
        gameState.active = true;

        renderLives();
        updateHUD();

        logSystem("Mode Infinite: ACTIVATED.");

        // Visual Feedback
        updateGameMessage("INICIALIZANDO VIAJE...", "neutral");

        setTimeout(() => {
            loadRandomGame();
        }, 1000);
    }

    /**
     * Load a random game from the catalog
     */
    function loadRandomGame() {
        if (!gameState.active) return;

        // Select random game distinct from current
        let nextIndex;
        do {
            nextIndex = Math.floor(Math.random() * gamesCatalog.length);
        } while (nextIndex === gameState.currentGameIndex && gamesCatalog.length > 1);

        gameState.currentGameIndex = nextIndex;
        const game = gamesCatalog[nextIndex];

        // Update UI
        updateGameMessage("SISTEMA ACTIVO", "success");
        if (elements.gameIndicator) {
            elements.gameIndicator.style.opacity = '0';
            setTimeout(() => {
                elements.gameIndicator.innerText = `Cargando módulo: ${game.title} [${game.type}]...`;
                elements.gameIndicator.style.opacity = '1';
                elements.gameIndicator.style.color = getDifficultyColor();
            }, 300);
        }
    }

    /**
     * Proceed to next game (Win condition simulation)
     */
    function nextGame() {
        if (!gameState.active) {
            startInfiniteMode();
            return;
        }

        // Increase Score & Difficulty
        gameState.score += 150 + (gameState.difficulty * 2);
        gameState.difficulty = Math.min(100, gameState.difficulty + 10);

        updateHUD();
        triggerSuccessEffect();
        loadRandomGame();
    }

    /**
     * Simulate Failure (Lose Life)
     */
    function handleFailsimulation() {
        if (!gameState.active) return;

        if (gameState.lives > 0) {
            gameState.lives--;
            renderLives();
            triggerDamageEffect();

            // Penalty
            gameState.score = Math.max(0, gameState.score - 50);
            updateHUD();

            if (gameState.lives === 0) {
                gameOver();
            } else {
                updateGameMessage("¡ADVERTENCIA! Integridad del casco comprometida.", "warning");
            }
        }
    }

    /**
     * Game Over State
     */
    function gameOver() {
        gameState.active = false;
        updateGameMessage("SISTEMA CRÍTICO. JUEGO TERMINADO.", "danger");
        if (elements.gameIndicator) elements.gameIndicator.innerText = `Puntuación Final: ${gameState.score}`;

        if (elements.btnNext) elements.btnNext.innerText = "REINICIAR";
    }

    /**
     * Render Life Icons
     */
    /**
     * Render Life Icons
     */
    function renderLives() {
        if (!elements.livesContainer) return;
        elements.livesContainer.innerHTML = '';

        for (let i = 0; i < gameState.maxLives; i++) {
            const lifeKv = document.createElement('div');
            lifeKv.classList.add('life-icon');

            if (i < gameState.lives) {
                lifeKv.innerHTML = '♥';
                lifeKv.style.color = '#ff003c'; // Neon Red
                lifeKv.style.textShadow = '0 0 10px #ff003c';
                lifeKv.style.transform = 'scale(1)';
            } else {
                lifeKv.innerHTML = '💔';
                lifeKv.style.color = '#555';
                lifeKv.style.textShadow = 'none';
                lifeKv.style.transform = 'scale(0.9)';
                lifeKv.style.opacity = '0.5';
            }
            elements.livesContainer.appendChild(lifeKv);
        }
    }

    /**
     * Update Score and Difficulty UI
     */
    function updateHUD() {
        // Update Score
        if (elements.scoreDisplay) {
            // Number animation (simple)
            elements.scoreDisplay.innerText = gameState.score.toString().padStart(4, '0');
        }

        // Update Difficulty Bar
        if (elements.difficultyBar) {
            elements.difficultyBar.style.width = `${gameState.difficulty}%`;

            // Change color based on difficulty
            const color = getDifficultyColor();
            elements.difficultyBar.style.background = color;
        }
    }

    function getDifficultyColor() {
        if (gameState.difficulty < 40) return 'linear-gradient(to right, var(--ocean-light), var(--turquoise))';
        if (gameState.difficulty < 70) return 'linear-gradient(to right, var(--sand-brown), var(--sand-light))';
        return 'linear-gradient(to right, var(--forest-green), #ff4500)';
    }

    /**
     * Visual FX
     */
    function updateGameMessage(text, type) {
        if (!elements.gameMessage) return;

        elements.gameMessage.innerText = text;
        elements.gameMessage.className = 'game-status-msg'; // Reset

        if (type === 'danger') elements.gameMessage.style.color = '#ff4500';
        else if (type === 'warning') elements.gameMessage.style.color = 'var(--sand-brown)';
        else if (type === 'success') elements.gameMessage.style.color = 'var(--forest-green)';
        else elements.gameMessage.style.color = 'var(--text-main)';
    }

    function triggerDamageEffect() {
        const viewport = document.querySelector('.game-interface');
        if (viewport) {
            viewport.style.boxShadow = '0 0 40px #ff4500';
            viewport.style.transform = 'translateX(10px)';
            setTimeout(() => { viewport.style.transform = 'translateX(-10px)'; }, 50);
            setTimeout(() => { viewport.style.transform = 'translateX(0)'; }, 100);
            setTimeout(() => { viewport.style.boxShadow = '0 0 50px rgba(0, 119, 190, 0.2)'; }, 300);
        }
    }

    function triggerSuccessEffect() {
        const hud = document.querySelector('.hud');
        if (hud) {
            hud.style.borderColor = 'var(--turquoise)';
            setTimeout(() => { hud.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }, 300);
        }
    }

    function logSystem(msg) {
        console.log(`[GAIA]: ${msg}`);
    }
});
