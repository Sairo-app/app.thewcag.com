use rand::RngCore;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::state::AppState;

const SITE: &str = "https://accessibility.build";
const KEYCHAIN_SERVICE: &str = "build.accessibility.desktop";
const KEYCHAIN_USER: &str = "device-token";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER).map_err(|e| e.to_string())
}

fn read_token() -> Option<String> {
    entry().ok()?.get_password().ok()
}

fn store_token(token: &str) -> Result<(), String> {
    entry()?.set_password(token).map_err(|e| e.to_string())
}

fn clear_token() {
    if let Ok(e) = entry() {
        let _ = e.delete_credential();
    }
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub signed_in: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credits: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entitlements {
    email: Option<String>,
    credits: Option<i64>,
    plan: Option<String>,
}

/// Open the browser to the site's connect page. The site (Clerk-authed)
/// mints a device token and hands it back via the accessibility-build://
/// deep link, which handle_deep_link stores in the Keychain.
#[tauri::command]
pub fn sign_in(app: AppHandle) -> Result<(), String> {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let state: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
    *app.state::<AppState>().auth_state.lock().unwrap() = Some(state.clone());

    let device = sanitize(&whoami::devicename());
    let url = format!("{SITE}/desktop/connect?state={state}&device={device}");
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sign_out(app: AppHandle) {
    clear_token();
    let _ = app.emit("account-changed", ());
}

#[tauri::command]
pub async fn get_account() -> Result<Account, String> {
    let Some(token) = read_token() else {
        return Ok(Account::default());
    };
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{SITE}/api/desktop/entitlements"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        // token revoked or invalid — forget it so the UI shows signed-out
        clear_token();
        return Ok(Account::default());
    }
    if !resp.status().is_success() {
        // network/site trouble: report signed-out rather than erroring the UI
        return Ok(Account::default());
    }
    let ent: Entitlements = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Account {
        signed_in: true,
        email: ent.email,
        credits: ent.credits,
        plan: ent.plan,
    })
}

/// Handle an incoming accessibility-build://auth?token=..&state=.. URL.
pub fn handle_deep_link(app: &AppHandle, url: &str) {
    let parsed = match url::Url::parse(url) {
        Ok(u) => u,
        Err(_) => return,
    };
    if parsed.host_str() != Some("auth") {
        return;
    }
    let mut token = None;
    let mut state = None;
    for (k, v) in parsed.query_pairs() {
        match k.as_ref() {
            "token" => token = Some(v.into_owned()),
            "state" => state = Some(v.into_owned()),
            _ => {}
        }
    }
    let (token, state) = match (token, state) {
        (Some(t), Some(s)) => (t, s),
        _ => return,
    };

    // Confirm this app initiated the sign-in (guards against a rogue site
    // driving our scheme with an attacker's token).
    let expected = app.state::<AppState>().auth_state.lock().unwrap().take();
    if expected.as_deref() != Some(state.as_str()) {
        return;
    }

    if store_token(&token).is_ok() {
        crate::actions::show_main(app);
        let _ = app.emit("account-changed", ());
    }
}

/// Keep only URL-safe chars for the device name query param.
fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { ' ' })
        .collect();
    cleaned.trim().replace(' ', "%20")
}
