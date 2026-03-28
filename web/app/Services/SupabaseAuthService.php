<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;

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
     * Create a user in Supabase GoTrue via Admin API.
     */
    public function createUser(string $email, string $password, array $metadata = []): ?array
    {
        $response = Http::withHeaders([
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
     * Sign in a user via Supabase GoTrue password grant.
     *
     * Returns the full GoTrue response (access_token, refresh_token, user, etc.)
     * or null on failure.
     */
    public function signInWithPassword(string $email, string $password): ?array
    {
        $response = Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Content-Type' => 'application/json',
        ])->post(rtrim($this->baseUrl, '/').'/auth/v1/token?grant_type=password', [
            'email' => $email,
            'password' => $password,
        ]);

        if ($response->failed()) {
            return null;
        }

        return $response->json();
    }

    /**
     * Look up a Supabase user by email via the Admin API.
     *
     * Returns the first matching user array, or null if none found.
     */
    public function findUserByEmail(string $email): ?array
    {
        $response = Http::withHeaders([
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
     * Delete a user from Supabase GoTrue.
     */
    public function deleteUser(string $supabaseUserId): bool
    {
        $response = Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Authorization' => 'Bearer '.$this->serviceKey,
        ])->delete(rtrim($this->baseUrl, '/').'/auth/v1/admin/users/'.$supabaseUserId);

        return $response->successful();
    }
}
