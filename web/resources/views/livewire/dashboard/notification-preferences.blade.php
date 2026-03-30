<div>
    {{-- Page heading --}}
    <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-semibold text-[#ededed]">Notification Preferences</h1>
        <p class="mt-1 text-sm text-[#999999]">Choose how and when you want to be notified about project activity.</p>
    </div>

    {{-- Success message --}}
    @if (session()->has('preferences-saved'))
        <div class="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-4 py-3 flex items-center gap-3">
            <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span class="text-sm text-emerald-400">{{ session('preferences-saved') }}</span>
        </div>
    @endif

    {{-- Channels section --}}
    <div class="bg-[#252525] rounded-lg border border-[#333333] overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-[#333333]">
            <h2 class="text-sm font-medium text-[#ededed]">Notification Channels</h2>
            <p class="text-xs text-[#666666] mt-1">Select which channels should receive notifications.</p>
        </div>
        <div class="divide-y divide-[#333333]">
            @php
                $channelMeta = [
                    'email' => ['label' => 'Email', 'description' => 'Receive notifications to your account email address.', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>'],
                    'slack' => ['label' => 'Slack', 'description' => 'Get notified in your connected Slack workspace.', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>'],
                    'discord' => ['label' => 'Discord', 'description' => 'Receive notifications through the Orchestra Discord bot.', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/>'],
                    'telegram' => ['label' => 'Telegram', 'description' => 'Get real-time notifications via Telegram bot.', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>'],
                ];
            @endphp

            @foreach ($channelMeta as $key => $meta)
                <div class="px-6 py-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <svg class="w-4 h-4 text-[#666666] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">{!! $meta['icon'] !!}</svg>
                        <div>
                            <p class="text-sm text-[#ededed]">{{ $meta['label'] }}</p>
                            <p class="text-xs text-[#666666] mt-0.5">{{ $meta['description'] }}</p>
                        </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" wire:model.live="channels.{{ $key }}" class="sr-only peer">
                        <div class="w-9 h-5 bg-[#333333] peer-focus:ring-2 peer-focus:ring-[#00E5FF]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#666666] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00E5FF]/30 peer-checked:after:bg-[#00E5FF]"></div>
                    </label>
                </div>
            @endforeach
        </div>
    </div>

    {{-- Events section --}}
    <div class="bg-[#252525] rounded-lg border border-[#333333] overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-[#333333]">
            <h2 class="text-sm font-medium text-[#ededed]">Event Types</h2>
            <p class="text-xs text-[#666666] mt-1">Choose which events trigger notifications.</p>
        </div>
        <div class="divide-y divide-[#333333]">
            @php
                $eventMeta = [
                    'task_assigned' => ['label' => 'Task Assigned', 'description' => 'When a new task is assigned to you.'],
                    'task_completed' => ['label' => 'Task Completed', 'description' => 'When a task you are following is completed.'],
                    'agent_blocked' => ['label' => 'Agent Blocked', 'description' => 'When an AI agent is blocked and needs input.'],
                    'review_requested' => ['label' => 'Review Requested', 'description' => 'When a code or plan review is requested from you.'],
                    'sprint_started' => ['label' => 'Sprint Started', 'description' => 'When a new sprint begins in your project.'],
                ];
            @endphp

            @foreach ($eventMeta as $key => $meta)
                <div class="px-6 py-4 flex items-center justify-between">
                    <div>
                        <p class="text-sm text-[#ededed]">{{ $meta['label'] }}</p>
                        <p class="text-xs text-[#666666] mt-0.5">{{ $meta['description'] }}</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" wire:model.live="events.{{ $key }}" class="sr-only peer">
                        <div class="w-9 h-5 bg-[#333333] peer-focus:ring-2 peer-focus:ring-[#00E5FF]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#666666] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00E5FF]/30 peer-checked:after:bg-[#00E5FF]"></div>
                    </label>
                </div>
            @endforeach
        </div>
    </div>

    {{-- Save button --}}
    <div>
        <button
            wire:click="save"
            class="inline-flex items-center px-4 py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
        >
            <svg wire:loading wire:target="save" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Save Preferences
        </button>
    </div>
</div>
