<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#0f0f12">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700" rel="stylesheet" />

    <x-seo
        :title="isset($title) ? $title . ' - Orchestra MCP' : 'Orchestra MCP'"
        :description="isset($description) ? $description : 'Orchestra MCP — Turn Claude AI into a 24/7 Autonomous Company Operating System.'"
    />

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles

    <style>
        body.public-layout {
            background: #0f0f12;
            color: #f8f8f8;
            font-family: 'Instrument Sans', -apple-system, system-ui, sans-serif;
        }
        .public-gradient-text {
            background: linear-gradient(135deg, #00e5ff, #a900ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .public-gradient-bg {
            background: linear-gradient(135deg, #00e5ff, #a900ff);
        }
        .public-gradient-border {
            border-image: linear-gradient(135deg, #00e5ff, #a900ff) 1;
        }
        .public-glow {
            box-shadow: 0 0 80px rgba(0, 229, 255, 0.06), 0 0 80px rgba(169, 0, 255, 0.06);
        }
    </style>
</head>
<body class="public-layout min-h-screen flex flex-col">

    {{-- ===== Header ===== --}}
    <header class="sticky top-0 z-50 border-b border-white/[0.08] backdrop-blur-md" style="background: rgba(15, 15, 18, 0.85);">
        <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
            {{-- Logo --}}
            <a href="{{ route('home') }}" class="flex items-center gap-2.5">
                <img src="/img/logo.svg" alt="Orchestra MCP" class="h-8 w-8">
                <span class="text-base font-semibold public-gradient-text">Orchestra MCP</span>
            </a>

            {{-- Desktop nav --}}
            <nav class="hidden md:flex items-center gap-6 text-sm">
                <a href="{{ route('features') }}" class="text-[#a0a0a0] hover:text-white transition-colors">Features</a>
                <a href="{{ route('pricing') }}" class="text-[#a0a0a0] hover:text-white transition-colors">Pricing</a>
                <a href="{{ route('docs') }}" class="text-[#a0a0a0] hover:text-white transition-colors">Docs</a>

                @auth
                    <a href="{{ route('dashboard') }}" class="text-[#a0a0a0] hover:text-white transition-colors">Dashboard</a>
                    <x-user-dropdown />
                @endauth
                @guest
                    <a href="{{ route('login') }}" class="text-[#a0a0a0] hover:text-white transition-colors">Login</a>
                    <a href="{{ route('register') }}" class="inline-flex items-center px-4 py-2 public-gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Get Started</a>
                @endguest
            </nav>

            {{-- Mobile hamburger --}}
            <div x-data="{ mobileOpen: false }" class="md:hidden">
                <button @click="mobileOpen = !mobileOpen" class="text-[#a0a0a0] hover:text-white transition-colors cursor-pointer">
                    <svg x-show="!mobileOpen" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
                    <svg x-show="mobileOpen" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" x-cloak><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>

                {{-- Mobile dropdown --}}
                <div x-show="mobileOpen" x-transition x-cloak class="absolute top-full left-0 right-0 border-t border-white/[0.08]" style="background: rgba(15, 15, 18, 0.95); backdrop-filter: blur(12px);">
                    <nav class="flex flex-col px-4 py-3 space-y-1">
                        <a href="{{ route('features') }}" class="block px-3 py-2.5 text-sm text-[#a0a0a0] hover:text-white hover:bg-white/[0.05] rounded-md transition-colors">Features</a>
                        <a href="{{ route('pricing') }}" class="block px-3 py-2.5 text-sm text-[#a0a0a0] hover:text-white hover:bg-white/[0.05] rounded-md transition-colors">Pricing</a>
                        <a href="{{ route('docs') }}" class="block px-3 py-2.5 text-sm text-[#a0a0a0] hover:text-white hover:bg-white/[0.05] rounded-md transition-colors">Docs</a>
                        @auth
                            <a href="{{ route('dashboard') }}" class="block px-3 py-2.5 text-sm text-[#a0a0a0] hover:text-white hover:bg-white/[0.05] rounded-md transition-colors">Dashboard</a>
                            <form method="POST" action="{{ route('logout') }}">
                                @csrf
                                <button type="submit" class="w-full text-left block px-3 py-2.5 text-sm text-[#a0a0a0] hover:text-red-400 hover:bg-white/[0.05] rounded-md transition-colors cursor-pointer">Sign out</button>
                            </form>
                        @endauth
                        @guest
                            <a href="{{ route('login') }}" class="block px-3 py-2.5 text-sm text-[#a0a0a0] hover:text-white hover:bg-white/[0.05] rounded-md transition-colors">Login</a>
                            <a href="{{ route('register') }}" class="block px-3 py-2.5 text-sm text-center public-gradient-bg text-white font-medium rounded-lg hover:opacity-90 transition-opacity mt-1">Get Started</a>
                        @endguest
                    </nav>
                </div>
            </div>
        </div>
    </header>

    {{-- ===== Main Content ===== --}}
    <main class="flex-1">
        {{ $slot }}
    </main>

    {{-- ===== Footer ===== --}}
    <footer class="border-t border-white/[0.08]" style="background: rgba(15, 15, 18, 0.6);">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-2.5">
                    <img src="/img/logo.svg" alt="Orchestra MCP" class="h-6 w-6 opacity-60">
                    <span class="text-sm text-[#666]">Orchestra MCP</span>
                </div>
                <div class="flex items-center gap-6 text-sm text-[#666]">
                    <a href="{{ route('features') }}" class="hover:text-[#a0a0a0] transition-colors">Features</a>
                    <a href="{{ route('pricing') }}" class="hover:text-[#a0a0a0] transition-colors">Pricing</a>
                    <a href="{{ route('docs') }}" class="hover:text-[#a0a0a0] transition-colors">Docs</a>
                    <a href="https://github.com/orchestra-mcp/framework" target="_blank" rel="noopener" class="hover:text-[#a0a0a0] transition-colors">GitHub</a>
                </div>
                <p class="text-xs text-[#444]">&copy; {{ date('Y') }} Orchestra MCP. All rights reserved.</p>
            </div>
        </div>
    </footer>

    @livewireScripts
</body>
</html>
