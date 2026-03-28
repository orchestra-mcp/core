<?php

namespace App\Services;

use App\Models\McpToken;
use Illuminate\Support\Str;

class TokenService
{
    /**
     * Generate a new MCP token.
     * Returns the plain token (only shown once).
     */
    public function generate(string $userId, string $organizationId, string $name = 'default', array $scopes = ['read', 'write']): array
    {
        // Generate: orch_ + 32 random hex chars
        $plainToken = 'orch_' . bin2hex(random_bytes(16));

        // Hash for storage
        $tokenHash = hash('sha256', $plainToken);

        // Display prefix (first 12 chars)
        $tokenPrefix = substr($plainToken, 0, 13) . '...';

        $mcpToken = McpToken::create([
            'user_id' => $userId,
            'organization_id' => $organizationId,
            'token_hash' => $tokenHash,
            'token_prefix' => $tokenPrefix,
            'name' => $name,
            'scopes' => $scopes,
        ]);

        return [
            'token' => $mcpToken,
            'plain_token' => $plainToken, // Only returned once!
        ];
    }

    /**
     * Validate a plain token. Returns the token record or null.
     */
    public function validate(string $plainToken): ?McpToken
    {
        $hash = hash('sha256', $plainToken);

        $token = McpToken::where('token_hash', $hash)
            ->whereNull('revoked_at')
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            })
            ->first();

        if ($token) {
            $token->update([
                'last_used_at' => now(),
                'usage_count' => $token->usage_count + 1,
            ]);
        }

        return $token;
    }

    /**
     * Revoke a token.
     */
    public function revoke(string $tokenId, string $userId): bool
    {
        return McpToken::where('id', $tokenId)
            ->where('user_id', $userId)
            ->update(['revoked_at' => now()]) > 0;
    }

    /**
     * List tokens for a user.
     */
    public function listForUser(string $userId): \Illuminate\Database\Eloquent\Collection
    {
        return McpToken::where('user_id', $userId)
            ->whereNull('revoked_at')
            ->orderByDesc('created_at')
            ->get();
    }
}
