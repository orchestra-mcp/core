<div>
    {{-- Page heading --}}
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
            <h1 class="text-xl sm:text-2xl font-semibold text-[--color-text-primary]">Notifications</h1>
            <p class="mt-1 text-sm text-[--color-text-secondary]">
                @if($unreadCount > 0)
                    You have <span class="text-[--color-brand-purple] font-medium">{{ $unreadCount }}</span> unread notification{{ $unreadCount === 1 ? '' : 's' }}.
                @else
                    You're all caught up!
                @endif
            </p>
        </div>
        @if($unreadCount > 0)
            <button
                wire:click="markAllRead"
                class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[--color-brand-purple] border border-[--color-brand-purple]/30 rounded-md hover:bg-[--color-brand-purple]/10 transition-colors cursor-pointer"
            >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Mark all as read
            </button>
        @endif
    </div>

    {{-- Filters --}}
    <div class="flex flex-wrap items-center gap-3 mb-6">
        {{-- Status filter --}}
        <div class="flex items-center bg-[--color-bg-surface] border border-[--color-border] rounded-lg overflow-hidden">
            @foreach(['all' => 'All', 'unread' => 'Unread', 'read' => 'Read'] as $value => $label)
                <button
                    wire:click="$set('filter', '{{ $value }}')"
                    class="px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer {{ $filter === $value ? 'bg-[--color-brand-card-hover] text-[--color-text-primary]' : 'text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-bg-card]' }}"
                >
                    {{ $label }}
                </button>
            @endforeach
        </div>

        {{-- Type filter --}}
        <select
            wire:model.live="typeFilter"
            class="px-3 py-1.5 text-xs font-medium bg-[--color-bg-surface] border border-[--color-border] rounded-lg text-[--color-text-secondary] focus:outline-none focus:border-[--color-brand-purple] focus:ring-1 focus:ring-[--color-brand-purple]/25 cursor-pointer appearance-none pr-8"
            style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 0.5rem center;"
        >
            <option value="">All Types</option>
            @foreach($types as $type)
                <option value="{{ $type }}">{{ ucwords(str_replace('_', ' ', $type)) }}</option>
            @endforeach
        </select>
    </div>

    {{-- Notification list --}}
    <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-lg overflow-hidden">
        @forelse($notifications as $notification)
            <div
                class="flex items-start gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 border-b border-[--color-border-muted] last:border-0 transition-colors hover:bg-[--color-bg-card] group {{ !$notification->isRead() ? 'border-l-2 border-l-[--color-brand-purple]' : '' }}"
                wire:key="notification-{{ $notification->id }}"
            >
                {{-- Type icon --}}
                @php
                    $color = $notification->getTypeColor();
                    $iconBgMap = [
                        'emerald' => 'bg-emerald-500/10',
                        'amber' => 'bg-amber-500/10',
                        'red' => 'bg-red-500/10',
                        'purple' => 'bg-[--color-brand-purple]/10',
                        'cyan' => 'bg-[--color-brand-cyan]/10',
                        'blue' => 'bg-blue-500/10',
                        'gray' => 'bg-[--color-border]',
                    ];
                    $iconColorMap = [
                        'emerald' => 'text-emerald-400',
                        'amber' => 'text-amber-400',
                        'red' => 'text-red-400',
                        'purple' => 'text-[--color-brand-purple]',
                        'cyan' => 'text-[--color-brand-cyan]',
                        'blue' => 'text-blue-400',
                        'gray' => 'text-[--color-text-muted]',
                    ];
                    $iconPaths = [
                        'info' => 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                        'success' => 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                        'warning' => 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
                        'error' => 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
                        'task_assigned' => 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
                        'task_completed' => 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                        'agent_online' => 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z',
                        'agent_offline' => 'M18.364 5.636a9 9 0 010 12.728m-2.829-9.9a5 5 0 010 7.072M13 12a1 1 0 11-2 0 1 1 0 012 0zM3 3l18 18',
                        'mention' => 'M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9',
                        'system' => 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
                    ];
                    $iconPath = $iconPaths[$notification->type] ?? $iconPaths['info'];
                @endphp

                <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 {{ $iconBgMap[$color] ?? $iconBgMap['gray'] }}">
                    <svg class="w-4 h-4 {{ $iconColorMap[$color] ?? $iconColorMap['gray'] }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="{{ $iconPath }}"/>
                    </svg>
                </div>

                {{-- Content --}}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <p class="text-sm font-medium {{ $notification->isRead() ? 'text-[--color-text-secondary]' : 'text-[--color-text-primary]' }}">
                            {{ $notification->title }}
                        </p>
                        @if(!$notification->isRead())
                            <span class="w-2 h-2 rounded-full bg-[--color-brand-purple] shrink-0"></span>
                        @endif
                    </div>
                    @if($notification->body)
                        <p class="text-xs text-[--color-text-muted] mt-0.5 line-clamp-2">{{ $notification->body }}</p>
                    @endif
                    <div class="flex items-center gap-3 mt-1.5">
                        <span class="text-[11px] text-[--color-text-faint]">{{ $notification->created_at->diffForHumans() }}</span>
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[--color-border-muted] text-[--color-text-muted]">
                            {{ ucwords(str_replace('_', ' ', $notification->type)) }}
                        </span>
                    </div>
                </div>

                {{-- Actions --}}
                <div class="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    @if($notification->action_url)
                        <a
                            href="{{ $notification->action_url }}"
                            wire:navigate
                            class="p-1.5 text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors rounded hover:bg-[--color-border-muted]"
                            title="Go to action"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                        </a>
                    @endif

                    @if($notification->isRead())
                        <button
                            wire:click="markAsUnread('{{ $notification->id }}')"
                            class="p-1.5 text-[--color-text-muted] hover:text-[--color-brand-purple] transition-colors rounded hover:bg-[--color-border-muted] cursor-pointer"
                            title="Mark as unread"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                        </button>
                    @else
                        <button
                            wire:click="markAsRead('{{ $notification->id }}')"
                            class="p-1.5 text-[--color-text-muted] hover:text-emerald-400 transition-colors rounded hover:bg-[--color-border-muted] cursor-pointer"
                            title="Mark as read"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/>
                            </svg>
                        </button>
                    @endif

                    <button
                        wire:click="deleteNotification('{{ $notification->id }}')"
                        wire:confirm="Delete this notification?"
                        class="p-1.5 text-[--color-text-muted] hover:text-red-400 transition-colors rounded hover:bg-[--color-border-muted] cursor-pointer"
                        title="Delete notification"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </div>
        @empty
            {{-- Empty state --}}
            <div class="flex flex-col items-center justify-center py-16 px-4">
                <div class="w-16 h-16 rounded-full bg-[--color-border-muted] flex items-center justify-center mb-4">
                    <svg class="w-8 h-8 text-[--color-text-faint]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                </div>
                <p class="text-sm font-medium text-[--color-text-secondary]">No notifications yet</p>
                <p class="text-xs text-[--color-text-muted] mt-1">
                    @if($filter === 'unread')
                        All notifications have been read.
                    @elseif($filter === 'read')
                        No read notifications found.
                    @else
                        Notifications from your agents and team will appear here.
                    @endif
                </p>
            </div>
        @endforelse
    </div>

    {{-- Pagination --}}
    @if($notifications->hasPages())
        <div class="mt-6">
            {{ $notifications->links() }}
        </div>
    @endif

    {{-- Link to notification preferences --}}
    <div class="mt-6 text-center">
        <a href="{{ route('dashboard.notifications') }}?tab=preferences" wire:navigate class="text-xs text-[--color-text-muted] hover:text-[--color-brand-purple] transition-colors">
            Manage notification preferences
        </a>
    </div>
</div>
