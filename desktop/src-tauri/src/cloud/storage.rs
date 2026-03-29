use reqwest::Client;

/// Supabase Storage client for file upload, download, and public URL generation.
///
/// Talks to the Supabase Storage API at `/storage/v1/object`.
pub struct SupabaseStorage {
    client: Client,
    url: String,
    key: String,
    /// Optional bearer token for RLS-aware bucket access.
    access_token: Option<String>,
}

impl SupabaseStorage {
    /// Create a new storage client.
    ///
    /// * `url` - Supabase project URL (e.g. `https://xyz.supabase.co`)
    /// * `key` - Supabase API key
    pub fn new(url: &str, key: &str) -> Self {
        Self {
            client: Client::new(),
            url: url.trim_end_matches('/').to_string(),
            key: key.to_string(),
            access_token: None,
        }
    }

    /// Set a user access token for authenticated uploads/downloads.
    pub fn set_access_token(&mut self, token: &str) {
        self.access_token = Some(token.to_string());
    }

    /// Clear the access token.
    pub fn clear_access_token(&mut self) {
        self.access_token = None;
    }

    /// Resolve the Authorization header value.
    fn auth_header(&self) -> String {
        match &self.access_token {
            Some(token) => format!("Bearer {token}"),
            None => format!("Bearer {}", self.key),
        }
    }

    /// Upload a file to a storage bucket.
    ///
    /// * `bucket`       - Bucket name
    /// * `path`         - Object path inside the bucket (e.g. `"avatars/user1.png"`)
    /// * `data`         - Raw file bytes
    /// * `content_type` - MIME type (e.g. `"image/png"`)
    ///
    /// Returns the `Key` string from the Supabase response (the stored object path).
    pub async fn upload(
        &self,
        bucket: &str,
        path: &str,
        data: &[u8],
        content_type: &str,
    ) -> Result<String, String> {
        let url = format!(
            "{}/storage/v1/object/{bucket}/{path}",
            self.url
        );

        let response = self
            .client
            .post(&url)
            .header("apikey", &self.key)
            .header("Authorization", self.auth_header())
            .header("Content-Type", content_type)
            // Upsert so re-uploads overwrite without error.
            .header("x-upsert", "true")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| format!("upload request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("upload failed ({status}): {body}"));
        }

        // Supabase returns `{ "Key": "bucket/path" }`.
        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("upload: failed to parse response: {e}"))?;

        json.get("Key")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "upload: response missing 'Key' field".to_string())
    }

    /// Download a file from a storage bucket.
    ///
    /// * `bucket` - Bucket name
    /// * `path`   - Object path inside the bucket
    ///
    /// Returns the raw file bytes.
    pub async fn download(&self, bucket: &str, path: &str) -> Result<Vec<u8>, String> {
        let url = format!(
            "{}/storage/v1/object/{bucket}/{path}",
            self.url
        );

        let response = self
            .client
            .get(&url)
            .header("apikey", &self.key)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| format!("download request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("download failed ({status}): {body}"));
        }

        response
            .bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("download: failed to read bytes: {e}"))
    }

    /// Remove a file from a storage bucket.
    ///
    /// * `bucket` - Bucket name
    /// * `path`   - Object path inside the bucket
    pub async fn remove(&self, bucket: &str, path: &str) -> Result<(), String> {
        let url = format!(
            "{}/storage/v1/object/{bucket}/{path}",
            self.url
        );

        let response = self
            .client
            .delete(&url)
            .header("apikey", &self.key)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| format!("remove request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("remove failed ({status}): {body}"));
        }

        Ok(())
    }

    /// Get the public URL for an object in a **public** bucket.
    ///
    /// This does NOT make a network request — it constructs the URL deterministically.
    ///
    /// * `bucket` - Public bucket name
    /// * `path`   - Object path inside the bucket
    pub fn get_public_url(&self, bucket: &str, path: &str) -> String {
        format!(
            "{}/storage/v1/object/public/{bucket}/{path}",
            self.url
        )
    }

    /// Generate a signed (time-limited) URL for a **private** object.
    ///
    /// * `bucket`     - Bucket name
    /// * `path`       - Object path
    /// * `expires_in` - Validity duration in seconds
    ///
    /// Returns the full signed URL.
    pub async fn create_signed_url(
        &self,
        bucket: &str,
        path: &str,
        expires_in: u64,
    ) -> Result<String, String> {
        let url = format!(
            "{}/storage/v1/object/sign/{bucket}/{path}",
            self.url
        );

        let body = serde_json::json!({
            "expiresIn": expires_in
        });

        let response = self
            .client
            .post(&url)
            .header("apikey", &self.key)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("create_signed_url request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "unable to read body".into());
            return Err(format!("create_signed_url failed ({status}): {body}"));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("create_signed_url: failed to parse response: {e}"))?;

        let signed_path = json
            .get("signedURL")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "create_signed_url: response missing 'signedURL' field".to_string())?;

        // The response is a relative path — prepend the base URL.
        Ok(format!("{}{signed_path}", self.url))
    }
}
