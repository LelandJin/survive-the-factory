// Title screen. One tap/click starts the run (and unlocks mobile audio).
class Menu extends Phaser.Scene {
  constructor() {
    super('menuScene');
  }

  create() {
    this.layoutAll();
    this.onResize = () => this.layoutAll();
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));

    this.input.once('pointerup', () => this.startGame());
    this.input.keyboard.once('keydown', () => this.startGame());
  }

  startGame() {
    this.sound.play('sfxSelect', { volume: 0.6 });
    try {
      if (!this.sound.get('bgm') && this.cache.audio.exists('bgm')) {
        this.sound.add('bgm', { loop: true, volume: 0.25 }).play();
      }
    } catch (e) { /* no music if the device can't decode it */ }
    this.scene.start('playScene');
  }

  layoutAll() {
    const w = this.scale.width, h = this.scale.height;
    if (this.everything) this.everything.forEach(o => o.destroy());
    this.everything = [];
    const add = o => { this.everything.push(o); return o; };

    // backdrop: a strip of factory floor
    for (let k = -1; k <= Math.ceil(w / 128) + 1; k++) {
      add(this.add.image(k * 128, h * 0.78 + (k % 2) * 32, 'world', 'floor' + (Math.abs(k) % 4)).setAlpha(0.5));
      add(this.add.image(k * 128 + 64, h * 0.78 + 32 - (k % 2) * 32, 'world', 'floor' + (Math.abs(k + 1) % 4)).setAlpha(0.5));
    }

    // cast: survivor flanked by a shambling horde
    add(this.add.image(w / 2, h * 0.72, 'world', 'shadow').setScale(0.8).setAlpha(0.7));
    add(this.add.sprite(w / 2, h * 0.7, 'platformer', 'sword'));
    for (let k = 0; k < 4; k++) {
      const x = w / 2 + (k < 2 ? -1 : 1) * (90 + (k % 2) * 70);
      add(this.add.image(x, h * 0.72, 'world', 'shadow').setScale(0.7).setAlpha(0.6));
      const zed = add(this.add.sprite(x, h * 0.7, 'platformer', 'zombie' + (k * 2 + 1)).setFlipX(k >= 2));
      this.tweens.add({
        targets: zed, angle: { from: -5, to: 5 }, duration: 600 + k * 120,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    const small = Math.min(w, h) < 500;
    add(this.add.text(w / 2, h * 0.2, 'SURVIVE THE FACTORY', {
      fontFamily: 'Courier', fontSize: (small ? 30 : 46) + 'px', color: '#ffe14d',
      stroke: '#000000', strokeThickness: 6, fontStyle: 'bold', align: 'center',
      wordWrap: { width: w * 0.9 }
    }).setOrigin(0.5));
    add(this.add.text(w / 2, h * 0.31, '— realtime 2.5D zombie survival —', {
      fontFamily: 'Courier', fontSize: (small ? 13 : 17) + 'px', color: '#c7ccd4',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5));

    add(this.add.text(w / 2, h * 0.43,
      'Left thumb: move   ·   Right thumb: SWORD / GUN / DASH\n' +
      'Desktop: WASD + SPACE / E / SHIFT\n' +
      'Loot chests, eat fruit, level up, survive the waves.',
      {
        fontFamily: 'Courier', fontSize: (small ? 11 : 14) + 'px', color: '#8f96a3',
        stroke: '#000000', strokeThickness: 2, align: 'center', lineSpacing: 6
      }).setOrigin(0.5));

    const hint = add(this.add.text(w / 2, h * 0.55, 'TAP TO ENTER THE FACTORY', {
      fontFamily: 'Courier', fontSize: (small ? 18 : 24) + 'px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
    }).setOrigin(0.5));
    this.tweens.add({ targets: hint, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

    add(this.add.text(w / 2, h - 16,
      'Leland Jin · Jerry Lin · Lakery Cao  —  CMPM120 (2021) / 2.5D rework (2026)', {
        fontFamily: 'Courier', fontSize: '11px', color: '#555a63'
      }).setOrigin(0.5, 1));
  }
}
