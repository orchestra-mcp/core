# Notification Sounds

Place custom notification sounds here. Supported formats: MP3, WAV, OGG, AIFF

## Expected Files

| File           | Event                | Fallback                          |
| -------------- | -------------------- | --------------------------------- |
| `started.mp3`  | Task started         | macOS: Glass, Windows: chimes.wav |
| `finished.mp3` | Task completed       | macOS: Glass, Windows: chimes.wav |
| `updated.mp3`  | Task updated         | macOS: Glass, Windows: chimes.wav |
| `default.mp3`  | Default notification | macOS: Glass, Windows: chimes.wav |

## macOS System Sounds

You can also use these system sound names directly:

- Basso, Blow, Bottle, Frog, Funk, Glass, Hero
- Morse, Ping, Pop, Purr, Sosumi, Submarine, Tink

## Notes

- If custom sounds are not found, the app falls back to system sounds
- On macOS, sounds are played using `afplay`
- On Windows, sounds are played using PowerShell Media.SoundPlayer
- On Linux, sounds are played using `paplay` or `aplay`
