{{-- Shared public header for home, features, pricing, docs --}}
{{-- Usage: <x-public-header :activePage="'home'" /> --}}
@props(['activePage' => ''])

<header class="sticky top-0 z-50 border-b border-[--color-border] bg-[--color-bg-alt]" x-data="{ mobileMenuOpen: false }">
    <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
        <div class="flex items-center gap-3">
            {{-- Mobile hamburger for docs sidebar (only on docs page) --}}
            @if($activePage === 'docs')
                <button @click="$dispatch('toggle-docs-nav')" class="lg:hidden text-[--color-brand-text-secondary] hover:text-[--color-brand-text] transition-colors cursor-pointer -ml-1">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                </button>
            @endif

            <a href="{{ route('home') }}" wire:navigate class="flex items-center gap-2.5">
                <img src="/img/logo.svg" alt="Orchestra MCP" class="h-8 w-8 sm:h-9 sm:w-9">
                <span class="text-base sm:text-lg font-semibold gradient-text">Orchestra MCP</span>
            </a>

            @if($activePage === 'docs')
                <span class="text-[--color-border] mx-1 sm:mx-2 hidden sm:inline">/</span>
                <span class="text-sm font-medium text-[--color-brand-text-secondary] hidden sm:inline">Documentation</span>
            @endif
        </div>

        {{-- Desktop nav --}}
        <nav class="hidden md:flex items-center gap-6 text-sm">
            <a href="{{ route('features') }}" wire:navigate class="{{ $activePage === 'features' ? 'text-white font-medium' : 'text-[--color-brand-text-secondary] hover:text-white transition-colors' }}">Features</a>
            <a href="{{ route('pricing') }}" wire:navigate class="{{ $activePage === 'pricing' ? 'text-white font-medium' : 'text-[--color-brand-text-secondary] hover:text-white transition-colors' }}">Pricing</a>
            <a href="{{ route('docs') }}" wire:navigate class="{{ $activePage === 'docs' ? 'text-white font-medium' : 'text-[--color-brand-text-secondary] hover:text-white transition-colors' }}">Docs</a>

            @auth
                <x-notification-bell />
                <x-user-dropdown />
            @endauth
            @guest
                <a href="{{ route('login') }}" wire:navigate class="text-[--color-brand-text-secondary] hover:text-white transition-colors">Login</a>
                <a href="{{ route('register') }}" wire:navigate class="inline-flex items-center px-4 py-2 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Get Started</a>
            @endguest
        </nav>

        {{-- Mobile hamburger --}}
        <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden text-[--color-brand-text-secondary] hover:text-white transition-colors cursor-pointer">
            <svg x-show="!mobileMenuOpen" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
            <svg x-show="mobileMenuOpen" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" x-cloak><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
    </div>

    {{-- Mobile menu dropdown --}}
    <div x-show="mobileMenuOpen" x-transition x-cloak class="md:hidden border-t border-[--color-border] bg-[--color-bg-alt]">
        <nav class="flex flex-col px-4 py-3 space-y-1">
            <a href="{{ route('features') }}" wire:navigate class="block px-3 py-2.5 text-sm {{ $activePage === 'features' ? 'text-white font-medium bg-[--color-bg-surface]' : 'text-[--color-brand-text-secondary] hover:text-white hover:bg-[--color-bg-surface]' }} rounded-md transition-colors">Features</a>
            <a href="{{ route('pricing') }}" wire:navigate class="block px-3 py-2.5 text-sm {{ $activePage === 'pricing' ? 'text-white font-medium bg-[--color-bg-surface]' : 'text-[--color-brand-text-secondary] hover:text-white hover:bg-[--color-bg-surface]' }} rounded-md transition-colors">Pricing</a>
            <a href="{{ route('docs') }}" wire:navigate class="block px-3 py-2.5 text-sm {{ $activePage === 'docs' ? 'text-white font-medium bg-[--color-bg-surface]' : 'text-[--color-brand-text-secondary] hover:text-white hover:bg-[--color-bg-surface]' }} rounded-md transition-colors">Docs</a>

            @auth
                <div class="pt-2 mt-1 border-t border-[--color-border]">
                    <a href="{{ route('dashboard') }}" wire:navigate class="block px-3 py-2.5 text-sm text-[--color-brand-text-secondary] hover:text-white hover:bg-[--color-bg-surface] rounded-md transition-colors">Dashboard</a>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="w-full text-left block px-3 py-2.5 text-sm text-[--color-brand-text-secondary] hover:text-red-400 hover:bg-[--color-bg-surface] rounded-md transition-colors cursor-pointer">Sign out</button>
                    </form>
                </div>
            @endauth
            @guest
                <a href="{{ route('login') }}" wire:navigate class="block px-3 py-2.5 text-sm text-[--color-brand-text-secondary] hover:text-white hover:bg-[--color-bg-surface] rounded-md transition-colors">Login</a>
                <a href="{{ route('register') }}" wire:navigate class="block px-3 py-2.5 text-sm text-center gradient-bg text-white font-medium rounded-lg hover:opacity-90 transition-opacity mt-1">Get Started</a>
            @endguest
        </nav>
    </div>
</header>
