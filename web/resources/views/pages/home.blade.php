<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'Orchestra MCP') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-white">
    {{-- Navigation --}}
    <header class="border-b border-gray-200">
        <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
            <div class="flex items-center gap-3">
                <div class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white text-sm font-bold">O</div>
                <span class="text-lg font-semibold text-gray-900">Orchestra MCP</span>
            </div>
            <nav class="flex items-center gap-6 text-sm">
                <a href="{{ route('features') }}" class="text-gray-600 hover:text-gray-900">Features</a>
                <a href="{{ route('pricing') }}" class="text-gray-600 hover:text-gray-900">Pricing</a>
                <a href="{{ route('docs') }}" class="text-gray-600 hover:text-gray-900">Docs</a>
                <a href="{{ route('login') }}" class="text-gray-600 hover:text-gray-900">Login</a>
                <a href="{{ route('register') }}" class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Get Started</a>
            </nav>
        </div>
    </header>

    {{-- Hero --}}
    <main class="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 class="text-5xl font-bold text-gray-900 tracking-tight">
            Orchestra MCP
        </h1>
        <p class="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            Turn Claude into your 24/7 company OS
        </p>
        <div class="mt-10 flex items-center justify-center gap-4">
            <a href="{{ route('register') }}" class="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">
                Start Free Trial
            </a>
            <a href="{{ route('docs') }}" class="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                Read the Docs
            </a>
        </div>
    </main>
</body>
</html>
