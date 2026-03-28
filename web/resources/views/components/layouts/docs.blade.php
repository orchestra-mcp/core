<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#0f0f23">
    <meta property="og:image" content="/img/cover.jpg">

    <title>Docs - {{ $title ?? config('app.name', 'Orchestra MCP') }}</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-brand-dark text-brand-text">
    {{-- Top navigation --}}
    <header class="sticky top-0 z-20 bg-brand-surface border-b border-brand-border">
        <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
            <div class="flex items-center gap-3">
                <a href="{{ route('home') }}" class="flex items-center gap-3">
                    <img src="/img/logo.svg" alt="Orchestra MCP" class="h-8 w-8">
                    <span class="text-lg font-semibold gradient-text">Orchestra MCP</span>
                </a>
                <span class="text-brand-border mx-2">/</span>
                <span class="text-sm font-medium text-brand-text-secondary">Documentation</span>
            </div>
            <nav class="flex items-center gap-6 text-sm">
                <a href="{{ route('home') }}" class="text-brand-text-secondary hover:text-brand-text">Home</a>
                <a href="{{ route('features') }}" class="text-brand-text-secondary hover:text-brand-text">Features</a>
                <a href="{{ route('pricing') }}" class="text-brand-text-secondary hover:text-brand-text">Pricing</a>
            </nav>
        </div>
    </header>

    <div class="max-w-7xl mx-auto flex">
        {{-- Side navigation --}}
        <aside class="w-64 shrink-0 border-r border-brand-border py-8 pr-6 pl-6 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <nav class="space-y-6">
                <div>
                    <h3 class="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">Getting Started</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs', 'introduction') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">Introduction</a></li>
                        <li><a href="{{ route('docs', 'installation') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">Installation</a></li>
                        <li><a href="{{ route('docs', 'quickstart') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">Quick Start</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">Core Concepts</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs', 'features') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">Features & Gates</a></li>
                        <li><a href="{{ route('docs', 'agents') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">Agents</a></li>
                        <li><a href="{{ route('docs', 'tools') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">Tools</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">API Reference</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs', 'api') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">REST API</a></li>
                        <li><a href="{{ route('docs', 'mcp-protocol') }}" class="block px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-cyan rounded-md hover:bg-brand-card">MCP Protocol</a></li>
                    </ul>
                </div>
            </nav>
        </aside>

        {{-- Breadcrumbs & Content --}}
        <main class="flex-1 py-8 px-8 lg:px-12 min-w-0">
            {{-- Breadcrumbs --}}
            <nav class="flex items-center gap-2 text-sm text-brand-text-secondary mb-8">
                <a href="{{ route('docs') }}" class="hover:text-brand-text">Docs</a>
                @if(request()->route('slug'))
                    <span>/</span>
                    <span class="text-brand-text capitalize">{{ str_replace('-', ' ', request()->route('slug')) }}</span>
                @endif
            </nav>

            {{ $slot }}
        </main>
    </div>

    @livewireScripts
</body>
</html>
