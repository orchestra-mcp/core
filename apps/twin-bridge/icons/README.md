# Icons

Orchestra Twin Bridge icons — 3 sizes required for Chrome MV3.

## Required Files

- `icon-16.png` — 16×16 toolbar icon
- `icon-48.png` — 48×48 extension manager icon
- `icon-128.png` — 128×128 Chrome Web Store icon

## Design Spec

- Background: #7C3AED (Orchestra purple)
- Symbol: White "O" or circuit/bridge motif
- Corner radius: ~20% for rounded square feel

## Placeholder

The SVG source below can be rasterized to generate PNG placeholders:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#7C3AED"/>
  <circle cx="64" cy="64" r="32" fill="none" stroke="white" stroke-width="10"/>
  <line x1="32" y1="64" x2="96" y2="64" stroke="white" stroke-width="8"/>
  <circle cx="32" cy="64" r="8" fill="white"/>
  <circle cx="96" cy="64" r="8" fill="white"/>
</svg>
```

## Generating PNGs

```bash
# Using Inkscape:
inkscape icon.svg --export-png=icon-128.png --export-width=128
inkscape icon.svg --export-png=icon-48.png  --export-width=48
inkscape icon.svg --export-png=icon-16.png  --export-width=16

# Using ImageMagick:
convert -background none icon.svg -resize 128x128 icon-128.png
convert -background none icon.svg -resize 48x48  icon-48.png
convert -background none icon.svg -resize 16x16  icon-16.png
```
