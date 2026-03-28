<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#1c1c1c">
    <meta property="og:image" content="/img/cover.jpg">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700" rel="stylesheet" />

    <title>{{ $title ?? config('app.name', 'Orchestra MCP') }}</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-[#1c1c1c]">
    <div class="flex">
        {{-- Sidebar --}}
        <aside class="fixed inset-y-0 left-0 w-60 bg-[#1c1c1c] border-r border-[#333333] flex flex-col z-20">
            {{-- Logo --}}
            <div class="flex items-center gap-2.5 px-5 h-14 border-b border-[#333333] shrink-0">
                <img src="/img/logo.svg" alt="Orchestra MCP" class="h-7 w-7">
                <span class="text-sm font-semibold gradient-text">Orchestra MCP</span>
            </div>

            {{-- Navigation --}}
            <nav class="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                @php
                    $navItems = [
                        ['route' => 'dashboard', 'label' => 'Home', 'match' => 'dashboard', 'excludeMatch' => 'dashboard.*', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>'],
                        ['route' => 'dashboard.tokens', 'label' => 'API Tokens', 'match' => 'dashboard.tokens', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>'],
                        ['route' => 'dashboard.team', 'label' => 'Team Members', 'match' => 'dashboard.team', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>'],
                        ['route' => 'dashboard.agents', 'label' => 'Agents', 'match' => 'dashboard.agent*', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>'],
                        ['route' => 'dashboard.usage', 'label' => 'Usage', 'match' => 'dashboard.usage', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'],
                    ];
                @endphp

                @foreach($navItems as $item)
                    @php
                        $isActive = isset($item['excludeMatch'])
                            ? request()->routeIs($item['match']) && !request()->routeIs($item['excludeMatch'])
                            : request()->routeIs($item['match']);
                    @endphp
                    <a href="{{ route($item['route']) }}"
                       class="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors {{ $isActive ? 'bg-[#2a2a2a] text-[#ededed]' : 'text-[#999999] hover:text-[#ededed] hover:bg-[#252525]' }}">
                        <svg class="w-4 h-4 shrink-0 {{ $isActive ? 'text-[#ededed]' : 'text-[#666666]' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">{!! $item['icon'] !!}</svg>
                        {{ $item['label'] }}
                    </a>
                @endforeach

                {{-- Divider --}}
                <div class="!my-3 border-t border-[#333333]"></div>

                @php
                    $bottomItems = [
                        ['route' => 'dashboard.connections', 'label' => 'Connections', 'match' => 'dashboard.connections', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>'],
                        ['route' => 'dashboard.notifications', 'label' => 'Notifications', 'match' => 'dashboard.notifications', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>'],
                        ['route' => 'dashboard.settings', 'label' => 'Settings', 'match' => 'dashboard.settings', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>'],
                        ['route' => 'dashboard.billing', 'label' => 'Billing', 'match' => 'dashboard.billing', 'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>'],
                    ];
                @endphp

                @foreach($bottomItems as $item)
                    @php $isActive = request()->routeIs($item['match']); @endphp
                    <a href="{{ route($item['route']) }}"
                       class="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors {{ $isActive ? 'bg-[#2a2a2a] text-[#ededed]' : 'text-[#999999] hover:text-[#ededed] hover:bg-[#252525]' }}">
                        <svg class="w-4 h-4 shrink-0 {{ $isActive ? 'text-[#ededed]' : 'text-[#666666]' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">{!! $item['icon'] !!}</svg>
                        {{ $item['label'] }}
                    </a>
                @endforeach
            </nav>

            {{-- User section at bottom --}}
            <div class="border-t border-[#333333] px-3 py-3">
                <div class="flex items-center justify-between px-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}
                        </div>
                        <span class="text-[13px] text-[#ededed] truncate">{{ auth()->user()->name ?? 'User' }}</span>
                    </div>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="text-[#666666] hover:text-[#ededed] transition-colors cursor-pointer" title="Sign out">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </aside>

        {{-- Main content --}}
        <div class="flex-1 ml-60">
            {{-- Top bar --}}
            <header class="sticky top-0 z-10 flex items-center justify-between h-14 px-8 bg-[#1c1c1c] border-b border-[#333333]">
                <div>
                    @if(isset($title))
                        <h1 class="text-sm font-medium text-[#ededed]">{{ $title }}</h1>
                    @endif
                </div>
                <div class="flex items-center gap-3">
                    <a href="{{ route('dashboard.settings') }}" class="text-[13px] text-[#666666] hover:text-[#ededed] transition-colors">
                        {{ auth()->user()->email ?? '' }}
                    </a>
                </div>
            </header>

            {{-- Page content --}}
            <main class="p-8">
                {{ $slot }}
            </main>
        </div>
    </div>

    @livewireScripts
</body>
</html>
