<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#121212">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700" rel="stylesheet" />

    <x-seo
        title="Documentation - Orchestra MCP"
        description="Learn how to set up and use Orchestra MCP. Full API reference, self-hosting guide, and tool documentation."
    />

    @vite(['resources/css/app.css', 'resources/js/app.js'])

    {{-- Syntax highlighting for code blocks --}}
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/core.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/json.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/bash.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/php.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/go.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/javascript.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/yaml.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/sql.min.js"></script>

    @livewireStyles
</head>
<body class="min-h-screen bg-[--color-bg-default] text-[--color-brand-text]" x-data="{ docsNavOpen: false }" @toggle-docs-nav.window="docsNavOpen = !docsNavOpen">
    {{-- Shared header with auth-aware nav --}}
    <x-public-header activePage="docs" />

    <div class="max-w-7xl mx-auto flex relative">
        {{-- Mobile docs nav overlay --}}
        <div
            x-show="docsNavOpen"
            x-transition:enter="transition-opacity ease-linear duration-200"
            x-transition:enter-start="opacity-0"
            x-transition:enter-end="opacity-100"
            x-transition:leave="transition-opacity ease-linear duration-200"
            x-transition:leave-start="opacity-100"
            x-transition:leave-end="opacity-0"
            class="fixed inset-0 z-30 bg-black/60 lg:hidden"
            @click="docsNavOpen = false"
            x-cloak
        ></div>

        {{-- Side navigation --}}
        <aside
            class="w-64 shrink-0 border-r border-[--color-border] py-8 pr-6 pl-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto
                   fixed z-40 bg-[--color-bg-default] lg:relative lg:z-auto lg:bg-transparent lg:block transition-transform duration-200 ease-in-out lg:translate-x-0"
            :class="docsNavOpen ? 'translate-x-0' : '-translate-x-full'"
        >
            <nav class="space-y-6">
                <div>
                    <h3 class="text-xs font-semibold text-[--color-brand-text-secondary] uppercase tracking-wider mb-2">Getting Started</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs.show', 'introduction') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">Introduction</a></li>
                        <li><a href="{{ route('docs.show', 'installation') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">Installation</a></li>
                        <li><a href="{{ route('docs.show', 'quickstart') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">Quick Start</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-xs font-semibold text-[--color-brand-text-secondary] uppercase tracking-wider mb-2">Core Concepts</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs.show', 'features') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">Features & Gates</a></li>
                        <li><a href="{{ route('docs.show', 'agents') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">Agents</a></li>
                        <li><a href="{{ route('docs.show', 'tools') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">Tools</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-xs font-semibold text-[--color-brand-text-secondary] uppercase tracking-wider mb-2">API Reference</h3>
                    <ul class="space-y-1">
                        <li><a href="{{ route('docs.show', 'api') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">REST API</a></li>
                        <li><a href="{{ route('docs.show', 'mcp-protocol') }}" wire:navigate @click="docsNavOpen = false" class="block px-3 py-1.5 text-sm text-[--color-brand-text-secondary] hover:text-brand-cyan rounded-md hover:bg-[--color-bg-card]">MCP Protocol</a></li>
                    </ul>
                </div>
            </nav>
        </aside>

        {{-- Breadcrumbs & Content --}}
        <main class="flex-1 py-6 px-4 sm:py-8 sm:px-6 lg:px-12 min-w-0">
            {{-- Breadcrumbs --}}
            <nav class="flex items-center gap-2 text-sm text-[--color-brand-text-secondary] mb-8">
                <a href="{{ route('docs') }}" wire:navigate class="hover:text-[--color-brand-text]">Docs</a>
                @if(request()->route('slug'))
                    <span>/</span>
                    <span class="text-[--color-brand-text] capitalize">{{ str_replace('-', ' ', request()->route('slug')) }}</span>
                @endif
            </nav>

            {{-- Markdown content wrapper with desktop-matching styles --}}
            <div class="docs-content">
                {{ $slot }}
            </div>
        </main>
    </div>

    {{-- Initialize highlight.js for code blocks --}}
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('pre code').forEach(function(el) {
                hljs.highlightElement(el);
            });
        });
        // Re-highlight on Livewire navigate
        document.addEventListener('livewire:navigated', function() {
            document.querySelectorAll('pre code').forEach(function(el) {
                hljs.highlightElement(el);
            });
        });
    </script>

    @livewireScripts
</body>
</html>
