<div>
    {{-- Page heading --}}
    <div class="mb-8">
        <h1 class="text-2xl font-bold text-brand-text">Settings</h1>
        <p class="mt-1 text-brand-text-secondary">Manage your profile and account preferences.</p>
    </div>

    {{-- Success message --}}
    @if (session()->has('settings-saved'))
        <div class="mb-6 bg-brand-cyan/10 border border-brand-cyan/20 rounded-lg px-4 py-3 flex items-center gap-3">
            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span class="text-sm text-brand-cyan">{{ session('settings-saved') }}</span>
        </div>
    @endif

    {{-- Profile section --}}
    <div class="bg-brand-card rounded-xl border border-brand-border overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-brand-border">
            <h2 class="text-lg font-semibold text-brand-text">Profile</h2>
        </div>
        <div class="p-6 space-y-5">
            {{-- Name --}}
            <div>
                <label for="name" class="block text-sm font-medium text-brand-text-secondary mb-1.5">Name</label>
                <input
                    type="text"
                    id="name"
                    wire:model="name"
                    class="w-full px-4 py-2.5 bg-brand-surface border border-brand-border rounded-lg text-brand-text text-sm placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan transition-colors"
                    placeholder="Your name"
                >
                @error('name') <span class="text-red-400 text-xs mt-1">{{ $message }}</span> @enderror
            </div>

            {{-- Email (read-only) --}}
            <div>
                <label for="email" class="block text-sm font-medium text-brand-text-secondary mb-1.5">Email</label>
                <input
                    type="email"
                    id="email"
                    value="{{ $email }}"
                    readonly
                    class="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-brand-text-secondary text-sm cursor-not-allowed"
                >
                <p class="mt-1 text-xs text-brand-text-secondary">Email cannot be changed.</p>
            </div>

            {{-- Timezone --}}
            <div>
                <label for="timezone" class="block text-sm font-medium text-brand-text-secondary mb-1.5">Timezone</label>
                <select
                    id="timezone"
                    wire:model="timezone"
                    class="w-full px-4 py-2.5 bg-brand-surface border border-brand-border rounded-lg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan transition-colors"
                >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (US)</option>
                    <option value="America/Chicago">Central Time (US)</option>
                    <option value="America/Denver">Mountain Time (US)</option>
                    <option value="America/Los_Angeles">Pacific Time (US)</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris / Berlin</option>
                    <option value="Europe/Istanbul">Istanbul</option>
                    <option value="Asia/Dubai">Dubai</option>
                    <option value="Africa/Cairo">Cairo</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Shanghai">China (CST)</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Australia/Sydney">Sydney</option>
                </select>
                @error('timezone') <span class="text-red-400 text-xs mt-1">{{ $message }}</span> @enderror
            </div>

            {{-- Language --}}
            <div>
                <label for="language" class="block text-sm font-medium text-brand-text-secondary mb-1.5">Language</label>
                <select
                    id="language"
                    wire:model="language"
                    class="w-full px-4 py-2.5 bg-brand-surface border border-brand-border rounded-lg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan transition-colors"
                >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                </select>
                @error('language') <span class="text-red-400 text-xs mt-1">{{ $message }}</span> @enderror
            </div>

            {{-- Save button --}}
            <div class="pt-2">
                <button
                    wire:click="save"
                    class="inline-flex items-center px-5 py-2.5 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                >
                    <svg wire:loading wire:target="save" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Save Changes
                </button>
            </div>
        </div>
    </div>

    {{-- Organization section --}}
    <div class="bg-brand-card rounded-xl border border-brand-border overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-brand-border">
            <h2 class="text-lg font-semibold text-brand-text">Organization</h2>
        </div>
        <div class="p-6 space-y-5">
            {{-- Org name --}}
            <div>
                <label class="block text-sm font-medium text-brand-text-secondary mb-1.5">Organization Name</label>
                <input
                    type="text"
                    value="{{ $orgName }}"
                    readonly
                    class="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-brand-text-secondary text-sm cursor-not-allowed"
                >
            </div>

            {{-- Org slug --}}
            <div>
                <label class="block text-sm font-medium text-brand-text-secondary mb-1.5">Organization Slug</label>
                <input
                    type="text"
                    value="{{ $orgSlug }}"
                    readonly
                    class="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-brand-text-secondary text-sm cursor-not-allowed"
                >
                <p class="mt-1 text-xs text-brand-text-secondary">Organization settings are managed by the organization owner.</p>
            </div>
        </div>
    </div>

    {{-- Danger zone --}}
    <div class="bg-brand-card rounded-xl border border-red-500/30 overflow-hidden">
        <div class="px-6 py-4 border-b border-red-500/30">
            <h2 class="text-lg font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div class="p-6">
            @if ($showDeleteConfirmation)
                <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p class="text-sm text-red-400 mb-4">
                        Are you sure you want to delete your account? This action cannot be undone. All your data, tokens, and team memberships will be permanently removed.
                    </p>
                    <div class="flex items-center gap-3">
                        <button
                            wire:click="deleteAccount"
                            class="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                        >
                            Yes, Delete My Account
                        </button>
                        <button
                            wire:click="cancelDelete"
                            class="inline-flex items-center px-4 py-2 border border-brand-border text-brand-text text-sm font-medium rounded-lg hover:bg-brand-surface transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            @else
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-brand-text">Delete Account</p>
                        <p class="text-xs text-brand-text-secondary mt-1">Permanently delete your account and all associated data.</p>
                    </div>
                    <button
                        wire:click="confirmDelete"
                        class="inline-flex items-center px-4 py-2 border border-red-500/50 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                        Delete Account
                    </button>
                </div>
            @endif
        </div>
    </div>
</div>
