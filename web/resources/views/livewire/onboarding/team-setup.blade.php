<div class="space-y-6">
    <x-step-indicator :current="2" />

    <div class="text-center">
        <h2 class="text-2xl font-bold gradient-text">Invite Your Team</h2>
        <p class="text-brand-text-secondary mt-2 text-sm">Add team members to collaborate on your projects. You can always do this later.</p>
    </div>

    {{-- Add Email Form --}}
    <div class="space-y-3">
        <div class="flex gap-2">
            <div class="flex-1">
                <input
                    wire:model="email"
                    type="email"
                    placeholder="colleague@company.com"
                    class="w-full rounded-lg bg-brand-surface border border-brand-border px-4 py-2.5 text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan transition"
                    wire:keydown.enter="addEmail"
                >
            </div>
            <select
                wire:model="role"
                class="rounded-lg bg-brand-surface border border-brand-border px-3 py-2.5 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan transition text-sm"
            >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
            </select>
            <button
                wire:click="addEmail"
                type="button"
                class="gradient-bg text-white font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition text-sm"
            >
                Add
            </button>
        </div>
        @error('email')
            <p class="text-sm text-red-400">{{ $message }}</p>
        @enderror
    </div>

    {{-- Invite List --}}
    @if(count($invites) > 0)
        <div class="space-y-2">
            <h3 class="text-sm font-medium text-brand-text">Pending Invites ({{ count($invites) }})</h3>
            <div class="space-y-2 max-h-48 overflow-y-auto">
                @foreach($invites as $index => $invite)
                    <div class="flex items-center justify-between bg-brand-surface rounded-lg px-4 py-2.5 border border-brand-border">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold">
                                {{ strtoupper(substr($invite['email'], 0, 1)) }}
                            </div>
                            <div>
                                <p class="text-brand-text text-sm">{{ $invite['email'] }}</p>
                                <p class="text-brand-text-secondary text-xs capitalize">{{ $invite['role'] }}</p>
                            </div>
                        </div>
                        <button
                            wire:click="removeEmail({{ $index }})"
                            type="button"
                            class="text-brand-text-secondary hover:text-red-400 transition"
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
            class="flex-1 border border-brand-border text-brand-text font-semibold py-2.5 px-4 rounded-lg hover:bg-brand-surface transition focus:outline-none"
        >
            Skip
        </button>
        <button
            wire:click="save"
            type="button"
            class="flex-1 gradient-bg text-white font-semibold py-2.5 px-4 rounded-lg hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
        >
            Continue
        </button>
    </div>
</div>
