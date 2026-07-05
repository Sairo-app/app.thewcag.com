use std::collections::HashMap;
use std::sync::Mutex;

pub struct OverlayPayload {
    pub png: Vec<u8>,
    /// "pair" | "fg" | "bg" | "shot"
    pub mode: String,
    /// physical-pixels-per-logical-point of the captured monitor
    pub scale: f32,
}

#[derive(Default)]
pub struct AppState {
    /// one frozen frame per overlay window, keyed by window label
    pub overlays: Mutex<HashMap<String, OverlayPayload>>,
    pub annotation: Mutex<Option<Vec<u8>>>,
}
