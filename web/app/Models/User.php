<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the Supabase UUID used as the primary identifier for Orchestra tables.
     *
     * With Supabase GoTrue as the primary auth provider, this should always
     * return the real GoTrue UUID set during registration or login. The
     * fallback UUID generation exists only for legacy users not yet synced.
     */
    public function orchestraId(): string
    {
        if (! $this->supabase_user_id) {
            Log::warning(
                'User missing supabase_user_id — generating fallback UUID. '
                .'This user should re-authenticate to sync with GoTrue.',
                ['user_id' => $this->id, 'email' => $this->email]
            );
            $this->supabase_user_id = (string) Str::uuid();
            $this->saveQuietly();
        }

        return $this->supabase_user_id;
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'supabase_user_id',
        'organization_id',
        'onboarding_completed',
        'timezone',
        'language',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'onboarding_completed' => 'boolean',
        ];
    }

    /**
     * The organization this user belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * The MCP tokens owned by this user.
     */
    public function mcpTokens(): HasMany
    {
        return $this->hasMany(McpToken::class);
    }

    /**
     * The team memberships for this user.
     */
    public function teamMemberships(): HasMany
    {
        return $this->hasMany(TeamMember::class);
    }
}
