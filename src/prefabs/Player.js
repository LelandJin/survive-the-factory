// The survivor. A realtime action hero: walks/runs via joystick or WASD,
// swings a sword, dodges, fires a scavenged gun, levels up Diablo-style.
class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'platformer', 'stand');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setOrigin(0.5, 0.92);            // origin at the feet for 2.5D depth sorting
        this.body.setCircle(14, 45 / 2 - 14, 78 * 0.92 - 14);

        // stats
        this.level = 1;
        this.xp = 0;
        this.xpNext = 50;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.atk = 16;
        this.speed = 240;

        // realtime state
        this.alive = true;
        this.facing = new Phaser.Math.Vector2(1, 0);
        this.moveVec = new Phaser.Math.Vector2(0, 0);
        this.attackCd = 0;
        this.gunCd = 0;
        this.dashCd = 0;
        this.attackCdMax = 420;
        this.gunCdMax = 4000;
        this.dashCdMax = 1500;
        this.dashTime = 0;
        this.iframes = 0;
        this.poseTime = 0;                    // time left showing attack/gun pose
        this.poseFrame = null;
        this.animTimer = 0;
        this.animStep = 0;

        this.shadow = scene.add.image(x, y, 'world', 'shadow')
            .setScale(0.7).setAlpha(0.8).setDepth(STF.DEPTH.SHADOW);
    }

    // frame prefix: at level 4+ the survivor finds their tactical glasses
    fp(name) {
        return (this.level >= 4 ? 'glasses-' : '') + name;
    }

    update(time, delta) {
        if (!this.alive) return;

        this.attackCd = Math.max(0, this.attackCd - delta);
        this.gunCd = Math.max(0, this.gunCd - delta);
        this.dashCd = Math.max(0, this.dashCd - delta);
        this.iframes = Math.max(0, this.iframes - delta);
        this.poseTime = Math.max(0, this.poseTime - delta);

        // movement (screen-space; vertical squashed for the iso feel)
        const v = this.moveVec;
        const dashing = this.dashTime > time;
        const spd = this.speed * (dashing ? 3.1 : 1);
        if (v.lengthSq() > 0.01) {
            const n = v.clone().normalize();
            this.setVelocity(n.x * spd, n.y * spd * 0.62);
            this.facing.copy(n);
        } else if (!dashing) {
            this.setVelocity(0, 0);
        }

        this.updateSprite(delta, v.lengthSq() > 0.01);

        this.shadow.setPosition(this.x, this.y + 2);
        this.setDepth(this.y);
    }

    updateSprite(delta, moving) {
        // pose (attack / shoot) overrides walk frames briefly
        if (this.poseTime > 0 && this.poseFrame) {
            this.setFrame(this.fp(this.poseFrame));
            this.setFlipX(this.facing.x > 0.05);
            return;
        }
        if (!moving) {
            this.setFrame(this.fp('stand'));
            return;
        }
        this.animTimer += delta;
        if (this.animTimer > 150) {
            this.animTimer = 0;
            this.animStep ^= 1;
        }
        if (Math.abs(this.facing.x) >= Math.abs(this.facing.y) * 0.7) {
            this.setFrame(this.fp(this.animStep ? 'leftright2' : 'leftright'));
            this.setFlipX(this.facing.x > 0);
        } else {
            this.setFrame(this.fp(this.animStep ? 'updown2' : 'updown'));
            this.setFlipX(false);
        }
    }

    tryAttack() {
        if (!this.alive || this.attackCd > 0) return false;
        this.attackCd = this.attackCdMax;
        this.poseTime = 220;
        this.poseFrame = 'sword';
        const angle = this.scene.getAimAngle(this);
        this.facing.setToPolar(angle, 1);
        this.scene.playerMelee(angle);
        return true;
    }

    tryGun() {
        if (!this.alive || this.gunCd > 0) return false;
        this.gunCd = this.gunCdMax;
        this.poseTime = 320;
        this.poseFrame = 'holdgun2';
        const angle = this.scene.getAimAngle(this);
        this.facing.setToPolar(angle, 1);
        this.scene.playerGun(angle);
        return true;
    }

    tryDash() {
        if (!this.alive || this.dashCd > 0) return false;
        this.dashCd = this.dashCdMax;
        this.dashTime = this.scene.time.now + 170;
        this.iframes = Math.max(this.iframes, 380);
        const n = this.moveVec.lengthSq() > 0.01 ? this.moveVec.clone().normalize() : this.facing;
        this.setVelocity(n.x * this.speed * 3.1, n.y * this.speed * 3.1 * 0.62);
        this.scene.sound.play('sfxSwish', { volume: 0.5 });
        this.scene.tweens.add({ targets: this, alpha: 0.45, duration: 90, yoyo: true });
        return true;
    }

    takeDamage(dmg) {
        if (!this.alive || this.iframes > 0) return;
        this.iframes = 500;
        this.hp -= dmg;
        this.setTintFill(0xff4444);
        this.scene.time.delayedCall(110, () => this.clearTint());
        this.scene.cameras.main.shake(120, 0.006);
        this.scene.sound.play('sfxHurt', { volume: 0.5 });
        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    heal(amount) {
        if (!this.alive) return;
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    gainXp(amount) {
        if (!this.alive) return;
        this.xp += amount;
        while (this.xp >= this.xpNext) {
            this.xp -= this.xpNext;
            this.levelUp();
        }
    }

    levelUp() {
        this.level += 1;
        this.xpNext = Math.floor(50 * Math.pow(this.level, 1.4));
        this.maxHp += 16;
        this.atk += 5;
        this.speed = Math.min(300, this.speed + 4);
        this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.5));
        this.scene.sound.play('sfxLevel', { volume: 0.5 });
        this.scene.spawnDamageText(this.x, this.y - 90, 'LEVEL UP!', '#ffe14d', 24);
        this.scene.burstFx(this.x, this.y - 30, 0xffe14d, 14);
    }

    die() {
        this.alive = false;
        this.setVelocity(0, 0);
        this.setFrame(this.fp('stand'));
        this.scene.tweens.add({
            targets: this,
            angle: 90,
            alpha: 0.6,
            duration: 500,
            ease: 'Quad.easeIn'
        });
        this.scene.onPlayerDead();
    }
}
