// HUD overlay scene: virtual joystick, action buttons, health orb, XP bar,
// wave banners and the death screen. Runs on top of the Play scene.
class UI extends Phaser.Scene {
    constructor() {
        super('uiScene');
    }

    create() {
        this.play = this.scene.get('playScene');
        this.lastWave = 0;
        this.deadShown = false;
        this.deadPanel = null;
        this.joyPointerId = null;

        // --- joystick (floating, left half of the screen) ---
        this.joyBase = this.add.image(0, 0, 'world', 'joyBase').setAlpha(0.001).setDepth(10);
        this.joyThumb = this.add.image(0, 0, 'world', 'joyThumb').setAlpha(0.001).setDepth(11);
        this.joyRadius = 56;

        this.input.on('pointerdown', (pointer) => {
            if (this.deadShown) return;
            const w = this.scale.width, h = this.scale.height;
            if (pointer.x < w * 0.52 && pointer.y > h * 0.3 && this.joyPointerId === null) {
                this.joyPointerId = pointer.id;
                this.joyBase.setPosition(pointer.x, pointer.y).setAlpha(0.9);
                this.joyThumb.setPosition(pointer.x, pointer.y).setAlpha(0.9);
            }
        });
        this.input.on('pointermove', (pointer) => {
            if (pointer.id !== this.joyPointerId) return;
            const dx = pointer.x - this.joyBase.x;
            const dy = pointer.y - this.joyBase.y;
            const len = Math.hypot(dx, dy) || 1;
            const clamped = Math.min(len, this.joyRadius);
            this.joyThumb.setPosition(
                this.joyBase.x + dx / len * clamped,
                this.joyBase.y + dy / len * clamped);
            if (len / this.joyRadius > 0.18) {
                const power = Math.min(1, len / this.joyRadius);
                this.play.uiMove.set(dx / len * power, dy / len * power);
            } else {
                this.play.uiMove.set(0, 0);
            }
        });
        const releaseJoy = (pointer) => {
            if (pointer.id !== this.joyPointerId) return;
            this.joyPointerId = null;
            this.play.uiMove.set(0, 0);
            this.joyBase.setAlpha(0.001);
            this.joyThumb.setAlpha(0.001);
        };
        this.input.on('pointerup', releaseJoy);
        this.input.on('pointerupoutside', releaseJoy);

        // --- action buttons ---
        this.btnAttack = this.makeButton(1.25, 0xffd0d0);
        this.btnAttackIcon = this.add.image(0, 0, 'platformer', 'jian').setScale(1.1).setDepth(21);
        this.btnAttack.on('pointerdown', () => { this.play.attackHeld = true; });
        this.btnAttack.on('pointerup', () => { this.play.attackHeld = false; });
        this.btnAttack.on('pointerout', () => { this.play.attackHeld = false; });

        this.btnGun = this.makeButton(0.85, 0xfff0c0);
        this.btnGunIcon = this.add.image(0, 0, 'platformer', 'gun').setScale(0.8).setDepth(21);
        this.btnGun.on('pointerdown', () => { this.play.player.tryGun(); });
        this.gunShade = this.add.image(0, 0, 'world', 'btn').setTint(0x000000).setAlpha(0.55).setDepth(22).setVisible(false);

        this.btnDash = this.makeButton(0.85, 0xd0e8ff);
        this.dashLabel = this.add.text(0, 0, 'DASH', {
            fontFamily: 'Courier', fontSize: '15px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(21);
        this.btnDash.on('pointerdown', () => { this.play.player.tryDash(); });
        this.dashShade = this.add.image(0, 0, 'world', 'btn').setTint(0x000000).setAlpha(0.55).setDepth(22).setVisible(false);

        // --- context action button (LOOT / DRINK — the mobile "F key") ---
        this.ctxBtn = this.makeButton(0.95, 0xd8f7c8).setVisible(false);
        this.ctxIcon = this.add.image(0, 0, 'platformer', 'baoxiang').setScale(0.75).setDepth(21).setVisible(false);
        this.ctxLabel = this.add.text(0, 0, '', {
            fontFamily: 'Courier', fontSize: '13px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5, 0).setDepth(21).setVisible(false);
        this.ctxBtn.on('pointerdown', () => { this.play.doContextAction(); });
        this.tweens.add({
            targets: this.ctxBtn, scale: { from: 0.95, to: 1.05 },
            duration: 500, yoyo: true, repeat: -1
        });

        // --- health orb (Diablo style) ---
        this.orbR = 42;
        this.orbBg = this.add.graphics().setDepth(20);
        this.hpFill = this.add.image(0, 0, 'world', 'px').setTint(0xb61f1f).setOrigin(0.5, 1).setDepth(21);
        this.orbMaskG = this.make.graphics({ add: false });
        this.hpFill.setMask(this.orbMaskG.createGeometryMask());
        this.orbFg = this.add.graphics().setDepth(22);
        this.hpText = this.add.text(0, 0, '', {
            fontFamily: 'Courier', fontSize: '13px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(23);
        this.lvlText = this.add.text(0, 0, 'LV 1', {
            fontFamily: 'Courier', fontSize: '15px', color: '#ffe14d',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(23);

        // --- XP bar ---
        this.xpBg = this.add.image(0, 0, 'world', 'px').setTint(0x101418).setOrigin(0, 0.5).setDepth(20).setAlpha(0.85);
        this.xpFill = this.add.image(0, 0, 'world', 'px').setTint(0x59d95e).setOrigin(0, 0.5).setDepth(21);

        // --- hunger / thirst mini-meters under the orb ---
        const meterLabel = { fontFamily: 'Courier', fontSize: '10px', color: '#8f96a3', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold' };
        this.hungerLbl = this.add.text(0, 0, 'FOOD', meterLabel).setOrigin(1, 0.5).setDepth(21);
        this.hungerBg = this.add.image(0, 0, 'world', 'px').setTint(0x101418).setOrigin(0, 0.5).setDepth(20).setAlpha(0.85);
        this.hungerFill = this.add.image(0, 0, 'world', 'px').setTint(0xe07b1f).setOrigin(0, 0.5).setDepth(21);
        this.thirstLbl = this.add.text(0, 0, 'H2O', meterLabel).setOrigin(1, 0.5).setDepth(21);
        this.thirstBg = this.add.image(0, 0, 'world', 'px').setTint(0x101418).setOrigin(0, 0.5).setDepth(20).setAlpha(0.85);
        this.thirstFill = this.add.image(0, 0, 'world', 'px').setTint(0x3fa7e0).setOrigin(0, 0.5).setDepth(21);

        // --- metabolism panel (tap the M button or press M) ---
        this.metaOpen = false;
        this.metaBtn = this.add.text(0, 0, 'M', {
            fontFamily: 'Courier', fontSize: '22px', color: '#c7ccd4',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true });
        this.metaBtn.on('pointerdown', () => this.toggleMetabolism());
        this.input.keyboard.on('keydown-M', () => this.toggleMetabolism());
        this.buildMetabolismPanel();

        // --- top-right info ---
        const info = { fontFamily: 'Courier', fontSize: '15px', color: '#c7ccd4', stroke: '#000000', strokeThickness: 3, align: 'right' };
        this.waveText = this.add.text(0, 0, '', {
            fontFamily: 'Courier', fontSize: '18px', color: '#ffe14d',
            stroke: '#000000', strokeThickness: 3, align: 'right', fontStyle: 'bold'
        }).setOrigin(1, 0).setDepth(20);
        this.statText = this.add.text(0, 0, '', info).setOrigin(1, 0).setDepth(20);

        this.muteBtn = this.add.text(0, 0, '♪', {
            fontFamily: 'Courier', fontSize: '24px', color: '#c7ccd4',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true });
        this.muteBtn.on('pointerdown', () => {
            this.sound.mute = !this.sound.mute;
            this.muteBtn.setColor(this.sound.mute ? '#555a63' : '#c7ccd4');
        });

        // --- banner text ---
        this.banner = this.add.text(0, 0, '', {
            fontFamily: 'Courier', fontSize: '34px', color: '#ffe14d',
            stroke: '#000000', strokeThickness: 5, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(40).setAlpha(0);

        this.layout();
        this.onResize = () => this.layout();
        this.scale.on('resize', this.onResize);
        this.events.once('shutdown', () => this.scale.off('resize', this.onResize));
    }

    makeButton(scale, tint) {
        return this.add.image(0, 0, 'world', 'btn').setScale(scale).setTint(tint)
            .setDepth(20).setAlpha(0.9)
            .setInteractive({ useHandCursor: true });
    }

    // ------------------------------------------------ metabolism panel ----

    buildMetabolismPanel() {
        this.metaPanel = this.add.container(0, 0).setDepth(35).setVisible(false);
        const bg = this.add.rectangle(0, 0, 240, 240, 0x0c0f14, 0.92).setOrigin(0.5).setStrokeStyle(2, 0x3c3f45);
        const title = this.add.text(0, -102, 'METABOLISM', {
            fontFamily: 'Courier', fontSize: '16px', color: '#ffe14d',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.metaPanel.add([bg, title]);

        this.metaBars = {};
        const rows = [
            ['hunger', 'HUNGER', 0xe07b1f, -68],
            ['thirst', 'THIRST', 0x3fa7e0, -34],
            ['stomach', 'STOMACH', 0xb9884f, 0],
            ['bladder', 'BLADDER', 0xf5e642, 34]
        ];
        for (const [key, label, tint, y] of rows) {
            const lbl = this.add.text(-104, y, label, {
                fontFamily: 'Courier', fontSize: '12px', color: '#c7ccd4',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0, 0.5);
            const barBg = this.add.image(-14, y, 'world', 'px').setTint(0x101418).setOrigin(0, 0.5).setDisplaySize(114, 12);
            const bar = this.add.image(-13, y, 'world', 'px').setTint(tint).setOrigin(0, 0.5).setDisplaySize(1, 8);
            this.metaBars[key] = bar;
            this.metaPanel.add([lbl, barBg, bar]);
        }

        // manual relieve buttons — go when it's safe, not when nature decides
        const btnStyle = {
            fontFamily: 'Courier', fontSize: '13px', color: '#ffffff',
            backgroundColor: '#243040', padding: { left: 8, right: 8, top: 5, bottom: 5 }, fontStyle: 'bold'
        };
        this.peeBtn = this.add.text(-58, 82, 'PEE', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.pooBtn = this.add.text(58, 82, 'POO', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.peeBtn.on('pointerdown', () => this.play.player.startRelieve('pee', false));
        this.pooBtn.on('pointerdown', () => this.play.player.startRelieve('poo', false));
        this.metaPanel.add([this.peeBtn, this.pooBtn]);
    }

    toggleMetabolism() {
        this.metaOpen = !this.metaOpen;
        this.metaPanel.setVisible(this.metaOpen);
        this.sound.play('sfxSelect', { volume: 0.4 });
    }

    layout() {
        const w = this.scale.width, h = this.scale.height;
        const m = Math.min(w, h) < 500 ? 0.85 : 1;   // shrink controls a bit on small phones

        // buttons, bottom-right cluster
        this.btnAttack.setPosition(w - 78 * m, h - 92 * m).setScale(1.25 * m);
        this.btnAttackIcon.setPosition(this.btnAttack.x, this.btnAttack.y).setScale(1.1 * m);
        this.btnGun.setPosition(w - 185 * m, h - 138 * m).setScale(0.85 * m);
        this.btnGunIcon.setPosition(this.btnGun.x, this.btnGun.y).setScale(0.8 * m);
        this.gunShade.setPosition(this.btnGun.x, this.btnGun.y);
        this.btnDash.setPosition(w - 88 * m, h - 212 * m).setScale(0.85 * m);
        this.dashLabel.setPosition(this.btnDash.x, this.btnDash.y);
        this.dashShade.setPosition(this.btnDash.x, this.btnDash.y);

        // context action button sits between joystick zone and skill cluster
        this.ctxBtn.setPosition(w - 205 * m, h - 258 * m);
        this.ctxIcon.setPosition(this.ctxBtn.x, this.ctxBtn.y);
        this.ctxLabel.setPosition(this.ctxBtn.x, this.ctxBtn.y + 56 * m);

        // orb, top-left
        const ox = 66, oy = 66, r = this.orbR;
        this.orbBg.clear();
        this.orbBg.fillStyle(0x1a0505, 0.95).fillCircle(ox, oy, r);
        this.orbFg.clear();
        this.orbFg.lineStyle(4, 0x3c3f45, 1).strokeCircle(ox, oy, r);
        this.orbFg.lineStyle(2, 0x777d88, 0.8).strokeCircle(ox, oy, r + 2);
        this.orbFg.fillStyle(0xffffff, 0.13).fillEllipse(ox - 10, oy - 16, 34, 18);
        this.orbMaskG.clear();
        this.orbMaskG.fillStyle(0xffffff).fillCircle(ox, oy, r - 2);
        this.hpFill.setPosition(ox, oy + r).setDisplaySize(r * 2, r * 2);
        this.hpText.setPosition(ox, oy + 6);
        this.lvlText.setPosition(ox, oy + r + 16);

        // hunger/thirst meters under the orb
        const my0 = oy + r + 34;
        this.hungerLbl.setPosition(ox - 6, my0);
        this.hungerBg.setPosition(ox, my0).setDisplaySize(72, 9);
        this.hungerFill.setPosition(ox + 1, my0).setDisplaySize(1, 5);
        this.thirstLbl.setPosition(ox - 6, my0 + 15);
        this.thirstBg.setPosition(ox, my0 + 15).setDisplaySize(72, 9);
        this.thirstFill.setPosition(ox + 1, my0 + 15).setDisplaySize(1, 5);

        // xp bar, top center
        const bw = Math.min(w * 0.45, 420);
        this.xpBarW = bw;
        this.xpBg.setPosition(w / 2 - bw / 2, 16).setDisplaySize(bw, 10);
        this.xpFill.setPosition(w / 2 - bw / 2 + 1, 16).setDisplaySize(1, 6);

        this.waveText.setPosition(w - 16, 12);
        this.statText.setPosition(w - 16, 38);
        this.muteBtn.setPosition(w - 30, 96);
        this.metaBtn.setPosition(w - 30, 136);
        this.metaPanel.setPosition(w / 2, h * 0.42);
        this.banner.setPosition(w / 2, h * 0.32);

        if (this.deadPanel) this.layoutDeath();
    }

    showBanner(text, color) {
        this.banner.setText(text).setColor(color || '#ffe14d').setAlpha(0).setScale(0.6);
        this.tweens.add({
            targets: this.banner, alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({ targets: this.banner, alpha: 0, delay: 1400, duration: 400 });
            }
        });
    }

    update() {
        const play = this.play;
        if (!play || !play.player) return;
        const p = play.player;

        // orb + bars
        const frac = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
        this.hpFill.displayHeight = Math.max(1, this.orbR * 2 * frac);
        this.hpText.setText(Math.ceil(p.hp) + '/' + p.maxHp);
        this.lvlText.setText('LV ' + p.level);
        this.xpFill.displayWidth = Math.max(1, (this.xpBarW - 2) * Phaser.Math.Clamp(p.xp / p.xpNext, 0, 1));

        // info
        const t = Math.floor(play.elapsed);
        const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
        this.waveText.setText(play.wave > 0 ? 'WAVE ' + play.wave : 'GET READY');
        this.statText.setText('KILLS ' + play.kills + '   ' + mm + ':' + ss);

        // cooldown shades shrink as the skill recharges
        const gunFrac = p.gunCd / p.gunCdMax;
        this.gunShade.setVisible(gunFrac > 0).setScale(0.85 * Math.max(0.01, gunFrac));
        const dashFrac = p.dashCd / p.dashCdMax;
        this.dashShade.setVisible(dashFrac > 0).setScale(0.85 * Math.max(0.01, dashFrac));

        // hunger / thirst meters (flash when critical)
        this.hungerFill.displayWidth = Math.max(1, 70 * p.hunger / 100);
        this.thirstFill.displayWidth = Math.max(1, 70 * p.thirst / 100);
        const flash = (Math.floor(this.time.now / 300) % 2) === 0;
        this.hungerFill.setAlpha(p.hunger > 80 && flash ? 0.35 : 1);
        this.thirstFill.setAlpha(p.thirst > 80 && flash ? 0.35 : 1);

        // context action button (LOOT / DRINK)
        const act = play.contextAction;
        if (act && !this.deadShown) {
            this.ctxBtn.setVisible(true);
            this.ctxIcon.setVisible(true);
            this.ctxLabel.setVisible(true);
            if (act.type === 'loot') {
                this.ctxIcon.setTexture('platformer', act.target.fridge ? 'bingxiang' : 'baoxiang').setScale(0.7);
                this.ctxLabel.setText('LOOT');
                this.ctxBtn.setTint(0xd8f7c8);
            } else {
                this.ctxIcon.setTexture('platformer', 'xigua').setScale(0.7);
                this.ctxLabel.setText('DRINK');
                this.ctxBtn.setTint(0xc8e4f7);
            }
        } else {
            this.ctxBtn.setVisible(false);
            this.ctxIcon.setVisible(false);
            this.ctxLabel.setVisible(false);
        }

        // metabolism panel bars
        if (this.metaOpen) {
            this.metaBars.hunger.displayWidth = Math.max(1, 112 * p.hunger / 100);
            this.metaBars.thirst.displayWidth = Math.max(1, 112 * p.thirst / 100);
            this.metaBars.stomach.displayWidth = Math.max(1, 112 * p.stomach / 100);
            this.metaBars.bladder.displayWidth = Math.max(1, 112 * p.bladder / 100);
            this.peeBtn.setAlpha(p.bladder >= 15 && !p.busy ? 1 : 0.4);
            this.pooBtn.setAlpha(p.stomach >= 15 && !p.busy ? 1 : 0.4);
        }

        // wave banner
        if (play.wave !== this.lastWave) {
            this.lastWave = play.wave;
            if (play.wave % 5 === 0) this.showBanner('!! BOSS WAVE ' + play.wave + ' !!', '#ff5c40');
            else this.showBanner('WAVE ' + play.wave);
        }

        // death screen
        if (play.gameOver && !this.deadShown) {
            this.deadShown = true;
            this.showDeath();
        }
    }

    showDeath() {
        const play = this.play;
        this.deadDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.72).setOrigin(0).setDepth(50).setInteractive();
        this.deadTitle = this.add.text(0, 0, 'YOU  DIED', {
            fontFamily: 'Courier', fontSize: '52px', color: '#b61f1f',
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(51);
        let bestLine = '';
        try {
            const best = JSON.parse(localStorage.getItem('stf-best') || '{}');
            if (best.kills) bestLine = '\nBEST: ' + best.kills + ' kills / wave ' + best.wave;
        } catch (e) { /* no storage */ }
        const t = Math.floor(play.elapsed);
        this.deadStats = this.add.text(0, 0,
            'Survived ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') +
            '\nWave ' + play.wave + '  ·  ' + play.kills + ' kills  ·  LV ' + play.player.level + bestLine,
            {
                fontFamily: 'Courier', fontSize: '18px', color: '#c7ccd4', align: 'center',
                stroke: '#000000', strokeThickness: 3, lineSpacing: 8
            }).setOrigin(0.5).setDepth(51);
        this.deadHint = this.add.text(0, 0, 'TAP TO RISE AGAIN', {
            fontFamily: 'Courier', fontSize: '22px', color: '#ffe14d',
            stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(51).setAlpha(0);
        this.deadPanel = [this.deadDim, this.deadTitle, this.deadStats, this.deadHint];
        this.deadPanel.forEach(o => o.setAlpha(o === this.deadHint ? 0 : 0.001));
        this.tweens.add({ targets: [this.deadDim, this.deadTitle, this.deadStats], alpha: { from: 0, to: 1 }, duration: 600 });
        this.tweens.add({ targets: this.deadHint, alpha: 1, duration: 500, delay: 900, yoyo: true, repeat: -1 });
        this.layoutDeath();

        // small delay so a panic-tap doesn't instantly restart
        this.time.delayedCall(900, () => {
            this.deadDim.once('pointerdown', () => {
                this.sound.play('sfxSelect', { volume: 0.6 });
                this.play.scene.restart();
                this.scene.restart();
            });
        });
    }

    layoutDeath() {
        const w = this.scale.width, h = this.scale.height;
        this.deadDim.setSize(w, h);
        if (this.deadDim.input) this.deadDim.input.hitArea.setSize(w, h);
        this.deadTitle.setPosition(w / 2, h * 0.32);
        this.deadStats.setPosition(w / 2, h * 0.5);
        this.deadHint.setPosition(w / 2, h * 0.68);
    }
}
