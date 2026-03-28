<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>Docs - {{ config('app.name', 'Orchestra MCP') }}</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-white">
    {{-- Top navigation --}}
    <header class="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
            <div class="flex items-center gap-3">
                <a href="{{ route('home') }}" class="flex items-center gap-3">
                    <div class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white text-xs font-bold">O</div>
                    <span class="text-lg font-semibold text-gray-900">Orchestra MCP</span>
                </a>
                <span class="text-gray-300 mx-2">/</span>
                <span class="text-sm font-medium text-gray-600">Documentation</span>
            </div>
            <nav class="flex items-center gap-6 text-sm">
                <a href="{{ route('home') }}" class="text-gray-600 hover:text-gray-900">Home</a>
                <a href="{{ route('features') }}" class="text-gray-600 hover:text-gray-900">Features</a>
                <a href="{{ route('pricing') }}" class="text-gray-600 hover:text-gray-900">Pricing</a>
            </nav>
        </div>
    </header>

    <div class="max-w-7xl mx-auto flex">
        {{-- Side navigation --}}
        <aside class="w-64 shrink-0 border-r border-gray-200 py-8 pr-6 pl-6 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <nav class="space-y-6">
                <div>
                    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Getting Started</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs', 'introduction') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">Introduction</a></li>
                        <li><a href="{{ route('docs', 'installation') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">Installation</a></li>
                        <li><a href="{{ route('docs', 'quickstart') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">Quick Start</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Core Concepts</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs', 'features') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">Features & Gates</a></li>
                        <li><a href="{{ route('docs', 'agents') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">Agents</a></li>
                        <li><a href="{{ route('docs', 'tools') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">Tools</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">API Reference</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs', 'api') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">REST API</a></li>
                        <li><a href="{{ route('docs', 'mcp-protocol') }}" class="block px-3 py-1.5 text-sm text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">MCP Protocol</a></li>
                    </ul>
                </div>
            </nav>
        </aside>

        {{-- Breadcrumbs & Content --}}
        <main class="flex-1 py-8 px-8 lg:px-12 min-w-0">
            {{-- Breadcrumbs --}}
            <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8">
                <a href="{{ route('docs') }}" class="hover:text-gray-700">Docs</a>
                @if(request()->route('slug'))
                    <span>/</span>
                    <span class="text-gray-900 capitalize">{{ str_replace('-', ' ', request()->route('slug')) }}</span>
                @endif
            </nav>

            {{ $slot }}
        </main>
    </div>

    @livewireScripts
</body>
</html>
