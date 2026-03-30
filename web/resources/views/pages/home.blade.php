<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#121212">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700" rel="stylesheet" />

    <x-seo
        title="Orchestra MCP — Turn Claude AI into a 24/7 Autonomous Company Operating System"
        description="Orchestra MCP transforms Claude Code into a full product-development platform with 91+ MCP tools, AI agents, persistent memory, team sync, and a desktop app. Open source, self-hosted."
    />

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-[--color-bg-default] text-[--color-text-secondary]">
    {{-- ===== Navigation ===== --}}
    <x-public-header activePage="home" />

    <main class="relative overflow-hidden">
        {{-- ===== HERO ===== --}}
        <section class="relative">
            {{-- Background glow effect --}}
            <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[300px] sm:h-[400px] bg-[#00E5FF] opacity-[0.06] blur-[120px] rounded-full"></div>
                <div class="absolute top-1/3 left-1/3 w-[400px] sm:w-[600px] h-[200px] sm:h-[300px] bg-[#A900FF] opacity-[0.06] blur-[120px] rounded-full"></div>
            </div>

            <div class="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-28 text-center">
                {{-- Logo --}}
                <div class="mb-6 sm:mb-8 fade-in-up">
                    <svg class="h-14 sm:h-20 mx-auto" viewBox="0 0 725.06 724.82" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="hero-grad" x1="671.57" y1="599.9" x2="188.27" y2="219.43" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a900ff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs>
                        <path fill="url(#hero-grad)" d="M670.75,54.19c-8.34-8.34-21.81-8.54-30.39-.45L61.86,599.32c-6.59,6.22-11.12,14.18-13.08,23.03-3.36,15.13,1.17,30.71,12.14,41.68,8.58,8.58,19.99,13.22,31.8,13.22,3.28,0,6.59-.36,9.87-1.09,8.84-1.96,16.81-6.49,23.03-13.08L671.19,84.58c8.09-8.58,7.9-22.05-.45-30.39Z"/>
                        <path fill="url(#hero-grad)" d="M661.8,158.12l-54.6,57.88c25.67,42.78,40.44,92.88,40.44,146.41,0,157.51-127.72,285.23-285.23,285.23-47.55,0-92.41-11.64-131.84-32.28l-54.56,57.88c54.46,32.75,118.25,51.58,186.41,51.58,200.16,0,362.41-162.25,362.41-362.41,0-75.77-23.25-146.11-63.02-204.29ZM362.41,77.18c53.59,0,103.72,14.8,146.54,40.54l57.88-54.6C508.65,23.29,438.25,0,362.41,0,162.25,0,0,162.25,0,362.41c0,68.22,18.86,132.04,51.68,186.54l57.85-54.56c-20.67-39.46-32.35-84.36-32.35-131.98,0-157.51,127.72-285.23,285.23-285.23Z"/>
                        <path fill="url(#hero-grad)" d="M362.41,130.87c-127.88,0-231.54,103.66-231.54,231.54,0,33.22,6.98,64.8,19.6,93.35l58.82-55.47c-3.02-12.15-4.6-24.83-4.6-37.89,0-87.11,70.6-157.72,157.72-157.72,16.31,0,32.01,2.48,46.81,7.05l58.79-55.44c-31.64-16.27-67.55-25.44-105.6-25.44ZM568.58,256.94l-55.47,58.82c4.56,14.73,7.01,30.4,7.01,46.64,0,87.11-70.6,157.72-157.72,157.72-12.99,0-25.64-1.58-37.72-4.53l-55.5,58.82c28.52,12.55,60.03,19.53,93.22,19.53,127.88,0,231.54-103.66,231.54-231.54,0-37.99-9.16-73.86-25.37-105.47Z"/>
                    </svg>
                </div>

                {{-- Heading --}}
                <h1 class="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight fade-in-up fade-in-up-delay-1">
                    <span class="gradient-text">Turn Claude AI into a 24/7</span>
                    <br>
                    <span class="text-white">Autonomous Company Operating System</span>
                </h1>

                {{-- Subheading --}}
                <p class="mt-4 sm:mt-6 text-base sm:text-xl text-[--color-brand-text-secondary] max-w-2xl mx-auto leading-relaxed fade-in-up fade-in-up-delay-2">
                    Orchestra MCP transforms Claude Code into a full product-development platform with AI agents, feature workflows, persistent memory, and project management built in.
                </p>

                {{-- CTA Buttons --}}
                <div class="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 fade-in-up fade-in-up-delay-3">
                    <a href="{{ route('register') }}" wire:navigate class="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-base sm:text-lg">
                        Get Started
                    </a>
                    <a href="https://github.com/orchestra-mcp/framework" target="_blank" rel="noopener" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-[--color-border] text-white font-semibold rounded-lg hover:bg-[--color-bg-surface] transition-colors text-base sm:text-lg">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                        GitHub
                    </a>
                </div>
            </div>
        </section>

        {{-- ===== FEATURES (4 cards) ===== --}}
        <section class="relative max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
            <h2 class="text-2xl sm:text-3xl font-bold text-white text-center mb-4">Everything you need to run your company with AI</h2>
            <p class="text-center text-[--color-brand-text-secondary] max-w-2xl mx-auto mb-10 sm:mb-14">One platform. One protocol. Complete autonomy.</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {{-- Card 1 --}}
                <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-6 hover:border-[--color-border-strong] transition-colors">
                    <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center mb-4">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">91+ MCP Tools</h3>
                    <p class="text-sm text-[--color-brand-text-secondary] leading-relaxed">Feature workflows, gates, reviews, and marketplace tools all accessible through the Model Context Protocol.</p>
                </div>

                {{-- Card 2 --}}
                <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-6 hover:border-[--color-border-strong] transition-colors">
                    <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center mb-4">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">Persistent Memory</h3>
                    <p class="text-sm text-[--color-brand-text-secondary] leading-relaxed">Vector-powered semantic memory with context that persists across sessions. Agents never lose track of your project.</p>
                </div>

                {{-- Card 3 --}}
                <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-6 hover:border-[--color-border-strong] transition-colors">
                    <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center mb-4">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">Team Sync</h3>
                    <p class="text-sm text-[--color-brand-text-secondary] leading-relaxed">Real-time collaboration with activity feeds, session tracking, and shared context across your entire team.</p>
                </div>

                {{-- Card 4 --}}
                <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-6 hover:border-[--color-border-strong] transition-colors">
                    <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center mb-4">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">Desktop App</h3>
                    <p class="text-sm text-[--color-brand-text-secondary] leading-relaxed">Native desktop app built with Tauri for document editing, markdown preview, and direct MCP connection management.</p>
                </div>
            </div>
        </section>

        {{-- ===== HOW IT WORKS (3 steps) ===== --}}
        <section class="relative py-16 sm:py-24 border-t border-[--color-border]">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 text-center">
                <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">How It Works</h2>
                <p class="text-[--color-brand-text-secondary] max-w-xl mx-auto mb-12 sm:mb-16">Three steps to an AI-powered team that works around the clock.</p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
                    {{-- Step 1 --}}
                    <div class="text-center">
                        <div class="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">1</div>
                        <h3 class="text-lg font-semibold text-white mb-2">Register</h3>
                        <p class="text-sm text-[--color-brand-text-secondary] leading-relaxed">Create your account, set up your organization, and invite your team members.</p>
                    </div>

                    {{-- Step 2 --}}
                    <div class="text-center">
                        <div class="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">2</div>
                        <h3 class="text-lg font-semibold text-white mb-2">Connect</h3>
                        <p class="text-sm text-[--color-brand-text-secondary] leading-relaxed">Get your MCP token and add it to Claude Code, Claude Desktop, or any MCP-compatible client.</p>
                    </div>

                    {{-- Step 3 --}}
                    <div class="text-center">
                        <div class="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">3</div>
                        <h3 class="text-lg font-semibold text-white mb-2">AI Team Works 24/7</h3>
                        <p class="text-sm text-[--color-brand-text-secondary] leading-relaxed">Your AI agents manage tasks, track decisions, maintain memory, and collaborate in real time -- around the clock.</p>
                    </div>
                </div>
            </div>
        </section>

        {{-- ===== TECH STACK ===== --}}
        <section class="relative py-16 sm:py-24 border-t border-[--color-border]">
            <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center">
                <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Built with Modern Tech</h2>
                <p class="text-[--color-brand-text-secondary] max-w-xl mx-auto mb-12 sm:mb-16">Every layer optimized for performance and developer experience.</p>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                    {{-- Go --}}
                    <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-5 sm:p-6 flex flex-col items-center hover:border-[--color-border-strong] transition-colors">
                        <svg class="w-10 h-10 mb-3 text-[#00ADD8]" viewBox="0 0 256 256" fill="currentColor"><path d="M30.4 112.8s-.8 0-.8-.8l3.2-3.2s.8 0 .8.8l16 4.8s.8.8 0 .8L30.4 112.8z"/><path d="M4.8 123.2s-.8 0-.8-.8l3.2-3.2s.8 0 .8.8l32.8 6.4s.8.8 0 .8L4.8 123.2z"/><path d="M48 133.6s-.8 0 0-.8l3.2-4s.8 0 .8.8l20.8 4s.8.8 0 .8L48 133.6z"/><path d="M186.4 121.6c-6.4-4-16-7.2-24-7.2-8.8 0-15.2 4-15.2 9.6 0 6.4 6.4 8 16.8 9.6 16 2.4 24 6.4 24 18.4 0 12-11.2 19.2-28.8 19.2-12 0-22.4-3.2-31.2-10.4l8-8.8c7.2 5.6 14.4 8 24 8 9.6 0 16-3.2 16-9.6 0-5.6-4-7.2-16.8-9.6-16-2.4-24.8-8-24.8-18.4s10.4-19.2 27.2-19.2c11.2 0 20 2.4 28 8l-3.2 10.4z"/><path d="M221.6 143.2c8.8 0 16.8-3.2 20.8-8l9.6 6.4c-7.2 8-16.8 12.8-30.4 12.8-20.8 0-36-12.8-36-33.6 0-19.2 14.4-33.6 34.4-33.6 20 0 32 14.4 32 33.6 0 2.4 0 4-.8 5.6H198.4c2.4 10.4 11.2 16.8 23.2 16.8zm19.2-26.4c-2.4-10.4-9.6-16.8-20-16.8-11.2 0-19.2 6.4-21.6 16.8h41.6z"/><path d="M112 90.4h12V152H112l-1.6-8.8C104 150.4 96 154.4 86.4 154.4 66.4 154.4 52.8 140 52.8 120.8c0-20 14.4-33.6 33.6-33.6 10.4 0 18.4 4 24.8 11.2L112 90.4zm-24 52c12.8 0 24-9.6 24-22.4s-11.2-22.4-24-22.4-22.4 9.6-22.4 22.4 9.6 22.4 22.4 22.4z"/></svg>
                        <h3 class="text-sm font-semibold text-white">Go</h3>
                        <p class="text-xs text-[--color-text-muted] mt-1">MCP Server</p>
                    </div>

                    {{-- Laravel --}}
                    <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-5 sm:p-6 flex flex-col items-center hover:border-[--color-border-strong] transition-colors">
                        <svg class="w-10 h-10 mb-3 text-[#FF2D20]" viewBox="0 0 256 264" fill="currentColor"><path d="M255.856 59.62c.095.351.144.713.144 1.077v56.568c0 1.478-.79 2.843-2.073 3.578l-47.458 27.402v54.258c0 1.478-.79 2.843-2.073 3.578l-99.108 57.246c-.227.128-.474.21-.722.299-.093.03-.18.09-.28.12-.333.096-.68.156-1.027.156s-.694-.06-1.027-.156c-.118-.04-.218-.1-.332-.14-.24-.085-.48-.165-.692-.285L2.073 204.503C.79 203.768 0 202.403 0 200.925V31.221c0-.364.05-.726.144-1.077.03-.12.1-.222.144-.34.08-.215.152-.437.255-.636.064-.127.16-.234.234-.352.109-.17.21-.348.339-.497.09-.106.206-.186.306-.28.13-.12.25-.248.4-.348L50.588.055c1.283-.74 2.863-.74 4.146 0l49.564 28.636c.15.1.27.228.4.348.1.094.215.174.305.28.13.149.23.326.34.497.074.118.17.225.234.352.104.2.176.421.255.636.043.118.114.22.144.34.095.351.144.713.144 1.077v106.458l41.327-23.862V57.49c0-.364.05-.726.144-1.077.03-.12.1-.222.144-.34.08-.215.152-.437.255-.636.064-.127.16-.234.234-.352.109-.17.21-.348.339-.497.09-.106.206-.186.306-.28.13-.12.25-.248.4-.348l49.564-28.636c1.283-.74 2.863-.74 4.146 0l49.564 28.636c.15.1.27.228.4.348.1.094.215.174.305.28.13.149.23.326.34.497.074.118.17.225.234.352.104.2.176.421.255.636.043.118.114.22.144.34z"/></svg>
                        <h3 class="text-sm font-semibold text-white">Laravel</h3>
                        <p class="text-xs text-[--color-text-muted] mt-1">Web App</p>
                    </div>

                    {{-- Supabase --}}
                    <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-5 sm:p-6 flex flex-col items-center hover:border-[--color-border-strong] transition-colors">
                        <svg class="w-10 h-10 mb-3 text-[#3ECF8E]" viewBox="0 0 109 113" fill="none"><path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874L63.708 110.284z" fill="url(#sb1)"/><path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874L63.708 110.284z" fill="url(#sb2)" fill-opacity=".2"/><path d="M45.317 2.07c2.86-3.602 8.658-1.628 8.727 2.97l.347 67.251H9.262c-8.19 0-12.758-9.46-7.665-15.875L45.317 2.072z" fill="#3ECF8E"/><defs><linearGradient id="sb1" x1="53.974" y1="54.974" x2="94.163" y2="71.829" gradientUnits="userSpaceOnUse"><stop stop-color="#249361"/><stop offset="1" stop-color="#3ECF8E"/></linearGradient><linearGradient id="sb2" x1="36.156" y1="30.578" x2="54.484" y2="65.081" gradientUnits="userSpaceOnUse"><stop/><stop offset="1" stop-opacity="0"/></linearGradient></defs></svg>
                        <h3 class="text-sm font-semibold text-white">Supabase</h3>
                        <p class="text-xs text-[--color-text-muted] mt-1">Auth, Realtime, DB</p>
                    </div>

                    {{-- Tauri --}}
                    <div class="bg-[--color-bg-surface] border border-[--color-border] rounded-xl p-5 sm:p-6 flex flex-col items-center hover:border-[--color-border-strong] transition-colors">
                        <svg class="w-10 h-10 mb-3 text-[#FFC131]" viewBox="0 0 256 256" fill="currentColor"><circle cx="128" cy="128" r="40"/><circle cx="128" cy="128" r="110" fill="none" stroke="currentColor" stroke-width="20"/><circle cx="190" cy="66" r="18"/><circle cx="66" cy="190" r="18"/></svg>
                        <h3 class="text-sm font-semibold text-white">Tauri</h3>
                        <p class="text-xs text-[--color-text-muted] mt-1">Desktop App</p>
                    </div>
                </div>
            </div>
        </section>

        {{-- ===== OPEN SOURCE ===== --}}
        <section class="relative py-16 sm:py-24 border-t border-[--color-border]">
            <div class="max-w-3xl mx-auto px-4 sm:px-6 text-center">
                <div class="w-16 h-16 rounded-2xl bg-[--color-bg-surface] border border-[--color-border] flex items-center justify-center mx-auto mb-6">
                    <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                </div>
                <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Open Source</h2>
                <p class="text-[--color-brand-text-secondary] max-w-xl mx-auto mb-8 leading-relaxed">
                    Orchestra MCP is open source under the MIT License. Self-host on your own infrastructure, contribute to the codebase, or build custom integrations. Your data, your rules.
                </p>
                <div class="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                    <a href="{{ route('register') }}" wire:navigate class="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-lg">
                        Start Free
                    </a>
                    <a href="https://github.com/orchestra-mcp/framework" target="_blank" rel="noopener" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-[--color-border] text-white font-semibold rounded-lg hover:bg-[--color-bg-surface] transition-colors text-lg">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                        View on GitHub
                    </a>
                </div>
            </div>
        </section>

        {{-- ===== FOOTER ===== --}}
        <footer class="border-t border-[--color-border] py-12 sm:py-16">
            <div class="max-w-6xl mx-auto px-4 sm:px-6">
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-8">
                    {{-- Brand --}}
                    <div class="col-span-2 sm:col-span-1">
                        <div class="flex items-center gap-2 mb-4">
                            <img src="/img/logo.svg" alt="Orchestra MCP" class="h-7 w-7">
                            <span class="text-sm font-semibold gradient-text">Orchestra MCP</span>
                        </div>
                        <p class="text-xs text-[--color-text-muted] leading-relaxed">Turn Claude AI into a 24/7 autonomous company operating system.</p>
                    </div>

                    {{-- Product --}}
                    <div>
                        <h4 class="text-xs font-semibold text-white uppercase tracking-wider mb-3">Product</h4>
                        <ul class="space-y-2">
                            <li><a href="{{ route('features') }}" wire:navigate class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">Features</a></li>
                            <li><a href="{{ route('pricing') }}" wire:navigate class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">Pricing</a></li>
                            <li><a href="{{ route('docs') }}" wire:navigate class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">Documentation</a></li>
                        </ul>
                    </div>

                    {{-- Resources --}}
                    <div>
                        <h4 class="text-xs font-semibold text-white uppercase tracking-wider mb-3">Resources</h4>
                        <ul class="space-y-2">
                            <li><a href="https://github.com/orchestra-mcp/framework" target="_blank" rel="noopener" class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">GitHub</a></li>
                            <li><a href="{{ route('docs.show', 'api') }}" wire:navigate class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">API Reference</a></li>
                            <li><a href="{{ route('docs.show', 'mcp-protocol') }}" wire:navigate class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">MCP Protocol</a></li>
                        </ul>
                    </div>

                    {{-- Company --}}
                    <div>
                        <h4 class="text-xs font-semibold text-white uppercase tracking-wider mb-3">Account</h4>
                        <ul class="space-y-2">
                            <li><a href="{{ route('login') }}" wire:navigate class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">Login</a></li>
                            <li><a href="{{ route('register') }}" wire:navigate class="text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors">Register</a></li>
                        </ul>
                    </div>
                </div>

                <div class="mt-10 pt-6 border-t border-[--color-border] flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p class="text-xs text-[--color-text-faint]">&copy; {{ date('Y') }} Orchestra MCP. MIT License.</p>
                    <p class="text-xs text-[--color-text-faint]">Built with Go, Laravel, Supabase, and Tauri</p>
                </div>
            </div>
        </footer>
    </main>

    @livewireScripts
</body>
</html>
