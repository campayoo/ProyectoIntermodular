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

        // Floor collision
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
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

function init(resetLevel = true) {
    if (resetLevel) {
        level = 1;
        score = 0;
    }
    levelTimeLeft = 15;
    bird = new Bird();
    obstacles = [];
    frames = 0;
    gameSpeed = 6 + (level * 1.5); // Increase base speed per level
    obstacleFrequency = Math.max(15, 60 - (level * 5)); // Increase frequency per level (min 15 frames)
    isGameOver = false;
    isLevelTransition = false;

    scoreElement.innerText = score;
    levelElement.innerText = level;
    timerElement.innerText = levelTimeLeft;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    levelScreen.classList.add('hidden');

    lastTimeUpdate = performance.now();
    animate(lastTimeUpdate);
}

function startLevelTransition() {
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

        // Chance to spawn second increases slightly per level
        const chanceForSecond = Math.min(0.8, 0.3 + (level * 0.05));

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

        // Collision Detection (Simple AABB with slight padding for emoji transparency)
        const padding = 10;
        if (
            bird.x < obstacle.x + obstacle.width - padding &&
            bird.x + bird.width - padding > obstacle.x &&
            bird.y < obstacle.y + obstacle.height - padding &&
            bird.y + bird.height - padding > obstacle.y
        ) {
            gameOver();
        }

        if (obstacle.markedForDeletion) {
            obstacles.splice(index, 1);
        }
    });

    frames++;
    animationId = requestAnimationFrame(animate);
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    finalScoreElement.innerText = score;
    gameOverScreen.classList.remove('hidden');
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
