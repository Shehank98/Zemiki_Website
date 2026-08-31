# Site assets

## Logo

Put your logo here named exactly **`logo.png`**:

```
public/assets/logo.png
```

- It appears in the top-left header of every page **and on the printed packing slip**
  you stick on each order box.
- Recommended: a transparent PNG, roughly **240 x 80 px** (or any 3:1-ish ratio).
  It is displayed at ~40 px tall in the header (~54 px on the packing slip) and scales
  down on mobile.
- Use a logo that reads well on a light background (cream header / white packing slip).

Until you add `logo.png`, the site automatically falls back to the "✦ Zemiki"
text wordmark, so nothing looks broken.

To use a different filename or an SVG, change the `src="/assets/logo.png"` line
in `public/js/layout.js`.
