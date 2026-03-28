<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'Orchestra MCP') }}</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
    {{-- Branding --}}
    <div class="mb-8 text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-2xl font-bold mb-4">
            O
        </div>
        <h1 class="text-2xl font-bold text-gray-900">{{ config('app.name', 'Orchestra MCP') }}</h1>
    </div>

    {{-- Card --}}
    <div class="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {{ $slot }}
    </div>

    @livewireScripts
</body>
</html>
