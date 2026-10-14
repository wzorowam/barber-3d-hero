# Atelier Brzytwa

Przykładowa strona salonu fryzjerskiego męskiego. Marka, zespół, opinie, telefon, adres i ceny są wymyślone. Treść strony jest po polsku.

The hero is a scroll-driven 3D scene: scissors and a straight razor come down onto a matte plaster bust with a messy cut, hair falls, the head turns, and a dissolve leaves a short crop. Scrolling back up reverses the whole thing. The bust, both haircuts, the scissors and the razor are built in Three.js. There are no downloaded models.

## Stack

Vite, Three.js, GSAP ScrollTrigger and Lenis. The production build is a static `dist/` folder. `vercel.json` points Vercel at that build.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run render:fallback
npm run shots
```

`render:fallback` opens the scene in headless Chrome and writes `public/fallback/poster.jpg`, `before.jpg`, `after.jpg` and 24 scroll frames. Those files are the reduced-motion stills and the low-end image sequence. Run it again after changing the choreography, then commit the new frames.

`shots` serves the production build and saves viewport screenshots at 0%, 30%, 60% and 90% of the page, on a desktop and a phone size.

## How the hero chooses a mode

- `prefers-reduced-motion`: a before-and-after pair, no pinning.
- No WebGL2, Save-Data, two or fewer cores, or a phone that is also short on cores or memory: a scroll-scrubbed JPEG sequence.
- Otherwise: the live WebGL scene.

The pixel ratio is capped at 1.5, and at 1.25 on narrow screens. The scene stays under 25 draw calls. Rendering pauses when the hero leaves the screen. A poster image shows until the first frame.

Query flags, for checks: `?mode=webgl`, `?mode=sequence`, `?mode=stills`, `?snap=0`, `?scrub=0`.

## Credits

- Geometry: procedural, written in this repo.
- [three.js](https://github.com/mrdoob/three.js) (MIT), including `RoomEnvironment` for the metal reflections.
- [GSAP](https://gsap.com/) and ScrollTrigger.
- [Lenis](https://github.com/darkroomengineering/lenis) (MIT).
- Cormorant Garamond and Inter, shipped with Fontsource (SIL Open Font License).
- Map image: © OpenStreetMap contributors. `scripts/fetch-map.mjs` rebuilds `public/images/map.jpg`.
- Photographs in `public/images/` were made for this sample. They are not pictures of a real shop or of real barbers.
