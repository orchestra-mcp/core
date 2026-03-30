// Provider: Apple Intelligence (macOS only)
//
// Uses macOS Foundation Models framework via swift CLI for free on-device inference.
// Suitable for small tasks: summaries, text processing, classification.
// Only available on macOS with Apple Silicon.

use super::{AgentSpawnConfig, ProviderAdapter};
use std::process::{Command, Child};

pub struct Apple;

impl ProviderAdapter for Apple {
    fn spawn(config: &AgentSpawnConfig) -> Result<Child, String> {
        #[cfg(target_os = "macos")]
        {
            // Use swift to call Foundation Models framework
            // This requires macOS 26+ with Apple Intelligence enabled
            let swift_code = format!(r#"
import Foundation
import FoundationModels

let session = LanguageModelSession()
let prompt = """
{system_prompt}

Task: {instruction}
"""

Task {{
    do {{
        let response = try await session.respond(to: prompt)
        print(response.content)
    }} catch {{
        fputs("Error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }}
}}

RunLoop.main.run()
"#,
                system_prompt = config.system_prompt.replace('"', "\\\""),
                instruction = config.instruction.replace('"', "\\\""),
            );

            // Write swift code to temp file
            let temp_dir = std::env::temp_dir();
            let swift_file = temp_dir.join(format!("orch_apple_{}.swift", uuid::Uuid::new_v4()));
            std::fs::write(&swift_file, &swift_code)
                .map_err(|e| format!("Failed to write Swift file: {}", e))?;

            let child = Command::new("swift")
                .arg(swift_file.to_string_lossy().to_string())
                .current_dir(&config.workspace)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn Apple Intelligence: {}", e))?;

            Ok(child)
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = config;
            Err("Apple Intelligence is only available on macOS".to_string())
        }
    }

    fn name() -> &'static str {
        "apple"
    }
}
