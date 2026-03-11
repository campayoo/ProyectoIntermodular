const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreElement = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const levelScreen = document.getElementById('level-screen'); // new
const finalScoreElement = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// New level elements
const levelElement = document.getElementById('level');
const timerElement = document.getElementById('timer');
const nextLevelTimerElement = document.getElementById('next-level-timer');
const livesContainer = document.getElementById('lives-container');

let frames = 0;
let score = 0;
let gameSpeed = 2;
let isGameOver = false;
let animationId;
let level = 1;
let levelTimeLeft = 15;
let isLevelTransition = false;
let obstacleFrequency = 60; // Base frames between obstacles
let lastTimeUpdate = 0; // For tracking seconds accurately
let availableZones = [0, 1, 2]; // 0: Top, 1: Middle, 2: Bottom
let lives = 4;
let contaminationTimer = 0;
let isContaminated = false;

// Game constants
const GRAVITY = 0.25;
const JUMP = 4.6;

// Resize canvas to fill window
// Resize canvas based on container
function resizeCanvas() {
    const container = document.getElementById('game-container');
    if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    } else {
        canvas.width = 900;
        canvas.height = 620;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Bird {
    constructor() {
        this.width = 70;
        this.height = 70;
        this.x = 50;
        this.y = canvas.height / 2;
        this.velocity = 0;
        this.emoji = '🐦';
    }

    draw() {
        // Rotation based on velocity
        let rotation = this.velocity * 0.1; // Magic number for rotation scaling
        if (rotation > Math.PI / 4) rotation = Math.PI / 4; // Max downward angle
        if (rotation < -Math.PI / 4) rotation = -Math.PI / 4; // Max upward angle

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(rotation);

        ctx.save();
        ctx.scale(-1, 1); // Flip horizontally for direction
        ctx.font = '70px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();

        ctx.restore();
    }

    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;

        // Floor collision (Game over ONLY when completely off-screen)
        if (this.y > canvas.height) {
            this.velocity = 0;
            gameOver();
        }

        // Ceiling collision
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }

        this.draw();
    }

    jump() {
        this.velocity = -JUMP;
    }
}

class Obstacle {
    constructor(y) {
        this.width = 110;
        this.height = 110;
        this.x = canvas.width;
        // Random usage: 50% chance for Eagle, 50% for Plane
        this.type = Math.random() > 0.5 ? 'eagle' : 'plane';
        this.emoji = this.type === 'eagle' ? '🦅' : '✈️';

        if (y !== undefined) {
            this.y = y;
        } else {
            // Unused fallback, we explicitly set Y now.
            this.y = 0;
        }

        this.speed = gameSpeed + Math.random() * 2; // Slight speed variation
        this.markedForDeletion = false;
    }

    draw() {
        ctx.save();
        ctx.font = '110px Arial';
        if (this.type === 'plane') {
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(-135 * Math.PI / 180);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.emoji, 0, 0);
        } else {
            ctx.fillText(this.emoji, this.x, this.y + this.height);
        }
        ctx.restore();
    }

    update() {
        this.x -= this.speed;
        if (this.x + this.width < 0) {
            this.markedForDeletion = true;
            score++;
            scoreElement.innerText = score;
        }
        this.draw();
    }
}

let bird;
let obstacles = [];

function updateLivesUI() {
    if (livesContainer) {
        livesContainer.innerText = '🌍'.repeat(Math.max(0, lives));
    }
}

function init(resetLevel = true) {
    if (resetLevel) {
        level = 1;
        score = 0;
        lives = 4;
    }
    // ---- DIFFICULTY SCALING ----
    const urlParams = new URLSearchParams(window.location.search);
    const multiplier = parseFloat(urlParams.get('multiplier')) || 1.0;
    levelTimeLeft = Math.max(5, Math.ceil(15 / multiplier));
    // ----------------------------

    bird = new Bird();
    obstacles = [];
    frames = 0;
    gameSpeed = (4 + (level * 1.0)) * multiplier;
    // ensure integer and minimum frequency to avoid overlapping/invisible obstacles
    obstacleFrequency = Math.max(20, Math.floor((120 - (level * 10)) / multiplier));
    isGameOver = false;
    isLevelTransition = false;
    isContaminated = false;
    contaminationTimer = 0;

    scoreElement.innerText = score;
    levelElement.innerText = level;
    timerElement.innerText = levelTimeLeft;
    updateLivesUI();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    levelScreen.classList.add('hidden');

    lastTimeUpdate = performance.now();
    animate(lastTimeUpdate);
}

function startLevelTransition() {
    // ---- INFINITE MODE SIGNAL ----
    const isInfinite = location.search.includes('multiplier');
    if (isInfinite && window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'onGameComplete' }, '*');
        return; 
    }
    // ------------------------------

    isLevelTransition = true;
    levelScreen.classList.remove('hidden');

    let countdown = 3;
    nextLevelTimerElement.innerText = countdown;

    const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            nextLevelTimerElement.innerText = countdown;
        } else {
            clearInterval(interval);
            level++;
            init(false); // don't reset score and level
        }
    }, 1000);
}

function animate(currentTime) {
    if (isGameOver || isLevelTransition) return;

    // Timer update (countdown 1 second at a time)
    if (currentTime - lastTimeUpdate >= 1000) {
        levelTimeLeft--;
        timerElement.innerText = levelTimeLeft;
        lastTimeUpdate = currentTime;

        if (levelTimeLeft <= 0) {
            startLevelTransition();
            return;
        }
    }

    ctx.globalAlpha = 1.0; // Always reset alpha at start of frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw solid sky background on canvas (replaces CSS gradient)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Contamination effect
    if (isContaminated) {
        contaminationTimer--;
        if (contaminationTimer <= 0) {
            isContaminated = false;
        }
        // Draw a murky brownish/gray overlay on top of the sky
        ctx.fillStyle = 'rgba(101, 67, 33, 0.4)'; // Sepia/Dirty brown
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    bird.update();

    if (frames % obstacleFrequency === 0) {

        // Reset available zones if they are all used
        if (availableZones.length < 2) {
            availableZones = [0, 1, 2];
        }

        const zoneHeight = canvas.height / 3;

        // Pick a random zone and remove it from available zones to avoid clumping
        const zoneIndex = Math.floor(Math.random() * availableZones.length);
        const zone = availableZones.splice(zoneIndex, 1)[0];

        // Ensure it doesn't spill over the bottom
        const minY = zone * zoneHeight;
        const maxY = Math.min((zone + 1) * zoneHeight, canvas.height - 110);
        let y1 = Math.floor(Math.random() * (maxY - minY + 1)) + minY;

        // Force exactly on top edge if zone is 0 and random hits the upper quarter of the zone
        if (zone === 0 && Math.random() < 0.5) y1 = 0;

        const obs1 = new Obstacle(y1);
        obstacles.push(obs1);

        // Chance to spawn second increases slightly per level, very low at start
        const chanceForSecond = Math.min(0.8, 0.1 + (level * 0.05));

        if (Math.random() < chanceForSecond && availableZones.length > 0) {

            // Pick another zone that hasn't been used yet
            const secondZoneIndex = Math.floor(Math.random() * availableZones.length);
            const secondZone = availableZones.splice(secondZoneIndex, 1)[0];

            const minY2 = secondZone * zoneHeight;
            const maxY2 = Math.min((secondZone + 1) * zoneHeight, canvas.height - 110);
            let y2 = Math.floor(Math.random() * (maxY2 - minY2 + 1)) + minY2;

            if (secondZone === 0 && Math.random() < 0.5) y2 = 0;

            obstacles.push(new Obstacle(y2));
        }
    }

    obstacles.forEach((obstacle, index) => {
        obstacle.update();

        // Collision Detection (Shape-specific hitboxes)
        const birdHB = {
            x: bird.x + bird.width * 0.25,
            y: bird.y + bird.height * 0.25,
            w: bird.width * 0.5,
            h: bird.height * 0.5
        };

        const checkCollision = (r1, r2) => {
            return r1.x < r2.x + r2.w &&
                r1.x + r1.w > r2.x &&
                r1.y < r2.y + r2.h &&
                r1.y + r1.h > r2.y;
        };

        let collision = false;
        if (obstacle.type === 'plane') {
            // Plane has a cross shape: Fuselage and Wings
            const fuselage = {
                x: obstacle.x + obstacle.width * 0.1,
                y: obstacle.y + obstacle.height * 0.35,
                w: obstacle.width * 0.8,
                h: obstacle.height * 0.3
            };
            const wings = {
                x: obstacle.x + obstacle.width * 0.25,
                y: obstacle.y + obstacle.height * 0.02,
                w: obstacle.width * 0.5,
                h: obstacle.height * 0.98
            };
            collision = checkCollision(birdHB, fuselage) || checkCollision(birdHB, wings);
        } else {
            // Eagle shape: Main body and wing span (Expanded)
            // Bottom-left diagonal refined: Another 5% smaller (total 10% shift)
            const eagleHB = {
                x: obstacle.x + obstacle.width * 0.20,
                y: obstacle.y + obstacle.height * 0.25,
                w: obstacle.width * 0.78,
                h: obstacle.height * 0.83 // another 5% smaller than the previous 0.88
            };
            collision = checkCollision(birdHB, eagleHB);
        }

        if (collision) {
            gameOver(index);
            return; // Stop checking after a collision
        }

        if (obstacle.markedForDeletion) {
            obstacles.splice(index, 1);
        }
    });

    frames++;
    animationId = requestAnimationFrame(animate);
}

function gameOver(hitIndex) {
    // ---- INFINITE MODE SIGNAL ----
    const isInfinite = location.search.includes('multiplier');
    if (isInfinite && window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'onLifeLost' }, '*');
        return; 
    }
    // ------------------------------

    lives--;
    updateLivesUI();

    // Remove the obstacle that was hit
    if (hitIndex !== undefined && hitIndex >= 0 && hitIndex < obstacles.length) {
        obstacles.splice(hitIndex, 1);
    }

    if (lives > 0) {
        // Temporary "crash" state
        isContaminated = true;
        contaminationTimer = 180; // 3 seconds at 60fps

        // Reset only the player position, keep remaining obstacles
        bird = new Bird();
    } else {
        // Final death: draw the contaminated sky before stopping
        isGameOver = true;
        cancelAnimationFrame(animationId);

        // Manually render the final contaminated frame
        ctx.globalAlpha = 1.0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#E0F6FF');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(101, 67, 33, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        finalScoreElement.innerText = score;
        gameOverScreen.classList.remove('hidden');
    }
}

// Input handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!isGameOver) bird.jump();
    }
});

window.addEventListener('touchstart', (e) => {
    if (!isGameOver) bird.jump();
});

window.addEventListener('click', () => {
    if (!isGameOver) bird.jump();
});

// Button listeners
startBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent jump on click
    init();
});

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent jump on click
    init();
});
