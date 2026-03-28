<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#0f0f23">
    <meta property="og:image" content="/img/cover.jpg">

    <title>{{ $title ?? config('app.name', 'Orchestra MCP') }}</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-brand-dark flex flex-col items-center justify-center">
    {{-- Branding --}}
    <div class="mb-8 text-center">
        <img src="/img/logo.svg" alt="Orchestra MCP" class="h-16 mx-auto mb-4">
        <h1 class="text-2xl font-bold gradient-text">Orchestra MCP</h1>
    </div>

    {{-- Card --}}
    <div class="w-full max-w-md bg-brand-card rounded-xl shadow-lg border border-brand-border p-8">
        {{ $slot }}
    </div>

    @livewireScripts
</body>
</html>
