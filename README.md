# Final CMPM120 Project: Survive The Factory
Authors: [Leland Jin](mailto:nli32@ucsc.edu), Jerry Lin, Lakery Cao \
Group: 4rA
Date: May 14, 2021 \
Spring 2021  

---
### Game Description:
- Paying tribute to [SCUM on Steam](https://store.steampowered.com/app/513710), Survive The Factory is a survival game built on Phaser 3. You are meant to survive as long as possible for the entertainment of tycoons from above:)
You can read more about the background story of SCUM [here](https://scum-game.fandom.com/wiki/Scum).
- **v6.0 rework:** the game is now a realtime **2.5D isometric action RPG** (think Diablo) that is fully **playable on phones** — survive endless zombie waves, loot chests, level up, and take down the ROBOT boss every 5th wave.

### How to Play (v6.0):
- **Phone / tablet:** left thumb anywhere on the left half = virtual joystick; right-thumb buttons: **SWORD** (hold to auto-swing), **GUN** (5-shot fan, cooldown), **DASH** (burst + brief invulnerability). Attacks auto-aim at the nearest zombie.
- **Desktop:** move with **WASD/arrows**, **SPACE** to swing, **E** to shoot, **SHIFT** to dash.
- Chests auto-open when you walk up to them; fruit heals, green orbs give XP. Level up to grow HP/damage/speed (at LV4 you find your tactical glasses). The first boss drops **the axe** (+35% damage).

### Architecture (v6.0):
- `src/scenes/Boot.js` — asset loading + procedural canvas texture atlas (iso floor tiles, wall/crate/machine cubes, fx, touch controls)
- `src/scenes/Play.js` — iso map generation, y-based depth sorting, arcade physics, waves/boss, melee/gun/dash combat, loot & XP
- `src/scenes/UI.js` — HUD overlay: floating joystick, skill buttons with cooldowns, Diablo-style health orb, XP bar, banners, death screen
- `src/prefabs/Player.js`, `Zombie.js`, `Item.js` — realtime entities
- No build step: `python3 -m http.server` and open on any device.

### Links:
- [Public GitHub repository](https://github.com/jerrylin4real/survive-the-factory)

- [GitHub page/Playable link](https://jerrylin4real.github.io/survive-the-factory/)

- [Group Google drive](https://drive.google.com/drive/folders/1LB6Vdx5lpXOuZgMV4hXCGnVQgUnjNuvu?usp=sharing)

- [Production Plan](https://docs.google.com/spreadsheets/d/1IPQ5VGNMIJ-X7-zjF-Um_xaEgY5ljL-dkttPFAnFF-o/edit?usp=sharing)


- You can use Python as a web server to host the game locally: `python3 -m http.server`
  
---
### Patch Notes:

`Patch v6.0 (Realtime 2.5D mobile rework):`
- Rebuilt as a realtime 2.5D isometric ARPG playable on phones
- Procedurally generated isometric factory floor with depth-sorted walls, crates and machines
- Virtual joystick + multitouch skill buttons (sword / gun / dash) with auto-aim
- Endless zombie waves, ROBOT boss every 5th wave, XP/levels, loot drops, chests
- Diablo-style health orb, XP bar, floating damage numbers, death/retry screen
- Responsive layout for portrait & landscape; keyboard still supported on desktop

`Patch v0.5 (Final Game):`
- Hours taken: 
  - 12 hours or more
- Features
  - release version
  - axe as win game condition 
  - easter eggs
  - press p to pause background music

`Patch v0.3 (Final sprint):`
- Hours taken: 
  - 10 hours
- Features implemented:
  - wall
  - chests
  - items
  

`Patch v0.2 (Sprint 2): May 28, 2021`
- Hours taken: 
  - 12 hours
- Features implemented:
  - UI overlay
  - level mechanism
  - HP mechanism 
  - Stamina mechanism
  - player1 animation
  - F key interaction 
  - left click to use item 

`Patch v0.1 (Sprint 1):`
- Hours taken: 
  - 16 hours
- Features implemented:
  - WSAD Control
  - Mouse indicator(need more fixes)
  - survival timer
  - camera following player1
  - press ESC to escape 
  - press R to restart

---

### Fun Facts:
- Leland came up with the idea of making a 2D adaption of SCUM after playing SCUM for 30 hours. 
- You can do beatbox in this game!
- Whistle and beatbox sounds are made by Leland!
- Wall collision is hardcoded by Leland.
- Many fantastic arts in the assets are not actually implemented in the coding aspect:(
  
---
### Reference:
- [SCUM on Steam](https://store.steampowered.com/app/513710)
- https://www.codecaptain.io/blog/game-development/shooting-bullets-phaser-3-using-arcade-physics-groups/696
- https://phaser.io/examples/v2/camera/follow-styles
- https://github.com/jerrylin4real/Endless-runner
- https://github.com/leland-jin/Rocket_Patrol_Mod
- https://phaser.io/examples/v2/games/tanks
 
### Credit  
- [FPSOSU! Crosshair + Minimal skin](https://steamcommunity.com/sharedfiles/filedetails/?id=1789952373)
