# Skybow — Balloon Archer

Open `index.html` in a modern browser. No installation or build is required.

- Press **Space** to shoot an arrow.
- Move the archer up and down with **↑ / ↓** or the pointer. Movement stops at the screen boundaries; arrows always fly horizontally to the right.
- Click/tap the arena to shoot; phones also have a Shoot button.
- Press **P** to pause.

Pop the required number of balloons to advance through 10 distinct levels. Coral balloons award 10 points, blue 20, violet 35, and gold 50; higher-value colors rise faster. Levels increase speed, spawn frequency, and target count, introducing new colors along the way. Each escaped balloon costs one of your five lives. Clear level 10 to win.

Optional local server: `python3 -m http.server 8000` from this directory.

Each shot animates the archer's recoil, drawing hand, and vibrating bowstring, with a short bow-release sound. Balloon hits produce a separate pop. Browser audio activates after a click or key press.

The 10 level settings are plains, forest, town, city, castle, desert, hell, heaven, robotic, and space, each with its own palette and scenery.

An original looping folk/arcade soundtrack starts after your first interaction and continues across levels and menus. Use **Music: on/off** to mute music independently of game sound effects. No audio downloads are required.
