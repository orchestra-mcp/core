<div>
    {{-- Page heading --}}
    <div class="mb-6">
        <h1 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">MCP Tokens</h1>
        <p class="mt-1 text-[13px]" style="color: var(--color-text-muted);">Manage your MCP server access tokens.</p>
    </div>

    {{-- Token Table (Studio style) --}}
    @if ($tokens->count() > 0)
        <x-data-table
            :columns="['Name', 'Token Prefix', 'Last Used', 'Usage', 'Created', '']"
            :total="$tokens->count()"
            totalLabel="tokens"
        >
            <x-slot:actions>
                <button
                    wire:click="$set('showCreateModal', true)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium btn-primary cursor-pointer"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Create Token
                </button>
            </x-slot:actions>

            @foreach ($tokens as $token)
                <tr class="transition-colors cursor-default"
                    style="border-bottom: 1px solid var(--color-border-muted);"
                    onmouseover="this.style.background='var(--color-bg-surface)'"
                    onmouseout="this.style.background='transparent'">
                    <td class="px-4 py-3">
                        <span class="text-[13px] font-medium" style="color: var(--color-text-primary);">{{ $token->name }}</span>
                    </td>
                    <td class="px-4 py-3">
                        <code class="text-[12px] font-mono px-1.5 py-0.5 rounded" style="color: #00E5FF; background: rgba(0, 229, 255, 0.05);">{{ $token->token_prefix }}</code>
                    </td>
                    <td class="px-4 py-3">
                        <span class="text-[13px]" style="color: var(--color-text-muted);">
                            {{ $token->last_used_at ? $token->last_used_at->diffForHumans() : 'Never' }}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="text-[13px]" style="color: var(--color-text-muted);">{{ $token->usage_count ?? 0 }}</span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="text-[13px]" style="color: var(--color-text-muted);">{{ $token->created_at->format('M d, Y') }}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button
                            wire:click="revokeToken('{{ $token->id }}')"
                            wire:confirm="Are you sure you want to revoke this token? This cannot be undone."
                            class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer btn-danger"
                        >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                            </svg>
                            Revoke
                        </button>
                    </td>
                </tr>
            @endforeach
        </x-data-table>
    @else
        <div class="rounded-lg p-12 text-center" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
            <div class="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style="background: var(--color-bg-surface);">
                <svg class="w-6 h-6" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
            </div>
            <p class="text-[13px]" style="color: var(--color-text-muted);">No tokens yet. Create your first token to connect Claude.</p>
            <button
                wire:click="$set('showCreateModal', true)"
                class="mt-4 inline-flex items-center gap-2 px-3 py-1.5 btn-primary rounded text-[13px] font-medium cursor-pointer"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Create Your First Token
            </button>
        </div>
    @endif

    {{-- Create Token Modal (Studio style) --}}
    @if ($showCreateModal)
        <div
            x-data="{ copied: false }"
            class="fixed inset-0 z-50 flex items-center justify-center"
        >
            <div class="absolute inset-0" style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);" wire:click="closeModal"></div>

            <div class="relative w-full max-w-lg mx-4 rounded-lg shadow-2xl" style="background: var(--color-bg-default); border: 1px solid var(--color-border);">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-5">
                        <h2 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">Create New Token</h2>
                        <button wire:click="closeModal" class="cursor-pointer p-1 rounded transition-colors" style="color: var(--color-text-muted);">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    @if ($generatedToken)
                        <div class="space-y-4">
                            <div class="flex items-center gap-2 mb-2" style="color: hsl(153.1 60.2% 52.7%);">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span class="text-[13px] font-medium">Token generated successfully</span>
                            </div>

                            <div class="relative">
                                <code class="block w-full p-4 rounded text-[13px] font-mono break-all" style="background: var(--color-bg-alt); color: #00E5FF; border: 1px solid var(--color-border);">{{ $generatedToken }}</code>
                                <button
                                    x-on:click="navigator.clipboard.writeText('{{ $generatedToken }}'); copied = true; setTimeout(() => copied = false, 2000)"
                                    class="absolute top-3 right-3 p-1.5 rounded cursor-pointer transition-colors"
                                    style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
                                    title="Copy to clipboard"
                                >
                                    <template x-if="!copied">
                                        <svg class="w-4 h-4" style="color: var(--color-text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                        </svg>
                                    </template>
                                    <template x-if="copied">
                                        <svg class="w-4 h-4" style="color: hsl(153.1 60.2% 52.7%);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                        </svg>
                                    </template>
                                </button>
                            </div>

                            <div class="flex items-start gap-3 p-3 rounded" style="background: hsl(38.9 100% 42.9% / 0.05); border: 1px solid hsl(38.9 100% 42.9% / 0.15);">
                                <svg class="w-4 h-4 mt-0.5 shrink-0" style="color: hsl(38.9 100% 42.9%);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                </svg>
                                <p class="text-[13px]" style="color: hsl(38.9 100% 62.9%);">Copy this token now. It won't be shown again.</p>
                            </div>

                            <button wire:click="closeModal" class="w-full py-2 btn-primary rounded text-[13px] font-medium cursor-pointer">
                                Done
                            </button>
                        </div>
                    @else
                        <form wire:submit="createToken" class="space-y-5">
                            <div>
                                <label for="tokenName" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Token Name</label>
                                <input
                                    wire:model="newTokenName"
                                    id="tokenName"
                                    type="text"
                                    placeholder="e.g., Claude Desktop, CI/CD Pipeline"
                                    class="studio-field"
                                    autofocus
                                />
                                @error('newTokenName')
                                    <p class="mt-1.5 text-[12px]" style="color: var(--color-destructive);">{{ $message }}</p>
                                @enderror
                            </div>

                            <div class="flex gap-3">
                                <button type="button" wire:click="closeModal" class="flex-1 py-2 btn-secondary rounded text-[13px] font-medium cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" class="flex-1 py-2 btn-primary rounded text-[13px] font-medium cursor-pointer">
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
