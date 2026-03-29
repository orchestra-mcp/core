use reqwest::Client;
use serde_json::Value;

/// PostgREST client for Supabase database operations.
///
/// Provides typed CRUD helpers that translate into PostgREST HTTP calls
/// against the `/rest/v1` endpoint.
pub struct SupabaseDB {
    client: Client,
    url: String,
    key: String,
    /// Optional bearer token for RLS-authenticated requests.
    access_token: Option<String>,
}

impl SupabaseDB {
    /// Create a new database client.
    ///
    /// * `url` - Supabase project URL (e.g. `https://xyz.supabase.co`)
    /// * `key` - Supabase API key (anon or service-role)
    pub fn new(url: &str, key: &str) -> Self {
        Self {
            client: Client::new(),
            url: url.trim_end_matches('/').to_string(),
            key: key.to_string(),
            access_token: None,
        }
    }

    /// Set a bearer token for authenticated (RLS-aware) requests.
    pub fn set_access_token(&mut self, token: &str) {
        self.access_token = Some(token.to_string());
    }

    /// Clear the bearer token, reverting to anon-key-only requests.
    pub fn clear_access_token(&mut self) {
        self.access_token = None;
    }

    /// Build the common headers shared by every request.
    fn request_headers(&self) -> Vec<(&str, String)> {
        let mut headers: Vec<(&str, String)> = vec![
            ("apikey", self.key.clone()),
            ("Content-Type", "application/json"),
        ];

        // If we have a user access token, use it for Authorization (RLS).
        // Otherwise fall back to the API key itself.
        let auth_value = match &self.access_token {
            Some(token) => format!("Bearer {token}"),
            None => format!("Bearer {}", self.key),
        };
        headers.push(("Authorization", auth_value));

        headers
    }

    /// SELECT rows from a table.
    ///
    /// * `table`   - Table name
    /// * `columns` - PostgREST select expression (e.g. `"*"`, `"id,name"`, `"*, projects(*)"`)
    /// * `filters` - Slice of `(column, filter_expr)` pairs using PostgREST operators
    ///               (e.g. `[("status", "eq.active"), ("age", "gte.18")]`)
    ///
    /// Returns the JSON array of matching rows.
    pub async fn select(
        &self,
        table: &str,
        columns: &str,
        filters: &[(&str, &str)],
    ) -> Result<Value, String> {
        let mut url = format!("{}/rest/v1/{table}?select={columns}", self.url);

        for (col, expr) in filters {
            url.push_str(&format!("&{col}={expr}"));
        }

        let mut req = self.client.get(&url);
        for (name, value) in self.request_headers() {
            req = req.header(name, value);
        }

        let response = req
            .send()
            .await
            .map_err(|e| format!("select request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("select failed ({status}): {body}"));
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| format!("select: failed to parse response: {e}"))
    }

    /// INSERT one or more rows into a table.
    ///
    /// * `data` - A JSON object (single row) or JSON array (multiple rows).
    ///
    /// Returns the inserted rows (with server-generated columns).
    pub async fn insert(&self, table: &str, data: &Value) -> Result<Value, String> {
        let url = format!("{}/rest/v1/{table}", self.url);

        let mut req = self.client.post(&url);
        for (name, value) in self.request_headers() {
            req = req.header(name, value);
        }
        // Ask PostgREST to return the created rows.
        req = req.header("Prefer", "return=representation");
        req = req.json(data);

        let response = req
            .send()
            .await
            .map_err(|e| format!("insert request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("insert failed ({status}): {body}"));
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| format!("insert: failed to parse response: {e}"))
    }

    /// UPDATE rows matching the given filters.
    ///
    /// * `filters` - At least one filter is required to avoid accidental full-table updates.
    /// * `data`    - JSON object with columns to update.
    ///
    /// Returns the updated rows.
    pub async fn update(
        &self,
        table: &str,
        filters: &[(&str, &str)],
        data: &Value,
    ) -> Result<Value, String> {
        if filters.is_empty() {
            return Err("update requires at least one filter to prevent full-table updates".into());
        }

        let mut url = format!("{}/rest/v1/{table}?", self.url);
        let filter_params: Vec<String> = filters
            .iter()
            .map(|(col, expr)| format!("{col}={expr}"))
            .collect();
        url.push_str(&filter_params.join("&"));

        let mut req = self.client.patch(&url);
        for (name, value) in self.request_headers() {
            req = req.header(name, value);
        }
        req = req.header("Prefer", "return=representation");
        req = req.json(data);

        let response = req
            .send()
            .await
            .map_err(|e| format!("update request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("update failed ({status}): {body}"));
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| format!("update: failed to parse response: {e}"))
    }

    /// DELETE rows matching the given filters.
    ///
    /// * `filters` - At least one filter is required to avoid accidental full-table deletes.
    pub async fn delete(&self, table: &str, filters: &[(&str, &str)]) -> Result<(), String> {
        if filters.is_empty() {
            return Err("delete requires at least one filter to prevent full-table deletes".into());
        }

        let mut url = format!("{}/rest/v1/{table}?", self.url);
        let filter_params: Vec<String> = filters
            .iter()
            .map(|(col, expr)| format!("{col}={expr}"))
            .collect();
        url.push_str(&filter_params.join("&"));

        let mut req = self.client.delete(&url);
        for (name, value) in self.request_headers() {
            req = req.header(name, value);
        }

        let response = req
            .send()
            .await
            .map_err(|e| format!("delete request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("delete failed ({status}): {body}"));
        }

        Ok(())
    }

    /// Call a Postgres function (RPC) via PostgREST.
    ///
    /// * `function` - The function name (must be exposed through the API schema).
    /// * `params`   - JSON object of named parameters.
    ///
    /// Returns the function's JSON result.
    pub async fn rpc(&self, function: &str, params: &Value) -> Result<Value, String> {
        let url = format!("{}/rest/v1/rpc/{function}", self.url);

        let mut req = self.client.post(&url);
        for (name, value) in self.request_headers() {
            req = req.header(name, value);
        }
        req = req.json(params);

        let response = req
            .send()
            .await
            .map_err(|e| format!("rpc request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("rpc '{function}' failed ({status}): {body}"));
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| format!("rpc: failed to parse response: {e}"))
    }
}
