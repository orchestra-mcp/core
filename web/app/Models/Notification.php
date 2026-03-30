<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use HasUuids;

    /**
     * The table associated with the model.
     */
    protected $table = 'notifications';

    /**
     * notifications has created_at but no updated_at.
     */
    const UPDATED_AT = null;

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
     */
    protected $fillable = [
        'user_id',
        'organization_id',
        'type',
        'title',
        'body',
        'action_url',
        'read_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Valid notification types.
     */
    public const TYPES = [
        'info',
        'success',
        'warning',
        'error',
        'task_assigned',
        'task_completed',
        'agent_online',
        'agent_offline',
        'mention',
        'system',
    ];

    /**
     * The user who owns this notification.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The organization this notification belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Check if the notification has been read.
     */
    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    /**
     * Mark the notification as read.
     */
    public function markAsRead(): void
    {
        if (! $this->isRead()) {
            $this->update(['read_at' => now()]);
        }
    }

    /**
     * Mark the notification as unread.
     */
    public function markAsUnread(): void
    {
        $this->update(['read_at' => null]);
    }

    /**
     * Scope: only unread notifications.
     */
    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    /**
     * Scope: only read notifications.
     */
    public function scopeRead($query)
    {
        return $query->whereNotNull('read_at');
    }

    /**
     * Scope: filter by user.
     */
    public function scopeForUser($query, string $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope: filter by type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Get the icon name for the notification type.
     */
    public function getTypeIcon(): string
    {
        return match ($this->type) {
            'success' => 'check-circle',
            'warning' => 'exclamation-triangle',
            'error' => 'x-circle',
            'task_assigned' => 'clipboard-list',
            'task_completed' => 'check-badge',
            'agent_online' => 'signal',
            'agent_offline' => 'signal-slash',
            'mention' => 'at-symbol',
            'system' => 'cog',
            default => 'information-circle',
        };
    }

    /**
     * Get the color class for the notification type.
     */
    public function getTypeColor(): string
    {
        return match ($this->type) {
            'success', 'task_completed' => 'emerald',
            'warning' => 'amber',
            'error' => 'red',
            'task_assigned', 'mention' => 'purple',
            'agent_online' => 'cyan',
            'agent_offline' => 'gray',
            'system' => 'blue',
            default => 'gray',
        };
    }
}
