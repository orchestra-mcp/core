<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Saeedvir\Supabase\Facades\Supabase;

/**
 * Supabase Auth service — delegates to the SDK where possible,
 * retains custom methods (admin API, JWT generation) that the SDK
 * does not cover.
 */
class SupabaseAuthService
{
    private string $baseUrl;

    private string $serviceKey;

    private string $jwtSecret;

    public function __construct()
    {
        $this->baseUrl = config('services.supabase.url', 'http://localhost:54321');
        $this->serviceKey = config('services.supabase.service_key', '');
        $this->jwtSecret = config('services.supabase.jwt_secret', '');
    }

    /**
     * Create a user in Supabase GoTrue via the SDK signUp endpoint.
     *
     * Note: The SDK's signUp uses /auth/v1/signup (public endpoint).
     * For admin-level user creation with email_confirm=true we keep
     * the direct HTTP call to /auth/v1/admin/users.
     */
    public function createUser(string $email, string $password, array $metadata = []): ?array
    {
        $response = \Illuminate\Support\Facades\Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Authorization' => 'Bearer '.$this->serviceKey,
            'Content-Type' => 'application/json',
        ])->post(rtrim($this->baseUrl, '/').'/auth/v1/admin/users', [
            'email' => $email,
            'password' => $password,
            'email_confirm' => true,
            'user_metadata' => $metadata,
        ]);

        if ($response->failed()) {
            return null;
        }

        return $response->json();
    }

    /**
     * Generate a Supabase-compatible JWT for a user.
     */
    public function generateJwt(string $userId, string $role = 'authenticated'): string
    {
        $payload = [
            'sub' => $userId,
            'role' => $role,
            'iss' => 'supabase',
            'aud' => 'authenticated',
            'iat' => time(),
            'exp' => time() + 3600, // 1 hour
        ];

        return JWT::encode($payload, $this->jwtSecret, 'HS256');
    }

    /**
     * Sign in a user via the Supabase SDK.
     *
     * Returns the full response (access_token, refresh_token, user, etc.)
     * or null on failure.
     */
    public function signInWithPassword(string $email, string $password): ?array
    {
        $result = Supabase::auth()->signIn($email, $password);

        if (! $result || isset($result['error'])) {
            return null;
        }

        return $result;
    }

    /**
     * Look up a Supabase user by email via the Admin API.
     *
     * Returns the first matching user array, or null if none found.
     */
    public function findUserByEmail(string $email): ?array
    {
        $response = \Illuminate\Support\Facades\Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Authorization' => 'Bearer '.$this->serviceKey,
        ])->get(rtrim($this->baseUrl, '/').'/auth/v1/admin/users');

        if ($response->failed()) {
            return null;
        }

        $users = $response->json('users', []);

        foreach ($users as $user) {
            if (($user['email'] ?? '') === $email) {
                return $user;
            }
        }

        return null;
    }

    /**
     * Delete a user from Supabase GoTrue via the Admin API.
     */
    public function deleteUser(string $supabaseUserId): bool
    {
        $response = \Illuminate\Support\Facades\Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Authorization' => 'Bearer '.$this->serviceKey,
        ])->delete(rtrim($this->baseUrl, '/').'/auth/v1/admin/users/'.$supabaseUserId);

        return $response->successful();
    }

    /**
     * Get user details via the SDK.
     */
    public function getUser(string $accessToken): ?array
    {
        $result = Supabase::auth()->getUser($accessToken);

        if (! $result || isset($result['error'])) {
            return null;
        }

        return $result;
    }

    /**
     * Refresh a session via the SDK.
     */
    public function refreshSession(string $refreshToken): ?array
    {
        $result = Supabase::auth()->refresh($refreshToken);

        if (! $result || isset($result['error'])) {
            return null;
        }

        return $result;
    }
}
