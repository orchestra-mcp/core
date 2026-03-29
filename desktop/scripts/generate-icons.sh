#!/usr/bin/env bash
# ============================================================================
# Orchestra Desktop — Icon Generation Script
# ============================================================================
# Generates all macOS/Windows/Linux icon assets from the source logo.
#
# Requirements:
#   - macOS (for sips, iconutil)
#   - ImageMagick (brew install imagemagick) — for ICO and advanced compositing
#
# Usage:
#   cd desktop && bash scripts/generate-icons.sh
#
# Source assets (from arts/):
#   - appicon.png  — 1024x1024 gradient logo on TRANSPARENT background (liquid glass ready)
#   - black.svg    — Black monochrome logo (for dark mode tray)
#   - tray.svg     — Compact monochrome logo (for menu bar)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DESKTOP_DIR")"
ARTS_DIR="$PROJECT_ROOT/arts"
ICONS_DIR="$DESKTOP_DIR/src-tauri/icons"

# Source files
SRC_APPICON="$ARTS_DIR/appicon.png"     # 1024x1024, transparent bg, gradient logo
SRC_TRAY_SVG="$ARTS_DIR/tray.svg"       # Monochrome logo SVG
SRC_BLACK_SVG="$ARTS_DIR/black.svg"     # Black monochrome SVG

# Temp directory
TMPDIR_ICONS=$(mktemp -d)
trap 'rm -rf "$TMPDIR_ICONS"' EXIT

echo "=== Orchestra Desktop Icon Generator ==="
echo "Source: $SRC_APPICON"
echo "Output: $ICONS_DIR"
echo ""

# ============================================================================
# 1. APP ICON — Transparent background for Liquid Glass (macOS Tahoe)
# ============================================================================
# Apple's liquid glass effect requires:
#   - Transparent background (alpha channel)
#   - Logo mark only, centered with ~15% padding
#   - Clean edges, no background shapes
#
# The appicon.png from arts/ already meets these requirements.
# ============================================================================

echo "--- Generating app icon PNGs (transparent background for liquid glass) ---"

# The source appicon.png is already transparent-background with the gradient logo.
# Generate all needed sizes from it.

# Standard Tauri icon sizes
SIZES=(16 32 64 128 256 512 1024)

for size in "${SIZES[@]}"; do
    echo "  ${size}x${size}"
    sips -z "$size" "$size" "$SRC_APPICON" --out "$TMPDIR_ICONS/icon_${size}x${size}.png" > /dev/null 2>&1
done

# Copy to icons directory — the main icon.png (1024x1024 for Tauri)
cp "$TMPDIR_ICONS/icon_1024x1024.png" "$ICONS_DIR/icon.png"

# Tauri-specific sizes
cp "$TMPDIR_ICONS/icon_32x32.png"   "$ICONS_DIR/32x32.png"
cp "$TMPDIR_ICONS/icon_128x128.png" "$ICONS_DIR/128x128.png"
cp "$TMPDIR_ICONS/icon_256x256.png" "$ICONS_DIR/128x128@2x.png"  # @2x of 128

echo "  Done."
echo ""

# ============================================================================
# 2. macOS .icns FILE — With all required sizes for Retina + Liquid Glass
# ============================================================================
# Apple .icns requires an .iconset folder with specific naming:
#   icon_16x16.png, icon_16x16@2x.png, icon_32x32.png, icon_32x32@2x.png,
#   icon_128x128.png, icon_128x128@2x.png, icon_256x256.png, icon_256x256@2x.png,
#   icon_512x512.png, icon_512x512@2x.png
# ============================================================================

echo "--- Generating macOS .icns ---"

ICONSET_DIR="$TMPDIR_ICONS/AppIcon.iconset"
mkdir -p "$ICONSET_DIR"

# Generate iconset PNGs with correct naming
sips -z 16   16   "$SRC_APPICON" --out "$ICONSET_DIR/icon_16x16.png"      > /dev/null 2>&1
sips -z 32   32   "$SRC_APPICON" --out "$ICONSET_DIR/icon_16x16@2x.png"   > /dev/null 2>&1
sips -z 32   32   "$SRC_APPICON" --out "$ICONSET_DIR/icon_32x32.png"      > /dev/null 2>&1
sips -z 64   64   "$SRC_APPICON" --out "$ICONSET_DIR/icon_32x32@2x.png"   > /dev/null 2>&1
sips -z 128  128  "$SRC_APPICON" --out "$ICONSET_DIR/icon_128x128.png"    > /dev/null 2>&1
sips -z 256  256  "$SRC_APPICON" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null 2>&1
sips -z 256  256  "$SRC_APPICON" --out "$ICONSET_DIR/icon_256x256.png"    > /dev/null 2>&1
sips -z 512  512  "$SRC_APPICON" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null 2>&1
sips -z 512  512  "$SRC_APPICON" --out "$ICONSET_DIR/icon_512x512.png"    > /dev/null 2>&1
sips -z 1024 1024 "$SRC_APPICON" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null 2>&1

# Convert to .icns
iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"

echo "  icon.icns generated with all sizes (16-1024)."
echo ""

# ============================================================================
# 3. DARK MODE APP ICON VARIANT
# ============================================================================
# For macOS Sequoia+ and Tahoe liquid glass, apps can provide dark/light variants.
# We create a dark-mode icon: white logo on transparent background.
# This is done by inverting the black.svg paths to white.
#
# For Tauri, the main icon.png serves both modes (the gradient works on both).
# We generate a dark variant for future use / Asset Catalog integration.
# ============================================================================

echo "--- Generating dark mode icon variant ---"

# The gradient logo on transparent background works well for both light and dark
# modes because the gradient (purple->cyan) has good contrast against both.
# We store the same transparent-bg icon as the dark variant.
# For true dark-mode-specific icon, you'd use a lighter variant.

# Create a "dark mode" icon with slightly brighter/lighter treatment
# Since the gradient logo works on both backgrounds, we use it as-is
cp "$ICONS_DIR/icon.png" "$ICONS_DIR/icon-dark.png"

echo "  icon-dark.png generated."
echo ""

# ============================================================================
# 4. TRAY ICON — macOS Template Image (CRITICAL)
# ============================================================================
# macOS menu bar "template images" MUST be:
#   - Single color: BLACK (#000000) with varying alpha for shading
#   - Transparent background (alpha = 0)
#   - Size: 22x22 points (@1x), 44x44 px (@2x)
#   - Named with "Template" suffix for automatic light/dark adaptation
#
# macOS automatically:
#   - Shows the icon in white on dark menu bars
#   - Shows the icon in dark on light menu bars
#   - Applies vibrancy and other system effects
#
# Using a colored/non-template icon will look out of place in the menu bar.
# ============================================================================

echo "--- Generating tray template icons ---"

# Use ImageMagick to render SVG to proper template PNGs
# The tray.svg is already a monochrome path — we render it as black on transparent
# Detect ImageMagick command (v7 uses "magick", v6 uses "convert")

MAGICK_CMD=""
if command -v magick &> /dev/null; then
    MAGICK_CMD="magick"
elif command -v convert &> /dev/null; then
    MAGICK_CMD="convert"
fi

if [ -n "$MAGICK_CMD" ]; then
    # Render tray icon at @1x (22x22)
    $MAGICK_CMD -background none -density 300 "$SRC_TRAY_SVG" \
        -resize 22x22 -gravity center -extent 22x22 \
        -alpha set -channel RGB -evaluate set 0 +channel \
        "$TMPDIR_ICONS/trayTemplate.png"

    # Render tray icon at @2x (44x44)
    $MAGICK_CMD -background none -density 300 "$SRC_TRAY_SVG" \
        -resize 44x44 -gravity center -extent 44x44 \
        -alpha set -channel RGB -evaluate set 0 +channel \
        "$TMPDIR_ICONS/trayTemplate@2x.png"

    cp "$TMPDIR_ICONS/trayTemplate.png"    "$ICONS_DIR/trayTemplate.png"
    cp "$TMPDIR_ICONS/trayTemplate@2x.png" "$ICONS_DIR/trayTemplate@2x.png"

    echo "  trayTemplate.png (22x22) generated."
    echo "  trayTemplate@2x.png (44x44) generated."
else
    echo "  WARNING: ImageMagick not found. Using sips fallback."
    echo "  Install ImageMagick: brew install imagemagick"

    # Fallback: use the existing tray PNGs from arts/ and ensure correct sizes
    # The arts/tray.png is the monochrome source
    TRAY_SRC="$ARTS_DIR/tray.png"

    sips -z 22 22 "$TRAY_SRC" --out "$ICONS_DIR/trayTemplate.png" > /dev/null 2>&1
    sips -z 44 44 "$TRAY_SRC" --out "$ICONS_DIR/trayTemplate@2x.png" > /dev/null 2>&1

    echo "  trayTemplate.png (22x22) generated from arts/tray.png."
    echo "  trayTemplate@2x.png (44x44) generated from arts/tray.png."
fi

echo ""

# ============================================================================
# 5. WINDOWS .ico FILE
# ============================================================================
# Windows .ico should contain: 16, 24, 32, 48, 64, 128, 256 px sizes
# ============================================================================

echo "--- Generating Windows .ico ---"

if [ -n "$MAGICK_CMD" ]; then
    $MAGICK_CMD "$SRC_APPICON" \
        \( -clone 0 -resize 16x16 \) \
        \( -clone 0 -resize 24x24 \) \
        \( -clone 0 -resize 32x32 \) \
        \( -clone 0 -resize 48x48 \) \
        \( -clone 0 -resize 64x64 \) \
        \( -clone 0 -resize 128x128 \) \
        \( -clone 0 -resize 256x256 \) \
        -delete 0 \
        "$ICONS_DIR/icon.ico"
    echo "  icon.ico generated with 7 sizes."
else
    echo "  WARNING: ImageMagick not found, keeping existing icon.ico."
    echo "  Install ImageMagick: brew install imagemagick"
fi

echo ""

# ============================================================================
# 6. ALSO UPDATE arts/AppIcon.iconset for consistency
# ============================================================================

echo "--- Updating arts/AppIcon.iconset ---"
ARTS_ICONSET="$ARTS_DIR/AppIcon.iconset"
mkdir -p "$ARTS_ICONSET"

cp "$ICONSET_DIR/icon_16x16.png"      "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_16x16@2x.png"   "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_32x32.png"      "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_32x32@2x.png"   "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_128x128.png"    "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_128x128@2x.png" "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_256x256.png"    "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_256x256@2x.png" "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_512x512.png"    "$ARTS_ICONSET/"
cp "$ICONSET_DIR/icon_512x512@2x.png" "$ARTS_ICONSET/"

# Also regenerate arts/AppIcon.icns
iconutil -c icns "$ARTS_ICONSET" -o "$ARTS_DIR/AppIcon.icns"

echo "  arts/AppIcon.iconset updated."
echo "  arts/AppIcon.icns regenerated."
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "=== Generation Complete ==="
echo ""
echo "App Icon (Liquid Glass ready — transparent background):"
echo "  $ICONS_DIR/icon.png          (1024x1024, main icon)"
echo "  $ICONS_DIR/icon.icns         (.icns bundle, 16-1024px)"
echo "  $ICONS_DIR/icon.ico          (Windows, 16-256px)"
echo "  $ICONS_DIR/icon-dark.png     (Dark mode variant)"
echo "  $ICONS_DIR/32x32.png         (32x32)"
echo "  $ICONS_DIR/128x128.png       (128x128)"
echo "  $ICONS_DIR/128x128@2x.png    (256x256, @2x of 128)"
echo ""
echo "Tray Icon (macOS Template Image):"
echo "  $ICONS_DIR/trayTemplate.png      (22x22, black on transparent)"
echo "  $ICONS_DIR/trayTemplate@2x.png   (44x44, black on transparent)"
echo ""
echo "IMPORTANT: Update tauri.conf.json trayIcon.iconPath to 'icons/trayTemplate.png'"
echo ""
