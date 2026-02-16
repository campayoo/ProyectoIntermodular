const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const livesSpan = document.getElementById('lives');
const finalScoreSpan = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over');

canvas.width = 800;
canvas.height = 600;

let score = 0;
let lives = 100;
let gameActive = true;
let gameItems = [];
let particles = [];
let difficulty = 0.8; // Starting slightly easier than before

const player = {
    x: 400,
    y: 300,
    size: 50,
    emoji: '🚢'
};

const types = {
    trash: ['🧴', '🛍️', '🥫', '📦'],
    marine: ['🐟', '🐢', '🐙', '🦈', '🐠']
};

class Item {
    constructor() {
        this.isTrash = Math.random() > 0.4;
        this.emoji = this.isTrash
            ? types.trash[Math.floor(Math.random() * types.trash.length)]
            : types.marine[Math.floor(Math.random() * types.marine.length)];

        this.x = canvas.width + 50;
        this.y = Math.random() * (canvas.height - 100) + 50;
        this.size = this.isTrash ? 35 : 40; // Slightly larger hitboxes for trash to make it easier
        this.speed = (1.5 + Math.random() * 2.5) * (1 + difficulty * 0.5); // Slower initial speed
        this.waveOffset = Math.random() * Math.PI * 2;
    }

    update() {
        this.x -= this.speed;
        this.y += Math.sin(this.x * 0.05 + this.waveOffset) * 2;
    }

    draw() {
        ctx.font = `${this.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);
    }
}

// Mouse sensitivity fix: direct follow
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    player.x = e.clientX - rect.left;
    player.y = e.clientY - rect.top;

    // Boundaries
    if (player.x < 25) player.x = 25;
    if (player.x > canvas.width - 25) player.x = canvas.width - 25;
    if (player.y < 25) player.y = 25;
    if (player.y > canvas.height - 25) player.y = canvas.height - 25;
});

function spawnItems() {
    // Increased spawn rate slightly but kept speed low at start
    if (gameActive && Math.random() < 0.03 + (difficulty * 0.01)) {
        gameItems.push(new Item());
    }
}

function createBubbles() {
    const container = document.getElementById('game-container');
    if (Math.random() < 0.1) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.random() * 10 + 5;
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${Math.random() * 800}px`;
        bubble.style.animationDuration = `${Math.random() * 3 + 2}s`;
        container.appendChild(bubble);
        setTimeout(() => bubble.remove(), 5000);
    }
}

function update() {
    if (!gameActive) return;

    gameItems.forEach((item, index) => {
        item.update();

        // Collision
        const dx = item.x - player.x;
        const dy = item.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (player.size / 2 + item.size / 2)) {
            gameItems.splice(index, 1);
            if (item.isTrash) {
                score += 10;
                scoreSpan.innerText = score;
                // CLEAR DIFFICULTY SCALING
                difficulty = score / 300;
            } else {
                lives -= 10; // More forgiving (was 20)
                livesSpan.innerText = Math.max(0, lives);
                if (lives <= 0) gameOver();
            }
        }

        // Remove off-screen
        if (item.x < -50) {
            gameItems.splice(index, 1);
        }
    });

    spawnItems();
    createBubbles();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw player
    ctx.font = `${player.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.emoji, player.x, player.y);

    // Draw items
    gameItems.forEach(item => item.draw());
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    gameOverScreen.style.display = 'flex';
    finalScoreSpan.innerText = score;
}

function resetGame() {
    score = 0;
    lives = 100;
    difficulty = 0.8;
    gameItems = [];
    scoreSpan.innerText = score;
    livesSpan.innerText = lives;
    gameOverScreen.style.display = 'none';
    gameActive = true;
}

gameLoop();
