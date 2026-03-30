<div>
    {{-- Page heading --}}
    <div class="mb-6">
        <h1 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">Settings</h1>
        <p class="mt-1 text-[13px]" style="color: var(--color-text-muted);">Manage your profile and account preferences.</p>
    </div>

    {{-- Success message --}}
    @if (session()->has('settings-saved'))
        <div class="mb-6 rounded px-4 py-3 flex items-center gap-3" style="background: hsl(153.1 60.2% 52.7% / 0.08); border: 1px solid hsl(153.1 60.2% 52.7% / 0.2);">
            <svg class="w-4 h-4 shrink-0" style="color: hsl(153.1 60.2% 52.7%);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span class="text-[13px]" style="color: hsl(153.1 60.2% 52.7%);">{{ session('settings-saved') }}</span>
        </div>
    @endif

    {{-- Profile section (Studio-style card) --}}
    <div class="rounded-lg overflow-hidden mb-6" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
        <div class="px-6 py-3.5" style="border-bottom: 1px solid var(--color-border);">
            <h2 class="text-[13px] font-semibold" style="color: var(--color-text-primary);">Profile</h2>
            <p class="text-[12px] mt-0.5" style="color: var(--color-text-muted);">Your personal information and preferences.</p>
        </div>
        <div class="p-6 space-y-5">
            <div>
                <label for="name" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Name</label>
                <input type="text" id="name" wire:model="name" class="studio-field" placeholder="Your name">
                @error('name') <span class="text-[12px] mt-1" style="color: var(--color-destructive);">{{ $message }}</span> @enderror
            </div>

            <div>
                <label for="email" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Email</label>
                <input type="email" id="email" value="{{ $email }}" readonly class="studio-field" style="background: var(--color-bg-alt); color: var(--color-text-faint); cursor: not-allowed;">
                <p class="mt-1 text-[11px]" style="color: var(--color-text-faint);">Email cannot be changed.</p>
            </div>

            <div>
                <label for="timezone" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Timezone</label>
                <select id="timezone" wire:model="timezone" class="studio-field cursor-pointer">
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
                @error('timezone') <span class="text-[12px] mt-1" style="color: var(--color-destructive);">{{ $message }}</span> @enderror
            </div>

            <div>
                <label for="language" class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Language</label>
                <select id="language" wire:model="language" class="studio-field cursor-pointer">
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                </select>
                @error('language') <span class="text-[12px] mt-1" style="color: var(--color-destructive);">{{ $message }}</span> @enderror
            </div>

            <div class="pt-2">
                <button wire:click="save" class="inline-flex items-center px-3 py-1.5 btn-primary rounded text-[13px] font-medium cursor-pointer">
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
    <div class="rounded-lg overflow-hidden mb-6" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
        <div class="px-6 py-3.5" style="border-bottom: 1px solid var(--color-border);">
            <h2 class="text-[13px] font-semibold" style="color: var(--color-text-primary);">Organization</h2>
            <p class="text-[12px] mt-0.5" style="color: var(--color-text-muted);">Your organization details. Managed by the org owner.</p>
        </div>
        <div class="p-6 space-y-5">
            <div>
                <label class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Organization Name</label>
                <input type="text" value="{{ $orgName }}" readonly class="studio-field" style="background: var(--color-bg-alt); color: var(--color-text-faint); cursor: not-allowed;">
            </div>
            <div>
                <label class="block text-[13px] mb-1.5" style="color: var(--color-text-muted);">Organization Slug</label>
                <input type="text" value="{{ $orgSlug }}" readonly class="studio-field" style="background: var(--color-bg-alt); color: var(--color-text-faint); cursor: not-allowed;">
                <p class="mt-1 text-[11px]" style="color: var(--color-text-faint);">Organization settings are managed by the organization owner.</p>
            </div>
        </div>
    </div>

    {{-- Danger zone --}}
    <div class="rounded-lg overflow-hidden" style="border: 1px solid hsl(10.2 77.9% 53.9% / 0.2); background: var(--color-bg-sidebar);">
        <div class="px-6 py-3.5" style="border-bottom: 1px solid hsl(10.2 77.9% 53.9% / 0.2);">
            <h2 class="text-[13px] font-semibold" style="color: hsl(9.7 85.2% 62.9%);">Danger Zone</h2>
        </div>
        <div class="p-6">
            @if ($showDeleteConfirmation)
                <div class="p-4 rounded" style="background: hsl(10.2 77.9% 53.9% / 0.05); border: 1px solid hsl(10.2 77.9% 53.9% / 0.2);">
                    <p class="text-[13px] mb-4" style="color: var(--color-text-muted);">
                        Are you sure you want to delete your account? This action cannot be undone. All your data, tokens, and team memberships will be permanently removed.
                    </p>
                    <div class="flex items-center gap-3">
                        <button wire:click="deleteAccount" class="inline-flex items-center px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer" style="background: hsl(10.2 77.9% 53.9%); color: white;">
                            Yes, Delete My Account
                        </button>
                        <button wire:click="cancelDelete" class="inline-flex items-center px-3 py-1.5 btn-secondary rounded text-[13px] font-medium cursor-pointer">
                            Cancel
                        </button>
                    </div>
                </div>
            @else
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[13px] font-medium" style="color: var(--color-text-primary);">Delete Account</p>
                        <p class="text-[12px] mt-1" style="color: var(--color-text-faint);">Permanently delete your account and all associated data.</p>
                    </div>
                    <button wire:click="confirmDelete" class="inline-flex items-center px-3 py-1.5 btn-danger rounded text-[13px] font-medium cursor-pointer">
                        Delete Account
                    </button>
                </div>
            @endif
        </div>
    </div>
</div>
