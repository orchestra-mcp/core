<div>
    {{-- Header --}}
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-2xl font-bold text-brand-text">MCP Tokens</h1>
            <p class="mt-1 text-brand-text-secondary">Manage your MCP server access tokens.</p>
        </div>
        <button
            wire:click="$set('showCreateModal', true)"
            class="inline-flex items-center gap-2 px-5 py-2.5 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Token
        </button>
    </div>

    {{-- Token Table --}}
    @if ($tokens->count() > 0)
        <div class="bg-brand-card rounded-xl border border-brand-border overflow-hidden">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-brand-border">
                        <th class="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">Token Prefix</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">Last Used</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">Usage Count</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">Created</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-brand-text-secondary uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-brand-border">
                    @foreach ($tokens as $token)
                        <tr class="hover:bg-brand-card-hover transition-colors">
                            <td class="px-6 py-4">
                                <span class="text-sm font-medium text-brand-text">{{ $token->name }}</span>
                            </td>
                            <td class="px-6 py-4">
                                <code class="text-sm font-mono text-brand-cyan bg-brand-surface px-2 py-1 rounded">{{ $token->token_prefix }}</code>
                            </td>
                            <td class="px-6 py-4">
                                <span class="text-sm text-brand-text-secondary">
                                    {{ $token->last_used_at ? $token->last_used_at->diffForHumans() : 'Never' }}
                                </span>
                            </td>
                            <td class="px-6 py-4">
                                <span class="text-sm text-brand-text-secondary">{{ $token->usage_count ?? 0 }}</span>
                            </td>
                            <td class="px-6 py-4">
                                <span class="text-sm text-brand-text-secondary">{{ $token->created_at->format('M d, Y') }}</span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <button
                                    wire:click="revokeToken('{{ $token->id }}')"
                                    wire:confirm="Are you sure you want to revoke this token? This cannot be undone."
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors"
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
        <div class="bg-brand-card rounded-xl border border-brand-border p-12 text-center">
            <div class="flex items-center justify-center w-14 h-14 rounded-full bg-brand-surface mx-auto mb-4">
                <svg class="w-7 h-7 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
            </div>
            <p class="text-brand-text-secondary">No tokens yet. Create your first token to connect Claude.</p>
            <button
                wire:click="$set('showCreateModal', true)"
                class="mt-4 inline-flex items-center gap-2 px-5 py-2.5 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
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
                class="absolute inset-0 bg-black/60 backdrop-blur-sm"
                wire:click="closeModal"
            ></div>

            {{-- Modal Card --}}
            <div class="relative w-full max-w-lg mx-4 bg-brand-card rounded-2xl border border-brand-border shadow-2xl">
                {{-- Gradient top border --}}
                <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-cyan to-brand-purple rounded-t-2xl"></div>

                <div class="p-8">
                    {{-- Header --}}
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-bold text-brand-text">Create New Token</h2>
                        <button
                            wire:click="closeModal"
                            class="text-brand-text-secondary hover:text-brand-text transition-colors"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    @if ($generatedToken)
                        {{-- Token Generated State --}}
                        <div class="space-y-4">
                            <div class="flex items-center gap-2 text-green-400 mb-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span class="text-sm font-medium">Token generated successfully</span>
                            </div>

                            {{-- Token display --}}
                            <div class="relative">
                                <code class="block w-full p-4 bg-brand-dark rounded-lg text-brand-cyan font-mono text-sm break-all border border-brand-border">{{ $generatedToken }}</code>
                                <button
                                    x-on:click="navigator.clipboard.writeText('{{ $generatedToken }}'); copied = true; setTimeout(() => copied = false, 2000)"
                                    class="absolute top-3 right-3 p-1.5 rounded-md bg-brand-surface hover:bg-brand-card-hover transition-colors"
                                    title="Copy to clipboard"
                                >
                                    <template x-if="!copied">
                                        <svg class="w-4 h-4 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                        </svg>
                                    </template>
                                    <template x-if="copied">
                                        <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                        </svg>
                                    </template>
                                </button>
                            </div>

                            {{-- Warning --}}
                            <div class="flex items-start gap-3 p-4 bg-amber-400/10 rounded-lg border border-amber-400/20">
                                <svg class="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                </svg>
                                <p class="text-sm text-amber-200">Copy this token now. It won't be shown again.</p>
                            </div>

                            {{-- Done button --}}
                            <button
                                wire:click="closeModal"
                                class="w-full py-2.5 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                            >
                                Done
                            </button>
                        </div>
                    @else
                        {{-- Create Form State --}}
                        <form wire:submit="createToken" class="space-y-5">
                            <div>
                                <label for="tokenName" class="block text-sm font-medium text-brand-text-secondary mb-2">Token Name</label>
                                <input
                                    wire:model="newTokenName"
                                    id="tokenName"
                                    type="text"
                                    placeholder="e.g., Claude Desktop, CI/CD Pipeline"
                                    class="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-brand-text placeholder-brand-text-secondary/50 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-colors"
                                    autofocus
                                />
                                @error('newTokenName')
                                    <p class="mt-1.5 text-sm text-red-400">{{ $message }}</p>
                                @enderror
                            </div>

                            <div class="flex gap-3">
                                <button
                                    type="button"
                                    wire:click="closeModal"
                                    class="flex-1 py-2.5 bg-brand-surface border border-brand-border text-brand-text-secondary text-sm font-medium rounded-lg hover:bg-brand-card-hover transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    class="flex-1 py-2.5 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
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
