use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Supabase GoTrue authentication client.
///
/// Handles sign-up, sign-in (email/password), token refresh, and sign-out
/// against a Supabase GoTrue `/auth/v1` endpoint.
#[derive(Clone)]
pub struct SupabaseAuth {
    client: Client,
    url: String,
    anon_key: String,
    access_token: Option<String>,
    refresh_token: Option<String>,
}

/// Session returned after successful authentication.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub user: AuthUser,
}

/// Authenticated user profile.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
    pub user_metadata: serde_json::Value,
}

/// Credentials payload sent to GoTrue for email/password auth.
#[derive(Serialize)]
struct Credentials {
    email: String,
    password: String,
}

/// Payload sent to GoTrue for token refresh.
#[derive(Serialize)]
struct RefreshPayload {
    refresh_token: String,
}

impl SupabaseAuth {
    /// Create a new auth client.
    ///
    /// * `url`      - Supabase project URL (e.g. `https://xyz.supabase.co`)
    /// * `anon_key` - Supabase anonymous/public API key
    pub fn new(url: &str, anon_key: &str) -> Self {
        Self {
            client: Client::new(),
            url: url.trim_end_matches('/').to_string(),
            anon_key: anon_key.to_string(),
            access_token: None,
            refresh_token: None,
        }
    }

    /// Sign in with email and password.
    ///
    /// On success the internal access/refresh tokens are updated automatically.
    pub async fn sign_in(&mut self, email: &str, password: &str) -> Result<AuthSession, String> {
        let endpoint = format!("{}/auth/v1/token?grant_type=password", self.url);

        let response = self
            .client
            .post(&endpoint)
            .header("apikey", &self.anon_key)
            .header("Content-Type", "application/json")
            .json(&Credentials {
                email: email.to_string(),
                password: password.to_string(),
            })
            .send()
            .await
            .map_err(|e| format!("sign_in request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("sign_in failed ({status}): {body}"));
        }

        let session: AuthSession = response
            .json()
            .await
            .map_err(|e| format!("sign_in: failed to parse response: {e}"))?;

        self.access_token = Some(session.access_token.clone());
        self.refresh_token = Some(session.refresh_token.clone());

        Ok(session)
    }

    /// Create a new account with email and password.
    ///
    /// On success the internal access/refresh tokens are updated automatically.
    pub async fn sign_up(&mut self, email: &str, password: &str) -> Result<AuthSession, String> {
        let endpoint = format!("{}/auth/v1/signup", self.url);

        let response = self
            .client
            .post(&endpoint)
            .header("apikey", &self.anon_key)
            .header("Content-Type", "application/json")
            .json(&Credentials {
                email: email.to_string(),
                password: password.to_string(),
            })
            .send()
            .await
            .map_err(|e| format!("sign_up request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("sign_up failed ({status}): {body}"));
        }

        let session: AuthSession = response
            .json()
            .await
            .map_err(|e| format!("sign_up: failed to parse response: {e}"))?;

        self.access_token = Some(session.access_token.clone());
        self.refresh_token = Some(session.refresh_token.clone());

        Ok(session)
    }

    /// Refresh the current session using the stored refresh token.
    ///
    /// Returns the new session and updates internal tokens.
    pub async fn refresh(&mut self) -> Result<AuthSession, String> {
        let rt = self
            .refresh_token
            .as_ref()
            .ok_or_else(|| "no refresh token available — sign in first".to_string())?
            .clone();

        let endpoint = format!("{}/auth/v1/token?grant_type=refresh_token", self.url);

        let response = self
            .client
            .post(&endpoint)
            .header("apikey", &self.anon_key)
            .header("Content-Type", "application/json")
            .json(&RefreshPayload {
                refresh_token: rt,
            })
            .send()
            .await
            .map_err(|e| format!("refresh request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("refresh failed ({status}): {body}"));
        }

        let session: AuthSession = response
            .json()
            .await
            .map_err(|e| format!("refresh: failed to parse response: {e}"))?;

        self.access_token = Some(session.access_token.clone());
        self.refresh_token = Some(session.refresh_token.clone());

        Ok(session)
    }

    /// Sign out the current user.
    ///
    /// Clears internal tokens regardless of server response.
    pub async fn sign_out(&mut self) -> Result<(), String> {
        let token = self
            .access_token
            .as_ref()
            .ok_or_else(|| "no access token — not signed in".to_string())?
            .clone();

        let endpoint = format!("{}/auth/v1/logout", self.url);

        let response = self
            .client
            .post(&endpoint)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| format!("sign_out request failed: {e}"))?;

        // Clear tokens regardless — the local session is over.
        self.access_token = None;
        self.refresh_token = None;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("sign_out failed ({status}): {body}"));
        }

        Ok(())
    }

    /// Return the current access token, if any.
    pub fn access_token(&self) -> Option<&str> {
        self.access_token.as_deref()
    }

    /// Return the current refresh token, if any.
    pub fn refresh_token(&self) -> Option<&str> {
        self.refresh_token.as_deref()
    }

    /// Convenience: set tokens from an externally-stored session
    /// (e.g. loaded from keychain on app launch).
    pub fn set_tokens(&mut self, access: &str, refresh: &str) {
        self.access_token = Some(access.to_string());
        self.refresh_token = Some(refresh.to_string());
    }
}
