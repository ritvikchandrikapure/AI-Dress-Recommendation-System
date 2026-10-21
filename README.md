# Threadly – AI Virtual Try-On (React)
Landing page → choose a category (Men's Shirts, Ladies' Dresses, Sunglasses, Hats & Caps, Necklaces) → pick an item
→ (shirts/dresses: size + material) → choose how to try: on yourself (live camera, AI tracking) or on a real-time 3D AI model (male / female, drag to turn, 3 skin tones).

    npm install
    npm run dev     # http://localhost:5173

Needs internet once for the AI pose model (CDN). Camera works on localhost / https.

Add a new product: drop a transparent PNG in src/assets/clothes/ and add one line in src/clothes.js
(shirts/dresses need shoulder points L/R, glasses/hats need w, dy and optional anchor a).
