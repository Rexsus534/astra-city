# ASTRA CITY — Online Superhero Sandbox

A browser-based 3D superhero sandbox built with Three.js, Vite, Express, and Socket.IO.

## Current features

- Procedurally assembled 3D city block grid, roads, rooftops, downtown height variation, park/trees, lighting, fog, and shadow rendering.
- Third-person hero, camera orbit, WASD, jump, sprint, flight toggle, boost, ascend/descend controls, touch joystick and touch buttons.
- Flight glow, procedural limb/body animation, custom suit color.
- Melee attacks with front-facing range check, combo counter, knockback, and strength upgrade damage.
- Unlockable energy projectile, telekinetic pulse, shield timer, ultimate area attack.
- Basic criminal/elite AI, chasing and attacks; Null Titan boss encounter with health HUD.
- Pedestrian wandering.
- Patrol, crime wave, civilian rescue, and five-step story directive flow (park arrival, hostile wave, downtown arrival, boss, campaign finish).
- XP, credits, level ups, unlocks, skills, achievements UI, minimap, settings panel, inventory and power panels.
- Account registration/login, hashed passwords, player save/load, seven-day in-memory session, online presence, movement sync, chat, and visual action relays.
- Mobile controls and responsive HUD.

## Run locally

1. Install Node.js 20+.
2. Open this project folder in a terminal.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the Vite URL (normally `http://localhost:5173`). The dev command starts the game client and API/socket server together.

## Checks

Run `npm run test:sanity` for dependency-free static checks. `node --check src/main.js` and `node --check server/index.js` check syntax.


## Honest limitations / remaining development work

This is still an evolving game project, not a finished commercial/AAA release. Online play currently synchronizes account presence, player positions, chat, and action visual effects. Combat damage, NPCs, enemies, and mission state are still locally simulated per client; the Null Titan and street hostiles are not server-authoritative or shared targets. The current save file is a local JSON store, sessions are memory-only, and the prototype server does not yet have production security/rate limiting or a robust database. Full character animation rigging, mission cinematic sequences, object-based telekinesis, complete boss phase mechanics, traffic, interiors, advanced police/wanted behavior, and authored audio remain unfinished. Package installation/build could not be verified in this environment because `npm install` timed out and Vite is not installed here.
