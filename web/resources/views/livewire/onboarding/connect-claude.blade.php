<div class="space-y-6">
    <x-step-indicator :current="3" />

    <div class="text-center">
        <h2 class="text-2xl font-bold gradient-text">Connect Claude</h2>
        <p class="text-brand-text-secondary mt-2 text-sm">Your MCP token has been generated. Use it to connect Claude to Orchestra.</p>
    </div>

    {{-- Token Display --}}
    @if($tokenGenerated)
        <div class="space-y-3">
            <label class="block text-sm font-medium text-brand-text">Your MCP Token</label>
            <div
                x-data="{ copied: false }"
                class="relative"
            >
                <div class="flex items-center bg-brand-dark rounded-lg border border-brand-border overflow-hidden">
                    <code class="flex-1 px-4 py-3 text-brand-cyan text-sm font-mono break-all select-all">{{ $plainToken }}</code>
                    <button
                        x-on:click="navigator.clipboard.writeText('{{ $plainToken }}').then(() => { copied = true; setTimeout(() => copied = false, 2000) })"
                        type="button"
                        class="px-4 py-3 text-brand-text-secondary hover:text-white transition border-l border-brand-border"
                        title="Copy to clipboard"
                    >
                        <template x-if="!copied">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </template>
                        <template x-if="copied">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </template>
                    </button>
                </div>
            </div>
            <p class="flex items-center gap-1.5 text-xs text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                This token will only be shown once. Copy it now and store it securely.
            </p>
        </div>
    @endif

    {{-- Connection Instructions --}}
    <div class="space-y-3">
        <h3 class="text-sm font-medium text-brand-text">Connection Instructions</h3>
        <p class="text-brand-text-secondary text-sm">Add the following to your <code class="text-brand-cyan">.mcp.json</code> file:</p>
        <div
            x-data="{ configCopied: false }"
            class="relative"
        >
            <pre class="bg-brand-dark rounded-lg border border-brand-border p-4 text-sm font-mono text-brand-text overflow-x-auto"><code>{
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
                class="absolute top-2 right-2 p-1.5 rounded text-brand-text-secondary hover:text-white transition"
                title="Copy config"
            >
                <template x-if="!configCopied">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </template>
                <template x-if="configCopied">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
        class="w-full gradient-bg text-white font-semibold py-2.5 px-4 rounded-lg hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
    >
        Go to Dashboard
    </button>
</div>
