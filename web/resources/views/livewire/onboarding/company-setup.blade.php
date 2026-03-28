<div class="space-y-6">
    <x-step-indicator :current="1" />

    <div class="text-center">
        <h2 class="text-xl font-semibold gradient-text">Create Your Company</h2>
        <p class="text-[#999999] mt-2 text-sm">Set up your organization to get started with Orchestra MCP.</p>
    </div>

    <form wire:submit="save" class="space-y-4">
        {{-- Company Name --}}
        <div>
            <label for="name" class="block text-[13px] font-normal text-[#999999] mb-1.5">Company Name</label>
            <input
                wire:model.live.debounce.300ms="name"
                type="text"
                id="name"
                placeholder="Acme Inc."
                class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
            >
            @error('name')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Slug (auto-generated, readonly) --}}
        <div>
            <label for="slug" class="block text-[13px] font-normal text-[#999999] mb-1.5">Slug</label>
            <div class="flex items-center rounded-md bg-[#202020] border border-[#333333] overflow-hidden">
                <span class="px-3 text-[#666666] text-sm bg-[#171717] py-2 border-r border-[#333333]">orchestra-mcp.dev/</span>
                <input
                    wire:model="slug"
                    type="text"
                    id="slug"
                    readonly
                    class="flex-1 bg-transparent px-3 py-2 text-[#666666] text-sm focus:outline-none cursor-not-allowed"
                >
            </div>
            @error('slug')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Description (optional) --}}
        <div>
            <label for="description" class="block text-[13px] font-normal text-[#999999] mb-1.5">
                Description <span class="text-[#555555]">(optional)</span>
            </label>
            <textarea
                wire:model="description"
                id="description"
                rows="3"
                placeholder="Tell us about your company..."
                class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors resize-none"
            ></textarea>
        </div>

        {{-- Submit --}}
        <button
            type="submit"
            class="w-full py-2 gradient-bg text-white font-medium text-sm rounded-md hover:opacity-90 transition focus:outline-none cursor-pointer"
            wire:loading.attr="disabled"
            wire:loading.class="opacity-60 cursor-wait"
        >
            <span wire:loading.remove>Continue</span>
            <span wire:loading>
                <svg class="animate-spin inline-block w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Saving...
            </span>
        </button>
    </form>
</div>
