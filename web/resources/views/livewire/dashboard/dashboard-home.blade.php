<div>
    {{-- Page heading --}}
    <div class="mb-8">
        <h1 class="text-2xl font-semibold text-[#ededed]">Dashboard</h1>
        <p class="mt-1 text-sm text-[#999999]">Welcome to Orchestra MCP. Your AI-powered company OS.</p>
    </div>

    {{-- Stat cards --}}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {{-- Active Tokens --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-[#00E5FF]/10">
                    <svg class="w-4.5 h-4.5 text-[#00E5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Active Tokens</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $totalTokens }}</p>
        </div>

        {{-- Agents --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-[#A900FF]/10">
                    <svg class="w-4.5 h-4.5 text-[#A900FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Agents</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $totalAgents }}</p>
        </div>

        {{-- Tasks This Month --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-[#00E5FF]/10">
                    <svg class="w-4.5 h-4.5 text-[#00E5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Tasks (this month)</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $totalTasks }}</p>
        </div>

        {{-- Memory Used --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-[#A900FF]/10">
                    <svg class="w-4.5 h-4.5 text-[#A900FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Memory Used</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $memoryUsed }}</p>
        </div>
    </div>

    {{-- Recent Activity --}}
    <div class="mt-8">
        <h2 class="text-sm font-medium text-[#ededed] mb-4">Recent Activity</h2>

        @if (count($recentActivity) > 0)
            <div class="bg-[#252525] rounded-lg border border-[#333333] divide-y divide-[#333333]">
                @foreach ($recentActivity as $activity)
                    <div class="flex items-center justify-between px-5 py-3.5 hover:bg-[#2a2a2a] transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center justify-center w-7 h-7 rounded-full bg-[#00E5FF]/10">
                                <svg class="w-3.5 h-3.5 text-[#00E5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="text-[13px] text-[#ededed]">{{ $activity['description'] }}</p>
                                <p class="text-xs text-[#666666] font-mono">{{ $activity['prefix'] }}</p>
                            </div>
                        </div>
                        <span class="text-xs text-[#666666] whitespace-nowrap">{{ $activity['time'] }}</span>
                    </div>
                @endforeach
            </div>
        @else
            <div class="bg-[#252525] rounded-lg border border-[#333333] p-12 text-center">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-[#2a2a2a] mx-auto mb-4">
                    <svg class="w-6 h-6 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <p class="text-sm text-[#999999]">No activity yet. Create a token and connect Claude to get started.</p>
            </div>
        @endif
    </div>
</div>
