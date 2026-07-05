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
    pub overlay: Mutex<Option<OverlayPayload>>,
    pub annotation: Mutex<Option<Vec<u8>>>,
}
