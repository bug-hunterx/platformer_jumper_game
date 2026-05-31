# 🌋 Lava Dash

A fast, flat/modern **auto-running platformer**. Your character sprints from
left to right across floating platforms — tap at the right moment to leap the
gaps. Miss one and you melt in the lava below.

Pure client-side HTML5 Canvas + JavaScript. No build step, no dependencies —
just static files, so it hosts perfectly on **GitHub Pages**.

## 🎮 How to play

- **Jump:** `Space` (desktop) or **tap anywhere** (mobile)
- **Double jump:** press a second time while airborne for extra air
- Survive as long as you can — the run **speeds up** the longer you last

Built **mobile-landscape first**: the canvas fills the screen, renders crisply
on high-DPI displays, and disables browser scroll/zoom gestures so taps only
drive the game. Held in portrait on a phone? You'll get a "rotate your device"
nudge.

## 🚀 Run locally

Because it's all static files, just open `index.html` — or serve the folder:

```bash
# Python
python3 -m http.server 8000
# then visit http://localhost:8000
```

## 🌐 Deploy to GitHub Pages

This repo ships a workflow (`.github/workflows/deploy-pages.yml`) that publishes
the site automatically.

1. Push to the default branch.
2. In your repo: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. The site deploys to `https://<user>.github.io/<repo>/`.

Prefer no Actions? **Settings → Pages → Source: Deploy from a branch**, pick
your branch and the root folder — the static files serve directly.

## 📁 Project structure

| File        | Purpose                                            |
| ----------- | -------------------------------------------------- |
| `index.html`| Markup, overlays, rotate nudge                     |
| `style.css` | Flat/modern styling, responsive overlays           |
| `game.js`   | Game loop, physics, procedural platforms, visuals  |

## 🛠️ Tweaking the game

All gameplay knobs live in the `REF` object near the top of `game.js`
(`gravity`, `jumpV`, `baseSpeed`, `speedRamp`, `maxSpeed`, gap/platform sizes).
Values are scaled to screen height at runtime so the feel stays consistent
across devices.
