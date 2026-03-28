<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Firebase\JWT\JWT;

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
            'Authorization' => 'Bearer ' . $this->serviceKey,
            'Content-Type' => 'application/json',
        ])->post(rtrim($this->baseUrl, '/') . '/auth/v1/admin/users', [
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
     * Delete a user from Supabase GoTrue.
     */
    public function deleteUser(string $supabaseUserId): bool
    {
        $response = Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Authorization' => 'Bearer ' . $this->serviceKey,
        ])->delete(rtrim($this->baseUrl, '/') . '/auth/v1/admin/users/' . $supabaseUserId);

        return $response->successful();
    }
}
