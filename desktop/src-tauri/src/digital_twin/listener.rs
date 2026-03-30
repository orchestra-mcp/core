// Digital Twin — Mail Listener
//
// Checks macOS Mail.app for recent unread messages via AppleScript.

use super::Alert;
use uuid::Uuid;

/// Check for new unread mail messages.
#[cfg(target_os = "macos")]
pub fn check_mail() -> Result<Vec<Alert>, String> {
    use std::process::Command;

    let script = r#"
        tell application "Mail"
            set alerts to {}
            try
                set unreadMsgs to (messages of inbox whose read status is false)
                set msgCount to count of unreadMsgs
                if msgCount > 10 then set msgCount to 10

                repeat with i from 1 to msgCount
                    set msg to item i of unreadMsgs
                    set msgSubject to subject of msg
                    set msgSender to sender of msg
                    set msgDate to date received of msg as string
                    set msgPreview to ""
                    try
                        set msgPreview to content of msg
                        if length of msgPreview > 200 then
                            set msgPreview to text 1 thru 200 of msgPreview
                        end if
                    end try
                    set end of alerts to msgSubject & "|||" & msgSender & "|||" & msgDate & "|||" & msgPreview
                end repeat
            end try
            return alerts
        end tell
    "#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Mail check failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut alerts = Vec::new();

    for line in stdout.split(", ") {
        let parts: Vec<&str> = line.split("|||").collect();
        if parts.len() >= 3 {
            let subject = parts[0].trim();
            let sender = parts[1].trim();
            let date = parts[2].trim();
            let preview = if parts.len() > 3 { parts[3].trim() } else { "" };

            // Create stable ID from subject + sender + date
            let _id_source = format!("{}-{}-{}", subject, sender, date);
            let id = format!("mail-{}", Uuid::new_v4());

            alerts.push(Alert {
                id,
                source: "mail".to_string(),
                title: subject.to_string(),
                body: preview.to_string(),
                sender: sender.to_string(),
                timestamp: date.to_string(),
                is_read: false,
                priority: classify_priority(subject, sender),
            });
        }
    }

    Ok(alerts)
}

#[cfg(not(target_os = "macos"))]
pub fn check_mail() -> Result<Vec<Alert>, String> {
    Ok(Vec::new()) // No mail integration on non-macOS
}

/// Simple priority classification based on keywords.
fn classify_priority(subject: &str, sender: &str) -> String {
    let s = subject.to_lowercase();
    let from = sender.to_lowercase();

    if s.contains("urgent") || s.contains("critical") || s.contains("emergency")
        || s.contains("action required") || s.contains("security alert") {
        "high".to_string()
    } else if from.contains("github") || from.contains("stripe") || from.contains("aws")
        || from.contains("google") || from.contains("anthropic") || s.contains("expir") {
        "medium".to_string()
    } else {
        "low".to_string()
    }
}
