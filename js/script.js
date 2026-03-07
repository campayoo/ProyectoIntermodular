/**
 * script.js
 * WORLDGAMES: Microgames for Sustainability
 * Core Logic & Mission Control Hub
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Particles
    initParticles();

    // 2. Audio Context for SFX (Cyber-Arcade style)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSFX(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        if (type === 'hover') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        } else if (type === 'levelup') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        } else if (type === 'win') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        }

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + (type === 'levelup' ? 0.5 : 0.2));
    }

    // 3. Hover SFX
    const interactiveElements = document.querySelectorAll('button, .grid-slot:not(.locked), a');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (!el.classList.contains('locked')) {
                playSFX('hover');
            }
        });
    });

    // 4. Game State
    const worldState = {
        infiniteMode: false,
        score: 0,
        lives: 4,
        difficulty: 'EASY', // EASY, NORMAL, HARD
        multiplier: 1.0,
        gameList: [
            'juegos/juego1/index.html',
            'juegos/juego2/index.html',
            'juegos/juego3/index.html',
            'juegos/OceanCleanup/index.html',
            'juegos/juego5/index.html',
            'juegos/juego6/index.html',
            'juegos/juego7/index.html',
            'juegos/juego8/index.html',
            'juegos/juego9/index.html'
        ]
            'juegos/juego6/placeholder.html',
            'juegos/OceanCleanup/index.html'
        ] // Add more as they deploy
    };

    // 5. Infinite Mode Controller
    window.startInfiniteMode = function () {
        const btn = document.getElementById('start-infinite-btn');
        const overlay = document.getElementById('infinite-loading-overlay');

        btn.classList.add('opacity-50', 'pointer-events-none');
        overlay.classList.remove('hidden');

        playSFX('levelup');

        setTimeout(() => {
            worldState.infiniteMode = true;
            worldState.score = 0;
            worldState.lives = 4;
            worldState.difficulty = 'EASY';
            worldState.multiplier = 1.0;

            updateInfiniteHUD();
            overlay.classList.add('hidden');
            btn.classList.remove('opacity-50', 'pointer-events-none');

            launchNextMission();
        }, 1500);
    };

    function launchNextMission() {
        if (worldState.lives <= 0) return handleGameOver();

        // Pick a random game (currently only one, so we "fake" it with modifiers)
        const randomGame = worldState.gameList[Math.floor(Math.random() * worldState.gameList.length)];

        // Visual transition "GET READY"
        openGame(randomGame);

        // Simulate game result for demo purposes (usually handled by postMessage from iframe)
        // In a real scenario, the iframe sends 'win' or 'loss'
        // For now, let's auto-win or auto-progress after 8 seconds
        startTimer(8000, () => {
            handleMissionSuccess();
        });
    }

    function handleMissionSuccess() {
        worldState.score++;
        playSFX('win');
        checkDifficultyJump();
        updateInfiniteHUD();

        // Show success briefly then next
        setTimeout(() => {
            launchNextMission();
        }, 1000);
    }

    function checkDifficultyJump() {
        const modal = document.getElementById('game-modal');
        const indicator = document.getElementById('difficulty-indicator');
        const alert = document.getElementById('level-change-alert');
        const alertText = document.getElementById('level-alert-text');
        const alertSub = document.getElementById('level-alert-subtext');

        let jump = false;

        if (worldState.score === 10 && worldState.difficulty === 'EASY') {
            worldState.difficulty = 'NORMAL';
            worldState.multiplier = 1.2;
            modal.classList.add('level-flash-normal');
            alertText.textContent = '¡NIVEL NORMAL!';
            alertSub.textContent = 'VELOCIDAD x1.2';
            alertText.className = 'text-6xl md:text-8xl font-black italic tracking-tighter mb-2 text-yellow-400 opacity-100 scale-100';
            jump = true;
        } else if (worldState.score === 20 && worldState.difficulty === 'NORMAL') {
            worldState.difficulty = 'HARD';
            worldState.multiplier = 1.5;
            modal.classList.remove('level-flash-normal');
            modal.classList.add('level-flash-hard');
            alertText.textContent = '¡NIVEL CRÍTICO!';
            alertSub.textContent = 'VELOCIDAD x1.5';
            alertText.className = 'text-6xl md:text-8xl font-black italic tracking-tighter mb-2 text-red-500 opacity-100 scale-100';
            jump = true;
        }

        if (jump) {
            playSFX('levelup');
            alert.classList.remove('hidden');
            setTimeout(() => {
                alert.classList.add('hidden');
            }, 2000);

            indicator.textContent = `Nivel: ${worldState.difficulty} (x${worldState.multiplier})`;
            indicator.classList.add('border-cyan-400', 'text-white');
        }
    }

    function updateInfiniteHUD() {
        document.getElementById('infinite-score').textContent = worldState.score.toString().padStart(2, '0');

        const livesContainer = document.getElementById('infinite-lives');
        livesContainer.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const life = document.createElement('span');
            life.textContent = '🌍';
            if (i >= worldState.lives) life.classList.add('grayscale', 'opacity-20');
            livesContainer.appendChild(life);
        }
    }

    function startTimer(duration, callback) {
        const timerBar = document.getElementById('microgame-timer');
        let start = null;

        function step(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const remaining = Math.max(0, 100 - (progress / duration) * 100);
            timerBar.style.width = remaining + '%';

            if (progress < duration) {
                window.requestAnimationFrame(step);
            } else {
                callback();
            }
        }
        window.requestAnimationFrame(step);
    }

    function handleGameOver() {
        alert(`PLANETA AGOTADO. Score Final: ${worldState.score}`);
        closeGame();
    }

    // 6. Particles.js Configuration
    function initParticles() {
        if (window.particlesJS) {
            particlesJS('particles-js', {
                "particles": {
                    "number": { "value": 40, "density": { "enable": true, "value_area": 800 } },
                    "color": { "value": ["#26BDE2", "#FCC30B", "#3EB049"] },
                    "shape": { "type": "circle" },
                    "opacity": { "value": 0.2, "random": true },
                    "size": { "value": 2, "random": true },
                    "line_linked": { "enable": false },
                    "move": { "enable": true, "speed": 0.8, "direction": "none", "random": true, "out_mode": "out" }
                },
                "interactivity": {
                    "detect_on": "canvas",
                    "events": { "onhover": { "enable": true, "mode": "bubble" }, "resize": true },
                    "modes": { "bubble": { "distance": 200, "size": 4, "duration": 2, "opacity": 0.8 } }
                }
            });
        }
    }

    // 7. System UI effects
    console.log("%c WORLDGAMES SYSTEM ONLINE :: KERNEL_LOADED ", "background: #111; color: #26BDE2; font-weight: bold; padding: 5px;");
});

/**
 * Game Modal Functions
 */
function openGame(url) {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-iframe');
    if (modal && iframe) {
        iframe.src = url;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
}

function closeGame() {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-iframe');
    if (modal && iframe) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        iframe.src = '';
        document.body.style.overflow = '';
        // Reset effects
        modal.classList.remove('level-flash-normal', 'level-flash-hard');
    }
}

// Close on backdrop click (optional, usually disabled in arcade mode to prevent accidental close)
window.addEventListener('click', (e) => {
    const modal = document.getElementById('game-modal');
    if (e.target === modal) {
        // closeGame(); 
    }
});
