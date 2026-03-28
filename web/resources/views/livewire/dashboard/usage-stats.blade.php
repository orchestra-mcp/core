<div>
    {{-- Page heading --}}
    <div class="mb-8">
        <h1 class="text-2xl font-bold text-brand-text">Usage</h1>
        <p class="mt-1 text-brand-text-secondary">Monitor your plan limits and current usage.</p>
    </div>

    {{-- Plan card --}}
    <div class="relative bg-brand-card rounded-xl border border-brand-border overflow-hidden mb-8">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-cyan to-brand-purple"></div>
        <div class="p-6 flex items-center justify-between">
            <div>
                <p class="text-sm text-brand-text-secondary">Current Plan</p>
                <h2 class="text-2xl font-bold gradient-text">{{ $planName }}</h2>
            </div>
            <a href="{{ route('dashboard.billing') }}" class="inline-flex items-center px-4 py-2 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
                Upgrade Plan
            </a>
        </div>
    </div>

    {{-- Usage bars --}}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {{-- Tokens --}}
        <div class="bg-brand-card rounded-xl border border-brand-border p-6">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-cyan/10">
                        <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-brand-text">Active Tokens</span>
                </div>
                <span class="text-sm text-brand-text-secondary">{{ $tokensUsed }} / {{ $tokensMax }}</span>
            </div>
            <div class="w-full h-3 bg-brand-surface rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 {{ $this->getUsagePercentage($tokensUsed, $tokensMax) >= 90 ? 'bg-red-500' : 'bg-brand-cyan' }}"
                     style="width: {{ $this->getUsagePercentage($tokensUsed, $tokensMax) }}%"></div>
            </div>
            <p class="mt-2 text-xs text-brand-text-secondary">{{ $this->getUsagePercentage($tokensUsed, $tokensMax) }}% used</p>
        </div>

        {{-- Agents --}}
        <div class="bg-brand-card rounded-xl border border-brand-border p-6">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-purple/10">
                        <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-brand-text">Agents</span>
                </div>
                <span class="text-sm text-brand-text-secondary">{{ $agentsUsed }} / {{ $agentsMax }}</span>
            </div>
            <div class="w-full h-3 bg-brand-surface rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 {{ $this->getUsagePercentage($agentsUsed, $agentsMax) >= 90 ? 'bg-red-500' : 'bg-brand-purple' }}"
                     style="width: {{ $this->getUsagePercentage($agentsUsed, $agentsMax) }}%"></div>
            </div>
            <p class="mt-2 text-xs text-brand-text-secondary">{{ $this->getUsagePercentage($agentsUsed, $agentsMax) }}% used</p>
        </div>

        {{-- Tasks this month --}}
        <div class="bg-brand-card rounded-xl border border-brand-border p-6">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-cyan/10">
                        <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-brand-text">Tasks (this month)</span>
                </div>
                <span class="text-sm text-brand-text-secondary">{{ number_format($tasksUsed) }} / {{ number_format($tasksMax) }}</span>
            </div>
            <div class="w-full h-3 bg-brand-surface rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 {{ $this->getUsagePercentage($tasksUsed, $tasksMax) >= 90 ? 'bg-red-500' : 'bg-brand-cyan' }}"
                     style="width: {{ $this->getUsagePercentage($tasksUsed, $tasksMax) }}%"></div>
            </div>
            <p class="mt-2 text-xs text-brand-text-secondary">{{ $this->getUsagePercentage($tasksUsed, $tasksMax) }}% used</p>
        </div>

        {{-- Memory --}}
        <div class="bg-brand-card rounded-xl border border-brand-border p-6">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-purple/10">
                        <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-brand-text">Memory</span>
                </div>
                <span class="text-sm text-brand-text-secondary">{{ $this->formatMemory($memoryUsedMb) }} / {{ $this->formatMemory($memoryMaxMb) }}</span>
            </div>
            <div class="w-full h-3 bg-brand-surface rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 {{ $this->getUsagePercentage($memoryUsedMb, $memoryMaxMb) >= 90 ? 'bg-red-500' : 'bg-brand-purple' }}"
                     style="width: {{ $this->getUsagePercentage($memoryUsedMb, $memoryMaxMb) }}%"></div>
            </div>
            <p class="mt-2 text-xs text-brand-text-secondary">{{ $this->getUsagePercentage($memoryUsedMb, $memoryMaxMb) }}% used</p>
        </div>
    </div>

    {{-- Usage tips --}}
    <div class="mt-8 bg-brand-card rounded-xl border border-brand-border p-6">
        <h3 class="text-sm font-semibold text-brand-text mb-3">Usage Tips</h3>
        <ul class="space-y-2 text-sm text-brand-text-secondary">
            <li class="flex items-start gap-2">
                <svg class="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Tasks reset at the beginning of each billing cycle.
            </li>
            <li class="flex items-start gap-2">
                <svg class="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Revoke unused tokens to free up your token quota.
            </li>
            <li class="flex items-start gap-2">
                <svg class="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Approaching your limit? <a href="{{ route('dashboard.billing') }}" class="text-brand-cyan hover:underline">Upgrade your plan</a> for more capacity.
            </li>
        </ul>
    </div>
</div>
