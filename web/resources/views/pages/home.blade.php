<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#0f0f23">
    <meta property="og:image" content="/img/cover.jpg">
    <title>{{ config('app.name', 'Orchestra MCP') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-[#0f0f23] text-[#e0e0e0]">
    {{-- Navigation --}}
    <header class="border-b border-[#2a2a4a]">
        <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
            <div class="flex items-center gap-3">
                <img src="/img/logo.svg" alt="Orchestra MCP" class="h-9 w-9">
                <span class="text-lg font-semibold gradient-text">Orchestra MCP</span>
            </div>
            <nav class="flex items-center gap-6 text-sm">
                <a href="{{ route('features') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Features</a>
                <a href="{{ route('pricing') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Pricing</a>
                <a href="{{ route('docs') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Docs</a>
                <a href="{{ route('login') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Login</a>
                <a href="{{ route('register') }}" class="inline-flex items-center px-4 py-2 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Get Started</a>
            </nav>
        </div>
    </header>

    {{-- Hero --}}
    <main class="relative overflow-hidden">
        {{-- Background glow effect --}}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00E5FF] opacity-[0.07] blur-[120px] rounded-full"></div>
            <div class="absolute top-1/3 left-1/3 w-[600px] h-[300px] bg-[#A900FF] opacity-[0.07] blur-[120px] rounded-full"></div>
        </div>

        <div class="relative max-w-4xl mx-auto px-6 py-28 text-center">
            {{-- Logo --}}
            <div class="mb-8">
                <img src="/img/logo.svg" alt="Orchestra MCP" class="h-20 mx-auto">
            </div>

            {{-- Heading --}}
            <h1 class="text-5xl sm:text-6xl font-bold tracking-tight">
                <span class="gradient-text">Turn Claude AI into your</span>
                <br>
                <span class="text-white">24/7 company OS</span>
            </h1>

            {{-- Subheading --}}
            <p class="mt-6 text-xl text-[#a0a0b0] max-w-2xl mx-auto leading-relaxed">
                Orchestra MCP transforms Claude Code into a full product-development platform with AI agents, feature workflows, and project management built in.
            </p>

            {{-- CTA Buttons --}}
            <div class="mt-10 flex items-center justify-center gap-4">
                <a href="{{ route('register') }}" class="inline-flex items-center px-8 py-3.5 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-lg">
                    Start Free Trial
                </a>
                <a href="{{ route('docs') }}" class="inline-flex items-center px-8 py-3.5 border border-[#2a2a4a] text-[#e0e0e0] font-semibold rounded-lg hover:bg-[#1a1a2e] transition-colors text-lg">
                    Read the Docs
                </a>
            </div>
        </div>

        {{-- Features grid --}}
        <div class="relative max-w-6xl mx-auto px-6 pb-24">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                {{-- Feature 1 --}}
                <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                    <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center mb-4">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">49 MCP Tools</h3>
                    <p class="text-sm text-[#a0a0b0] leading-relaxed">Feature workflows, gates, reviews, and marketplace tools all accessible through the Model Context Protocol.</p>
                </div>

                {{-- Feature 2 --}}
                <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                    <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center mb-4">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">AI Agent Team</h3>
                    <p class="text-sm text-[#a0a0b0] leading-relaxed">40+ specialized agents covering backend, frontend, mobile, DevOps, design, QA, and business -- each with domain expertise.</p>
                </div>

                {{-- Feature 3 --}}
                <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                    <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center mb-4">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">Feature Workflows</h3>
                    <p class="text-sm text-[#a0a0b0] leading-relaxed">Built-in project management with feature gates, code reviews, sprint planning, and quality checkpoints.</p>
                </div>
            </div>
        </div>
    </main>
</body>
</html>
