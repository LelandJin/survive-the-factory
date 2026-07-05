// Ground loot dropped by zombies / chests, plus the chests themselves.

const LOOT_TABLE = [
    { frame: 'yingtao', heal: 10, weight: 30 },   // cherry
    { frame: 'taozi', heal: 16, weight: 26 },     // peach
    { frame: 'huolongguo', heal: 26, weight: 18 },// pitaya
    { frame: 'xigua', heal: 36, weight: 14 },     // watermelon
    { frame: 'food', heal: 55, weight: 12 }       // canned beef
];

function rollLoot() {
    let total = 0;
    for (const e of LOOT_TABLE) total += e.weight;
    let r = Math.random() * total;
    for (const e of LOOT_TABLE) {
        r -= e.weight;
        if (r <= 0) return e;
    }
    return LOOT_TABLE[0];
}

class Loot extends Phaser.Physics.Arcade.Sprite {
    // kind: {frame, heal} food entry, or {frame:'xporb', xp:n}
    constructor(scene, x, y, kind) {
        const isXp = kind.frame === 'xporb';
        super(scene, x, y, isXp ? 'world' : 'platformer', kind.frame);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.heal = kind.heal || 0;
        this.xpAmount = kind.xp || 0;
        this.setOrigin(0.5, 0.9);
        this.setScale(isXp ? 1 : 0.7);
        this.body.setCircle(16, this.width / 2 - 16, this.height * 0.9 - 16);

        // pop out of the corpse, then bob
        scene.tweens.add({
            targets: this,
            y: y - 26,
            duration: 180,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
                scene.tweens.add({
                    targets: this, y: this.y - 6, duration: 600,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                });
            }
        });
        // despawn after a while
        scene.time.delayedCall(15000, () => {
            if (this.active) {
                scene.tweens.add({
                    targets: this, alpha: 0, duration: 500,
                    onComplete: () => this.destroy()
                });
            }
        });
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        this.setDepth(this.y);
    }
}

class Chest extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, fridge) {
        super(scene, x, y, 'platformer', fridge ? 'bingxiang' : 'baoxiang');
        scene.add.existing(this);
        this.setOrigin(0.5, 0.9);
        this.setDepth(y);
        this.opened = false;
        this.fridge = !!fridge;
    }

    open() {
        if (this.opened) return;
        this.opened = true;
        if (!this.fridge) this.setFrame('baoxiang2');
        else this.setTint(0x999999);
        this.scene.sound.play('sfxEat', { volume: 0.6 });
        this.scene.tweens.add({ targets: this, scaleX: 1.15, scaleY: 0.9, duration: 100, yoyo: true });
        // spill loot around the chest
        const n = Phaser.Math.Between(2, 4);
        for (let k = 0; k < n; k++) {
            const ang = Math.random() * Math.PI * 2;
            const d = 40 + Math.random() * 40;
            this.scene.spawnLoot(this.x + Math.cos(ang) * d, this.y + Math.sin(ang) * d * 0.6, rollLoot());
        }
        this.scene.spawnLoot(this.x, this.y + 30, { frame: 'xporb', xp: 25 });
    }
}
