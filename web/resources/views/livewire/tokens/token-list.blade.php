<div>
    {{-- Header --}}
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-2xl font-semibold text-[#ededed]">API Tokens</h1>
            <p class="mt-1 text-sm text-[#999999]">Manage your MCP server access tokens.</p>
        </div>
        <button
            wire:click="$set('showCreateModal', true)"
            class="inline-flex items-center gap-2 px-4 py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Token
        </button>
    </div>

    {{-- Token Table --}}
    @if ($tokens->count() > 0)
        <div class="bg-[#252525] rounded-lg border border-[#333333] overflow-hidden">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-[#333333]">
                        <th class="px-5 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Name</th>
                        <th class="px-5 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Token Prefix</th>
                        <th class="px-5 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Last Used</th>
                        <th class="px-5 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Usage</th>
                        <th class="px-5 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Created</th>
                        <th class="px-5 py-3 text-right text-xs font-medium text-[#666666] uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-[#333333]">
                    @foreach ($tokens as $token)
                        <tr class="hover:bg-[#2a2a2a] transition-colors">
                            <td class="px-5 py-3.5">
                                <span class="text-[13px] font-medium text-[#ededed]">{{ $token->name }}</span>
                            </td>
                            <td class="px-5 py-3.5">
                                <code class="text-[13px] font-mono text-[#00E5FF] bg-[#00E5FF]/5 px-2 py-0.5 rounded">{{ $token->token_prefix }}</code>
                            </td>
                            <td class="px-5 py-3.5">
                                <span class="text-[13px] text-[#999999]">
                                    {{ $token->last_used_at ? $token->last_used_at->diffForHumans() : 'Never' }}
                                </span>
                            </td>
                            <td class="px-5 py-3.5">
                                <span class="text-[13px] text-[#999999]">{{ $token->usage_count ?? 0 }}</span>
                            </td>
                            <td class="px-5 py-3.5">
                                <span class="text-[13px] text-[#999999]">{{ $token->created_at->format('M d, Y') }}</span>
                            </td>
                            <td class="px-5 py-3.5 text-right">
                                <button
                                    wire:click="revokeToken('{{ $token->id }}')"
                                    wire:confirm="Are you sure you want to revoke this token? This cannot be undone."
                                    class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-red-400 bg-red-400/5 border border-red-400/20 rounded-md hover:bg-red-400/10 transition-colors cursor-pointer"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                    </svg>
                                    Revoke
                                </button>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @else
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-12 text-center">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-[#2a2a2a] mx-auto mb-4">
                <svg class="w-6 h-6 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
            </div>
            <p class="text-sm text-[#999999]">No tokens yet. Create your first token to connect Claude.</p>
            <button
                wire:click="$set('showCreateModal', true)"
                class="mt-4 inline-flex items-center gap-2 px-4 py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Create Your First Token
            </button>
        </div>
    @endif

    {{-- Create Token Modal --}}
    @if ($showCreateModal)
        <div
            x-data="{ copied: false }"
            class="fixed inset-0 z-50 flex items-center justify-center"
        >
            {{-- Overlay --}}
            <div
                class="absolute inset-0 bg-black/70 backdrop-blur-sm"
                wire:click="closeModal"
            ></div>

            {{-- Modal Card --}}
            <div class="relative w-full max-w-lg mx-4 bg-[#252525] rounded-lg border border-[#333333] shadow-2xl shadow-black/40">
                <div class="p-6">
                    {{-- Header --}}
                    <div class="flex items-center justify-between mb-5">
                        <h2 class="text-base font-medium text-[#ededed]">Create New Token</h2>
                        <button
                            wire:click="closeModal"
                            class="text-[#666666] hover:text-[#ededed] transition-colors cursor-pointer"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    @if ($generatedToken)
                        {{-- Token Generated State --}}
                        <div class="space-y-4">
                            <div class="flex items-center gap-2 text-emerald-400 mb-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span class="text-sm font-medium">Token generated successfully</span>
                            </div>

                            {{-- Token display --}}
                            <div class="relative">
                                <code class="block w-full p-4 bg-[#1c1c1c] rounded-md text-[#00E5FF] font-mono text-sm break-all border border-[#333333]">{{ $generatedToken }}</code>
                                <button
                                    x-on:click="navigator.clipboard.writeText('{{ $generatedToken }}'); copied = true; setTimeout(() => copied = false, 2000)"
                                    class="absolute top-3 right-3 p-1.5 rounded-md bg-[#252525] hover:bg-[#2a2a2a] border border-[#333333] transition-colors cursor-pointer"
                                    title="Copy to clipboard"
                                >
                                    <template x-if="!copied">
                                        <svg class="w-4 h-4 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                        </svg>
                                    </template>
                                    <template x-if="copied">
                                        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                        </svg>
                                    </template>
                                </button>
                            </div>

                            {{-- Warning --}}
                            <div class="flex items-start gap-3 p-3 bg-amber-400/5 rounded-md border border-amber-400/15">
                                <svg class="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                </svg>
                                <p class="text-[13px] text-amber-200/80">Copy this token now. It won't be shown again.</p>
                            </div>

                            {{-- Done button --}}
                            <button
                                wire:click="closeModal"
                                class="w-full py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    @else
                        {{-- Create Form State --}}
                        <form wire:submit="createToken" class="space-y-5">
                            <div>
                                <label for="tokenName" class="block text-[13px] font-normal text-[#999999] mb-1.5">Token Name</label>
                                <input
                                    wire:model="newTokenName"
                                    id="tokenName"
                                    type="text"
                                    placeholder="e.g., Claude Desktop, CI/CD Pipeline"
                                    class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                                    autofocus
                                />
                                @error('newTokenName')
                                    <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
                                @enderror
                            </div>

                            <div class="flex gap-3">
                                <button
                                    type="button"
                                    wire:click="closeModal"
                                    class="flex-1 py-2 bg-[#202020] border border-[#333333] text-[#999999] text-sm font-medium rounded-md hover:bg-[#2a2a2a] hover:text-[#ededed] transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    class="flex-1 py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                    Generate Token
                                </button>
                            </div>
                        </form>
                    @endif
                </div>
            </div>
        </div>
    @endif
</div>
