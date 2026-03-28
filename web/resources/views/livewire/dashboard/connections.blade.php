<div>
    {{-- Page heading --}}
    <div class="mb-8">
        <h1 class="text-2xl font-semibold text-[#ededed]">Connections</h1>
        <p class="mt-1 text-sm text-[#999999]">Connect external services to receive notifications and sync activity.</p>
    </div>

    {{-- Info flash --}}
    @if (session()->has('connection-info'))
        <div class="mb-6 bg-[#00E5FF]/10 border border-[#00E5FF]/20 rounded-md px-4 py-3 flex items-center gap-3">
            <svg class="w-4 h-4 text-[#00E5FF] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span class="text-sm text-[#00E5FF]">{{ session('connection-info') }}</span>
        </div>
    @endif

    <div class="space-y-4">
        {{-- GitHub --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] overflow-hidden">
            <div class="px-6 py-5 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-lg bg-[#202020] border border-[#333333] flex items-center justify-center">
                        <svg class="w-5 h-5 text-[#ededed]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-medium text-[#ededed]">GitHub</h3>
                        @if ($githubConnected && $githubUsername)
                            <p class="text-xs text-[#999999] mt-0.5">Connected as <span class="text-[#00E5FF]">{{ $githubUsername }}</span></p>
                        @else
                            <p class="text-xs text-[#666666] mt-0.5">Connect your GitHub account for OAuth and repository access.</p>
                        @endif
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    @if ($githubConnected)
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>
                        <button wire:click="disconnectGitHub" class="inline-flex items-center px-3 py-1.5 border border-[#333333] text-[#999999] text-xs font-medium rounded-md hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer">
                            Disconnect
                        </button>
                    @else
                        <button wire:click="connectGitHub" class="inline-flex items-center px-3 py-1.5 gradient-bg text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
                            Connect
                        </button>
                    @endif
                </div>
            </div>
        </div>

        {{-- Slack --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] overflow-hidden">
            <div class="px-6 py-5 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-lg bg-[#202020] border border-[#333333] flex items-center justify-center">
                        <svg class="w-5 h-5 text-[#ededed]" fill="currentColor" viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-medium text-[#ededed]">Slack</h3>
                        @if ($slackConnected && $slackWorkspace)
                            <p class="text-xs text-[#999999] mt-0.5">Connected to <span class="text-[#00E5FF]">{{ $slackWorkspace }}</span></p>
                        @else
                            <p class="text-xs text-[#666666] mt-0.5">Receive notifications and interact with Orchestra in Slack.</p>
                        @endif
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    @if ($slackConnected)
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>
                        <button wire:click="disconnectSlack" class="inline-flex items-center px-3 py-1.5 border border-[#333333] text-[#999999] text-xs font-medium rounded-md hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer">
                            Disconnect
                        </button>
                    @else
                        <button wire:click="connectSlack" class="inline-flex items-center px-3 py-1.5 gradient-bg text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
                            Connect
                        </button>
                    @endif
                </div>
            </div>
        </div>

        {{-- Discord --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] overflow-hidden">
            <div class="px-6 py-5 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-lg bg-[#202020] border border-[#333333] flex items-center justify-center">
                        <svg class="w-5 h-5 text-[#ededed]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-medium text-[#ededed]">Discord</h3>
                        @if ($discordConnected && $discordServer)
                            <p class="text-xs text-[#999999] mt-0.5">Connected to <span class="text-[#00E5FF]">{{ $discordServer }}</span></p>
                        @else
                            <p class="text-xs text-[#666666] mt-0.5">Add the Orchestra bot to your Discord server for notifications.</p>
                        @endif
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    @if ($discordConnected)
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>
                        <button wire:click="disconnectDiscord" class="inline-flex items-center px-3 py-1.5 border border-[#333333] text-[#999999] text-xs font-medium rounded-md hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer">
                            Disconnect
                        </button>
                    @else
                        <button wire:click="connectDiscord" class="inline-flex items-center px-3 py-1.5 gradient-bg text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
                            Invite Bot
                        </button>
                    @endif
                </div>
            </div>
        </div>

        {{-- Telegram --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] overflow-hidden">
            <div class="px-6 py-5 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-lg bg-[#202020] border border-[#333333] flex items-center justify-center">
                        <svg class="w-5 h-5 text-[#ededed]" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-medium text-[#ededed]">Telegram</h3>
                        @if ($telegramConnected)
                            <p class="text-xs text-[#999999] mt-0.5">Connected via <span class="text-[#00E5FF]">Orchestra MCP Bot</span></p>
                        @else
                            <p class="text-xs text-[#666666] mt-0.5">Get real-time notifications via the Orchestra Telegram bot.</p>
                        @endif
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    @if ($telegramConnected)
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>
                        <button wire:click="disconnectTelegram" class="inline-flex items-center px-3 py-1.5 border border-[#333333] text-[#999999] text-xs font-medium rounded-md hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer">
                            Disconnect
                        </button>
                    @else
                        <button wire:click="connectTelegram" class="inline-flex items-center px-3 py-1.5 gradient-bg text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
                            Connect Bot
                        </button>
                    @endif
                </div>
            </div>
        </div>
    </div>

    {{-- Telegram deep link display --}}
    @if ($telegramBotLink && ! $telegramConnected)
        <div class="mt-4 bg-[#202020] rounded-lg border border-[#333333] px-6 py-4">
            <p class="text-sm text-[#999999] mb-2">Open this link in Telegram to connect your account:</p>
            <a href="{{ $telegramBotLink }}" target="_blank" class="text-sm text-[#00E5FF] hover:underline break-all">{{ $telegramBotLink }}</a>
        </div>
    @endif
</div>
