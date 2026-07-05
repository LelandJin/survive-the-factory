// The original SCUM factory map, made realtime 2.5D: painted ground plane,
// extruded walls on the 2021 building footprints, depth-sorted entities,
// waves of zombies, loot, rivers and metabolism.

// The 5120px map art tiles twice horizontally — all 2021 coordinates preserved.
const WORLD = { LEFT: 15, TOP: 1378, RIGHT: 9980, BOTTOM: 5085 };

// wall segments relative to a building's top-left corner: [x, y, w, h]
const SMALL_BUILDING_SEGS = [
    [0, 0, 569, 12], [0, 805, 569, 12],                                   // top / bottom
    [0, 12, 12, 95], [0, 207, 12, 163], [0, 400, 12, 157], [0, 656, 12, 149], // left, door gaps
    [557, 12, 12, 95], [557, 656, 12, 149],                               // right, wide entrance
    [214, 215, 12, 160], [214, 435, 12, 128],                             // interior vertical
    [56, 223, 170, 12], [56, 400, 170, 12]                                // interior rooms
];
const BIG_BUILDING_SEGS = [
    [0, 0, 2127, 14],
    [0, 1652, 830, 14], [1350, 1652, 777, 14],                            // bottom, main entrance gap
    [0, 14, 14, 1638], [2113, 14, 14, 1638],                              // left / right
    [70, 100, 1971, 14],                                                  // top corridor
    [75, 1190, 746, 12], [1361, 1190, 689, 12],                           // interior with center gap
    [847, 1202, 12, 450]
];
const SMALL_BUILDINGS = [[100, 1580], [5224, 1585]];
const BIG_BUILDINGS = [[2845, 2997], [7960, 2997]];

// the 2021 river rectangles (walk-through, slows you, drinkable)
const RIVERS = [
    { x: 1300, y: 1345, w: 300, h: 2400 },
    { x: 32, y: 3355, w: 1380, h: 390 },
    { x: 6437, y: 1345, w: 263, h: 2400 },
    { x: 5072, y: 3415, w: 1410, h: 345 }
];

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
        this.contextAction = null;     // {type:'loot'|'drink', target}
        this.drinkCd = 0;

        this.physics.world.setBounds(WORLD.LEFT, WORLD.TOP,
            WORLD.RIGHT - WORLD.LEFT, WORLD.BOTTOM - WORLD.TOP);

        this.buildWorld();

        this.player = new Player(this, 4990, 2750);
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

        // camera: bound a little above the play area so the painted
        // mountains/sunset show as a backdrop near the top edge
        const cam = this.cameras.main;
        cam.setBounds(0, 400, WORLD.RIGHT, WORLD.BOTTOM - 400 + 90);
        cam.startFollow(this.player, false, 0.12, 0.12);
        this.applyZoom();
        this.onResize = () => this.applyZoom();
        this.scale.on('resize', this.onResize);
        this.events.once('shutdown', () => this.scale.off('resize', this.onResize));

        // keyboard (desktop fallback)
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,SPACE,SHIFT');

        if (!this.scene.isActive('uiScene')) this.scene.launch('uiScene');

        this.nextWaveAt = this.time.now + 3500;
        this.waveTimer = this.time.delayedCall(3500, () => this.startWave());
    }

    applyZoom() {
        const w = this.scale.width, h = this.scale.height;
        this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(w, h) / 720 + 0.35, 0.8, 1.2));
    }

    // ---------------------------------------------------------- world ----

    buildWorld() {
        // painted 2021 map as the ground plane (texture repeats 2x across)
        this.add.tileSprite(0, 0, WORLD.RIGHT, 5120, 'mainmap')
            .setOrigin(0, 0).setTileScale(2).setDepth(STF.DEPTH.FLOOR);

        this.walls = this.physics.add.staticGroup();

        const extrude = (bx, by, segs, tint, scale) => {
            for (const [sx, sy, sw, sh] of segs) {
                const x = bx + sx, y = by + sy;
                // one physics body per segment
                this.walls.add(this.add.rectangle(x + sw / 2, y + sh / 2, sw + 14, sh + 14, 0, 0));
                // extruded cubes along the segment give the 2.5D height
                const step = Math.round(120 * scale);
                if (sw >= sh) {
                    const baseY = y + sh + 22;
                    for (let cx = x + 34; cx < x + sw + 20; cx += step) {
                        this.add.image(cx, baseY, 'world', 'wallLight')
                            .setOrigin(0.5, 1).setScale(scale).setTint(tint).setDepth(baseY);
                    }
                } else {
                    for (let cy = y + 26; cy < y + sh + 20; cy += Math.round(46 * scale / 0.6)) {
                        const baseY = cy + 22;
                        this.add.image(x + sw / 2, baseY, 'world', 'wallLight')
                            .setOrigin(0.5, 1).setScale(scale).setTint(tint).setDepth(baseY);
                    }
                }
            }
        };

        for (const [bx, by] of SMALL_BUILDINGS) extrude(bx, by, SMALL_BUILDING_SEGS, 0xffffff, 0.62);
        for (const [bx, by] of BIG_BUILDINGS) extrude(bx, by, BIG_BUILDING_SEGS, 0x8a939e, 0.6);

        // machine row inside each big building (the 2021 blocked strip)
        for (const [bx, by] of BIG_BUILDINGS) {
            for (let k = 0; k < 3; k++) {
                const mx = bx + 1378, my = by + 1300 + k * 145;
                this.add.image(mx, my, 'world', 'machine')
                    .setOrigin(0.5, 1).setScale(0.85).setDepth(my);
            }
            this.walls.add(this.add.rectangle(bx + 1378, by + 1230 + 205, 110, 420, 0, 0));
        }

        // chests at the original 2021 locations, fridges included
        const chestSpots = [
            [8657, 3134, false], [9945, 5061, false], [3831, 3766, true],
            [431, 2193, true], [4003, 1463, false]
        ];
        this.chests = chestSpots.map(([x, y, fridge]) => new Chest(this, x, y, fridge));

        // the axe easter egg, where it always was
        this.axeDrop = null;
        this.time.delayedCall(50, () => {
            this.axeDrop = this.spawnLoot(9711, 3486, { frame: 'futou', special: 'axe' });
            this.axeDrop.noDespawn = true;
        });

        // zombie spawn pads scattered over the grass
        this.spawnPads = [
            { x: 900, y: 4300 }, { x: 2400, y: 2000 }, { x: 4400, y: 2400 },
            { x: 5700, y: 4400 }, { x: 7300, y: 2100 }, { x: 9300, y: 3800 },
            { x: 1900, y: 4600 }, { x: 8600, y: 4600 }
        ];
        for (const p of this.spawnPads) {
            this.add.image(p.x, p.y, 'world', 'hazard').setDepth(STF.DEPTH.FLOOR + 1).setAlpha(0.9);
        }
    }

    inRiver(x, y) {
        for (const r of RIVERS) {
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
        }
        return false;
    }

    // ------------------------------------------------- context action ----

    updateContextAction() {
        const p = this.player;
        this.contextAction = null;
        if (!p.alive || p.busy) return;
        for (const chest of this.chests) {
            if (!chest.opened &&
                Phaser.Math.Distance.Between(p.x, p.y, chest.x, chest.y) < 95) {
                this.contextAction = { type: 'loot', target: chest };
                return;
            }
        }
        if (this.inRiver(p.x, p.y) && this.drinkCd <= 0) {
            this.contextAction = { type: 'drink' };
        }
    }

    doContextAction() {
        const act = this.contextAction;
        if (!act || this.gameOver) return;
        if (act.type === 'loot') {
            act.target.open();
        } else if (act.type === 'drink') {
            this.drinkCd = 900;
            this.player.drink();
        }
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
        // spawn from a pad near (but not on top of) the player, so the
        // action stays close on the huge map
        const p = this.player;
        const sorted = this.spawnPads
            .map(pad => ({ pad, d: Phaser.Math.Distance.Between(p.x, p.y, pad.x, pad.y) }))
            .filter(e => e.d > 500)
            .sort((a, b) => a.d - b.d);
        const pick = Phaser.Utils.Array.GetRandom(sorted.slice(0, 3)).pad;

        const x = pick.x + Phaser.Math.Between(-60, 60);
        const y = pick.y + Phaser.Math.Between(-30, 30);
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
            this.player.eat(drop.heal);
            this.sound.play('sfxEat', { volume: 0.5 });
            this.spawnDamageText(drop.x, drop.y - 40, '+' + drop.heal, '#7cf58a', 16);
        }
        drop.destroy();
    }

    onPlayerDead() {
        this.gameOver = true;
        if (this.spawnEvent) this.spawnEvent.remove();
        if (this.waveTimer) this.waveTimer.remove();
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
        this.drinkCd = Math.max(0, this.drinkCd - delta);

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
        if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.doContextAction();

        p.update(time, delta);
        this.updateContextAction();
    }
}
