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
        :title="isset($title) ? $title . ' - Orchestra MCP' : config('app.name', 'Orchestra MCP')"
        description="Sign in to Orchestra MCP — your AI-powered company operating system."
    />

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-[--color-bg-default] flex flex-col items-center justify-center px-4">
    {{-- Branding --}}
    <div class="mb-10 text-center">
        <a href="{{ route('home') }}" wire:navigate>
            <img src="/img/logo.svg" alt="Orchestra MCP" class="h-12 mx-auto mb-4">
            <h1 class="text-xl font-semibold gradient-text tracking-tight">Orchestra MCP</h1>
        </a>
    </div>

    {{-- Card --}}
    <div class="w-full max-w-[420px] bg-[--color-bg-card] rounded-lg border border-[--color-border] p-5 sm:p-8 shadow-xl shadow-black/20">
        {{ $slot }}
    </div>

    {{-- Footer --}}
    <div class="mt-8 text-center">
        <p class="text-xs text-[--color-text-faint]">&copy; {{ date('Y') }} Orchestra MCP. All rights reserved.</p>
    </div>

    @livewireScripts
</body>
</html>
