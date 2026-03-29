// Vision: Screen Capture — macOS CoreGraphics implementation

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

#[cfg(target_os = "macos")]
pub mod macos {
    use super::*;
    use core_graphics::display::{
        kCGWindowListOptionOnScreenOnly, CGDisplay, CGWindowListCopyWindowInfo,
    };
    use core_graphics::geometry::CGRect;
    use core_graphics::image::CGImage;
    use core_graphics::window::kCGWindowListOptionAll;
    use std::io::Cursor;

    /// Capture the full main display as PNG bytes
    pub fn capture_screen() -> Result<CaptureResult, String> {
        let display = CGDisplay::main();
        let image = CGDisplay::image(display)
            .ok_or_else(|| "Failed to capture screen via CGDisplay::image".to_string())?;
        encode_cg_image(&image)
    }

    /// Capture a specific region as PNG bytes
    pub fn capture_region(region: &CaptureRegion) -> Result<CaptureResult, String> {
        let cg_rect = CGRect::new(
            &core_graphics::geometry::CGPoint::new(region.x, region.y),
            &core_graphics::geometry::CGSize::new(region.width, region.height),
        );

        let image = unsafe {
            let img_ref = core_graphics::display::CGDisplayCreateImageForRect(
                CGDisplay::main().id,
                cg_rect,
            );
            if img_ref.is_null() {
                return Err("Failed to capture region".to_string());
            }
            CGImage::from_ptr(img_ref)
        };

        encode_cg_image(&image)
    }

    /// Convert a CGImage to PNG bytes
    fn encode_cg_image(image: &CGImage) -> Result<CaptureResult, String> {
        let width = image.width() as u32;
        let height = image.height() as u32;
        let bytes_per_row = image.bytes_per_row();
        let data = image.data();
        let raw_bytes = data.bytes();

        // CGImage is typically BGRA — convert to RGBA for PNG encoding
        let mut rgba = Vec::with_capacity((width * height * 4) as usize);
        for y in 0..height as usize {
            for x in 0..width as usize {
                let offset = y * bytes_per_row + x * 4;
                if offset + 3 < raw_bytes.len() {
                    rgba.push(raw_bytes[offset + 2]); // R (from B)
                    rgba.push(raw_bytes[offset + 1]); // G
                    rgba.push(raw_bytes[offset]);      // B (from R)
                    rgba.push(raw_bytes[offset + 3]); // A
                }
            }
        }

        // Encode as PNG
        let mut png_bytes = Vec::new();
        {
            let mut encoder = image::codecs::png::PngEncoder::new(Cursor::new(&mut png_bytes));
            use image::ImageEncoder;
            encoder
                .write_image(&rgba, width, height, image::ExtendedColorType::Rgba8)
                .map_err(|e| format!("PNG encode failed: {}", e))?;
        }

        Ok(CaptureResult {
            width,
            height,
            data: png_bytes,
            format: "png".to_string(),
        })
    }
}

// Platform dispatch
pub fn capture_screen() -> Result<CaptureResult, String> {
    #[cfg(target_os = "macos")]
    return macos::capture_screen();

    #[cfg(not(target_os = "macos"))]
    Err("Screen capture not supported on this platform".to_string())
}

pub fn capture_region(region: &CaptureRegion) -> Result<CaptureResult, String> {
    #[cfg(target_os = "macos")]
    return macos::capture_region(region);

    #[cfg(not(target_os = "macos"))]
    Err("Region capture not supported on this platform".to_string())
}
