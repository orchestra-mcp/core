<div class="space-y-6">
    <x-step-indicator :current="3" />

    <div class="text-center">
        <h2 class="text-xl font-semibold gradient-text">Connect Claude</h2>
        <p class="text-[#999999] mt-2 text-sm">Your MCP token has been generated. Use it to connect Claude to Orchestra.</p>
    </div>

    {{-- Token Display --}}
    @if($tokenGenerated)
        <div class="space-y-3">
            <label class="block text-[13px] font-medium text-[#ededed]">Your MCP Token</label>
            <div
                x-data="{ copied: false }"
                class="relative"
            >
                <div class="flex items-center bg-[#1c1c1c] rounded-md border border-[#333333] overflow-hidden">
                    <code class="flex-1 px-4 py-3 text-[#00E5FF] text-sm font-mono break-all select-all">{{ $plainToken }}</code>
                    <button
                        x-on:click="navigator.clipboard.writeText('{{ $plainToken }}').then(() => { copied = true; setTimeout(() => copied = false, 2000) })"
                        type="button"
                        class="px-4 py-3 text-[#666666] hover:text-[#ededed] transition border-l border-[#333333] cursor-pointer"
                        title="Copy to clipboard"
                    >
                        <template x-if="!copied">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </template>
                        <template x-if="copied">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </template>
                    </button>
                </div>
            </div>
            <p class="flex items-center gap-1.5 text-xs text-amber-400/80">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                This token will only be shown once. Copy it now and store it securely.
            </p>
        </div>
    @endif

    {{-- Connection Instructions --}}
    <div class="space-y-3">
        <h3 class="text-[13px] font-medium text-[#ededed]">Connection Instructions</h3>
        <p class="text-[#999999] text-sm">Add the following to your <code class="text-[#00E5FF] bg-[#00E5FF]/5 px-1.5 py-0.5 rounded text-xs">.mcp.json</code> file:</p>
        <div
            x-data="{ configCopied: false }"
            class="relative"
        >
            <pre class="bg-[#1c1c1c] rounded-md border border-[#333333] p-4 text-sm font-mono text-[#ededed] overflow-x-auto"><code>{
  "orchestra": {
    "type": "sse",
    "url": "https://orchestra-mcp.dev/mcp",
    "token": "{{ $plainToken }}"
  }
}</code></pre>
            <button
                x-on:click="
                    const config = JSON.stringify({ orchestra: { type: 'sse', url: 'https://orchestra-mcp.dev/mcp', token: '{{ $plainToken }}' } }, null, 2);
                    navigator.clipboard.writeText(config).then(() => { configCopied = true; setTimeout(() => configCopied = false, 2000) })
                "
                type="button"
                class="absolute top-2 right-2 p-1.5 rounded-md bg-[#252525] border border-[#333333] text-[#666666] hover:text-[#ededed] transition cursor-pointer"
                title="Copy config"
            >
                <template x-if="!configCopied">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </template>
                <template x-if="configCopied">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </template>
            </button>
        </div>
    </div>

    {{-- Complete --}}
    <button
        wire:click="complete"
        type="button"
        class="w-full py-2 gradient-bg text-white font-medium text-sm rounded-md hover:opacity-90 transition focus:outline-none cursor-pointer"
    >
        Go to Dashboard
    </button>
</div>
