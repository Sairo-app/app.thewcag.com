# Lens capture: CGWindowListCreateImage → ScreenCaptureKit

## Current state

`lens_frame` (src/lens.rs) uses `CGWindowListCreateImage` with
`kCGWindowListOptionOnScreenBelowWindow` — one call returns everything
below the lens window, which is why the lens never sees itself.

Deprecated since macOS 14 but fully functional through macOS 15. Not
urgent for direct distribution; **required** for the Mac App Store build
(sandbox) and eventually for OS compatibility.

## Migration plan

1. Add `objc2-screen-capture-kit` (+ `block2`) to Cargo.
2. At lens-window creation, resolve shareable content once:
   `SCShareableContent.getExcludingDesktopWindows(false, onScreenWindowsOnly: true)`
   — async; bridge with a oneshot channel.
3. Build an `SCContentFilter` with
   `initWithDisplay:excludingWindows:` where the excluded list contains the
   lens window (match by `windowNumber` — already obtained via `ns_window()`).
4. Per frame, call `SCScreenshotManager.captureImageWithFilter:configuration:`
   (macOS 14+) with an `SCStreamConfiguration` whose `sourceRect` is the
   lens rect and `width/height` are the physical pixel size. Alternatively,
   run a persistent `SCStream` at 12fps and read `CMSampleBuffer`s — better
   CPU, more plumbing.
5. Convert the returned `CGImage` exactly as today (BGRA → RGBA header + raw).
6. Runtime-gate: `if #available macOS 14.4` → SCK, else fall back to
   the current CGWindowList path. Keep the wire format identical so the
   frontend doesn't change.

## Acceptance

- Lens shows content below itself with no self-capture feedback on
  macOS 14 and 15
- CPU at default lens size ≤ current implementation
- Works inside App Sandbox with the Screen Recording TCC grant
