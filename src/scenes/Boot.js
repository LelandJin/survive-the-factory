// Boot scene: loads assets, procedurally draws the 2.5D tile / UI textures,
// then hands off to the menu.
class Boot extends Phaser.Scene {
    constructor() {
        super('bootScene');
    }

    preload() {
        const w = this.scale.width, h = this.scale.height;
        const barBg = this.add.rectangle(w / 2, h / 2, Math.min(w * 0.7, 420), 14, 0x222831).setOrigin(0.5);
        const bar = this.add.rectangle(barBg.x - barBg.width / 2, h / 2, 1, 10, 0xd8a516).setOrigin(0, 0.5);
        this.add.text(w / 2, h / 2 - 30, 'LOADING THE FACTORY...', {
            fontFamily: 'Courier', fontSize: '16px', color: '#c7ccd4'
        }).setOrigin(0.5);
        this.load.on('progress', p => { bar.width = Math.max(1, (barBg.width - 4) * p); });

        this.load.path = './assets/';
        this.load.atlas('platformer', 'player-and-food.png', 'player-and-food.json');

        this.load.audio('bgm', 'sound/scumbgm.mp3');
        this.load.audio('sfxSelect', 'sound/Select.wav');
        this.load.audio('sfxBlip', 'sound/blip_select12.wav');
        this.load.audio('sfxEat', 'sound/eatsound.wav');
        this.load.audio('sfxKill', 'sound/explosion38.wav');
        this.load.audio('sfxShot', 'sound/rocket_shot.wav');
        this.load.audio('sfxSwish', 'sound/hihat.wav');
        this.load.audio('sfxHurt', 'sound/snare.wav');
        this.load.audio('sfxBossDie', 'sound/mixkit-truck-crash-with-explosion-1616.wav');
        this.load.audio('sfxLevel', 'sound/mixkit-space-game-668.wav');
        this.load.audio('sfxSpell', 'sound/mixkit-explosion-spell-1685.wav');
    }

    create() {
        this.buildWorldTexture();
        this.scene.start('menuScene');
    }

    // Draws every generated frame (iso tiles, cubes, fx, touch controls) onto
    // one shared canvas texture so the whole world renders as a single batch.
    buildWorldTexture() {
        const tex = this.textures.createCanvas('world', 1024, 512);
        const ctx = tex.getContext();
        const TW = STF.TILE_W, TH = STF.TILE_H;

        const diamondPath = (x, y, w, h) => {
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w / 2, y + h);
            ctx.lineTo(x, y + h / 2);
            ctx.closePath();
        };

        // --- floor variants ---
        const floorColors = ['#3b4048', '#383d44', '#40454e', '#34383f'];
        floorColors.forEach((c, n) => {
            const x = n * TW;
            diamondPath(x, 0, TW, TH);
            ctx.fillStyle = c;
            ctx.fill();
            // speckle noise for worn concrete
            ctx.save();
            diamondPath(x, 0, TW, TH);
            ctx.clip();
            for (let s = 0; s < 26; s++) {
                ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.09)';
                const sx = x + Math.random() * TW, sy = Math.random() * TH;
                ctx.fillRect(sx, sy, 2 + Math.random() * 5, 1 + Math.random() * 3);
            }
            ctx.restore();
            diamondPath(x + 0.5, 0.5, TW - 1, TH - 1);
            ctx.strokeStyle = 'rgba(0,0,0,0.28)';
            ctx.lineWidth = 1;
            ctx.stroke();
            tex.add('floor' + n, 0, x, 0, TW, TH);
        });

        // --- metal grate floor ---
        {
            const x = 4 * TW;
            diamondPath(x, 0, TW, TH);
            ctx.fillStyle = '#2e3a42';
            ctx.fill();
            ctx.save();
            diamondPath(x, 0, TW, TH);
            ctx.clip();
            ctx.strokeStyle = 'rgba(140,170,185,0.22)';
            ctx.lineWidth = 2;
            for (let k = -4; k < 8; k++) {
                ctx.beginPath();
                ctx.moveTo(x + k * 16, 0);
                ctx.lineTo(x + k * 16 + TW / 2, TH);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + k * 16 + TW / 2, 0);
                ctx.lineTo(x + k * 16, TH);
                ctx.stroke();
            }
            ctx.restore();
            diamondPath(x + 0.5, 0.5, TW - 1, TH - 1);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.stroke();
            tex.add('floorGrate', 0, x, 0, TW, TH);
        }

        // --- hazard pad (zombie spawn point) ---
        {
            const x = 5 * TW;
            diamondPath(x, 0, TW, TH);
            ctx.fillStyle = '#43391b';
            ctx.fill();
            diamondPath(x + 6, 3, TW - 12, TH - 6);
            ctx.strokeStyle = '#d8a516';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 8]);
            ctx.stroke();
            ctx.setLineDash([]);
            tex.add('hazard', 0, x, 0, TW, TH);
        }

        // helper: iso cube. (x,y) top-left of frame; w = width; topH = w/2; sideH = wall height
        const cube = (x, y, w, sideH, cTop, cLeft, cRight, edge) => {
            const topH = w / 2;
            // left face
            ctx.fillStyle = cLeft;
            ctx.beginPath();
            ctx.moveTo(x, y + topH / 2);
            ctx.lineTo(x + w / 2, y + topH);
            ctx.lineTo(x + w / 2, y + topH + sideH);
            ctx.lineTo(x, y + topH / 2 + sideH);
            ctx.closePath();
            ctx.fill();
            // right face
            ctx.fillStyle = cRight;
            ctx.beginPath();
            ctx.moveTo(x + w, y + topH / 2);
            ctx.lineTo(x + w / 2, y + topH);
            ctx.lineTo(x + w / 2, y + topH + sideH);
            ctx.lineTo(x + w, y + topH / 2 + sideH);
            ctx.closePath();
            ctx.fill();
            // top
            diamondPath(x, y, w, topH);
            ctx.fillStyle = cTop;
            ctx.fill();
            ctx.strokeStyle = edge;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        // --- factory wall block (frame 128 x 160, base sits at bottom) ---
        cube(0, 64, TW, 96, '#4e5b68', '#39434d', '#2b333c', 'rgba(0,0,0,0.4)');
        // rivets on the left face
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        for (let r = 0; r < 3; r++) ctx.fillRect(14 + r * 18, 64 + 70 + r * 9, 3, 3);
        tex.add('wall', 0, 0, 64, TW, 160);

        // --- crate (96 x 120) ---
        cube(140, 64, 96, 72, '#8a6a42', '#6e5232', '#594127', 'rgba(0,0,0,0.4)');
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(140 + 6, 64 + 24 + 28);
        ctx.lineTo(140 + 48, 64 + 48 + 28);
        ctx.lineTo(140 + 90, 64 + 24 + 28);
        ctx.stroke();
        tex.add('crate', 0, 140, 64, 96, 120);

        // --- machine (128 x 176) with warning light ---
        cube(250, 64, TW, 112, '#3f4d57', '#2c3640', '#222a32', 'rgba(0,0,0,0.45)');
        ctx.fillStyle = '#d8a516';
        ctx.fillRect(250 + 14, 64 + 78, 40, 8);
        ctx.fillStyle = '#ff5c40';
        ctx.beginPath();
        ctx.arc(250 + 64, 64 + 20, 5, 0, Math.PI * 2);
        ctx.fill();
        tex.add('machine', 0, 250, 64, TW, 176);

        // --- fx row (y = 250) ---
        // soft shadow ellipse 96x44
        {
            const g = ctx.createRadialGradient(48, 272, 4, 48, 272, 44);
            g.addColorStop(0, 'rgba(0,0,0,0.5)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save();
            ctx.translate(0, 250);
            ctx.scale(1, 0.46);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(48, 48, 46, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            tex.add('shadow', 0, 0, 250, 96, 46);
        }
        // spark (white, tintable)
        {
            const g = ctx.createRadialGradient(108, 262, 1, 108, 262, 8);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(100, 254, 16, 16);
            tex.add('spark', 0, 100, 254, 16, 16);
        }
        // bullet
        {
            const g = ctx.createRadialGradient(132, 262, 1, 132, 262, 10);
            g.addColorStop(0, '#fff6c8');
            g.addColorStop(0.5, '#ffb428');
            g.addColorStop(1, 'rgba(255,110,20,0)');
            ctx.fillStyle = g;
            ctx.fillRect(120, 250, 24, 24);
            tex.add('bullet', 0, 120, 250, 24, 24);
        }
        // xp orb (green diamond)
        {
            diamondPath(150, 252, 18, 18);
            ctx.fillStyle = '#59d95e';
            ctx.fill();
            ctx.strokeStyle = '#1f7a2e';
            ctx.lineWidth = 2;
            ctx.stroke();
            tex.add('xporb', 0, 148, 250, 22, 22);
        }
        // slash crescent 128x128 (white, tintable, rotates toward attack dir)
        {
            ctx.save();
            ctx.translate(240, 314);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineCap = 'round';
            ctx.lineWidth = 16;
            ctx.beginPath();
            ctx.arc(0, 0, 46, -0.9, 0.9);
            ctx.stroke();
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.arc(0, 0, 60, -0.7, 0.7);
            ctx.stroke();
            ctx.restore();
            tex.add('slash', 0, 176, 250, 128, 128);
        }
        // joystick base / thumb
        {
            ctx.beginPath();
            ctx.arc(380, 320, 64, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(380, 320, 44, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.stroke();
            tex.add('joyBase', 0, 314, 254, 132, 132);

            ctx.beginPath();
            ctx.arc(490, 290, 30, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.42)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            tex.add('joyThumb', 0, 458, 258, 64, 64);
        }
        // action button
        {
            ctx.beginPath();
            ctx.arc(600, 310, 52, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.stroke();
            tex.add('btn', 0, 546, 256, 108, 108);
        }
        // 8x8 white pixel for bars/rects
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1000, 0, 8, 8);
        tex.add('px', 0, 1000, 0, 8, 8);

        tex.refresh();
    }
}
