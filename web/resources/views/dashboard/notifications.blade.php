<x-layouts.app title="Notifications">
    <div x-data="{ tab: new URLSearchParams(window.location.search).get('tab') || 'center' }">
        {{-- Tab switcher --}}
        <div class="flex items-center gap-1 mb-6 border-b border-[--color-border]">
            <button
                @click="tab = 'center'; history.replaceState(null, '', '?tab=center')"
                class="px-4 py-2 text-sm font-medium transition-colors cursor-pointer -mb-px"
                :class="tab === 'center' ? 'text-[--color-text-primary] border-b-2 border-[--color-brand-purple]' : 'text-[--color-text-muted] hover:text-[--color-text-secondary]'"
            >
                Notification Center
            </button>
            <button
                @click="tab = 'preferences'; history.replaceState(null, '', '?tab=preferences')"
                class="px-4 py-2 text-sm font-medium transition-colors cursor-pointer -mb-px"
                :class="tab === 'preferences' ? 'text-[--color-text-primary] border-b-2 border-[--color-brand-purple]' : 'text-[--color-text-muted] hover:text-[--color-text-secondary]'"
            >
                Preferences
            </button>
        </div>

        {{-- Tab content --}}
        <div x-show="tab === 'center'" x-cloak>
            <livewire:dashboard.notification-center />
        </div>
        <div x-show="tab === 'preferences'" x-cloak>
            <livewire:dashboard.notification-preferences />
        </div>
    </div>
</x-layouts.app>
