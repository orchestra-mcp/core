<div class="space-y-6">
    <x-step-indicator :current="2" />

    <div class="text-center">
        <h2 class="text-xl font-semibold gradient-text">Invite Your Team</h2>
        <p class="text-[#999999] mt-2 text-sm">Add team members to collaborate on your projects. You can always do this later.</p>
    </div>

    {{-- Add Email Form --}}
    <div class="space-y-3">
        <div class="flex gap-2">
            <div class="flex-1">
                <input
                    wire:model="email"
                    type="email"
                    placeholder="colleague@company.com"
                    class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                    wire:keydown.enter="addEmail"
                >
            </div>
            <select
                wire:model="role"
                class="px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
            >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
            </select>
            <button
                wire:click="addEmail"
                type="button"
                class="gradient-bg text-white font-medium px-4 py-2 rounded-md hover:opacity-90 transition text-sm cursor-pointer"
            >
                Add
            </button>
        </div>
        @error('email')
            <p class="text-xs text-red-400">{{ $message }}</p>
        @enderror
    </div>

    {{-- Invite List --}}
    @if(count($invites) > 0)
        <div class="space-y-2">
            <h3 class="text-[13px] font-medium text-[#ededed]">Pending Invites ({{ count($invites) }})</h3>
            <div class="space-y-1.5 max-h-48 overflow-y-auto">
                @foreach($invites as $index => $invite)
                    <div class="flex items-center justify-between bg-[#202020] rounded-md px-4 py-2.5 border border-[#333333]">
                        <div class="flex items-center gap-3">
                            <div class="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold">
                                {{ strtoupper(substr($invite['email'], 0, 1)) }}
                            </div>
                            <div>
                                <p class="text-[#ededed] text-[13px]">{{ $invite['email'] }}</p>
                                <p class="text-[#666666] text-xs capitalize">{{ $invite['role'] }}</p>
                            </div>
                        </div>
                        <button
                            wire:click="removeEmail({{ $index }})"
                            type="button"
                            class="text-[#666666] hover:text-red-400 transition cursor-pointer"
                            title="Remove"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                @endforeach
            </div>
        </div>
    @endif

    {{-- Actions --}}
    <div class="flex gap-3">
        <button
            wire:click="skip"
            type="button"
            class="flex-1 py-2 bg-[#202020] border border-[#333333] text-[#999999] font-medium text-sm rounded-md hover:bg-[#2a2a2a] hover:text-[#ededed] transition focus:outline-none cursor-pointer"
        >
            Skip
        </button>
        <button
            wire:click="save"
            type="button"
            class="flex-1 py-2 gradient-bg text-white font-medium text-sm rounded-md hover:opacity-90 transition focus:outline-none cursor-pointer"
        >
            Continue
        </button>
    </div>
</div>
