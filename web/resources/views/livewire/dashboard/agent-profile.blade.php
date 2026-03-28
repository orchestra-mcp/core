<div>
    {{-- Back link --}}
    <div class="mb-6">
        <a href="{{ route('dashboard.agents') }}" class="inline-flex items-center gap-1.5 text-[13px] text-[#666666] hover:text-[#ededed] transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7"/>
            </svg>
            Back to Agents
        </a>
    </div>

    {{-- Profile header --}}
    <div class="bg-[#252525] rounded-lg border border-[#333333] p-6 mb-6">
        <div class="flex items-start gap-5">
            {{-- Avatar --}}
            <div class="w-16 h-16 rounded-full bg-gradient-to-br {{ $agent['avatar_color'] ?? 'from-cyan-500 to-purple-500' }} flex items-center justify-center text-white text-2xl font-bold shrink-0">
                {{ $agent['initial'] }}
            </div>

            {{-- Info --}}
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-1">
                    <h1 class="text-xl font-semibold text-[#ededed]">{{ $agent['name'] }}</h1>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium {{ $agent['status_classes'] }}">
                        {{ $agent['status_label'] }}
                    </span>
                </div>
                @if ($agent['role'])
                    <p class="text-[13px] text-[#999999] mb-2">{{ $agent['role'] }}</p>
                @endif
                <div class="flex items-center gap-4 text-[12px] text-[#666666]">
                    <span class="inline-flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                        </svg>
                        {{ $agent['type'] }}
                    </span>
                    <span>Created {{ $agent['created_at'] }}</span>
                    <span>Updated {{ $agent['updated_at'] }}</span>
                </div>
            </div>

            {{-- Actions --}}
            <div class="flex items-center gap-2 shrink-0">
                <button
                    wire:click="toggleStatus"
                    class="px-3 py-1.5 rounded-md border border-[#333333] bg-[#2a2a2a] text-[12px] font-medium text-[#999999] hover:text-[#ededed] hover:border-[#444444] transition-colors cursor-pointer"
                >
                    {{ $agent['status'] === 'active' ? 'Deactivate' : 'Activate' }}
                </button>
                <button
                    wire:click="archiveAgent"
                    wire:confirm="Are you sure you want to archive this agent?"
                    class="px-3 py-1.5 rounded-md border border-red-500/20 bg-red-500/5 text-[12px] font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors cursor-pointer"
                >
                    Archive
                </button>
            </div>
        </div>

        {{-- Persona --}}
        @if ($agent['persona'])
            <div class="mt-4 pt-4 border-t border-[#333333]">
                <h3 class="text-[12px] font-medium text-[#666666] uppercase tracking-wider mb-2">Persona</h3>
                <p class="text-[13px] text-[#999999] leading-relaxed">{{ $agent['persona'] }}</p>
            </div>
        @endif
    </div>

    {{-- Stats grid --}}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {{-- Tasks Completed --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-emerald-500/10">
                    <svg class="w-4.5 h-4.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Tasks Completed</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $tasksCompleted }}</p>
        </div>

        {{-- Active Sessions --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-[#00E5FF]/10">
                    <svg class="w-4.5 h-4.5 text-[#00E5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Active Sessions</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $activeSessions }}</p>
        </div>

        {{-- Memories --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-[#A900FF]/10">
                    <svg class="w-4.5 h-4.5 text-[#A900FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Memories</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $memoriesCount }}</p>
        </div>

        {{-- Decisions --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-md bg-amber-500/10">
                    <svg class="w-4.5 h-4.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                </div>
                <span class="text-[13px] font-medium text-[#999999]">Decisions</span>
            </div>
            <p class="text-3xl font-semibold text-[#ededed]">{{ $decisionsCount }}</p>
        </div>
    </div>

    {{-- Two-column layout: Activity + Tasks --}}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {{-- Recent Activity --}}
        <div>
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
                                    <p class="text-[13px] text-[#ededed]">{{ $activity['description'] ?? 'Activity' }}</p>
                                    <p class="text-xs text-[#666666]">{{ $activity['time'] ?? '' }}</p>
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            @else
                <div class="bg-[#252525] rounded-lg border border-[#333333] p-8 text-center">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#2a2a2a] mx-auto mb-3">
                        <svg class="w-5 h-5 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <p class="text-[13px] text-[#999999]">No activity recorded yet.</p>
                </div>
            @endif
        </div>

        {{-- Assigned Tasks --}}
        <div>
            <h2 class="text-sm font-medium text-[#ededed] mb-4">Assigned Tasks</h2>
            @if (count($assignedTasks) > 0)
                <div class="bg-[#252525] rounded-lg border border-[#333333] divide-y divide-[#333333]">
                    @foreach ($assignedTasks as $task)
                        <div class="flex items-center justify-between px-5 py-3.5 hover:bg-[#2a2a2a] transition-colors">
                            <div class="flex items-center gap-3">
                                <div class="flex items-center justify-center w-7 h-7 rounded-full {{ ($task['status'] ?? '') === 'completed' ? 'bg-emerald-500/10' : 'bg-amber-500/10' }}">
                                    @if (($task['status'] ?? '') === 'completed')
                                        <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                        </svg>
                                    @else
                                        <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    @endif
                                </div>
                                <div>
                                    <p class="text-[13px] text-[#ededed]">{{ $task['title'] ?? 'Task' }}</p>
                                    <p class="text-xs text-[#666666]">{{ $task['status'] ?? 'pending' }}</p>
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            @else
                <div class="bg-[#252525] rounded-lg border border-[#333333] p-8 text-center">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#2a2a2a] mx-auto mb-3">
                        <svg class="w-5 h-5 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                    </div>
                    <p class="text-[13px] text-[#999999]">No tasks assigned yet.</p>
                </div>
            @endif
        </div>
    </div>

    {{-- Skills --}}
    <div>
        <h2 class="text-sm font-medium text-[#ededed] mb-4">Skills</h2>
        @if (count($skills) > 0)
            <div class="bg-[#252525] rounded-lg border border-[#333333] p-5">
                <div class="flex flex-wrap gap-2">
                    @foreach ($skills as $skill)
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2a2a2a] border border-[#333333] text-[12px] font-medium text-[#999999]">
                            <svg class="w-3 h-3 text-[#00E5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            {{ $skill }}
                        </span>
                    @endforeach
                </div>
            </div>
        @else
            <div class="bg-[#252525] rounded-lg border border-[#333333] p-8 text-center">
                <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#2a2a2a] mx-auto mb-3">
                    <svg class="w-5 h-5 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                </div>
                <p class="text-[13px] text-[#999999]">No skills configured. Skills will appear when the agent is assigned capabilities.</p>
            </div>
        @endif
    </div>

    {{-- System Prompt (collapsible) --}}
    @if ($agent['system_prompt'])
        <div class="mt-6" x-data="{ open: false }">
            <button @click="open = !open" class="flex items-center gap-2 text-sm font-medium text-[#ededed] mb-4 cursor-pointer hover:text-[#00E5FF] transition-colors">
                <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/>
                </svg>
                System Prompt
            </button>
            <div x-show="open" x-transition class="bg-[#252525] rounded-lg border border-[#333333] p-5">
                <pre class="text-[13px] text-[#999999] leading-relaxed whitespace-pre-wrap font-mono">{{ $agent['system_prompt'] }}</pre>
            </div>
        </div>
    @endif
</div>
