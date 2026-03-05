const COLORS = {
    ods16: 0x4F82DE,   // ODS 16 Blue
    bg: 0x020617,      // Cyber Background
    shield: 0x60A5FA,  // Shield tint
    threat: 0xEF4444,  // Red for injustice/corruption
    core: 0xFFFFFF,    // White for peace/justice
    gold: 0xF59E0B     // UI elements
};

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    backgroundColor: 'transparent',
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// Game State
let state = {
    active: false,
    timeLeft: 15,
    lives: 3,
    score: 0,
    gameEnded: false,
    nextSpawn: 0,
    shieldAngle: 0,
    shieldWidthRad: Math.PI / 2 // 90 degrees
};

// Center Coordinates
const CX = 400;
const CY = 300;
const SHIELD_RADIUS = 90;
const CORE_RADIUS = 30;

let ui = {};
let coreGraphics;
let shieldGraphics;
let enemiesGroup = [];

function preload() {
    const g = this.make.graphics();

    // Thematic Glowing Core (Justice)
    g.fillStyle(COLORS.core, 1);
    g.fillCircle(30, 30, 15);
    g.fillStyle(COLORS.ods16, 0.6);
    g.fillCircle(30, 30, 22);
    g.fillStyle(COLORS.ods16, 0.3);
    g.fillCircle(30, 30, 30);
    g.generateTexture('core', 60, 60);
    g.clear();

    // Menacing Threat (Corruption Shard)
    g.lineStyle(2, 0xFF7A7A, 1);
    g.fillStyle(COLORS.threat, 1);
    g.beginPath();
    g.moveTo(15, 0); g.lineTo(30, 15); g.lineTo(20, 30); g.lineTo(0, 20);
    g.closePath(); g.fillPath(); g.strokePath();
    // Inner dark core of the threat
    g.fillStyle(0x450A0A, 1);
    g.fillCircle(15, 15, 5);
    g.generateTexture('threat', 30, 30);
    g.clear();

    // Heart (Life point - Shields instead of hearts for ODS 16 context)
    g.lineStyle(2, COLORS.core, 1);
    g.fillStyle(COLORS.ods16, 1);
    g.beginPath();
    g.moveTo(15, 0); g.lineTo(30, 10); g.lineTo(30, 20); g.lineTo(15, 30); g.lineTo(0, 20); g.lineTo(0, 10);
    g.closePath(); g.fillPath(); g.strokePath();
    g.generateTexture('heart', 30, 30);
    g.clear();
}

function create() {
    // Dynamic Background Rings
    ui.bgRings = this.add.graphics();
    this.tweens.addCounter({
        from: 0, to: 100, duration: 4000, repeat: -1, yoyo: true,
        onUpdate: (tween) => {
            ui.bgRings.clear();
            const val = tween.getValue();
            ui.bgRings.lineStyle(2, COLORS.ods16, 0.05 + (val / 1000));
            ui.bgRings.strokeCircle(CX, CY, SHIELD_RADIUS + (val / 5));
            ui.bgRings.strokeCircle(CX, CY, SHIELD_RADIUS + 100 + (val / 4));
            ui.bgRings.strokeCircle(CX, CY, SHIELD_RADIUS + 200 + (val / 3));
        }
    });

    // Core pulsing effect
    ui.core = this.add.image(CX, CY, 'core');
    this.tweens.add({
        targets: ui.core, scale: 1.3, alpha: 0.8,
        yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.easeInOut'
    });

    shieldGraphics = this.add.graphics();
    updateShield();

    enemiesGroup = [];

    // --- UI Top Bar ---
    this.add.rectangle(400, 30, 800, 60, 0x0f172a, 0.85).setStrokeStyle(1, COLORS.ods16, 0.5);
    ui.title = this.add.text(20, 15, 'ESCUDO DE LA JUSTICIA', { fontSize: '24px', fontFamily: 'Outfit, sans-serif', fill: '#60A5FA', fontStyle: 'bold', letterSpacing: 2 });
    ui.timerText = this.add.text(400, 30, '15.0', { fontSize: '38px', fontFamily: 'Courier New, monospace', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

    ui.livesGroup = this.add.group();
    drawLives.call(this);

    // Initial Start Screen
    startScreen.call(this);
}

function update(time, delta) {
    if (!state.active || state.gameEnded) return;

    // Timer logic
    state.timeLeft -= delta / 1000;
    if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        endGame.call(this, true, "");
    }

    ui.timerText.setText(state.timeLeft.toFixed(1));
    if (state.timeLeft < 5) {
        ui.timerText.setFill('#F59E0B'); // Turn gold warning
        ui.timerText.setScale(1 + Math.sin(time / 50) * 0.1);
    }

    // Input -> Shield Angle
    const pointer = this.input.activePointer;
    state.shieldAngle = Math.atan2(pointer.y - CY, pointer.x - CX);
    updateShield();

    // Spawn Enemies
    if (time > state.nextSpawn) {
        spawnEnemy.call(this);
        let baseDelay = state.timeLeft <= 5 ? 300 : (state.timeLeft <= 10 ? 600 : 900);
        state.nextSpawn = time + baseDelay + Math.random() * 200;
    }

    // Move & Collide Enemies
    for (let i = 0; i < enemiesGroup.length; i++) {
        let e = enemiesGroup[i];

        // Move towards center
        e.sprite.x += Math.cos(e.angle) * e.speed * (delta / 1000);
        e.sprite.y += Math.sin(e.angle) * e.speed * (delta / 1000);

        let distParams = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, CX, CY);

        if (!e.passedShield && distParams <= SHIELD_RADIUS + 10) {
            // Check Shield Block
            // Enemy angle from center is inverted to its travel direction
            let enemyAngleFromCenter = Math.atan2(e.sprite.y - CY, e.sprite.x - CX);
            let diff = Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(enemyAngleFromCenter), Phaser.Math.RadToDeg(state.shieldAngle));

            if (Math.abs(diff) < (Phaser.Math.RadToDeg(state.shieldWidthRad) / 2)) {
                // BLOCKED!
                createSparks.call(this, e.sprite.x, e.sprite.y, COLORS.shield);
                e.sprite.destroy();
                enemiesGroup.splice(i, 1);
                i--;
                state.score += 10;
                continue;
            } else {
                e.passedShield = true; // Breached!
            }
        }

        if (distParams <= CORE_RADIUS) {
            // HIT CORE!
            createSparks.call(this, e.sprite.x, e.sprite.y, COLORS.threat);
            e.sprite.destroy();
            enemiesGroup.splice(i, 1);
            i--;

            takeDamage.call(this);
        }
    }
}

function updateShield() {
    shieldGraphics.clear();
    // Aura behind shield
    shieldGraphics.lineStyle(10, COLORS.ods16, 0.2);
    shieldGraphics.beginPath();
    shieldGraphics.arc(CX, CY, SHIELD_RADIUS, state.shieldAngle - state.shieldWidthRad / 2, state.shieldAngle + state.shieldWidthRad / 2);
    shieldGraphics.strokePath();

    // Hard energy shield
    shieldGraphics.lineStyle(4, COLORS.core, 1);
    shieldGraphics.beginPath();
    shieldGraphics.arc(CX, CY, SHIELD_RADIUS, state.shieldAngle - state.shieldWidthRad / 2, state.shieldAngle + state.shieldWidthRad / 2);
    shieldGraphics.strokePath();
}

function spawnEnemy() {
    // Spawn in a circle outside the screen
    let spawnAngle = Math.random() * Math.PI * 2;
    let dist = 600; // Far outside
    let startX = CX + Math.cos(spawnAngle) * dist;
    let startY = CY + Math.sin(spawnAngle) * dist;

    // Movement angle is opposite of spawn from center
    let moveAngle = Math.atan2(CY - startY, CX - startX);

    let sprite = this.add.image(startX, startY, 'threat');
    // Random spin
    this.tweens.add({ targets: sprite, rotation: Math.PI * 2, repeat: -1, duration: 600 });

    enemiesGroup.push({
        sprite: sprite,
        angle: moveAngle,
        speed: Phaser.Math.Between(250, 400),
        passedShield: false
    });
}

function createSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
        let p = this.add.circle(x, y, 3, color);
        this.tweens.add({
            targets: p,
            x: x + (Math.random() - 0.5) * 100,
            y: y + (Math.random() - 0.5) * 100,
            alpha: 0,
            duration: 300 + Math.random() * 200,
            onComplete: () => p.destroy()
        });
    }
}

function takeDamage() {
    state.lives--;
    drawLives.call(this);

    // Impact feedback
    this.cameras.main.shake(150, 0.02);

    let flash = this.add.rectangle(400, 300, 800, 600, COLORS.threat, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

    if (state.lives <= 0) {
        endGame.call(this, false, "Las defensas cayeron. La injusticia prevalece.");
    }
}

function drawLives() {
    ui.livesGroup.clear(true, true);
    for (let i = 0; i < state.lives; i++) {
        let heart = this.add.image(770 - (i * 30), 25, 'heart');
        ui.livesGroup.add(heart);
    }
}

function startScreen() {
    ui.msgGroup = this.add.group();
    const overlayBg = this.add.rectangle(400, 300, 800, 600, 0x020617, 0.95).setDepth(200);

    const titleT = this.add.text(400, 150, 'ESCUDO DE LA JUSTICIA', { fontSize: '42px', fontFamily: 'sans-serif', fill: '#4F82DE', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201);

    // Shield instruction visual
    const exCore = this.add.circle(400, 270, 15, COLORS.core).setDepth(201);
    const exShield = this.add.graphics().setDepth(201);
    exShield.lineStyle(4, COLORS.ods16, 1);
    exShield.beginPath(); exShield.arc(400, 270, 60, -Math.PI / 4, Math.PI / 4); exShield.strokePath();
    const exThreat = this.add.image(480, 270, 'threat').setDepth(201);

    const instruction = this.add.text(400, 380, '1. Mueve el ratón para rotar el Escudo Orbital.\n2. Intercepta los proyectiles rojos (Corrupción).\n3. Protege el núcleo durante 15 SEGUNDOS.', { fontSize: '20px', align: 'center', fontFamily: 'sans-serif', fill: '#cbd5e1', lineSpacing: 10 }).setOrigin(0.5).setDepth(201);

    const btnStart = this.add.text(400, 480, '¡DEFENDER!', { fontSize: '28px', fontFamily: 'sans-serif', fontStyle: 'bold', backgroundColor: '#4F82DE', padding: { x: 40, y: 15 } }).setOrigin(0.5).setInteractive().setDepth(201);

    ui.msgGroup.addMultiple([overlayBg, titleT, exCore, exThreat, instruction, btnStart]);

    btnStart.on('pointerdown', () => {
        exShield.destroy();
        ui.msgGroup.clear(true, true);
        startNewGame.call(this);
    });
}

function startNewGame() {
    state.active = true;
    state.gameEnded = false;
    state.timeLeft = 15;
    state.lives = 3;
    state.score = 0;
    state.nextSpawn = this.time.now + 1000;

    drawLives.call(this);

    enemiesGroup.forEach(e => e.sprite.destroy());
    enemiesGroup = [];
}

function endGame(victory, reason) {
    state.gameEnded = true;
    state.active = false;

    ui.msgGroup = this.add.group();
    const overlayBg = this.add.rectangle(400, 300, 800, 600, 0x020617, 0.95).setDepth(200);

    const titleText = victory ? '¡PAZ PRESERVADA!' : 'DEFENSAS CAÍDAS';
    const titleColor = victory ? '#60A5FA' : '#EF4444';
    const title = this.add.text(400, 220, titleText, { fontSize: '42px', fontFamily: 'sans-serif', fill: titleColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(201);

    const subText = victory ? 'Has defendido las instituciones de las amenazas.' : reason;
    const sub = this.add.text(400, 280, subText, { fontSize: '18px', align: 'center', fontFamily: 'sans-serif', fill: '#ffffff' }).setOrigin(0.5).setDepth(201);

    const btn = this.add.text(400, 420, 'REINTENTAR', { fontSize: '24px', fontFamily: 'sans-serif', fontStyle: 'bold', backgroundColor: '#4F82DE', padding: { x: 30, y: 15 }, color: '#ffffff' }).setOrigin(0.5).setDepth(201).setInteractive();

    ui.msgGroup.addMultiple([overlayBg, title, sub, btn]);
    btn.on('pointerdown', () => this.scene.restart());
}
