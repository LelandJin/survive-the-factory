// The factory floor: realtime 2.5D (isometric, depth-sorted) survival combat.
class Play extends Phaser.Scene {
    constructor() {
        super('playScene');
    }

    create() {
        // run state
        this.gameOver = false;
        this.wave = 0;
        this.kills = 0;
        this.aliveCount = 0;
        this.pendingSpawns = 0;
        this.haveAxe = false;
        this.startTime = this.time.now;
        this.elapsed = 0;
        this.uiMove = new Phaser.Math.Vector2(0, 0);
        this.attackHeld = false;

        const b = isoBounds();
        this.physics.world.setBounds(b.x, b.y, b.width, b.height);

        this.buildMap();

        // player at the center of the diamond
        const c = isoToWorld(STF.GRID / 2, STF.GRID / 2);
        this.player = new Player(this, c.x, c.y);
        this.player.setCollideWorldBounds(true);

        // groups
        this.zombies = this.physics.add.group({ runChildUpdate: true });
        this.bullets = this.physics.add.group();
        this.loot = this.physics.add.group();

        // colliders
        this.physics.add.collider(this.player, this.walls);
        this.physics.add.collider(this.zombies, this.walls);
        this.physics.add.collider(this.zombies, this.zombies);
        this.physics.add.collider(this.player, this.zombies);
        this.physics.add.collider(this.bullets, this.walls, (bullet) => this.popBullet(bullet));
        this.physics.add.overlap(this.bullets, this.zombies, (bullet, z) => {
            if (z.dead || !bullet.active) return;
            const fromX = bullet.x - bullet.body.velocity.x;
            const fromY = bullet.y - bullet.body.velocity.y;
            this.popBullet(bullet);
            z.takeDamage(bullet.dmg, fromX, fromY, false);
        });
        this.physics.add.overlap(this.player, this.loot, (p, drop) => this.pickupLoot(drop));

        // particles
        const particles = this.add.particles('world');
        particles.setDepth(60000);
        this.burstEmitter = particles.createEmitter({
            frame: 'spark',
            on: false,
            speed: { min: 60, max: 240 },
            lifespan: 420,
            scale: { start: 1.2, end: 0 },
            gravityY: 200
        });

        // camera
        const cam = this.cameras.main;
        cam.setBounds(b.x - 80, b.y - 120, b.width + 160, b.height + 240);
        cam.startFollow(this.player, false, 0.12, 0.12);
        this.applyZoom();
        this.onResize = () => this.applyZoom();
        this.scale.on('resize', this.onResize);
        this.events.once('shutdown', () => this.scale.off('resize', this.onResize));

        // keyboard (desktop fallback)
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,E,SPACE,SHIFT');

        // HUD runs as an overlay scene
        if (!this.scene.isActive('uiScene')) this.scene.launch('uiScene');

        // first wave after a breather
        this.nextWaveAt = this.time.now + 3500;
        this.waveTimer = this.time.delayedCall(3500, () => this.startWave());
    }

    applyZoom() {
        const w = this.scale.width, h = this.scale.height;
        this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(w, h) / 720 + 0.35, 0.8, 1.2));
    }

    // ---------------------------------------------------------- map ----

    buildMap() {
        const G = STF.GRID;
        // 0 floor, 1 border wall, 2 crate, 3 machine, 4 spawn pad
        const grid = [];
        for (let i = 0; i < G; i++) {
            grid[i] = [];
            for (let j = 0; j < G; j++) {
                grid[i][j] = (i === 0 || j === 0 || i === G - 1 || j === G - 1) ? 1 : 0;
            }
        }

        const mid = G / 2;
        const clear = (i, j, r) => Math.abs(i - mid) <= r && Math.abs(j - mid) <= r;

        // zombie spawn pads
        this.spawnPads = [];
        const pads = [[3, 3], [G - 4, 3], [3, G - 4], [G - 4, G - 4], [mid, 2], [2, mid]];
        for (const [pi, pj] of pads) {
            grid[pi][pj] = 4;
            this.spawnPads.push(isoToWorld(pi, pj));
        }

        // machine clusters (assembly lines)
        const rng = new Phaser.Math.RandomDataGenerator([String(Date.now())]);
        for (let n = 0; n < 6; n++) {
            const ci = rng.between(5, G - 8);
            const cj = rng.between(5, G - 8);
            if (clear(ci, cj, 5)) continue;
            const horiz = rng.frac() < 0.5;
            const len = rng.between(2, 4);
            for (let k = 0; k < len; k++) {
                const i = ci + (horiz ? k : 0), j = cj + (horiz ? 0 : k);
                if (grid[i][j] === 0 && !clear(i, j, 4)) grid[i][j] = 3;
            }
        }
        // scattered crates
        for (let n = 0; n < 26; n++) {
            const i = rng.between(2, G - 3), j = rng.between(2, G - 3);
            if (grid[i][j] === 0 && !clear(i, j, 3)) grid[i][j] = 2;
        }

        // render + physics
        this.walls = this.physics.add.staticGroup();
        const addBlocker = (x, y, w, h) => {
            const r = this.add.rectangle(x, y, w, h, 0, 0);
            this.walls.add(r);
        };

        for (let i = 0; i < G; i++) {
            for (let j = 0; j < G; j++) {
                const t = grid[i][j];
                const p = isoToWorld(i, j);
                const baseY = p.y + STF.TILE_H / 2;

                if (t !== 1) {
                    const fr = t === 4 ? 'hazard'
                        : (rng.frac() < 0.1 ? 'floorGrate' : 'floor' + rng.between(0, 3));
                    this.add.image(p.x, p.y, 'world', fr).setDepth(STF.DEPTH.FLOOR);
                }
                if (t === 1) {
                    this.add.image(p.x, baseY, 'world', 'wall').setOrigin(0.5, 1).setDepth(baseY);
                    addBlocker(p.x, p.y, 104, 54);
                } else if (t === 2) {
                    this.add.image(p.x, baseY - 8, 'world', 'crate').setOrigin(0.5, 1).setDepth(baseY - 8);
                    addBlocker(p.x, p.y, 74, 40);
                } else if (t === 3) {
                    this.add.image(p.x, baseY, 'world', 'machine').setOrigin(0.5, 1).setDepth(baseY);
                    addBlocker(p.x, p.y, 104, 54);
                }
            }
        }

        // chests with supplies
        this.chests = [];
        let placed = 0, guard = 0;
        while (placed < 5 && guard++ < 200) {
            const i = rng.between(4, G - 5), j = rng.between(4, G - 5);
            if (grid[i][j] !== 0 || clear(i, j, 3)) continue;
            grid[i][j] = 9;
            const p = isoToWorld(i, j);
            this.chests.push(new Chest(this, p.x, p.y, placed % 2 === 1));
            placed++;
        }
        this.grid = grid;
    }

    // ------------------------------------------------------- combat ----

    getAimAngle(player) {
        let best = null, bestD = 420;
        this.zombies.children.iterate(z => {
            if (!z || z.dead) return;
            const d = Phaser.Math.Distance.Between(player.x, player.y, z.x, z.y);
            if (d < bestD) { bestD = d; best = z; }
        });
        if (best) return Math.atan2(best.y - player.y, best.x - player.x);
        return Math.atan2(player.facing.y, player.facing.x);
    }

    playerMelee(angle) {
        const p = this.player;
        this.sound.play('sfxSwish', { volume: 0.4 });
        const sx = p.x + Math.cos(angle) * 48;
        const sy = p.y - 30 + Math.sin(angle) * 30;
        const slash = this.add.image(sx, sy, 'world', 'slash')
            .setRotation(angle).setDepth(p.y + 1).setAlpha(0.9).setScale(0.7).setTint(0xfff2c0);
        this.tweens.add({
            targets: slash, alpha: 0, scale: 1.2, duration: 160,
            onComplete: () => slash.destroy()
        });

        const range = 115, arc = 1.4;
        this.zombies.children.iterate(z => {
            if (!z || z.dead) return;
            const d = Phaser.Math.Distance.Between(p.x, p.y, z.x, z.y);
            if (d > range + (z.isBoss ? 30 : 0)) return;
            const a = Math.atan2(z.y - p.y, z.x - p.x);
            if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > arc) return;
            const crit = Math.random() < 0.15;
            const dmg = Math.round(p.atk * (0.85 + Math.random() * 0.3) * (crit ? 2 : 1) * (this.haveAxe ? 1.35 : 1));
            z.takeDamage(dmg, p.x, p.y, crit);
            this.burstFx(z.x, z.y - 40, 0xcc2222, 6);
        });
    }

    playerGun(angle) {
        const p = this.player;
        this.sound.play('sfxShot', { volume: 0.4 });
        for (let k = -2; k <= 2; k++) {
            const a = angle + k * 0.12;
            const bullet = this.bullets.create(p.x + Math.cos(a) * 24, p.y - 12 + Math.sin(a) * 16, 'world', 'bullet');
            bullet.setDepth(p.y + 2);
            bullet.body.setCircle(10, 2, 2);
            bullet.dmg = 22 + p.level * 4;
            bullet.setVelocity(Math.cos(a) * 640, Math.sin(a) * 640 * 0.62);
            this.time.delayedCall(750, () => { if (bullet.active) this.popBullet(bullet); });
        }
    }

    popBullet(bullet) {
        if (!bullet.active) return;
        this.burstFx(bullet.x, bullet.y, 0xffb428, 4);
        bullet.destroy();
    }

    burstFx(x, y, tint, count) {
        this.burstEmitter.setTint(tint);
        this.burstEmitter.explode(count, x, y);
    }

    spawnDamageText(x, y, txt, color, size) {
        const t = this.add.text(x + Phaser.Math.Between(-12, 12), y, txt, {
            fontFamily: 'Courier', fontSize: size + 'px', color: color,
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(70000);
        this.tweens.add({
            targets: t, y: y - 46, alpha: 0, duration: 700, ease: 'Quad.easeOut',
            onComplete: () => t.destroy()
        });
    }

    // -------------------------------------------------------- waves ----

    startWave() {
        if (this.gameOver) return;
        this.wave += 1;
        const isBossWave = this.wave % 5 === 0;
        const count = Math.min(3 + this.wave * 2, 24);
        this.pendingSpawns = count + (isBossWave ? 1 : 0);

        this.spawnEvent = this.time.addEvent({
            delay: 400,
            repeat: this.pendingSpawns - 1,
            callback: () => {
                this.pendingSpawns -= 1;
                const boss = isBossWave && this.pendingSpawns === 0;
                this.spawnZombie(boss);
            }
        });
    }

    spawnZombie(isBoss) {
        const pad = Phaser.Utils.Array.GetRandom(this.spawnPads);
        const x = pad.x + Phaser.Math.Between(-50, 50);
        const y = pad.y + Phaser.Math.Between(-25, 25);
        this.burstFx(x, y - 20, 0x59d95e, 8);
        const z = new Zombie(this, x, y, this.wave, isBoss);
        this.zombies.add(z);
        // group add resets the custom circular body, so restore it
        if (isBoss) z.body.setCircle(34, 179 / 2 - 34, 152 * 0.92 - 40);
        else z.body.setCircle(15, 45 / 2 - 15, 78 * 0.92 - 16);
        this.aliveCount += 1;
    }

    onZombieDead(z) {
        this.kills += 1;
        this.aliveCount -= 1;
        this.player.gainXp(z.xpValue);
        this.burstFx(z.x, z.y - 30, 0xcc2222, z.isBoss ? 24 : 8);

        if (z.isBoss) {
            this.sound.play('sfxBossDie', { volume: 0.5 });
            this.cameras.main.shake(300, 0.01);
            this.spawnLoot(z.x - 30, z.y, { frame: 'food', heal: 55 });
            this.spawnLoot(z.x + 30, z.y, { frame: 'food', heal: 55 });
            if (!this.haveAxe) this.spawnLoot(z.x, z.y + 24, { frame: 'futou', special: 'axe' });
        } else {
            this.sound.play('sfxKill', { volume: 0.18 });
            const roll = Math.random();
            if (roll < 0.22) this.spawnLoot(z.x, z.y, rollLoot());
            else if (roll < 0.42) this.spawnLoot(z.x, z.y, { frame: 'xporb', xp: 6 + this.wave * 2 });
        }

        if (this.aliveCount <= 0 && this.pendingSpawns <= 0 && !this.gameOver) {
            this.nextWaveAt = this.time.now + 5000;
            this.waveTimer = this.time.delayedCall(5000, () => this.startWave());
        }
    }

    spawnLoot(x, y, kind) {
        const drop = new Loot(this, x, y, kind);
        this.loot.add(drop);
        drop.body.setCircle(16, drop.width / 2 - 16, drop.height * 0.9 - 16);
        drop.special = kind.special;
        return drop;
    }

    pickupLoot(drop) {
        if (!drop.active || !this.player.alive) return;
        if (drop.special === 'axe') {
            this.haveAxe = true;
            this.sound.play('sfxLevel', { volume: 0.6 });
            this.spawnDamageText(this.player.x, this.player.y - 100, 'THE AXE! DMG +35%', '#ffe14d', 20);
        } else if (drop.xpAmount > 0) {
            this.player.gainXp(drop.xpAmount);
            this.sound.play('sfxBlip', { volume: 0.35 });
            this.spawnDamageText(drop.x, drop.y - 40, '+' + drop.xpAmount + ' XP', '#59d95e', 14);
        } else {
            this.player.heal(drop.heal);
            this.sound.play('sfxEat', { volume: 0.5 });
            this.spawnDamageText(drop.x, drop.y - 40, '+' + drop.heal, '#7cf58a', 16);
        }
        drop.destroy();
    }

    onPlayerDead() {
        this.gameOver = true;
        if (this.spawnEvent) this.spawnEvent.remove();
        if (this.waveTimer) this.waveTimer.remove();
        // record the best run
        try {
            const best = JSON.parse(localStorage.getItem('stf-best') || '{}');
            if (!best.kills || this.kills > best.kills) {
                localStorage.setItem('stf-best', JSON.stringify({
                    kills: this.kills, wave: this.wave, time: Math.floor(this.elapsed)
                }));
            }
        } catch (e) { /* storage unavailable — fine */ }
    }

    // ------------------------------------------------------- update ----

    update(time, delta) {
        const p = this.player;

        if (!this.gameOver) this.elapsed = (time - this.startTime) / 1000;

        // merge joystick + keyboard movement
        let mx = this.uiMove.x, my = this.uiMove.y;
        if (this.keys.A.isDown || this.cursors.left.isDown) mx -= 1;
        if (this.keys.D.isDown || this.cursors.right.isDown) mx += 1;
        if (this.keys.W.isDown || this.cursors.up.isDown) my -= 1;
        if (this.keys.S.isDown || this.cursors.down.isDown) my += 1;
        p.moveVec.set(Phaser.Math.Clamp(mx, -1, 1), Phaser.Math.Clamp(my, -1, 1));

        if (this.attackHeld || this.keys.SPACE.isDown) p.tryAttack();
        if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) p.tryDash();
        if (Phaser.Input.Keyboard.JustDown(this.keys.E)) p.tryGun();

        p.update(time, delta);

        // auto-open chests on approach
        for (const chest of this.chests) {
            if (!chest.opened &&
                Phaser.Math.Distance.Between(p.x, p.y, chest.x, chest.y) < 75) {
                chest.open();
            }
        }
    }
}
