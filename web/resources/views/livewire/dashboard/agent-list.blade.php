<div>
    {{-- Page heading --}}
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-2xl font-semibold text-[#ededed]">AI Agents</h1>
            <p class="mt-1 text-sm text-[#999999]">Manage your organization's AI agents and their profiles.</p>
        </div>
        <button
            wire:click="openCreateModal"
            class="inline-flex items-center gap-2 px-4 py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Agent
        </button>
    </div>

    {{-- Success flash --}}
    @if (session('agent-created'))
        <div class="mb-6 flex items-center gap-2 px-4 py-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            {{ session('agent-created') }}
        </div>
    @endif

    {{-- Search and filter bar --}}
    <div class="flex items-center gap-3 mb-6">
        <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
                wire:model.live.debounce.300ms="search"
                type="text"
                placeholder="Search agents by name, role, or type..."
                class="w-full pl-10 pr-4 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] placeholder-[#555555] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors"
            >
        </div>
        <select
            wire:model.live="statusFilter"
            class="px-3 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors cursor-pointer"
        >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
        </select>
    </div>

    {{-- Agent grid --}}
    @if (count($agents) > 0)
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @foreach ($agents as $agent)
                <div class="bg-[#252525] rounded-lg border border-[#333333] p-5 hover:border-[#444444] transition-colors group">
                    <div class="flex items-start gap-4">
                        {{-- Avatar --}}
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br {{ $agent['avatar_color'] ?? 'from-cyan-500 to-purple-500' }} flex items-center justify-center text-white text-lg font-bold shrink-0">
                            {{ $agent['initial'] }}
                        </div>

                        {{-- Info --}}
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <h3 class="text-sm font-semibold text-[#ededed] truncate">{{ $agent['name'] }}</h3>
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium {{ $agent['status_classes'] }}">
                                    {{ $agent['status_label'] }}
                                </span>
                            </div>
                            @if ($agent['role'])
                                <p class="text-[13px] text-[#999999] truncate">{{ $agent['role'] }}</p>
                            @endif
                            <div class="flex items-center gap-3 mt-2">
                                <span class="inline-flex items-center gap-1 text-[11px] text-[#666666]">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                                    </svg>
                                    {{ $agent['type'] }}
                                </span>
                                @if (count($agent['skills'] ?? []) > 0)
                                    <span class="inline-flex items-center gap-1 text-[11px] text-[#666666]">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                        </svg>
                                        {{ count($agent['skills']) }} skills
                                    </span>
                                @endif
                                <span class="text-[11px] text-[#555555]">{{ $agent['created_at'] }}</span>
                            </div>
                        </div>

                        {{-- View Profile button --}}
                        <a
                            href="{{ route('dashboard.agent-profile', $agent['id']) }}"
                            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#333333] bg-[#2a2a2a] text-[12px] font-medium text-[#999999] hover:text-[#ededed] hover:border-[#444444] transition-colors opacity-0 group-hover:opacity-100"
                        >
                            View Profile
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </a>
                    </div>
                </div>
            @endforeach
        </div>
    @else
        {{-- Empty state --}}
        <div class="bg-[#252525] rounded-lg border border-[#333333] p-12 text-center">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-[#2a2a2a] mx-auto mb-4">
                <svg class="w-6 h-6 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
            </div>
            <p class="text-sm text-[#999999] mb-4">
                @if ($search || $statusFilter !== 'all')
                    No agents match your search criteria.
                @else
                    No AI agents yet. Create your first agent to get started.
                @endif
            </p>
            @if (!$search && $statusFilter === 'all')
                <button
                    wire:click="openCreateModal"
                    class="inline-flex items-center gap-2 px-4 py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Create Agent
                </button>
            @endif
        </div>
    @endif

    {{-- Create Agent Modal --}}
    @if ($showCreateModal)
        <div class="fixed inset-0 z-50 flex items-center justify-center">
            {{-- Backdrop --}}
            <div wire:click="closeCreateModal" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            {{-- Modal --}}
            <div class="relative w-full max-w-lg mx-4 bg-[#252525] rounded-lg border border-[#333333] shadow-2xl">
                {{-- Header --}}
                <div class="flex items-center justify-between px-6 py-4 border-b border-[#333333]">
                    <h2 class="text-base font-semibold text-[#ededed]">Create New Agent</h2>
                    <button wire:click="closeCreateModal" class="text-[#666666] hover:text-[#ededed] transition-colors cursor-pointer">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {{-- Body --}}
                <form wire:submit="createAgent" class="px-6 py-5 space-y-4">
                    {{-- Name --}}
                    <div>
                        <label for="newName" class="block text-[13px] font-medium text-[#999999] mb-1.5">Agent Name</label>
                        <input
                            wire:model.live.debounce.300ms="newName"
                            id="newName"
                            type="text"
                            placeholder="e.g. Backend Developer"
                            class="w-full px-3 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] placeholder-[#555555] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors"
                        >
                        @error('newName') <p class="mt-1 text-xs text-red-400">{{ $message }}</p> @enderror
                    </div>

                    {{-- Slug --}}
                    <div>
                        <label for="newSlug" class="block text-[13px] font-medium text-[#999999] mb-1.5">Slug</label>
                        <input
                            wire:model="newSlug"
                            id="newSlug"
                            type="text"
                            placeholder="backend-developer"
                            class="w-full px-3 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] placeholder-[#555555] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors font-mono"
                        >
                        @error('newSlug') <p class="mt-1 text-xs text-red-400">{{ $message }}</p> @enderror
                    </div>

                    {{-- Role + Type (side by side) --}}
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="newRole" class="block text-[13px] font-medium text-[#999999] mb-1.5">Role</label>
                            <input
                                wire:model="newRole"
                                id="newRole"
                                type="text"
                                placeholder="e.g. Laravel Developer"
                                class="w-full px-3 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] placeholder-[#555555] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors"
                            >
                        </div>
                        <div>
                            <label for="newType" class="block text-[13px] font-medium text-[#999999] mb-1.5">Type</label>
                            <select
                                wire:model="newType"
                                id="newType"
                                class="w-full px-3 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors cursor-pointer"
                            >
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

                    {{-- Persona --}}
                    <div>
                        <label for="newPersona" class="block text-[13px] font-medium text-[#999999] mb-1.5">Persona <span class="text-[#555555]">(optional)</span></label>
                        <textarea
                            wire:model="newPersona"
                            id="newPersona"
                            rows="2"
                            placeholder="Describe the agent's personality and communication style..."
                            class="w-full px-3 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] placeholder-[#555555] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors resize-none"
                        ></textarea>
                    </div>

                    {{-- System Prompt --}}
                    <div>
                        <label for="newSystemPrompt" class="block text-[13px] font-medium text-[#999999] mb-1.5">System Prompt <span class="text-[#555555]">(optional)</span></label>
                        <textarea
                            wire:model="newSystemPrompt"
                            id="newSystemPrompt"
                            rows="3"
                            placeholder="The base instructions for this agent..."
                            class="w-full px-3 py-2 rounded-md border border-[#333333] bg-[#202020] text-[13px] text-[#ededed] placeholder-[#555555] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-colors resize-none"
                        ></textarea>
                    </div>

                    {{-- Footer --}}
                    <div class="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            wire:click="closeCreateModal"
                            class="px-4 py-2 rounded-md border border-[#333333] bg-[#2a2a2a] text-[13px] font-medium text-[#999999] hover:text-[#ededed] hover:border-[#444444] transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="inline-flex items-center gap-2 px-4 py-2 gradient-bg text-white text-[13px] font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
