# MindaQuest — Stage 2: Playable Forest Prototype

A browser-first top-down adventure prototype for children aged 6–10. This milestone focuses on a playable foundation before accounts, cloud saves, subscriptions, or backend services.

## Included
- Phaser 3 + TypeScript + Vite
- Phaser forest map, connected grass paths, a winding river, and a timber bridge with a dedicated walkable crossing
- Locally bundled Mixel 32×32 forest, ground, water, prop, and four-direction character art; see `ASSET-LICENSES.md`
- WASD / arrow-key movement, diagonal speed normalization, camera follow, collision objects
- Main menu, pause/resume, restart, return to menu
- On-screen directional buttons for touch screens
- Unit tests for movement normalization
- No remote runtime art, backend credentials, or service dependencies

## Run in Windows PowerShell
```powershell
Set-Location "C:\MindaQuest"
npm install
npm test
npm run build
npm run dev
```
Open the local URL printed by Vite (normally `http://127.0.0.1:5173/`).

## Controls
- Move: WASD or arrow keys
- Pause/resume: Escape or the pause icon
- Touch: directional pad at lower-left and pause icon at upper-right

## GitHub
This ZIP does not include `.git`; extracting into `C:\MindaQuest` preserves your existing Git repository and remote. After tests/build and a quick playtest:
```powershell
Set-Location "C:\MindaQuest"
git status
git add .
git commit -m "Build MindaQuest playable forest prototype"
git push -u origin main
```

## Next milestone
NPC dialogue, learning quests, bridge-repair inventory logic, save data, parent controls, and English/Bahasa Melayu localisation. No accounts, tracking, public chat, or payments are included.
