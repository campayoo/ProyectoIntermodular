/*
 * script.js
 * Logic for the Video Game Project Main Interface
 */

document.addEventListener('DOMContentLoaded', () => {
    // Game State
    let lives = 4;
    const maxLives = 4;
    const gameActive = true;

    // DOM Elements
    const livesContainer = document.getElementById('lives-display');
    const failButton = document.getElementById('simulate-fail-btn');
    const gameMessage = document.getElementById('game-message');

    // Initialize Game UI
    initGame();

    // Event Listeners
    if (failButton) {
        failButton.addEventListener('click', handleFailSimulation);
    }

    /**
     * Initialize the game state and UI
     */
    function initGame() {
        renderLives();
        logSystem("System initialized. Ready player one.");
    }

    /**
     * Render the visual representation of lives
     */
    function renderLives() {
        if (!livesContainer) return;

        livesContainer.innerHTML = '';

        // Create heart/life icons
        for (let i = 0; i < maxLives; i++) {
            const lifeIcon = document.createElement('span');
            lifeIcon.classList.add('life-icon');

            if (i < lives) {
                lifeIcon.innerHTML = '♥'; // Full life
                lifeIcon.style.opacity = '1';
                lifeIcon.style.color = 'var(--neon-red)';
                lifeIcon.style.textShadow = '0 0 5px var(--neon-red)';
            } else {
                lifeIcon.innerHTML = '♡'; // Empty life
                lifeIcon.style.opacity = '0.3';
                lifeIcon.style.color = '#555';
                lifeIcon.style.textShadow = 'none';
            }

            livesContainer.appendChild(lifeIcon);
        }
    }

    /**
     * Simulate a failure in a microgame (loss of life)
     */
    function handleFailSimulation() {
        if (lives > 0) {
            lives--;
            renderLives();

            // Visual feedback for damage
            triggerDamageEffect();

            if (lives === 0) {
                gameOver();
            } else {
                updateGameMessage("¡Cuidado! Has perdido una vida.", "warning");
            }
        } else {
            // Reset for demo purposes
            resetGame();
        }
    }

    /**
     * Trigger a visual shake/flash effect on damage
     */
    function triggerDamageEffect() {
        const gameInterface = document.querySelector('.game-interface');
        if (gameInterface) {
            gameInterface.style.borderColor = 'var(--neon-red)';
            gameInterface.style.boxShadow = '0 0 30px var(--neon-red)';
            gameInterface.style.transform = 'translate(5px, 5px)';

            setTimeout(() => {
                gameInterface.style.transform = 'translate(-5px, -5px)';
            }, 50);

            setTimeout(() => {
                gameInterface.style.transform = 'translate(2px, -2px)';
            }, 100);

            setTimeout(() => {
                gameInterface.style.borderColor = 'var(--neon-green)';
                gameInterface.style.boxShadow = '0 0 30px rgba(10, 255, 0, 0.2)';
                gameInterface.style.transform = 'translate(0, 0)';
            }, 300);
        }
    }

    /**
     * Handle Game Over state
     */
    function gameOver() {
        updateGameMessage("GAME OVER. Pulsa par reiniciar.", "danger");
        if (failButton) failButton.innerText = "REINICIAR SISTEMA";
    }

    /**
     * Reset the game state
     */
    function resetGame() {
        lives = maxLives;
        renderLives();
        updateGameMessage("SISTEMA REINICIADO", "success");
        if (failButton) failButton.innerText = "SIMULAR FALLO";

        setTimeout(() => {
            updateGameMessage("Esperando Microjuego...", "neutral");
        }, 1500);
    }

    /**
     * Update the text message in the game screen
     * @param {string} text - The message to display
     * @param {string} type - safe, warning, or danger
     */
    function updateGameMessage(text, type) {
        if (gameMessage) {
            gameMessage.innerText = text;
            gameMessage.style.color = type === 'danger' ? 'var(--neon-red)' :
                type === 'warning' ? '#ff9900' :
                    '#fff';
        }
    }

    /**
     * Simple internal logger
     */
    function logSystem(msg) {
        console.log(`[SYSTEM]: ${msg}`);
    }
});
