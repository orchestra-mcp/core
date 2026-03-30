<div>
    {{-- Page heading --}}
    <div class="flex items-center justify-between mb-6">
        <div>
            <h1 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">AI Agents</h1>
            <p class="mt-1 text-[13px]" style="color: var(--color-text-muted);">Manage your organization's AI agents and their profiles.</p>
        </div>
        <button
            wire:click="openCreateModal"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-[12px] font-medium cursor-pointer"
        >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Agent
        </button>
    </div>

    {{-- Success flash --}}
    @if (session('agent-created'))
        <div class="mb-6 flex items-center gap-2 px-4 py-3 rounded text-[13px]" style="background: hsl(153.1 60.2% 52.7% / 0.08); border: 1px solid hsl(153.1 60.2% 52.7% / 0.2); color: hsl(153.1 60.2% 52.7%);">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            {{ session('agent-created') }}
        </div>
    @endif

    {{-- Search and filter bar --}}
    <div class="flex items-center gap-3 mb-5">
        <div class="relative flex-1">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
                wire:model.live.debounce.300ms="search"
                type="text"
                placeholder="Search agents by name, role, or type..."
                class="w-full pl-8 pr-4 py-1.5 studio-field text-[13px]"
            >
        </div>
        <select
            wire:model.live="statusFilter"
            class="px-3 py-1.5 studio-field text-[13px] cursor-pointer"
            style="width: auto;"
        >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
        </select>
    </div>

    {{-- Agent grid --}}
    @if (count($agents) > 0)
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            @foreach ($agents as $agent)
                <div class="rounded-lg p-4 transition-colors group"
                     style="background: var(--color-bg-sidebar); border: 1px solid var(--color-border);">
                    <div class="flex items-start gap-3.5">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 {{ $agent['avatar_color'] ?? 'gradient-bg' }}">
                            {{ $agent['initial'] }}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                                <h3 class="text-[13px] font-semibold truncate" style="color: var(--color-text-primary);">{{ $agent['name'] }}</h3>
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium {{ $agent['status_classes'] }}">
                                    {{ $agent['status_label'] }}
                                </span>
                            </div>
                            @if ($agent['role'])
                                <p class="text-[12px] truncate" style="color: var(--color-text-muted);">{{ $agent['role'] }}</p>
                            @endif
                            <div class="flex items-center gap-3 mt-1.5">
                                <span class="inline-flex items-center gap-1 text-[11px]" style="color: var(--color-text-faint);">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                                    </svg>
                                    {{ $agent['type'] }}
                                </span>
                                @if (count($agent['skills'] ?? []) > 0)
                                    <span class="inline-flex items-center gap-1 text-[11px]" style="color: var(--color-text-faint);">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                        </svg>
                                        {{ count($agent['skills']) }} skills
                                    </span>
                                @endif
                                <span class="text-[10px]" style="color: var(--color-text-faint);">{{ $agent['created_at'] }}</span>
                            </div>
                        </div>
                        <a href="{{ route('dashboard.agent-profile', $agent['id']) }}" wire:navigate
                           class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium sm:opacity-0 sm:group-hover:opacity-100 transition-opacity btn-secondary">
                            View
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </a>
                    </div>
                </div>
            @endforeach
        </div>
    @else
        <div class="rounded-lg p-12 text-center" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
            <div class="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style="background: var(--color-bg-surface);">
                <svg class="w-6 h-6" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
            </div>
            <p class="text-[13px]" style="color: var(--color-text-muted);">
                @if ($search || $statusFilter !== 'all')
                    No agents match your search criteria.
                @else
                    No AI agents yet. Create your first agent to get started.
                @endif
            </p>
            @if (!$search && $statusFilter === 'all')
                <button wire:click="openCreateModal"
                    class="mt-4 inline-flex items-center gap-2 px-3 py-1.5 btn-primary rounded text-[13px] font-medium cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Create Agent
                </button>
            @endif
        </div>
    @endif

    {{-- Create Agent Modal (Studio style) --}}
    @if ($showCreateModal)
        <div class="fixed inset-0 z-50 flex items-center justify-center">
            <div wire:click="closeCreateModal" class="absolute inset-0" style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"></div>
            <div class="relative w-full max-w-lg mx-4 rounded-lg shadow-2xl" style="background: var(--color-bg-default); border: 1px solid var(--color-border);">
                <div class="flex items-center justify-between px-6 py-4" style="border-bottom: 1px solid var(--color-border);">
                    <h2 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">Create New Agent</h2>
                    <button wire:click="closeCreateModal" class="cursor-pointer p-1 rounded" style="color: var(--color-text-muted);">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form wire:submit="createAgent" class="px-6 py-5 space-y-4">
                    <div>
                        <label for="newName" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Agent Name</label>
                        <input wire:model.live.debounce.300ms="newName" id="newName" type="text" placeholder="e.g. Backend Developer" class="studio-field">
                        @error('newName') <p class="mt-1 text-[12px]" style="color: var(--color-destructive);">{{ $message }}</p> @enderror
                    </div>
                    <div>
                        <label for="newSlug" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Slug</label>
                        <input wire:model="newSlug" id="newSlug" type="text" placeholder="backend-developer" class="studio-field font-mono">
                        @error('newSlug') <p class="mt-1 text-[12px]" style="color: var(--color-destructive);">{{ $message }}</p> @enderror
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="newRole" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Role</label>
                            <input wire:model="newRole" id="newRole" type="text" placeholder="e.g. Laravel Developer" class="studio-field">
                        </div>
                        <div>
                            <label for="newType" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Type</label>
                            <select wire:model="newType" id="newType" class="studio-field cursor-pointer">
                                <option value="general">General</option>
                                <option value="backend">Backend</option>
                                <option value="frontend">Frontend</option>
                                <option value="mobile">Mobile</option>
                                <option value="qa">QA</option>
                                <option value="devops">DevOps</option>
                                <option value="data">Data</option>
                                <option value="ai">AI</option>
                                <option value="design">Design</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label for="newPersona" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Persona <span style="color: var(--color-text-faint);">(optional)</span></label>
                        <textarea wire:model="newPersona" id="newPersona" rows="2" placeholder="Describe the agent's personality..." class="studio-field resize-none"></textarea>
                    </div>
                    <div>
                        <label for="newSystemPrompt" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">System Prompt <span style="color: var(--color-text-faint);">(optional)</span></label>
                        <textarea wire:model="newSystemPrompt" id="newSystemPrompt" rows="3" placeholder="The base instructions..." class="studio-field resize-none"></textarea>
                    </div>
                    <div class="flex items-center justify-end gap-3 pt-2">
                        <button type="button" wire:click="closeCreateModal" class="px-3 py-1.5 btn-secondary rounded text-[13px] font-medium cursor-pointer">Cancel</button>
                        <button type="submit" class="inline-flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-[13px] font-medium cursor-pointer">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            Create Agent
                        </button>
                    </div>
                </form>
            </div>
        </div>
    @endif
</div>
