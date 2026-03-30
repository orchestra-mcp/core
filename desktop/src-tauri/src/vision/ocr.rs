// Vision: OCR — macOS Vision framework text recognition via Swift bridge
//
// Uses Apple's VNRecognizeTextRequest (Vision framework) for accurate,
// offline OCR. The Swift code is invoked via `swift` CLI to avoid FFI
// complexity while still getting native-quality text recognition.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TextMatch {
    /// The recognized text string
    pub text: String,
    /// Bounding box X origin (normalized 0.0–1.0, bottom-left origin)
    pub x: f64,
    /// Bounding box Y origin (normalized 0.0–1.0, bottom-left origin)
    pub y: f64,
    /// Bounding box width (normalized 0.0–1.0)
    pub width: f64,
    /// Bounding box height (normalized 0.0–1.0)
    pub height: f64,
    /// Recognition confidence (0.0–1.0)
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrResult {
    /// All recognized text concatenated with newlines
    pub full_text: String,
    /// Individual text observations with bounding boxes
    pub matches: Vec<TextMatch>,
}

#[cfg(target_os = "macos")]
pub mod macos {
    use super::*;
    use std::io::Write;
    use std::process::Command;

    /// Swift source that uses VNRecognizeTextRequest to extract text from an image file.
    /// Output format: one line per observation, tab-separated:
    ///   text\tx\ty\twidth\theight\tconfidence
    ///
    /// The bounding box coordinates are in Vision's normalized coordinate system:
    ///   origin = bottom-left, values 0.0–1.0 relative to image dimensions.
    const SWIFT_OCR_SOURCE: &str = r#"
import Foundation
import Vision
import CoreGraphics
import ImageIO

// Read image from file path passed as first argument
let args = CommandLine.arguments
guard args.count > 1 else {
    fputs("Usage: ocr_bridge <image_path>\n", stderr)
    exit(1)
}
let imagePath = args[1]
let imageURL = URL(fileURLWithPath: imagePath)

guard let dataProvider = CGDataProvider(url: imageURL as CFURL),
      let cgImage = CGImage(
          pngDataProviderSource: dataProvider,
          decode: nil,
          shouldInterpolate: true,
          intent: .defaultIntent
      ) else {
    // Try JPEG fallback via ImageIO
    guard let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
          let cgImageFallback = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        fputs("Error: Could not load image from \(imagePath)\n", stderr)
        exit(1)
    }
    // Use fallback image
    performOCR(on: cgImageFallback)
    exit(0)
}

performOCR(on: cgImage)

func performOCR(on image: CGImage) {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        fputs("Error: OCR failed — \(error.localizedDescription)\n", stderr)
        exit(1)
    }

    guard let observations = request.results else {
        // No text found — exit cleanly with no output
        exit(0)
    }

    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let box = observation.boundingBox
        let text = candidate.string
            .replacingOccurrences(of: "\t", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        let confidence = candidate.confidence
        print("\(text)\t\(box.origin.x)\t\(box.origin.y)\t\(box.width)\t\(box.height)\t\(confidence)")
    }
}
"#;

    /// Compile the Swift OCR helper once and cache the binary path.
    /// Returns the path to the compiled binary in the system temp directory.
    fn compile_ocr_bridge() -> Result<std::path::PathBuf, String> {
        let binary_path = std::env::temp_dir().join("orchestra_ocr_bridge");

        // Skip recompilation if binary already exists and is recent (within this session)
        if binary_path.exists() {
            if let Ok(metadata) = std::fs::metadata(&binary_path) {
                if let Ok(modified) = metadata.modified() {
                    if modified.elapsed().unwrap_or_default().as_secs() < 86400 {
                        return Ok(binary_path);
                    }
                }
            }
        }

        // Write Swift source to temp file
        let swift_path = std::env::temp_dir().join("orchestra_ocr_bridge.swift");
        std::fs::write(&swift_path, SWIFT_OCR_SOURCE)
            .map_err(|e| format!("Failed to write Swift source: {}", e))?;

        // Compile with swiftc — link Vision and CoreGraphics frameworks
        let output = Command::new("swiftc")
            .args([
                "-O",
                "-framework", "Vision",
                "-framework", "CoreGraphics",
                "-framework", "ImageIO",
                "-o", binary_path.to_str().unwrap_or("orchestra_ocr_bridge"),
                swift_path.to_str().unwrap_or("orchestra_ocr_bridge.swift"),
            ])
            .output()
            .map_err(|e| format!("Failed to compile Swift OCR bridge: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Swift compilation failed: {}", stderr));
        }

        Ok(binary_path)
    }

    /// Parse the tab-separated output from the Swift OCR bridge
    fn parse_ocr_output(stdout: &str) -> OcrResult {
        let mut matches = Vec::new();
        let mut full_text_parts = Vec::new();

        for line in stdout.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 6 {
                let text = parts[0].to_string();
                full_text_parts.push(text.clone());
                matches.push(TextMatch {
                    text,
                    x: parts[1].parse().unwrap_or(0.0),
                    y: parts[2].parse().unwrap_or(0.0),
                    width: parts[3].parse().unwrap_or(0.0),
                    height: parts[4].parse().unwrap_or(0.0),
                    confidence: parts[5].parse().unwrap_or(0.0),
                });
            }
        }

        OcrResult {
            full_text: full_text_parts.join("\n"),
            matches,
        }
    }

    /// Extract text from PNG image bytes using macOS Vision framework.
    /// The image is written to a temp file, passed to the compiled Swift helper,
    /// and the structured OCR results are returned.
    pub fn ocr_extract(image_data: &[u8]) -> Result<OcrResult, String> {
        // Write image data to a temp file
        let mut tmp = tempfile::NamedTempFile::new()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        tmp.write_all(image_data)
            .map_err(|e| format!("Failed to write image data: {}", e))?;
        tmp.flush()
            .map_err(|e| format!("Failed to flush temp file: {}", e))?;
        let image_path = tmp.path().to_string_lossy().to_string();

        // Compile (or reuse cached) the Swift OCR bridge
        let binary = compile_ocr_bridge()?;

        // Run the OCR bridge
        let output = Command::new(&binary)
            .arg(&image_path)
            .output()
            .map_err(|e| format!("Failed to run OCR bridge: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("OCR bridge failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(parse_ocr_output(&stdout))
    }

    /// Capture a screen region and run OCR on it.
    /// Uses the existing capture module to grab the pixels, then feeds them to OCR.
    pub fn screen_ocr(x: f64, y: f64, w: f64, h: f64) -> Result<OcrResult, String> {
        let region = crate::vision::capture::CaptureRegion {
            x,
            y,
            width: w,
            height: h,
        };
        let capture = crate::vision::capture::capture_region(&region)?;
        ocr_extract(&capture.data)
    }

    /// Capture the full screen and run OCR, returning all recognized text.
    pub fn screen_ocr_full() -> Result<OcrResult, String> {
        let capture = crate::vision::capture::capture_screen()?;
        ocr_extract(&capture.data)
    }

    /// Find occurrences of a text needle on the screen.
    /// Captures the full screen, runs OCR, and returns matches where the
    /// recognized text contains the needle (case-insensitive).
    /// Bounding boxes are converted from Vision normalized coordinates
    /// (bottom-left origin, 0–1) to screen pixel coordinates (top-left origin).
    pub fn screen_find_text(needle: &str) -> Result<Vec<TextMatch>, String> {
        let screen_size = crate::vision::window::get_screen_size();
        let capture = crate::vision::capture::capture_screen()?;
        let ocr = ocr_extract(&capture.data)?;

        let needle_lower = needle.to_lowercase();
        let mut results = Vec::new();

        for m in &ocr.matches {
            if m.text.to_lowercase().contains(&needle_lower) {
                // Convert from Vision normalized coords (bottom-left origin)
                // to screen pixel coords (top-left origin)
                let pixel_x = m.x * screen_size.width;
                let pixel_w = m.width * screen_size.width;
                let pixel_h = m.height * screen_size.height;
                // Vision Y is from bottom; screen Y is from top
                let pixel_y = (1.0 - m.y - m.height) * screen_size.height;

                results.push(TextMatch {
                    text: m.text.clone(),
                    x: pixel_x,
                    y: pixel_y,
                    width: pixel_w,
                    height: pixel_h,
                    confidence: m.confidence,
                });
            }
        }

        Ok(results)
    }
}

// ─── Platform Dispatch ──────────────────────────────────────────────

/// Extract text from PNG image bytes
pub fn ocr_extract(image_data: &[u8]) -> Result<OcrResult, String> {
    #[cfg(target_os = "macos")]
    return macos::ocr_extract(image_data);

    #[cfg(not(target_os = "macos"))]
    Err("OCR not supported on this platform".to_string())
}

/// Capture a screen region and extract text
pub fn screen_ocr(x: f64, y: f64, w: f64, h: f64) -> Result<OcrResult, String> {
    #[cfg(target_os = "macos")]
    return macos::screen_ocr(x, y, w, h);

    #[cfg(not(target_os = "macos"))]
    Err("OCR not supported on this platform".to_string())
}

/// Capture the full screen and extract text
pub fn screen_ocr_full() -> Result<OcrResult, String> {
    #[cfg(target_os = "macos")]
    return macos::screen_ocr_full();

    #[cfg(not(target_os = "macos"))]
    Err("OCR not supported on this platform".to_string())
}

/// Find text on screen — returns pixel-coordinate bounding boxes
pub fn screen_find_text(needle: &str) -> Result<Vec<TextMatch>, String> {
    #[cfg(target_os = "macos")]
    return macos::screen_find_text(needle);

    #[cfg(not(target_os = "macos"))]
    Err("OCR not supported on this platform".to_string())
}
