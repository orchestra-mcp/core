<div class="space-y-6">
    <x-step-indicator :current="1" />

    <div class="text-center">
        <h2 class="text-2xl font-bold gradient-text">Create Your Company</h2>
        <p class="text-brand-text-secondary mt-2 text-sm">Set up your organization to get started with Orchestra MCP.</p>
    </div>

    <form wire:submit="save" class="space-y-5">
        {{-- Company Name --}}
        <div>
            <label for="name" class="block text-sm font-medium text-brand-text mb-1">Company Name</label>
            <input
                wire:model.live.debounce.300ms="name"
                type="text"
                id="name"
                placeholder="Acme Inc."
                class="w-full rounded-lg bg-brand-surface border border-brand-border px-4 py-2.5 text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan transition"
            >
            @error('name')
                <p class="mt-1 text-sm text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Slug (auto-generated, readonly) --}}
        <div>
            <label for="slug" class="block text-sm font-medium text-brand-text mb-1">Slug</label>
            <div class="flex items-center rounded-lg bg-brand-surface border border-brand-border overflow-hidden">
                <span class="px-3 text-brand-text-secondary text-sm bg-brand-dark/50 py-2.5 border-r border-brand-border">orchestra-mcp.dev/</span>
                <input
                    wire:model="slug"
                    type="text"
                    id="slug"
                    readonly
                    class="flex-1 bg-transparent px-3 py-2.5 text-brand-text-secondary focus:outline-none cursor-not-allowed"
                >
            </div>
            @error('slug')
                <p class="mt-1 text-sm text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Description (optional) --}}
        <div>
            <label for="description" class="block text-sm font-medium text-brand-text mb-1">
                Description <span class="text-brand-text-secondary">(optional)</span>
            </label>
            <textarea
                wire:model="description"
                id="description"
                rows="3"
                placeholder="Tell us about your company..."
                class="w-full rounded-lg bg-brand-surface border border-brand-border px-4 py-2.5 text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan transition resize-none"
            ></textarea>
        </div>

        {{-- Submit --}}
        <button
            type="submit"
            class="w-full gradient-bg text-white font-semibold py-2.5 px-4 rounded-lg hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
            wire:loading.attr="disabled"
            wire:loading.class="opacity-60 cursor-wait"
        >
            <span wire:loading.remove>Continue</span>
            <span wire:loading>
                <svg class="animate-spin inline-block w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Saving...
            </span>
        </button>
    </form>
</div>
