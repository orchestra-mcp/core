<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Agent extends Model
{
    use HasUuids;

    /**
     * The table associated with the model.
     */
    protected $table = 'agents';

    /**
     * The primary key type.
     */
    protected $keyType = 'string';

    /**
     * Indicates if the IDs are auto-incrementing.
     */
    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'role',
        'type',
        'status',
        'persona',
        'system_prompt',
        'avatar_color',
        'organization_id',
        'created_by',
        'skills',
        'metadata',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'skills' => 'array',
            'metadata' => 'array',
        ];
    }

    /**
     * The organization this agent belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * The user who created this agent.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the first letter of the agent name for avatar fallback.
     */
    public function initial(): string
    {
        return strtoupper(substr($this->name ?? 'A', 0, 1));
    }

    /**
     * Get a display-friendly status label.
     */
    public function statusLabel(): string
    {
        return match ($this->status) {
            'active' => 'Active',
            'inactive' => 'Inactive',
            'archived' => 'Archived',
            default => 'Unknown',
        };
    }

    /**
     * Get the CSS classes for the status badge.
     */
    public function statusClasses(): string
    {
        return match ($this->status) {
            'active' => 'bg-emerald-500/10 text-emerald-400',
            'inactive' => 'bg-yellow-500/10 text-yellow-400',
            'archived' => 'bg-red-500/10 text-red-400',
            default => 'bg-[#333333] text-[#999999]',
        };
    }
}
