// Factory zombie (and the ROBOT boss). Realtime AI: wanders until the
// survivor is in aggro range, then chases and swipes on a cooldown.
class Zombie extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, wave, isBoss) {
        const frame = isBoss ? 'robot' : 'zombie' + Phaser.Math.Between(1, 9);
        super(scene, x, y, 'platformer', frame);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.isBoss = !!isBoss;
        this.setOrigin(0.5, 0.92);
        if (this.isBoss) {
            this.setScale(1.15);
            this.body.setCircle(34, 179 / 2 - 34, 152 * 0.92 - 40);
        } else {
            this.body.setCircle(15, 45 / 2 - 15, 78 * 0.92 - 16);
        }

        const scale = 1 + (wave - 1) * 0.22;
        this.maxHp = Math.floor((this.isBoss ? 320 : 34) * scale);
        this.hp = this.maxHp;
        this.dmg = Math.floor((this.isBoss ? 26 : 8) * (1 + (wave - 1) * 0.08));
        this.xpValue = (this.isBoss ? 120 : 10) + wave * 2;
        this.moveSpeed = this.isBoss ? 62 : Phaser.Math.Between(48, 86) + wave * 2;
        this.aggroRange = 99999;   // wave spawns always hunt the survivor
        this.attackRange = this.isBoss ? 78 : 50;
        this.attackCd = 0;
        this.knockTime = 0;
        this.wanderDir = new Phaser.Math.Vector2().setToPolar(Math.random() * Math.PI * 2, 1);
        this.wanderTimer = 0;
        this.dead = false;

        this.shadow = scene.add.image(x, y, 'world', 'shadow')
            .setScale(this.isBoss ? 1.6 : 0.7).setAlpha(0.7).setDepth(STF.DEPTH.SHADOW);
    }

    update(time, delta) {
        if (this.dead) return;
        const scene = this.scene;
        const player = scene.player;
        this.attackCd = Math.max(0, this.attackCd - delta);

        if (this.knockTime > time) {
            // being knocked back: let physics carry us
        } else if (scene.gameOver || !player.alive) {
            this.setVelocity(0, 0);
        } else {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist <= this.attackRange) {
                this.setVelocity(0, 0);
                if (this.attackCd <= 0) {
                    this.attackCd = this.isBoss ? 1300 : 950;
                    // lunge telegraph
                    scene.tweens.add({
                        targets: this, scaleX: this.scaleX * 1.12, scaleY: this.scaleY * 0.94,
                        duration: 90, yoyo: true
                    });
                    player.takeDamage(this.dmg);
                }
            } else if (dist <= this.aggroRange) {
                const n = 1 / dist;
                this.setVelocity(dx * n * this.moveSpeed, dy * n * this.moveSpeed * 0.62);
                this.setFlipX(dx > 0);
            } else {
                // shamble around
                this.wanderTimer -= delta;
                if (this.wanderTimer <= 0) {
                    this.wanderTimer = Phaser.Math.Between(1500, 3500);
                    this.wanderDir.setToPolar(Math.random() * Math.PI * 2, 1);
                    if (Math.random() < 0.3) this.wanderDir.set(0, 0);
                }
                const ws = this.moveSpeed * 0.35;
                this.setVelocity(this.wanderDir.x * ws, this.wanderDir.y * ws * 0.62);
                if (Math.abs(this.wanderDir.x) > 0.1) this.setFlipX(this.wanderDir.x > 0);
            }
        }

        // shamble wobble
        this.setAngle(Math.sin(time * 0.008 + this.x) * 4);
        this.shadow.setPosition(this.x, this.y + 2);
        this.setDepth(this.y);
    }

    takeDamage(dmg, fromX, fromY, isCrit) {
        if (this.dead) return;
        this.hp -= dmg;
        this.scene.spawnDamageText(this.x, this.y - (this.isBoss ? 130 : 80),
            String(dmg), isCrit ? '#ffe14d' : '#ffffff', isCrit ? 22 : 16);
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(80, () => { if (!this.dead) this.clearTint(); });

        // knockback away from the hit source (bosses barely budge)
        const ang = Math.atan2(this.y - fromY, this.x - fromX);
        const force = this.isBoss ? 60 : 240;
        this.setVelocity(Math.cos(ang) * force, Math.sin(ang) * force * 0.62);
        this.knockTime = this.scene.time.now + 140;

        if (this.hp <= 0) this.die();
    }

    die() {
        if (this.dead) return;
        this.dead = true;
        this.body.enable = false;
        this.scene.onZombieDead(this);
        this.shadow.destroy();
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            angle: this.flipX ? 90 : -90,
            y: this.y + 10,
            duration: 320,
            ease: 'Quad.easeIn',
            onComplete: () => this.destroy()
        });
    }

    destroy(fromScene) {
        if (this.shadow && this.shadow.active) this.shadow.destroy();
        super.destroy(fromScene);
    }
}
