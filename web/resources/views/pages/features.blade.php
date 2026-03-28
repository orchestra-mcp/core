<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Features - {{ config('app.name', 'Orchestra MCP') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-white">
    {{-- Navigation --}}
    <header class="border-b border-gray-200">
        <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
            <a href="{{ route('home') }}" class="flex items-center gap-3">
                <div class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white text-sm font-bold">O</div>
                <span class="text-lg font-semibold text-gray-900">Orchestra MCP</span>
            </a>
            <nav class="flex items-center gap-6 text-sm">
                <a href="{{ route('features') }}" class="text-indigo-600 font-medium">Features</a>
                <a href="{{ route('pricing') }}" class="text-gray-600 hover:text-gray-900">Pricing</a>
                <a href="{{ route('docs') }}" class="text-gray-600 hover:text-gray-900">Docs</a>
                <a href="{{ route('login') }}" class="text-gray-600 hover:text-gray-900">Login</a>
            </nav>
        </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 class="text-4xl font-bold text-gray-900">Features</h1>
        <p class="mt-4 text-lg text-gray-600">Everything you need to run your company with AI.</p>
    </main>
</body>
</html>
