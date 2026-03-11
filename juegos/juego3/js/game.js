/* ═══════════════════════════════════════════════════
   EL REPARTO JUSTO — ODS 5 · Igualdad de Género
   Drag & Drop balance game
   ═══════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ── Configuración de tareas ──
    const TASKS = [
        { emoji: '💼', name: 'Trabajo', weight: 2 },
        { emoji: '👶', name: 'Bebé', weight: 3 },
        { emoji: '🍳', name: 'Cocina', weight: 2 },
        { emoji: '🧹', name: 'Limpieza', weight: 1 },
        { emoji: '📚', name: 'Deberes', weight: 2 },
        { emoji: '🛒', name: 'Compras', weight: 1 },
        { emoji: '🏥', name: 'Médico', weight: 2 },
        { emoji: '🧺', name: 'Colada', weight: 1 },
        { emoji: '🚗', name: 'Transporte', weight: 1 },
        { emoji: '💊', name: 'Cuidados', weight: 3 },
    ];

    const ROUND_DURATION = 15; // segundos
    const BASE_SPAWN_INTERVAL = 2200; // ms entre spawns (ronda 1)
    const MIN_SPAWN_INTERVAL = 700;

    // ── Estado del juego ──
    let state = {
        round: 1,
        score: 0,
        timeLeft: ROUND_DURATION,
        zoneA: [],   // tareas colocadas en A (pesos)
        zoneB: [],   // tareas colocadas en B (pesos)
        pendingTasks: [], // tareas en el spawner sin colocar
        timerInterval: null,
        spawnInterval: null,
        running: false,
    };

    // ── DOM refs ──
    const $ = (id) => document.getElementById(id);
    const startScreen = $('start-screen');
    const startBtn = $('start-btn');
    const floatingBg = $('floating-bg');
    const hudRound = $('hud-round');
    const hudScore = $('hud-score');
    const timerFill = $('timer-fill');
    const timerText = $('timer-text');
    const zoneA = $('zone-a');
    const zoneB = $('zone-b');
    const itemsA = $('items-a');
    const itemsB = $('items-b');
    const countA = $('count-a');
    const countB = $('count-b');
    const balanceBeam = $('balance-beam');
    const taskSpawner = $('task-spawner');
    const resultOverlay = $('result-overlay');
    const resultCard = $('result-card');
    const resultIcon = $('result-icon');
    const resultTitle = $('result-title');
    const resultMsg = $('result-msg');
    const statA = $('stat-a');
    const statB = $('stat-b');
    const btnNext = $('btn-next');
    const btnRetry = $('btn-retry');

    // ── Inicialización ──
    buildFloatingIcons();
    startBtn.addEventListener('click', startGame);
    btnNext.addEventListener('click', nextRound);
    btnRetry.addEventListener('click', retryRound);

    // ── Iconos flotantes del fondo ──
    function buildFloatingIcons() {
        const icons = ['💼', '👶', '🍳', '🧹', '📚', '🛒', '🏥', '🧺', '🚗', '💊', '⚖️'];
        for (let i = 0; i < 18; i++) {
            const span = document.createElement('span');
            span.className = 'floating-icon';
            span.textContent = icons[i % icons.length];
            span.style.left = Math.random() * 90 + 5 + '%';
            span.style.top = Math.random() * 90 + 5 + '%';
            span.style.animationDelay = (Math.random() * 6) + 's';
            span.style.animationDuration = (6 + Math.random() * 5) + 's';
            floatingBg.appendChild(span);
        }
    }

    // ═══ INICIAR JUEGO ═══
    function startGame() {
        state.round = 1;
        state.score = 0;
        updateHUD();
        startScreen.classList.remove('active');
        startScreen.classList.add('hidden');
        startRound();
    }

    // ═══ INICIAR RONDA ═══
    function startRound() {
        state.zoneA = [];
        state.zoneB = [];
        state.pendingTasks = [];
        
        // ---- DIFFICULTY SCALING ----
        const urlParams = new URLSearchParams(window.location.search);
        const multiplier = parseFloat(urlParams.get('multiplier')) || 1.0;
        const scaledDuration = ROUND_DURATION / multiplier;
        const scaledSpawnInterval = BASE_SPAWN_INTERVAL / multiplier;
        // ----------------------------

        state.timeLeft = scaledDuration;
        state.running = true;

        // Limpiar zonas
        itemsA.innerHTML = '';
        itemsB.innerHTML = '';
        taskSpawner.innerHTML = '';
        countA.textContent = '0';
        countB.textContent = '0';

        updateHUD();
        updateBalance();
        resultOverlay.classList.add('hidden');
        resultOverlay.classList.remove('active');

        // Timer
        timerFill.classList.remove('warning');
        timerFill.style.strokeDashoffset = '0';
        const circumference = 2 * Math.PI * 45; // ≈ 283

        state.timerInterval = setInterval(() => {
            state.timeLeft -= 0.25;
            if (state.timeLeft <= 0) {
                state.timeLeft = 0;
                endRound();
            }
            // Actualizar anillo
            const progress = 1 - state.timeLeft / scaledDuration;
            timerFill.style.strokeDashoffset = (circumference * progress).toString();
            timerText.textContent = Math.ceil(state.timeLeft);
            if (state.timeLeft <= 5) timerFill.classList.add('warning');
        }, 250);

        // Spawner
        const interval = Math.max(MIN_SPAWN_INTERVAL, scaledSpawnInterval - (state.round - 1) * 250);
        spawnTask(); // primera tarea inmediata
        state.spawnInterval = setInterval(() => {
            if (state.running) spawnTask();
        }, interval);
    }

    // ═══ SPAWN DE TAREA ═══
    function spawnTask() {
        if (!state.running) return;
        // Limitar tareas pendientes en el spawner
        if (state.pendingTasks.length >= 3) return;

        const taskDef = TASKS[Math.floor(Math.random() * TASKS.length)];
        const el = document.createElement('div');
        el.className = 'task-icon';
        el.textContent = taskDef.emoji;
        el.dataset.weight = taskDef.weight;
        el.setAttribute('title', `${taskDef.name} (peso: ${taskDef.weight})`);

        // Badge de peso
        const badge = document.createElement('span');
        badge.className = 'weight-badge';
        badge.textContent = taskDef.weight;
        el.appendChild(badge);

        // Movimiento errático en rondas avanzadas
        if (state.round >= 3) el.classList.add('erratic');

        // Drag events (pointer-based para táctil + escritorio)
        setupDrag(el);

        taskSpawner.appendChild(el);
        state.pendingTasks.push(el);
    }

    // ═══ DRAG & DROP (Pointer Events) ═══
    function setupDrag(el) {
        let offsetX = 0, offsetY = 0;
        let isDragging = false;
        let ghost = null;

        const onStart = (e) => {
            if (!state.running) return;
            e.preventDefault();
            isDragging = true;

            const rect = el.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            offsetX = clientX - rect.left;
            offsetY = clientY - rect.top;

            // Crear ghost
            ghost = el.cloneNode(true);
            ghost.classList.add('dragging');
            ghost.style.width = rect.width + 'px';
            ghost.style.height = rect.height + 'px';
            ghost.style.left = (clientX - offsetX) + 'px';
            ghost.style.top = (clientY - offsetY) + 'px';
            document.body.appendChild(ghost);

            el.style.opacity = '0.3';

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onEnd);
            document.addEventListener('pointercancel', onEnd);
        };

        const onMove = (e) => {
            if (!isDragging || !ghost) return;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            ghost.style.left = (clientX - offsetX) + 'px';
            ghost.style.top = (clientY - offsetY) + 'px';

            // Highlight drop zones
            highlightZones(clientX, clientY);
        };

        const onEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
            document.removeEventListener('pointercancel', onEnd);

            const clientX = e.clientX || 0;
            const clientY = e.clientY || 0;

            // Limpiar highlights
            zoneA.classList.remove('drag-over');
            zoneB.classList.remove('drag-over');

            // Determinar zona de destino
            const rectA = zoneA.getBoundingClientRect();
            const rectB = zoneB.getBoundingClientRect();
            const weight = parseInt(el.dataset.weight);
            let placed = false;

            if (isInside(clientX, clientY, rectA)) {
                placeTask(el, 'a', weight);
                placed = true;
            } else if (isInside(clientX, clientY, rectB)) {
                placeTask(el, 'b', weight);
                placed = true;
            }

            // Limpiar ghost
            if (ghost) { ghost.remove(); ghost = null; }

            if (placed) {
                // Quitar del spawner
                const idx = state.pendingTasks.indexOf(el);
                if (idx > -1) state.pendingTasks.splice(idx, 1);
                el.remove();
            } else {
                el.style.opacity = '1';
            }
        };

        el.addEventListener('pointerdown', onStart);
    }

    function isInside(x, y, rect) {
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function highlightZones(x, y) {
        const rectA = zoneA.getBoundingClientRect();
        const rectB = zoneB.getBoundingClientRect();
        zoneA.classList.toggle('drag-over', isInside(x, y, rectA));
        zoneB.classList.toggle('drag-over', isInside(x, y, rectB));
    }

    // ═══ COLOCAR TAREA EN ZONA ═══
    function placeTask(originalEl, zone, weight) {
        const placed = document.createElement('div');
        placed.className = 'task-icon placed';
        placed.textContent = originalEl.textContent.charAt(0) + (originalEl.textContent.length > 2 ? '' : originalEl.textContent.charAt(1) || '');
        // Usar solo emoji (sin badge text)
        placed.textContent = '';
        const emoji = originalEl.childNodes[0].textContent;
        placed.textContent = emoji;

        const badge = document.createElement('span');
        badge.className = 'weight-badge';
        badge.textContent = weight;
        placed.appendChild(badge);

        if (zone === 'a') {
            state.zoneA.push(weight);
            itemsA.appendChild(placed);
            countA.textContent = state.zoneA.length;
        } else {
            state.zoneB.push(weight);
            itemsB.appendChild(placed);
            countB.textContent = state.zoneB.length;
        }

        updateBalance();
    }

    // ═══ ACTUALIZAR BALANZA ═══
    function updateBalance() {
        const totalA = state.zoneA.reduce((s, w) => s + w, 0);
        const totalB = state.zoneB.reduce((s, w) => s + w, 0);
        const diff = totalA - totalB;

        // Beam rotation: max ±20deg
        const maxTilt = 20;
        const tilt = Math.max(-maxTilt, Math.min(maxTilt, diff * 4));
        balanceBeam.style.transform = `rotate(${tilt}deg)`;

        // Balance class
        balanceBeam.classList.remove('balanced', 'unbalanced');
        zoneA.classList.remove('balanced', 'unbalanced');
        zoneB.classList.remove('balanced', 'unbalanced');

        const total = totalA + totalB;
        if (total === 0) return;

        if (Math.abs(diff) <= 1) {
            balanceBeam.classList.add('balanced');
            zoneA.classList.add('balanced');
            zoneB.classList.add('balanced');
        } else if (Math.abs(diff) >= 3) {
            balanceBeam.classList.add('unbalanced');
            if (diff > 0) zoneA.classList.add('unbalanced');
            else zoneB.classList.add('unbalanced');
        }
    }

    // ═══ FIN DE RONDA ═══
    function endRound() {
        // ---- INFINITE MODE SIGNAL ----
        const isInfinite = location.search.includes('multiplier');
        if (isInfinite && window.parent && window.parent.postMessage) {
            const totalA = state.zoneA.reduce((s, w) => s + w, 0);
            const totalB = state.zoneB.reduce((s, w) => s + w, 0);
            const diff = Math.abs(totalA - totalB);
            const totalTasks = state.zoneA.length + state.zoneB.length;
            const isWin = diff <= 1 && totalTasks >= 2;
            window.parent.postMessage({ type: isWin ? 'onGameComplete' : 'onLifeLost' }, '*');
            return; 
        }
        // ------------------------------

        state.running = false;
        clearInterval(state.timerInterval);
        clearInterval(state.spawnInterval);

        const totalA = state.zoneA.reduce((s, w) => s + w, 0);
        const totalB = state.zoneB.reduce((s, w) => s + w, 0);
        const diff = Math.abs(totalA - totalB);
        const totalTasks = state.zoneA.length + state.zoneB.length;
        const isWin = diff <= 1 && totalTasks >= 2;

        // Stats
        statA.textContent = `${state.zoneA.length} (${totalA} pts)`;
        statB.textContent = `${state.zoneB.length} (${totalB} pts)`;

        if (isWin) {
            state.score += 100 + state.round * 20;
            resultIcon.textContent = '⚖️';
            resultTitle.textContent = '¡Corresponsabilidad lograda!';
            resultTitle.className = 'result-title win';
            resultMsg.textContent = `Ronda ${state.round} superada. El reparto equitativo es posible cuando todos colaboran.`;
            btnNext.style.display = '';
            btnRetry.style.display = 'none';
        } else {
            resultIcon.textContent = '⚠️';
            resultTitle.textContent = 'La carga sigue siendo desigual';
            resultTitle.className = 'result-title lose';
            resultMsg.textContent = '¡Equilíbrala! La corresponsabilidad requiere un reparto justo de las tareas.';
            btnNext.style.display = 'none';
            btnRetry.style.display = '';
        }

        updateHUD();
        resultOverlay.classList.remove('hidden');
        resultOverlay.classList.add('active');
    }

    // ═══ SIGUIENTE RONDA ═══
    function nextRound() {
        state.round++;
        updateHUD();
        startRound();
    }

    // ═══ REINTENTAR RONDA ═══
    function retryRound() {
        startRound();
    }

    // ═══ ACTUALIZAR HUD ═══
    function updateHUD() {
        hudRound.textContent = String(state.round).padStart(2, '0');
        hudScore.textContent = state.score;
    }

})();
