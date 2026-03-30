# Request: OS Vision + Control Tool (Replace Browser CDP)

**Date**: 2026-03-29 00:10
**Status**: Architecture Discussion Needed
**Priority**: Critical — Core differentiator

## Concept

Replace the browser CDP tools with a full OS vision + control system, inspired by how remote desktop apps (AnyDesk, VNC, RDP) work. The AI gets:

- **Continuous screen capture** (fast frame streaming, not per-request screenshots)
- **Mouse control** (move, click, drag, scroll)
- **Keyboard input** (type, shortcuts, hotkeys)
- **Full OS visibility** (not just browser — can see IDE, terminal, Finder, any app)

## Why This is Better

- CDP only controls Chrome tabs, and loses context between calls
- Remote desktop approach gives the AI the same view as the human
- Works with ANY application (not just browser)
- Persistent connection (no disposable contexts)
- Sub-100ms frame capture (like AnyDesk achieves)

## Architecture Options

### Option 1: Native Screen Capture + Input Injection (Rust)

- Rust binary using platform APIs:
  - macOS: CoreGraphics (CGDisplayCreateImage) + CGEvent for input
  - Linux: X11/Wayland screen grab + XTest for input
  - Windows: DXGI Desktop Duplication + SendInput
- Communicate with Go MCP server via:
  - Unix socket (fastest)
  - gRPC
  - Shared memory + semaphore

### Option 2: VNC Protocol

- Run a VNC server on the user's machine
- MCP server connects as VNC client
- RFB protocol handles frame updates + input
- Libraries: libvncclient (C), go-vnc

### Option 3: WebRTC Screen Share

- User's machine runs a WebRTC peer
- MCP server receives the video stream
- DataChannel for input commands
- Lowest latency, handles resolution changes

### Option 4: Hybrid (recommended?)

- Rust binary for native screen capture (fastest)
- Encode frames as JPEG/WebP (quality vs speed tradeoff)
- Stream to Go MCP server via Unix socket
- Go server exposes MCP tools: screen_capture, mouse_click, keyboard_type, etc.

## MCP Tools (replacing browser\_\*)

- `screen_capture` — capture current screen (or region) as image
- `screen_stream_start` — start continuous frame capture
- `screen_stream_stop` — stop streaming
- `mouse_move` — move cursor to x,y
- `mouse_click` — click at x,y (left/right/double)
- `mouse_drag` — drag from x1,y1 to x2,y2
- `mouse_scroll` — scroll at position
- `keyboard_type` — type text
- `keyboard_shortcut` — press key combo (cmd+c, ctrl+alt+del, etc.)
- `screen_ocr` — extract text from screen region (using Tesseract or native OCR)
- `screen_find` — find UI element by text/image template matching

## Performance Targets

- Screen capture: <50ms per frame
- Input injection: <10ms latency
- Frame streaming: 10-30 FPS for continuous monitoring

## Questions for Discussion

1. Which option for screen capture? (Native APIs vs VNC vs WebRTC)
2. Rust binary or Go with CGo?
3. How to handle multi-monitor setups?
4. Privacy/security: how to limit what the AI can see/control?
5. How does this integrate with the MCP protocol? (binary image data in tool responses?)
6. Should this be a separate standalone binary (like orchestra-browser) or built into the MCP server?
