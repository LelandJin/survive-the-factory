/******************************************************
 * Survive The Factory — realtime 2.5D action survival
 *
 * Original (2021): Leland Jin, Jerry Lin, Lakery Cao
 * 2.5D / mobile ARPG rework (2026)
 *******************************************************/

// ----- world constants (isometric grid) -----
const STF = {
    TILE_W: 128,          // iso tile width (px)
    TILE_H: 64,           // iso tile height (px)
    GRID: 32,             // map is GRID x GRID tiles
    DEPTH: {
        FLOOR: -10000,
        SHADOW: -9000,
        UI: 100000
    }
};

// grid (i, j) -> world position of the tile's center (diamond map, all x > 0)
function isoToWorld(i, j) {
    return {
        x: (i - j) * STF.TILE_W / 2 + STF.GRID * STF.TILE_W / 2,
        y: (i + j) * STF.TILE_H / 2 + STF.TILE_H
    };
}

// world bounds of the diamond map (bounding box)
function isoBounds() {
    return {
        x: 0,
        y: 0,
        width: STF.GRID * STF.TILE_W,
        height: STF.GRID * STF.TILE_H + STF.TILE_H * 2
    };
}

const config = {
    type: Phaser.AUTO,
    parent: 'main',
    backgroundColor: '#07070c',
    render: {
        antialias: true,
        roundPixels: false,
        powerPreference: 'high-performance'
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    input: {
        activePointers: 4   // multitouch: joystick + buttons at once
    },
    disableContextMenu: true,
    scene: [Boot, Menu, Play, UI]
};

const game = new Phaser.Game(config);
