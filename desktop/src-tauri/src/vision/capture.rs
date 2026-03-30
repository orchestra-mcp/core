// Vision: Screen Capture — cross-platform implementation using xcap

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CaptureRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureResult {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DisplayInfo {
    pub id: u32,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_main: bool,
}

/// Encode an RgbaImage to PNG bytes wrapped in a CaptureResult.
fn encode_rgba_image(img: &image::RgbaImage) -> Result<CaptureResult, String> {
    use image::ImageEncoder;
    use std::io::Cursor;

    let width = img.width();
    let height = img.height();

    let mut png_bytes = Vec::new();
    {
        let encoder = image::codecs::png::PngEncoder::new(Cursor::new(&mut png_bytes));
        encoder
            .write_image(img.as_raw(), width, height, image::ExtendedColorType::Rgba8)
            .map_err(|e| format!("PNG encode failed: {}", e))?;
    }

    Ok(CaptureResult {
        width,
        height,
        data: png_bytes,
        format: "png".to_string(),
    })
}

/// Capture ALL displays composited into one image (captures the primary monitor).
pub fn capture_screen() -> Result<CaptureResult, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;

    // Find the primary monitor, or fall back to the first one
    let monitor = monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| monitors.first())
        .ok_or_else(|| "No monitors found".to_string())?;

    let img = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    encode_rgba_image(&img)
}

/// List all active displays with their bounds
pub fn list_displays() -> Result<Vec<DisplayInfo>, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;

    let mut result = Vec::new();
    for monitor in &monitors {
        let id = monitor.id().unwrap_or(0);
        let x = monitor.x().unwrap_or(0) as f64;
        let y = monitor.y().unwrap_or(0) as f64;
        let width = monitor.width().unwrap_or(0) as f64;
        let height = monitor.height().unwrap_or(0) as f64;
        let is_main = monitor.is_primary().unwrap_or(false);
        result.push(DisplayInfo {
            id,
            x,
            y,
            width,
            height,
            is_main,
        });
    }
    Ok(result)
}

/// Capture a specific display by ID
pub fn capture_display(display_id: u32) -> Result<CaptureResult, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;

    let monitor = monitors
        .iter()
        .find(|m| m.id().unwrap_or(0) == display_id)
        .ok_or_else(|| format!("Monitor with id {} not found", display_id))?;

    let img = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture display {}: {}", display_id, e))?;

    encode_rgba_image(&img)
}

/// Capture a specific region in global coordinates
pub fn capture_region(region: &CaptureRegion) -> Result<CaptureResult, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;

    // Find which monitor contains this region
    for monitor in &monitors {
        let mon_x = monitor.x().unwrap_or(0) as f64;
        let mon_y = monitor.y().unwrap_or(0) as f64;
        let mon_w = monitor.width().unwrap_or(0) as f64;
        let mon_h = monitor.height().unwrap_or(0) as f64;

        if region.x >= mon_x
            && region.x < mon_x + mon_w
            && region.y >= mon_y
            && region.y < mon_y + mon_h
        {
            // Convert to monitor-local coordinates
            let local_x = (region.x - mon_x) as u32;
            let local_y = (region.y - mon_y) as u32;
            let w = region.width as u32;
            let h = region.height as u32;

            let img = monitor
                .capture_region(local_x, local_y, w, h)
                .map_err(|e| format!("Failed to capture region: {}", e))?;

            return encode_rgba_image(&img);
        }
    }

    // Fallback: capture from primary monitor with raw coordinates
    let monitor = monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| monitors.first())
        .ok_or_else(|| "No monitors found".to_string())?;

    let img = monitor
        .capture_region(
            region.x as u32,
            region.y as u32,
            region.width as u32,
            region.height as u32,
        )
        .map_err(|e| format!("Failed to capture region on primary display: {}", e))?;

    encode_rgba_image(&img)
}

/// Compress a CaptureResult by downscaling (if wider than max_width) and converting to JPEG.
/// - `max_width`: maximum pixel width; images narrower than this are not upscaled.
/// - `quality`: JPEG quality 1-100 (70 is a good default for MCP screenshots).
pub fn compress_capture(
    result: CaptureResult,
    max_width: u32,
    quality: u8,
) -> Result<CaptureResult, String> {
    use image::ImageReader;
    use std::io::Cursor;

    // Load the PNG bytes into a DynamicImage
    let img = ImageReader::new(Cursor::new(&result.data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to guess image format: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image for compression: {}", e))?;

    let (w, h) = (img.width(), img.height());

    // Resize only if wider than max_width, maintaining aspect ratio
    let img = if w > max_width {
        let new_height = (h as f64 * max_width as f64 / w as f64).round() as u32;
        image::DynamicImage::ImageRgba8(image::imageops::resize(
            &img,
            max_width,
            new_height,
            image::imageops::FilterType::Lanczos3,
        ))
    } else {
        img
    };

    // Encode as JPEG
    let mut jpeg_bytes: Vec<u8> = Vec::new();
    {
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
        use image::ImageEncoder;
        encoder
            .write_image(
                img.to_rgb8().as_raw(),
                img.width(),
                img.height(),
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| format!("JPEG encode failed: {}", e))?;
    }

    Ok(CaptureResult {
        width: img.width(),
        height: img.height(),
        data: jpeg_bytes,
        format: "jpeg".to_string(),
    })
}
