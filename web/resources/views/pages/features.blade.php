<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#0f0f23">
    <meta property="og:image" content="/img/cover.jpg">
    <title>Features - {{ config('app.name', 'Orchestra MCP') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-[#0f0f23] text-[#e0e0e0]">
    {{-- Navigation --}}
    <header class="border-b border-[#2a2a4a]">
        <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
            <a href="{{ route('home') }}" class="flex items-center gap-3">
                <img src="/img/logo.svg" alt="Orchestra MCP" class="h-9 w-9">
                <span class="text-lg font-semibold gradient-text">Orchestra MCP</span>
            </a>
            <nav class="flex items-center gap-6 text-sm">
                <a href="{{ route('features') }}" class="text-white font-medium">Features</a>
                <a href="{{ route('pricing') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Pricing</a>
                <a href="{{ route('docs') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Docs</a>
                <a href="{{ route('login') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Login</a>
                <a href="{{ route('register') }}" class="inline-flex items-center px-4 py-2 gradient-bg text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Get Started</a>
            </nav>
        </div>
    </header>

    <main class="relative overflow-hidden">
        {{-- Background glow --}}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00E5FF] opacity-[0.05] blur-[120px] rounded-full"></div>
            <div class="absolute top-1/3 left-1/3 w-[600px] h-[300px] bg-[#A900FF] opacity-[0.05] blur-[120px] rounded-full"></div>
        </div>

        {{-- Hero --}}
        <div class="relative max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
                <span class="gradient-text">Everything you need</span>
                <br>
                <span class="text-white">to run your company with AI</span>
            </h1>
            <p class="mt-4 text-lg text-[#a0a0b0] max-w-2xl mx-auto">
                55 MCP tools, AI agent teams, real-time collaboration, and full self-hosting -- all in one platform.
            </p>
        </div>

        {{-- Feature sections --}}
        <div class="relative max-w-6xl mx-auto px-6 pb-24 space-y-20">

            {{-- MCP Tools --}}
            <section>
                <div class="flex items-start gap-6 mb-8">
                    <div class="shrink-0 w-14 h-14 rounded-xl gradient-bg flex items-center justify-center">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">55 MCP Tools</h2>
                        <p class="mt-2 text-[#a0a0b0] max-w-2xl">A comprehensive toolkit spanning 11 categories, all accessible through the Model Context Protocol. Every tool is designed to work seamlessly with Claude Code.</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    @php
                        $categories = [
                            ['Agents', 'Create, list, and manage AI agents with persistent context and memory.', 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'],
                            ['Tasks', 'Create tasks, assign to agents, track status, and manage dependencies.', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'],
                            ['Projects', 'Multi-project management with scoped resources and cross-project linking.', 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'],
                            ['Memory', 'Semantic memory with vector search, tagging, and automatic context retrieval.', 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'],
                            ['Activity', 'Full audit trail with activity feeds, filtering, and team-wide visibility.', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'],
                            ['Decisions', 'Log architectural decisions, rationale, alternatives, and outcomes.', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'],
                            ['Sessions', 'Persistent sessions with state management and cross-session continuity.', 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'],
                            ['Notes', 'Structured notes with markdown, tags, linking, and full-text search.', 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'],
                            ['Skills & Workflows', 'Automate multi-step workflows with reusable skill chains.', 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'],
                            ['Specs', 'Define and track technical specifications with versioning.', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'],
                            ['GitHub', 'Repository management, PR creation, and CLAUDE.md generation.', 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'],
                        ];
                    @endphp
                    @foreach ($categories as [$name, $desc, $icon])
                        <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-5 hover:bg-[#1e2a4a] transition-colors">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="w-8 h-8 rounded-lg bg-brand-cyan/10 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="{{ $icon }}"/></svg>
                                </div>
                                <h3 class="text-sm font-semibold text-white">{{ $name }}</h3>
                            </div>
                            <p class="text-xs text-[#a0a0b0] leading-relaxed">{{ $desc }}</p>
                        </div>
                    @endforeach
                </div>
            </section>

            {{-- AI Agent Team --}}
            <section>
                <div class="flex items-start gap-6 mb-8">
                    <div class="shrink-0 w-14 h-14 rounded-xl gradient-bg flex items-center justify-center">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">AI Agent Team</h2>
                        <p class="mt-2 text-[#a0a0b0] max-w-2xl">40+ specialized AI agents covering every discipline. Each agent has persistent memory, semantic search, and decision logging -- they remember context across sessions.</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Persistent Memory</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Every agent maintains long-term memory across sessions. Context is never lost -- agents pick up exactly where they left off.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Semantic Search</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Vector-powered search finds relevant context automatically. Agents retrieve the right information at the right time.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Decision Logging</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Every architectural decision is recorded with rationale, alternatives considered, and outcomes -- building an institutional knowledge base.</p>
                    </div>
                </div>
            </section>

            {{-- Team Sync --}}
            <section>
                <div class="flex items-start gap-6 mb-8">
                    <div class="shrink-0 w-14 h-14 rounded-xl gradient-bg flex items-center justify-center">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">Team Sync</h2>
                        <p class="mt-2 text-[#a0a0b0] max-w-2xl">Real-time collaboration across your entire team. Activity feeds, session tracking, and shared context keep everyone aligned.</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Realtime Collaboration</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">See what your team is working on in real time. Changes propagate instantly across all connected sessions.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Activity Feeds</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Full audit trail of every action across your organization. Filter by team, project, agent, or time range.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Session Tracking</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Track active sessions across all team members. Resume any session from any device with full context preservation.</p>
                    </div>
                </div>
            </section>

            {{-- GitHub Integration --}}
            <section>
                <div class="flex items-start gap-6 mb-8">
                    <div class="shrink-0 w-14 h-14 rounded-xl gradient-bg flex items-center justify-center">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">GitHub Integration</h2>
                        <p class="mt-2 text-[#a0a0b0] max-w-2xl">Deep GitHub integration for repository management, automated PR creation, and CLAUDE.md generation -- bridging AI agents with your codebase.</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Repo Management</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Connect and manage multiple repositories. Agents understand your codebase structure and conventions automatically.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">PR Creation</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">AI agents create pull requests with proper descriptions, linked issues, and review assignments -- all automated.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">CLAUDE.md Generation</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Auto-generate and maintain CLAUDE.md files that give AI agents deep understanding of your project structure and conventions.</p>
                    </div>
                </div>
            </section>

            {{-- Self-Hosted --}}
            <section>
                <div class="flex items-start gap-6 mb-8">
                    <div class="shrink-0 w-14 h-14 rounded-xl gradient-bg flex items-center justify-center">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/></svg>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">Self-Hosted</h2>
                        <p class="mt-2 text-[#a0a0b0] max-w-2xl">Full control over your data and infrastructure. Deploy on your own servers with Docker, manage with Supabase Studio, and never worry about vendor lock-in.</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Full Data Control</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Your data stays on your servers. Complete ownership with no third-party access to your codebase or agent memory.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">Supabase Studio Admin</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Manage your database, users, and storage with the full Supabase Studio admin panel. No command-line required.</p>
                    </div>
                    <div class="bg-[#16213e] border border-[#2a2a4a] rounded-xl p-6 hover:bg-[#1e2a4a] transition-colors">
                        <div class="w-10 h-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-4">
                            <svg class="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">No Vendor Lock-in</h3>
                        <p class="text-sm text-[#a0a0b0] leading-relaxed">Open standards, open protocol. Export your data anytime. Switch providers or self-host without losing anything.</p>
                    </div>
                </div>
            </section>
        </div>

        {{-- CTA --}}
        <div class="relative max-w-3xl mx-auto px-6 pb-24 text-center">
            <h2 class="text-2xl font-bold text-white mb-4">Ready to get started?</h2>
            <p class="text-[#a0a0b0] mb-8">
                Start free and upgrade as your team grows. No credit card required.
            </p>
            <div class="flex items-center justify-center gap-4">
                <a href="{{ route('register') }}" class="inline-flex items-center px-8 py-3.5 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-lg">
                    Start Free Trial
                </a>
                <a href="{{ route('docs') }}" class="inline-flex items-center px-8 py-3.5 border border-[#2a2a4a] text-white font-semibold rounded-lg hover:bg-[#1e2a4a] transition-colors text-lg">
                    Read the Docs
                </a>
            </div>
        </div>
    </main>
</body>
</html>
