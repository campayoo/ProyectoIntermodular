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
            './juegos/juego1/index.html',
            './juegos/juego2/index.html',
            './juegos/juego3/index.html',
            './juegos/OceanCleanup/index.html',
            './juegos/juego5/index.html',
            './juegos/juego6/index.html',
            './juegos/juego7/index.html',
            './juegos/juego8/index.html',
            './juegos/juego9/index.html'
        ],
        availableGames: [],
        currentLevelUrl: null,
        isLoading: false,
        hasReported: false, // Flag to prevent duplicate signals per mission
        watchdogTimer: null,
        bridgeInterval: null,
        missionNames: {
            './juegos/juego1/index.html': 'EcoPulse',
            './juegos/juego2/index.html': 'VitalRhythm',
            './juegos/juego3/index.html': 'CleanSky',
            './juegos/OceanCleanup/index.html': 'OceanRescue',
            './juegos/juego5/index.html': 'GreenPower',
            './juegos/juego6/index.html': 'ForestGuard',
            './juegos/juego7/index.html': 'RecycleMaster',
            './juegos/juego8/index.html': 'SolarRush',
            './juegos/juego9/index.html': 'WindStrike'
        },
        isPlanetDestroyed: false
    };
    window.worldState = worldState;

    window.addEventListener('message', (event) => {
        if (!worldState.infiniteMode) return;
        if (event.data && event.data.type === 'onGameComplete') {
            handleMissionSuccess();
        } else if (event.data && event.data.type === 'onLifeLost') {
            handleLifeLost();
        }
    });

    // 5. Infinite Mode Controller
    window.handleInfiniteButtonClick = function() {
        if (worldState.multiplier > 1.0 || worldState.isPlanetDestroyed || worldState.lives <= 0) {
            const confirmOverlay = document.getElementById('infinite-confirm-overlay');
            if (confirmOverlay) {
                confirmOverlay.classList.remove('hidden');
            }
        } else {
            startInfiniteMode();
        }
    };

    window.closeInfiniteConfirm = function() {
        const confirmOverlay = document.getElementById('infinite-confirm-overlay');
        if (confirmOverlay) {
            confirmOverlay.classList.add('hidden');
        }
    };

    window.startInfiniteMode = function (forceReset = false) {
        if (forceReset) {
            closeInfiniteConfirm();
            // ---- TERRAFORM EFFECT ----
            document.body.classList.add('restoring-planet');
            setTimeout(() => {
                document.body.classList.remove('restoring-planet', 'inhabitable-planet');
            }, 2000);
            // --------------------------
        }
        
        const btn = document.getElementById('start-infinite-btn');
        const overlay = document.getElementById('infinite-loading-overlay');

        btn.classList.add('opacity-50', 'pointer-events-none');
        overlay.classList.remove('hidden');

        playSFX('levelup');

        // Reset destroyed visual if needed
        const earthVisual = document.getElementById('earth-visual');
        if (earthVisual) {
            earthVisual.innerHTML = '🌍';
            earthVisual.className = 'text-9xl transition-all duration-1000';
            earthVisual.style.opacity = '1';
        }

        setTimeout(() => {
            worldState.infiniteMode = true;
            worldState.score = 0;
            worldState.lives = 4;
            worldState.difficulty = 'EASY';
            worldState.multiplier = 1.0;
            worldState.isPlanetDestroyed = false;
            worldState.availableGames = [...worldState.gameList];

            updateInfiniteHUD();
            updatePlanetaryTheme();
            overlay.classList.add('hidden');
            btn.classList.remove('opacity-50', 'pointer-events-none');

            launchNextMission();
        }, 1500);
    };

    function launchNextMission(isRetry = false) {
        if (worldState.lives <= 0) return handleGameOver();
        if (worldState.isLoading) {
            console.log('[Controller] Load blocked: already loading');
            return; 
        }

        // Clear MUST be global and absolute
        if (worldState.watchdogTimer) clearTimeout(worldState.watchdogTimer);
        if (worldState.bridgeInterval) clearInterval(worldState.bridgeInterval);
        worldState.watchdogTimer = null;
        worldState.bridgeInterval = null;
        worldState.hasReported = false; // Reset for new mission

        worldState.isLoading = true;
        let nextGamePath;

        if (isRetry && worldState.currentLevelUrl) {
            nextGamePath = worldState.currentLevelUrl;
        } else {
            if (worldState.availableGames.length === 0) {
                worldState.availableGames = [...worldState.gameList];
                if (worldState.availableGames.length > 1 && worldState.currentLevelUrl) {
                    const lastIndex = worldState.availableGames.indexOf(worldState.currentLevelUrl);
                    if (lastIndex !== -1) worldState.availableGames.splice(lastIndex, 1);
                }
            }
            
            const randomIndex = Math.floor(Math.random() * worldState.availableGames.length);
            nextGamePath = worldState.availableGames.splice(randomIndex, 1)[0];
            worldState.currentLevelUrl = nextGamePath;
        }

        // 2. HUD Update
        const iframe = document.getElementById('game-iframe');
        if (iframe) iframe.src = 'about:blank';
        
        const currentName = worldState.missionNames[nextGamePath] || 'Misión Desconocida';
        document.getElementById('current-mission-name').textContent = currentName;
        
        const nextPossible = worldState.availableGames[0];
        document.getElementById('next-mission-name').textContent = nextPossible ? (worldState.missionNames[nextPossible] || 'Aleatorio') : 'Barajando...';

        // 3. Load with Watchdog & Loading Screen
        const loadingScreen = document.getElementById('inter-game-loading');
        const loadingBar = document.getElementById('loading-bar-fill');
        const loadingTitle = document.getElementById('loading-mission-title');

        if (loadingScreen && loadingBar && loadingTitle) {
            loadingTitle.textContent = `VIAJANDO A SECTOR ${currentName}...`;
            loadingBar.style.width = '30%';
            loadingScreen.classList.remove('hidden');
            loadingScreen.classList.add('flex');
        }

        setTimeout(() => {
            const urlWithParams = `${nextGamePath}${nextGamePath.includes('?') ? '&' : '?'}multiplier=${worldState.multiplier.toFixed(2)}`;
            
            // Set up removal of loading screen on iframe load
            iframe.onload = () => {
                if (loadingBar) loadingBar.style.width = '100%';
                setTimeout(() => {
                    if (loadingScreen) {
                        loadingScreen.classList.add('hidden');
                        loadingScreen.classList.remove('flex');
                    }
                    if (loadingBar) loadingBar.style.width = '0%';
                }, 600);
                iframe.onload = null; // Clean up
            };

            openGame(urlWithParams);
            
            // Watchdog Timer: Force next if no signals in 25s
            worldState.watchdogTimer = setTimeout(() => {
                console.warn('[Watchdog] Magic jump triggered due to timeout');
                handleLifeLost(); // Penalty and skip
            }, 25000);

            worldState.isLoading = false; 
        }, 1500); 
    }

    // Note: detectOutcomeAndReport and setupGameBridge were removed in favor of internal game signaling.

    function handleMissionSuccess() {
        if (worldState.watchdogTimer) clearTimeout(worldState.watchdogTimer);
        worldState.watchdogTimer = null;
        
        if (worldState.hasReported) return;
        worldState.hasReported = true;

        worldState.score++;
        worldState.multiplier += 0.05; // Incremental Scaling
        playSFX('win');
        checkDifficultyJump();
        updateInfiniteHUD();

        // High-Dopamine Transition
        const successOverlay = document.getElementById('mission-success-overlay');
        const successContent = document.getElementById('success-content');
        const successBar = document.getElementById('success-bar');
        const gameIframe = document.getElementById('game-iframe');
        
        // ---- SAFETY & POLISH ----
        // 1. "Freeze" the background game visually and interaction-wise
        if (gameIframe) {
            gameIframe.style.pointerEvents = 'none'; // Prevent further clicks
            gameIframe.style.filter = 'blur(4px) brightness(0.4)'; // Immersive dimming
        }
        // -------------------------

        if (successOverlay && successContent && successBar) {
            successOverlay.classList.remove('hidden');
            successOverlay.classList.add('flex');
            setTimeout(() => {
                successContent.classList.remove('scale-50', 'opacity-0');
                successContent.classList.add('scale-100', 'opacity-100');
                successBar.style.width = '100%';
            }, 10);
        }

        // Transition Delay
        setTimeout(() => {
            if (successOverlay) {
                successOverlay.classList.add('hidden');
                successOverlay.classList.remove('flex');
                successContent.classList.add('scale-50', 'opacity-0');
                successContent.classList.remove('scale-100', 'opacity-100');
                successBar.style.width = '0%';
            }

            // Reset visuals for next game
            if (gameIframe) {
                gameIframe.style.filter = '';
                gameIframe.style.pointerEvents = 'auto';
            }

            launchNextMission();
        }, 2500); // 2.5s for more "dopamine" and safety
    }

    function handleLifeLost() {
        if (worldState.watchdogTimer) clearTimeout(worldState.watchdogTimer);
        worldState.watchdogTimer = null;

        if (worldState.hasReported) return;
        worldState.hasReported = true;

        // Stop current game execution effectively by unloading
        const iframe = document.getElementById('game-iframe');
        if (iframe) iframe.src = 'about:blank';

        worldState.lives--;
        updateInfiniteHUD();

        if (worldState.lives > 0) {
            const overlay = document.getElementById('life-lost-overlay');
            if (overlay) {
                document.getElementById('lives-remaining-text').textContent = `Te quedan ${worldState.lives} vidas`;
                overlay.classList.remove('hidden');
                overlay.classList.add('flex');
            }
        } else {
            handleGameOver();
        }
    }

    function checkDifficultyJump() {
        const modal = document.getElementById('game-modal');
        const indicator = document.getElementById('difficulty-indicator');
        const alert = document.getElementById('level-change-alert');
        const alertText = document.getElementById('level-alert-text');
        const alertSub = document.getElementById('level-alert-subtext');

        // Update the indicator text every time
        indicator.textContent = `Nivel: ${worldState.difficulty} (x${worldState.multiplier.toFixed(2)})`;

        let jump = false;

        // Milestones based on multiplier
        if (worldState.multiplier >= 1.5 && worldState.difficulty === 'EASY') {
            worldState.difficulty = 'NORMAL';
            modal.classList.add('level-flash-normal');
            alertText.textContent = '¡NIVEL NORMAL!';
            alertSub.textContent = `VELOCIDAD x${worldState.multiplier.toFixed(2)}`;
            alertText.className = 'text-6xl md:text-8xl font-black italic tracking-tighter mb-2 text-yellow-400 opacity-100 scale-100';
            jump = true;
        } else if (worldState.multiplier >= 2.0 && worldState.difficulty === 'NORMAL') {
            worldState.difficulty = 'HARD';
            modal.classList.remove('level-flash-normal');
            modal.classList.add('level-flash-hard');
            alertText.textContent = '¡NIVEL CRÍTICO!';
            alertSub.textContent = `VELOCIDAD x${worldState.multiplier.toFixed(2)}`;
            alertText.className = 'text-6xl md:text-8xl font-black italic tracking-tighter mb-2 text-red-500 opacity-100 scale-100';
            jump = true;
        }

        if (jump) {
            playSFX('levelup');
            alert.classList.remove('hidden');
            setTimeout(() => {
                alert.classList.add('hidden');
            }, 2000);
            indicator.classList.add('border-cyan-400', 'text-white');
        }
    }

    function updateInfiniteHUD() {
        if (document.getElementById('infinite-score')) {
            document.getElementById('infinite-score').textContent = worldState.score.toString().padStart(2, '0');
        }

        if (document.getElementById('infinite-lives-text')) {
            document.getElementById('infinite-lives-text').textContent = worldState.isPlanetDestroyed ? 'PLANETA DESTRUIDO' : `VIDAS: ${worldState.lives}/4`;
        }
        
        const livesContainers = [
            document.getElementById('infinite-lives'),
            document.getElementById('planet-lives') // Main Header Sync
        ];

        livesContainers.forEach(container => {
            if (!container) return;
            container.innerHTML = '';
            for (let i = 0; i < 4; i++) {
                const life = document.createElement('span');
                // Header uses planetary icons, so we keep consistency
                if (worldState.isPlanetDestroyed) {
                    life.textContent = '💀';
                    life.className = 'text-red-900 drop-shadow-[0_0_5px_rgba(255,0,0,0.5)]';
                } else {
                    const isLost = i >= worldState.lives;
                    life.textContent = isLost ? '🌑' : '🌍';
                    if (isLost) life.className = 'grayscale opacity-40';
                    else life.className = 'text-green-500';
                }
                container.appendChild(life);
            }
        });
        
        updatePlanetaryTheme();
    }

    function updatePlanetaryTheme() {
        if (worldState.lives <= 0 || worldState.isPlanetDestroyed) {
            document.body.classList.add('inhabitable-planet');
        } else {
            // Only remove if not already in terraform process
            if (!document.body.classList.contains('restoring-planet')) {
                document.body.classList.remove('inhabitable-planet');
            }
        }
    }



    function handleGameOver() {
        if (worldState.isPlanetDestroyed && document.getElementById('planet-destroyed-overlay').classList.contains('flex')) return;

        console.log('[Controller] Triggering Planet Destruction Sequence');
        
        const iframe = document.getElementById('game-iframe');
        if (iframe) iframe.src = 'about:blank';
        
        worldState.infiniteMode = false;
        worldState.lives = 0;
        worldState.isPlanetDestroyed = true;
        
        // 1. Hide ALL other overlays to prevent overlap
        ['life-lost-overlay', 'mission-success-overlay', 'inter-game-loading', 'pause-menu-overlay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('flex');
            }
        });

        // 2. Sync HUD & Theme
        updateInfiniteHUD(); 

        const destroyedOverlay = document.getElementById('planet-destroyed-overlay');
        const earthVisual = document.getElementById('earth-visual');
        const flash = document.getElementById('explosion-flash');

        if (destroyedOverlay && earthVisual && flash) {
            destroyedOverlay.classList.remove('hidden');
            destroyedOverlay.classList.add('flex');
            
            // Initial state reset
            earthVisual.innerHTML = '🌍';
            earthVisual.className = 'text-9xl transition-all duration-1000';
            earthVisual.style.filter = 'drop-shadow(0 0 30px rgba(255,0,0,0.5))';
            earthVisual.style.opacity = '1';
            
            // Start Sequence
            setTimeout(() => {
                // Shake Phase
                earthVisual.classList.add('animate-earth-shake');
                
                setTimeout(() => {
                    // Explosion Flash
                    flash.style.opacity = '1';
                    flash.style.background = 'white';
                    
                    setTimeout(() => {
                        flash.style.background = 'rgba(255, 69, 0, 0.8)';
                        setTimeout(() => flash.style.opacity = '0', 400);
                    }, 150);
                    
                    // Transformation Phase
                    earthVisual.classList.remove('animate-earth-shake');
                    earthVisual.innerHTML = '💥'; 
                    earthVisual.classList.add('scale-150');
                    
                    setTimeout(() => {
                        earthVisual.innerHTML = '🌑'; 
                        earthVisual.classList.replace('scale-150', 'scale-100');
                        earthVisual.classList.add('opacity-40');
                        earthVisual.style.filter = 'grayscale(1) contrast(1.2) drop-shadow(0 0 15px rgba(0,0,0,1))';
                        
                        // Apply desaturated red theme
                        document.body.classList.add('inhabitable-planet');
                    }, 800);
                }, 2000); // 2 seconds of shaking for suspense
            }, 100);
        }
    }

    window.stayOnDestroyedEarth = function() {
        const overlay = document.getElementById('planet-destroyed-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
        updateInfiniteHUD(); // Final sync for main page
        closeGame();
    };

    // Global Pause & Overlay Functions
    window.pauseGame = function() {
        const pauseMenu = document.getElementById('pause-menu-overlay');
        if (pauseMenu) {
            pauseMenu.classList.remove('hidden');
            pauseMenu.classList.add('flex');
        }
        const iframe = document.getElementById('game-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'onPause' }, '*');
        }
    };

    window.resumeGame = function() {
        const pauseMenu = document.getElementById('pause-menu-overlay');
        if (pauseMenu) {
            pauseMenu.classList.add('hidden');
            pauseMenu.classList.remove('flex');
        }
        const iframe = document.getElementById('game-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'onResume' }, '*');
        }
    };

    window.restartGame = function() {
        window.resumeGame();
        launchNextMission();
    };

    window.surrenderGame = function() {
        worldState.infiniteMode = false;
        const pauseMenu = document.getElementById('pause-menu-overlay');
        if (pauseMenu) {
            pauseMenu.classList.add('hidden');
            pauseMenu.classList.remove('flex');
        }
        const lifeLostMenu = document.getElementById('life-lost-overlay');
        if (lifeLostMenu) {
            lifeLostMenu.classList.add('hidden');
            lifeLostMenu.classList.remove('flex');
        }
        closeGame();
    };

    window.retryGame = function() {
        const overlay = document.getElementById('life-lost-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
        launchNextMission(true); // Explicit Retry
    };

    window.nextGame = function() {
        const overlay = document.getElementById('life-lost-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
        launchNextMission(false); // Skip to next random
    };

    window.exitGame = function() {
        window.surrenderGame();
    };

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
    if (window.worldState && window.worldState.isPlanetDestroyed) {
        alert("EL PLANETA HA SIDO DESTRUIDO. DEBES REINICIAR EL SISTEMA.");
        return;
    }
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
