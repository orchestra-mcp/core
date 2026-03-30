<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#0f0f12">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700&family=inter:400,500,600,700" rel="stylesheet" />

    <x-seo
        :title="isset($title) ? $title . ' - Orchestra MCP' : 'Dashboard - Orchestra MCP'"
        description="Orchestra MCP Dashboard — manage your AI agents, tokens, and team."
        :noIndex="true"
    />

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen"
      style="background: #0f0f12; color: var(--color-text-primary); font-family: 'Instrument Sans', 'Inter', -apple-system, system-ui, sans-serif;"
      x-data="{ sidebarOpen: true, sidebarMobileOpen: false, cmdkOpen: false }"
      x-init="sidebarOpen = localStorage.getItem('sidebar-open') !== 'false'"
      @keydown.meta.b.window.prevent="sidebarOpen = !sidebarOpen; localStorage.setItem('sidebar-open', sidebarOpen)">

    {{-- Toast Notification System --}}
    <x-toast-notifications />

    {{-- Global loading bar for wire:navigate --}}
    <div
        x-data="{ loading: false }"
        x-on:livewire:navigate-start.window="loading = true"
        x-on:livewire:navigate-end.window="loading = false"
    >
        <div
            x-show="loading"
            x-transition:enter="transition-opacity duration-150"
            x-transition:leave="transition-opacity duration-300"
            class="fixed top-0 left-0 right-0 z-[100] h-0.5"
        >
            <div class="h-full animate-pulse" style="background: linear-gradient(135deg, #00e5ff, #a900ff);"></div>
        </div>
    </div>

    {{-- ================================================================
         TOP HEADER BAR — 52px sticky
         ================================================================ --}}
    @persist('header')
    <header class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-[52px] px-3"
            style="background: #0a0a0d; border-bottom: 1px solid rgba(255,255,255,0.06);">
        {{-- Left: sidebar toggle + logo + connect pill --}}
        <div class="flex items-center gap-2">
            {{-- Sidebar toggle (desktop) --}}
            <button @click="sidebarOpen = !sidebarOpen; localStorage.setItem('sidebar-open', sidebarOpen)"
                    class="hidden md:flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer hover:bg-white/[0.05]"
                    style="color: var(--color-text-muted);"
                    title="Toggle sidebar (Cmd+B)">
                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            </button>

            {{-- Mobile hamburger --}}
            <button @click="sidebarMobileOpen = !sidebarMobileOpen"
                    class="md:hidden flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer hover:bg-white/[0.05]"
                    style="color: var(--color-text-muted);">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            </button>

            {{-- Logo + Name --}}
            <a href="{{ route('dashboard') }}" wire:navigate class="flex items-center gap-2">
                <img src="/img/logo.svg" alt="Orchestra MCP" class="h-5 w-5">
                <span class="text-[13px] font-semibold" style="color: var(--color-text-primary);">Orchestra MCP</span>
            </a>

            {{-- Connect pill (green) --}}
            <span class="ml-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style="background: hsl(153.1 60.2% 52.7% / 0.15); color: hsl(153.1 60.2% 52.7%);">
                <span class="w-1.5 h-1.5 rounded-full" style="background: hsl(153.1 60.2% 52.7%);"></span>
                Connected
            </span>
        </div>

        {{-- Right: search, help, notification bell, user avatar --}}
        <div class="flex items-center gap-1">
            {{-- Search (Cmd+K trigger) --}}
            <button @click="cmdkOpen = true"
                    class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded text-[12px] transition-colors cursor-pointer"
                    style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--color-text-muted);">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <span class="hidden lg:inline">Search</span>
                <kbd class="hidden lg:inline text-[10px] px-1 py-0.5 rounded" style="background: rgba(255,255,255,0.06); color: var(--color-text-faint);">&#8984;K</kbd>
            </button>

            {{-- Help --}}
            <a href="{{ route('docs') }}" class="p-1.5 rounded transition-colors hover:bg-white/[0.05]"
               style="color: var(--color-text-muted);"
               title="Documentation">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            </a>

            {{-- Notification Bell --}}
            <x-notification-bell />

            {{-- User avatar dropdown --}}
            <x-user-dropdown />
        </div>
    </header>
    @endpersist

    {{-- ================================================================
         LAYOUT: Sidebar (240px collapsible) + Content
         Top offset: 52px header
         ================================================================ --}}
    <div class="flex" style="padding-top: 52px; min-height: 100vh;">

        {{-- Mobile sidebar overlay --}}
        <div
            x-show="sidebarMobileOpen"
            x-transition:enter="transition-opacity ease-linear duration-200"
            x-transition:enter-start="opacity-0"
            x-transition:enter-end="opacity-100"
            x-transition:leave="transition-opacity ease-linear duration-200"
            x-transition:leave-start="opacity-100"
            x-transition:leave-end="opacity-0"
            class="fixed inset-0 z-30 bg-black/60 md:hidden"
            style="top: 52px;"
            @click="sidebarMobileOpen = false"
            x-cloak
        ></div>

        {{-- ============================================================
             LEFT SIDEBAR — 240px, collapsible on desktop, slide on mobile
             ============================================================ --}}
        @persist('sidebar')
        <aside
            class="fixed bottom-0 left-0 flex flex-col z-40 transition-all duration-200 ease-in-out overflow-y-auto"
            style="top: 52px; background: #0d0d10; border-right: 1px solid rgba(255,255,255,0.06);"
            :class="{
                'w-[240px]': sidebarOpen || sidebarMobileOpen,
                'w-0 md:w-0': !sidebarOpen && !sidebarMobileOpen,
                'translate-x-0': sidebarMobileOpen || sidebarOpen,
                '-translate-x-full md:translate-x-0': !sidebarMobileOpen && !sidebarOpen
            }"
        >
            <nav class="flex-1 py-3" :class="{ 'opacity-0': !sidebarOpen && !sidebarMobileOpen, 'opacity-100': sidebarOpen || sidebarMobileOpen }" style="transition: opacity 0.15s;">
                {{-- Section: Main --}}
                <div class="px-3 mb-1">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-[#444] px-2.5">Main</span>
                </div>

                @php
                    $sidebarItems = [
                        ['route' => 'dashboard', 'label' => 'Dashboard', 'match' => 'dashboard', 'excludeMatch' => 'dashboard.*', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>'],
                        ['route' => 'dashboard.agents', 'label' => 'Agents', 'match' => 'dashboard.agent*', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>'],
                        ['route' => 'dashboard.tokens', 'label' => 'Tokens', 'match' => 'dashboard.token*', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>'],
                    ];

                    $secondaryItems = [
                        ['route' => 'dashboard.connections', 'label' => 'Connections', 'match' => 'dashboard.connection*', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>'],
                        ['route' => 'dashboard.settings', 'label' => 'Settings', 'match' => 'dashboard.setting*', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
<circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>'],
                    ];
                @endphp

                @foreach($sidebarItems as $item)
                    @php
                        $isActive = isset($item['excludeMatch'])
                            ? request()->routeIs($item['match']) && !request()->routeIs($item['excludeMatch'])
                            : request()->routeIs($item['match']);
                    @endphp
                    <a href="{{ route($item['route']) }}"
                       wire:navigate
                       @click="sidebarMobileOpen = false"
                       class="flex items-center gap-2.5 mx-2 px-2.5 py-[7px] rounded-md text-[13px] transition-colors {{ $isActive ? 'text-white' : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.04]' }}"
                       @if($isActive) style="background: rgba(255,255,255,0.06);" @endif>
                        <svg class="w-4 h-4 shrink-0 {{ $isActive ? 'text-[#00e5ff]' : 'text-[#555]' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">{!! $item['icon'] !!}</svg>
                        {{ $item['label'] }}
                    </a>
                @endforeach

                {{-- Section: Settings --}}
                <div class="px-3 mt-5 mb-1">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-[#444] px-2.5">Settings</span>
                </div>

                @foreach($secondaryItems as $item)
                    @php
                        $isActive = isset($item['excludeMatch'])
                            ? request()->routeIs($item['match']) && !request()->routeIs($item['excludeMatch'])
                            : request()->routeIs($item['match']);
                    @endphp
                    <a href="{{ route($item['route']) }}"
                       wire:navigate
                       @click="sidebarMobileOpen = false"
                       class="flex items-center gap-2.5 mx-2 px-2.5 py-[7px] rounded-md text-[13px] transition-colors {{ $isActive ? 'text-white' : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.04]' }}"
                       @if($isActive) style="background: rgba(255,255,255,0.06);" @endif>
                        <svg class="w-4 h-4 shrink-0 {{ $isActive ? 'text-[#00e5ff]' : 'text-[#555]' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">{!! $item['icon'] !!}</svg>
                        {{ $item['label'] }}
                    </a>
                @endforeach
            </nav>

            {{-- Sidebar footer: user info --}}
            <div class="px-3 py-3 border-t border-white/[0.06]" :class="{ 'hidden': !sidebarOpen && !sidebarMobileOpen }">
                <div class="flex items-center gap-2.5 px-2">
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                         style="background: linear-gradient(135deg, #00e5ff, #a900ff);">
                        {{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}
                    </div>
                    <div class="min-w-0">
                        <p class="text-[12px] font-medium text-[#ccc] truncate">{{ auth()->user()->name ?? 'User' }}</p>
                        <p class="text-[10px] text-[#555] truncate">{{ auth()->user()->email ?? '' }}</p>
                    </div>
                </div>
            </div>
        </aside>
        @endpersist

        {{-- ============================================================
             MAIN CONTENT AREA
             ============================================================ --}}
        <div class="flex-1 flex flex-col transition-all duration-200"
             :class="sidebarOpen ? 'md:ml-[240px]' : 'md:ml-0'"
             style="min-height: calc(100vh - 52px);">
            <main class="flex-1 p-6 md:p-8" style="background: #0f0f12;">
                {{ $slot }}
            </main>
        </div>
    </div>

    {{-- ================================================================
         Cmd+K Search Modal
         ================================================================ --}}
    <div x-show="cmdkOpen"
         x-transition:enter="transition ease-out duration-150"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-100"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         @keydown.escape.window="cmdkOpen = false"
         @keydown.meta.k.window.prevent="cmdkOpen = !cmdkOpen"
         class="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]"
         style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
         x-cloak>
        <div @click.away="cmdkOpen = false"
             class="w-full max-w-lg mx-4 rounded-lg overflow-hidden shadow-2xl"
             style="background: #13131a; border: 1px solid rgba(255,255,255,0.08);">
            <div class="flex items-center gap-3 px-4 py-3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <svg class="w-4 h-4 shrink-0" style="color: var(--color-text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input type="text"
                       placeholder="Search pages, agents, tokens..."
                       class="flex-1 text-[14px] bg-transparent border-none outline-none"
                       style="color: var(--color-text-primary);"
                       x-ref="cmdkInput"
                       x-init="$watch('cmdkOpen', v => { if(v) $nextTick(() => $refs.cmdkInput.focus()) })"
                >
            </div>
            <div class="px-3 py-2 text-[12px]" style="color: var(--color-text-faint);">
                Type to search... Press <kbd class="px-1 py-0.5 rounded text-[10px]" style="background: rgba(255,255,255,0.06);">ESC</kbd> to close.
            </div>
        </div>
    </div>

    {{-- Supabase Realtime for push notifications --}}
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
        // ---- Orchestra Notification System ----
        (function() {
            const SUPABASE_URL = '{{ config("supabase.url") }}';
            const SUPABASE_KEY = '{{ config("supabase.key") }}';
            const USER_ID = '{{ auth()->user()->orchestraId() }}';
            const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]').content;

            // Initialize Supabase client for Realtime
            if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
                const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

                supabaseClient.channel('user-notifications')
                    .on('postgres_changes', {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${USER_ID}`
                    }, (payload) => {
                        const notification = payload.new;

                        // Show toast notification
                        window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: {
                                id: notification.id,
                                type: notification.type,
                                title: notification.title,
                                body: notification.body,
                                action_url: notification.action_url,
                                type_color: getTypeColor(notification.type),
                            }
                        }));

                        // Refresh notification bell
                        window.dispatchEvent(new CustomEvent('notification-received'));

                        // Browser push notification (when tab not focused)
                        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                            const n = new window.Notification(notification.title, {
                                body: notification.body || '',
                                icon: '/img/logo.svg',
                                tag: notification.id,
                            });
                            n.onclick = () => {
                                window.focus();
                                if (notification.action_url) {
                                    window.location.href = notification.action_url;
                                }
                                n.close();
                            };
                        }
                    })
                    .subscribe();
            }

            // Request browser notification permission on first interaction
            document.addEventListener('click', function requestPermission() {
                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission();
                }
                document.removeEventListener('click', requestPermission);
            }, { once: true });

            function getTypeColor(type) {
                const map = {
                    success: 'emerald', task_completed: 'emerald',
                    warning: 'amber',
                    error: 'red',
                    task_assigned: 'purple', mention: 'purple',
                    agent_online: 'cyan',
                    agent_offline: 'gray',
                    system: 'blue',
                };
                return map[type] || 'gray';
            }

            // ---- Shared icon helpers ----
            window.orchestraNotificationIcons = {
                getPath(type) {
                    const paths = {
                        info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                        success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                        warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
                        error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
                        task_assigned: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
                        task_completed: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                        agent_online: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z',
                        agent_offline: 'M18.364 5.636a9 9 0 010 12.728m-2.829-9.9a5 5 0 010 7.072M13 12a1 1 0 11-2 0 1 1 0 012 0zM3 3l18 18',
                        mention: 'M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9',
                        system: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
                    };
                    return paths[type] || paths.info;
                },
                getBg(color) {
                    const map = {
                        emerald: 'bg-emerald-500/10',
                        amber: 'bg-amber-500/10',
                        red: 'bg-red-500/10',
                        purple: 'bg-[#A900FF]/10',
                        cyan: 'bg-[#00E5FF]/10',
                        blue: 'bg-blue-500/10',
                        gray: 'bg-[#333333]',
                    };
                    return map[color] || map.gray;
                },
                getColor(color) {
                    const map = {
                        emerald: 'text-emerald-400',
                        amber: 'text-amber-400',
                        red: 'text-red-400',
                        purple: 'text-[#A900FF]',
                        cyan: 'text-[#00E5FF]',
                        blue: 'text-blue-400',
                        gray: 'text-[#666666]',
                    };
                    return map[color] || map.gray;
                },
                getProgress(color) {
                    const map = {
                        emerald: 'bg-emerald-500',
                        amber: 'bg-amber-500',
                        red: 'bg-red-500',
                        purple: 'bg-[#A900FF]',
                        cyan: 'bg-[#00E5FF]',
                        blue: 'bg-blue-500',
                        gray: 'bg-[#555555]',
                    };
                    return map[color] || map.gray;
                }
            };

            // ---- Alpine: Notification Bell ----
            window.notificationBell = function() {
                return {
                    open: false,
                    loading: false,
                    notifications: [],
                    unreadCount: 0,

                    init() {
                        this.fetchUnreadCount();
                        window.addEventListener('notification-received', () => {
                            this.fetchUnreadCount();
                            if (this.open) this.fetchRecent();
                        });
                    },

                    toggle() {
                        this.open = !this.open;
                        if (this.open) this.fetchRecent();
                    },

                    async fetchUnreadCount() {
                        try {
                            const res = await fetch('/dashboard/notifications/unread-count', {
                                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
                            });
                            if (res.ok) {
                                const data = await res.json();
                                this.unreadCount = data.count;
                            }
                        } catch (e) {}
                    },

                    async fetchRecent() {
                        this.loading = true;
                        try {
                            const res = await fetch('/dashboard/notifications/recent', {
                                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
                            });
                            if (res.ok) {
                                const data = await res.json();
                                this.notifications = data.notifications;
                            }
                        } catch (e) {}
                        this.loading = false;
                    },

                    async markAllRead() {
                        try {
                            await fetch('/dashboard/notifications/mark-all-read', {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'X-CSRF-TOKEN': CSRF_TOKEN,
                                    'X-Requested-With': 'XMLHttpRequest'
                                }
                            });
                            this.notifications = this.notifications.map(n => ({ ...n, read: true }));
                            this.unreadCount = 0;
                        } catch (e) {}
                    },

                    async handleNotificationClick(notification) {
                        if (!notification.read) {
                            try {
                                await fetch(`/dashboard/notifications/${notification.id}/read`, {
                                    method: 'POST',
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json',
                                        'X-CSRF-TOKEN': CSRF_TOKEN,
                                        'X-Requested-With': 'XMLHttpRequest'
                                    }
                                });
                                notification.read = true;
                                this.unreadCount = Math.max(0, this.unreadCount - 1);
                            } catch (e) {}
                        }
                        if (notification.action_url) {
                            window.location.href = notification.action_url;
                        }
                        this.open = false;
                    },

                    getTypeIconBg(color) { return window.orchestraNotificationIcons.getBg(color); },
                    getTypeIconColor(color) { return window.orchestraNotificationIcons.getColor(color); },
                    getTypeIconPath(type) { return window.orchestraNotificationIcons.getPath(type); },
                };
            };

            // ---- Alpine: Toast Notifications ----
            window.toastNotifications = function() {
                return {
                    toasts: [],
                    nextId: 0,

                    addToast(detail) {
                        const id = this.nextId++;
                        const toast = { id, ...detail, visible: true, progress: 100 };
                        this.toasts.push(toast);

                        const duration = 5000;
                        const interval = 100;
                        const step = (interval / duration) * 100;
                        const timer = setInterval(() => {
                            const t = this.toasts.find(t => t.id === id);
                            if (!t) { clearInterval(timer); return; }
                            t.progress = Math.max(0, t.progress - step);
                            if (t.progress <= 0) {
                                clearInterval(timer);
                                this.removeToast(id);
                            }
                        }, interval);
                    },

                    removeToast(id) {
                        const toast = this.toasts.find(t => t.id === id);
                        if (toast) {
                            toast.visible = false;
                            setTimeout(() => {
                                this.toasts = this.toasts.filter(t => t.id !== id);
                            }, 300);
                        }
                    },

                    handleToastClick(toast) {
                        if (toast.action_url) window.location.href = toast.action_url;
                        this.removeToast(toast.id);
                    },

                    getToastIconBg(color) { return window.orchestraNotificationIcons.getBg(color); },
                    getToastIconColor(color) { return window.orchestraNotificationIcons.getColor(color); },
                    getToastIconPath(type) { return window.orchestraNotificationIcons.getPath(type); },
                    getToastProgressColor(color) { return window.orchestraNotificationIcons.getProgress(color); },
                };
            };
        })();
    </script>

    @livewireScripts
</body>
</html>
