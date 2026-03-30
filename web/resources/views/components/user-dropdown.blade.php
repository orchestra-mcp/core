{{-- User Avatar Dropdown --}}
<div
    x-data="{ open: false }"
    @click.outside="open = false"
    class="relative"
>
    {{-- Avatar button --}}
    <button
        @click="open = !open"
        class="flex items-center gap-2 p-1 rounded-md hover:bg-[--color-bg-card] transition-colors cursor-pointer"
    >
        <div class="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold shrink-0">
            {{ strtoupper(substr(auth()->user()->name ?? auth()->user()->email ?? 'U', 0, 1)) }}
        </div>
        <svg class="w-3.5 h-3.5 text-[--color-text-muted] transition-transform" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
    </button>

    {{-- Dropdown menu --}}
    <div
        x-show="open"
        x-transition:enter="transition ease-out duration-150"
        x-transition:enter-start="opacity-0 scale-95 translate-y-1"
        x-transition:enter-end="opacity-100 scale-100 translate-y-0"
        x-transition:leave="transition ease-in duration-100"
        x-transition:leave-start="opacity-100 scale-100 translate-y-0"
        x-transition:leave-end="opacity-0 scale-95 translate-y-1"
        class="absolute right-0 top-full mt-2 w-[240px] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden"
        style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
        x-cloak
    >
        {{-- User info --}}
        <div class="px-4 py-3" style="border-bottom: 1px solid var(--color-border-muted);">
            <p class="text-sm font-medium truncate" style="color: var(--color-text-primary);">{{ auth()->user()->name ?? 'User' }}</p>
            <p class="text-xs truncate mt-0.5" style="color: var(--color-text-muted);">{{ auth()->user()->email ?? '' }}</p>
        </div>

        {{-- Navigation links --}}
        <div class="py-1.5">
            @php
                $menuItems = [
                    ['route' => 'dashboard', 'label' => 'Dashboard', 'icon' => 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
                    ['route' => 'dashboard.tokens', 'label' => 'MCP Tokens', 'icon' => 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'],
                    ['route' => 'dashboard.connections', 'label' => 'Connections', 'icon' => 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'],
                    ['route' => 'dashboard.notifications', 'label' => 'Notifications', 'icon' => 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'],
                    ['route' => 'dashboard.settings', 'label' => 'Settings', 'icon' => 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'],
                    ['route' => 'dashboard.billing', 'label' => 'Billing', 'icon' => 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'],
                ];
            @endphp

            @foreach($menuItems as $item)
                <a
                    href="{{ route($item['route']) }}"
                    wire:navigate
                    @click="open = false"
                    class="flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors"
                    style="color: var(--color-text-secondary);"
                    onmouseover="this.style.background='var(--color-bg-card)'; this.style.color='var(--color-text-primary)';"
                    onmouseout="this.style.background=''; this.style.color='var(--color-text-secondary)';"
                >
                    <svg class="w-4 h-4" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="{{ $item['icon'] }}"/>
                    </svg>
                    {{ $item['label'] }}
                </a>
            @endforeach
        </div>

        {{-- Separator + Logout --}}
        <div class="py-1.5" style="border-top: 1px solid var(--color-border-muted);">
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button
                    type="submit"
                    class="flex items-center gap-2.5 w-full px-4 py-2 text-[13px] transition-colors cursor-pointer"
                    style="color: var(--color-text-secondary);"
                    onmouseover="this.style.background='var(--color-bg-card)'; this.style.color='#f87171';"
                    onmouseout="this.style.background=''; this.style.color='var(--color-text-secondary)';"
                >
                    <svg class="w-4 h-4" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    Sign out
                </button>
            </form>
        </div>
    </div>
</div>
