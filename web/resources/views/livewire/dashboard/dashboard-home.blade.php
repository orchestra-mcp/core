<div>
    {{-- Page heading (Studio style: small text, no large headers) --}}
    <div class="mb-6">
        <h1 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">Project Overview</h1>
        <p class="mt-1 text-[13px]" style="color: var(--color-text-muted);">Welcome to Orchestra MCP. Your AI-powered company OS.</p>
    </div>

    {{-- Stat cards --}}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <x-stat-card
            label="Active Tokens"
            :value="$totalTokens"
            color="cyan"
            icon='<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>'
        />
        <x-stat-card
            label="Agents"
            :value="$totalAgents"
            color="purple"
            icon='<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>'
        />
        <x-stat-card
            label="Tasks (this month)"
            :value="$totalTasks"
            color="cyan"
            icon='<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>'
        />
        <x-stat-card
            label="Memory Used"
            :value="$memoryUsed"
            color="purple"
            icon='<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>'
        />
    </div>

    {{-- Quick Actions --}}
    <div class="mt-8 mb-6">
        <h2 class="text-[13px] font-medium mb-3" style="color: var(--color-text-primary);">Quick Actions</h2>
        <div class="flex flex-wrap gap-2">
            <a href="{{ route('dashboard.tokens') }}" wire:navigate
               class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors cursor-pointer btn-secondary">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/>
                </svg>
                Create Token
            </a>
            <a href="{{ route('dashboard.agents') }}" wire:navigate
               class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors cursor-pointer btn-secondary">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/>
                </svg>
                Add Agent
            </a>
            <a href="{{ route('dashboard.team') }}" wire:navigate
               class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors cursor-pointer btn-secondary">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                </svg>
                Invite Member
            </a>
        </div>
    </div>

    {{-- Recent Activity --}}
    <div class="mt-6">
        <h2 class="text-[13px] font-medium mb-3" style="color: var(--color-text-primary);">Recent Activity</h2>

        @if (count($recentActivity) > 0)
            <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
                @foreach ($recentActivity as $activity)
                    <div class="flex items-center justify-between px-4 py-3 transition-colors"
                         style="border-bottom: 1px solid var(--color-border-muted); {{ !$loop->last ? '' : 'border-bottom: none;' }}">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center justify-center w-7 h-7 rounded-full" style="background: rgba(0, 229, 255, 0.08);">
                                <svg class="w-3.5 h-3.5" style="color: #00E5FF;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="text-[13px]" style="color: var(--color-text-primary);">{{ $activity['description'] }}</p>
                                <p class="text-[11px] font-mono" style="color: var(--color-text-faint);">{{ $activity['prefix'] }}</p>
                            </div>
                        </div>
                        <span class="text-[11px] whitespace-nowrap ml-4" style="color: var(--color-text-faint);">{{ $activity['time'] }}</span>
                    </div>
                @endforeach
            </div>
        @else
            <div class="rounded-lg p-12 text-center" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
                <div class="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style="background: var(--color-bg-surface);">
                    <svg class="w-6 h-6" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <p class="text-[13px]" style="color: var(--color-text-muted);">No activity yet. Create a token and connect Claude to get started.</p>
            </div>
        @endif
    </div>
</div>
