# Orchestra Desktop — Icon Specification

## Overview

Orchestra Desktop uses a multi-ring "O with diagonal slash" logo mark (similar to a stylized null/prohibition symbol). The icon features a purple-to-cyan gradient across three concentric broken rings with a diagonal bar.

## Source Assets

All source assets live in `/arts/`:

| File | Size | Description |
|------|------|-------------|
| `appicon.png` | 1024x1024 | Gradient logo, **transparent background** (primary source) |
| `logo.svg` | 725x725 | Full gradient SVG (Illustrator source) |
| `black.svg` | 725x725 | Monochrome black SVG |
| `blue.svg` | 725x725 | Monochrome cyan (#00E5FF) SVG |
| `purpul.svg` | 725x725 | Monochrome purple (#A900FF) SVG |
| `tray.svg` | 164x164 | Compact monochrome SVG (for menu bar) |
| `AppIcon.iconset/` | various | macOS iconset folder |
| `AppIcon.icns` | all sizes | macOS .icns bundle |

## Generated Icon Files

All generated icons live in `/desktop/src-tauri/icons/`:

### App Icon (Liquid Glass / macOS Tahoe Ready)

| File | Size (px) | Format | Purpose |
|------|-----------|--------|---------|
| `icon.png` | 1024x1024 | PNG, RGBA | Main app icon (transparent bg) |
| `icon.icns` | 16-1024 | ICNS | macOS app bundle icon |
| `icon.ico` | 16-256 | ICO | Windows app icon |
| `icon-dark.png` | 1024x1024 | PNG, RGBA | Dark mode variant |
| `32x32.png` | 32x32 | PNG, RGBA | Tauri required size |
| `128x128.png` | 128x128 | PNG, RGBA | Tauri required size |
| `128x128@2x.png` | 256x256 | PNG, RGBA | Retina @2x of 128 |

### Tray Icon (macOS Template Image)

| File | Size (px) | Format | Purpose |
|------|-----------|--------|---------|
| `trayTemplate.png` | 22x22 | PNG, black+alpha | Menu bar @1x |
| `trayTemplate@2x.png` | 44x44 | PNG, black+alpha | Menu bar @2x (Retina) |

## Apple Icon Requirements

### Liquid Glass (macOS Tahoe / macOS 26)

macOS Tahoe introduces "liquid glass" for app icons. Requirements:

1. **Transparent background** — macOS composites a frosted glass effect behind the icon
2. **Foreground only** — provide only the logo mark, no background shape/circle
3. **Bold, simple symbol** — the icon should read clearly through frosted glass
4. **~15% padding** — center the mark with padding so macOS can frame it
5. **Clean alpha channel** — no semi-transparent halos around edges

The `appicon.png` source file already meets these requirements: the gradient logo sits on a fully transparent background.

### Dark / Light / Tinted Modes (macOS Sequoia+)

macOS supports three icon appearances:

- **Light** (default): Standard icon on light backgrounds
- **Dark**: Icon variant for dark mode (can have different colors/contrast)
- **Tinted**: Auto-generated from a single-layer grayscale icon

For Tauri apps, the main `icon.png` (gradient on transparent) works for both light and dark modes because the purple-to-cyan gradient has sufficient contrast against any background.

For native Xcode Asset Catalog integration (future), you would create:

```
Assets.xcassets/
  AppIcon.appiconset/
    Contents.json          # References all variants
    icon-light-1024.png    # Light mode icon
    icon-dark-1024.png     # Dark mode icon
```

### .icns Bundle Sizes

The `icon.icns` file must contain these sizes:

| Name | Pixel Size | Point Size |
|------|-----------|------------|
| `icon_16x16.png` | 16x16 | 16pt @1x |
| `icon_16x16@2x.png` | 32x32 | 16pt @2x |
| `icon_32x32.png` | 32x32 | 32pt @1x |
| `icon_32x32@2x.png` | 64x64 | 32pt @2x |
| `icon_128x128.png` | 128x128 | 128pt @1x |
| `icon_128x128@2x.png` | 256x256 | 128pt @2x |
| `icon_256x256.png` | 256x256 | 256pt @1x |
| `icon_256x256@2x.png` | 512x512 | 256pt @2x |
| `icon_512x512.png` | 512x512 | 512pt @1x |
| `icon_512x512@2x.png` | 1024x1024 | 512pt @2x |

### Tray / Menu Bar Icon (Template Image)

macOS menu bar icons MUST be **template images**:

- **Single color**: Black (`#000000`) pixels with alpha channel for shading
- **Transparent background**: Alpha = 0 for background areas
- **Size**: 22x22 points (@1x), 44x44 pixels (@2x)
- **Naming**: Must contain "Template" in filename (e.g., `trayTemplate.png`)

macOS automatically adapts template images:
- **Light menu bar**: Icon appears dark
- **Dark menu bar**: Icon appears white (automatically inverted)
- **Vibrancy**: System blends icon with background

**Never use colored icons for the tray** — they look out of place and don't adapt to the menu bar appearance.

## Regenerating Icons

Run the generation script from the project root:

```bash
cd desktop
bash scripts/generate-icons.sh
```

### Requirements

- **macOS** (for `sips` and `iconutil`)
- **ImageMagick** (`brew install imagemagick`) for ICO generation and SVG rendering

### Manual Commands

If you need to regenerate individual assets:

```bash
# Generate .icns from iconset
iconutil -c icns arts/AppIcon.iconset -o desktop/src-tauri/icons/icon.icns

# Resize PNG with sips
sips -z 128 128 arts/appicon.png --out desktop/src-tauri/icons/128x128.png

# Generate ICO with ImageMagick
magick arts/appicon.png \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 desktop/src-tauri/icons/icon.ico

# Generate template tray icon from SVG
magick -background none -density 300 arts/tray.svg \
  -resize 22x22 -gravity center -extent 22x22 \
  -alpha set -channel RGB -evaluate set 0 +channel \
  desktop/src-tauri/icons/trayTemplate.png
```

## Tauri Configuration

In `tauri.conf.json`:

```json
{
  "app": {
    "trayIcon": {
      "id": "orchestra-tray",
      "iconPath": "icons/trayTemplate.png",
      "iconAsTemplate": true
    }
  },
  "bundle": {
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico",
      "icons/icon.png"
    ]
  }
}
```

Key settings:
- `iconAsTemplate: true` tells Tauri to treat the tray icon as a macOS template image
- The `bundle.icon` array lists all icons Tauri uses when creating app bundles
- Tauri's bundler selects the appropriate icon per platform (`.icns` for macOS, `.ico` for Windows)

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Cyan | `#00E5FF` | Gradient end, accent |
| Purple | `#A900FF` | Gradient start, accent |
| Gradient | `#A900FF` to `#00E5FF` | Primary logo gradient |
| Black | `#000000` | Monochrome / template |
