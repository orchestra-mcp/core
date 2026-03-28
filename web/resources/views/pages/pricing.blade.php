<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta name="theme-color" content="#0f0f23">
    <meta property="og:image" content="/img/cover.jpg">
    <title>Pricing - {{ config('app.name', 'Orchestra MCP') }}</title>
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
                <a href="{{ route('features') }}" class="text-[#a0a0b0] hover:text-white transition-colors">Features</a>
                <a href="{{ route('pricing') }}" class="text-white font-medium">Pricing</a>
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

        {{-- Header --}}
        <div class="relative max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
                <span class="gradient-text">Simple, transparent</span>
                <span class="text-white"> pricing</span>
            </h1>
            <p class="mt-4 text-lg text-[#a0a0b0] max-w-2xl mx-auto">
                Start free and scale as your team grows. No hidden fees, no surprises.
            </p>
        </div>

        {{-- Pricing cards --}}
        <div class="relative max-w-7xl mx-auto px-6 pb-24">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {{-- Free --}}
                <div class="relative bg-[#16213e] border border-[#2a2a4a] rounded-2xl p-8 flex flex-col">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Free</h3>
                        <p class="mt-1 text-sm text-[#a0a0b0]">For individuals getting started</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">$0</span>
                        <span class="text-[#a0a0b0] text-sm">/month</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            1 user
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            1 project
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            3 agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            100 tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            50 MB memory
                        </li>
                    </ul>
                    <a href="{{ route('register') }}" class="block w-full text-center px-6 py-3 border border-[#2a2a4a] text-white font-medium rounded-lg hover:bg-[#1e2a4a] transition-colors">
                        Get Started
                    </a>
                </div>

                {{-- Pro (Most Popular) --}}
                <div class="relative bg-[#16213e] border-2 border-brand-cyan rounded-2xl p-8 flex flex-col ring-1 ring-brand-cyan/20">
                    {{-- Badge --}}
                    <div class="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span class="inline-flex items-center px-4 py-1 gradient-bg text-white text-xs font-bold rounded-full uppercase tracking-wider">Most Popular</span>
                    </div>
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Pro</h3>
                        <p class="mt-1 text-sm text-[#a0a0b0]">For professionals and small teams</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">$29</span>
                        <span class="text-[#a0a0b0] text-sm">/month</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            5 users
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            10 projects
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            20 agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            2,000 tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            500 MB memory
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Priority support
                        </li>
                    </ul>
                    <a href="{{ route('register') }}" class="block w-full text-center px-6 py-3 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-opacity">
                        Start Pro Trial
                    </a>
                </div>

                {{-- Team --}}
                <div class="relative bg-[#16213e] border border-[#2a2a4a] rounded-2xl p-8 flex flex-col">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Team</h3>
                        <p class="mt-1 text-sm text-[#a0a0b0]">For growing teams and organizations</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">$99</span>
                        <span class="text-[#a0a0b0] text-sm">/month</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            25 users
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited projects
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            100 agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            10,000 tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            5 GB memory
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            SSO & audit logs
                        </li>
                    </ul>
                    <a href="{{ route('register') }}" class="block w-full text-center px-6 py-3 border border-[#2a2a4a] text-white font-medium rounded-lg hover:bg-[#1e2a4a] transition-colors">
                        Start Team Trial
                    </a>
                </div>

                {{-- Enterprise --}}
                <div class="relative bg-[#16213e] border border-[#2a2a4a] rounded-2xl p-8 flex flex-col">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Enterprise</h3>
                        <p class="mt-1 text-sm text-[#a0a0b0]">For large-scale deployments</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">Custom</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited users
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited projects
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Custom memory limits
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Dedicated support & SLA
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[#a0a0b0]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Self-hosted option
                        </li>
                    </ul>
                    <a href="mailto:sales@orchestra-mcp.com" class="block w-full text-center px-6 py-3 border border-[#2a2a4a] text-white font-medium rounded-lg hover:bg-[#1e2a4a] transition-colors">
                        Contact Sales
                    </a>
                </div>
            </div>
        </div>

        {{-- Comparison table --}}
        <div class="relative max-w-5xl mx-auto px-6 pb-24">
            <h2 class="text-2xl font-bold text-white text-center mb-10">Compare Plans</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-[#2a2a4a]">
                            <th class="text-left py-4 pr-4 text-[#a0a0b0] font-medium">Feature</th>
                            <th class="text-center py-4 px-4 text-white font-medium">Free</th>
                            <th class="text-center py-4 px-4 text-brand-cyan font-medium">Pro</th>
                            <th class="text-center py-4 px-4 text-white font-medium">Team</th>
                            <th class="text-center py-4 px-4 text-white font-medium">Enterprise</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#2a2a4a]">
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">Users</td>
                            <td class="py-3 px-4 text-center text-white">1</td>
                            <td class="py-3 px-4 text-center text-white">5</td>
                            <td class="py-3 px-4 text-center text-white">25</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">Projects</td>
                            <td class="py-3 px-4 text-center text-white">1</td>
                            <td class="py-3 px-4 text-center text-white">10</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">Agents</td>
                            <td class="py-3 px-4 text-center text-white">3</td>
                            <td class="py-3 px-4 text-center text-white">20</td>
                            <td class="py-3 px-4 text-center text-white">100</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">Tasks / month</td>
                            <td class="py-3 px-4 text-center text-white">100</td>
                            <td class="py-3 px-4 text-center text-white">2,000</td>
                            <td class="py-3 px-4 text-center text-white">10,000</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">Memory</td>
                            <td class="py-3 px-4 text-center text-white">50 MB</td>
                            <td class="py-3 px-4 text-center text-white">500 MB</td>
                            <td class="py-3 px-4 text-center text-white">5 GB</td>
                            <td class="py-3 px-4 text-center text-white">Custom</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">GitHub Integration</td>
                            <td class="py-3 px-4 text-center text-brand-cyan">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-brand-cyan">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-brand-cyan">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-brand-cyan">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            </td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">SSO & Audit Logs</td>
                            <td class="py-3 px-4 text-center text-[#555]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-[#555]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-brand-cyan">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-brand-cyan">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            </td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[#a0a0b0]">Self-Hosted Option</td>
                            <td class="py-3 px-4 text-center text-[#555]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-[#555]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-[#555]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-brand-cyan">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {{-- FAQ / CTA --}}
        <div class="relative max-w-3xl mx-auto px-6 pb-24 text-center">
            <h2 class="text-2xl font-bold text-white mb-4">Questions?</h2>
            <p class="text-[#a0a0b0] mb-6">
                Need help choosing a plan? Our team is here to help you find the right fit for your organization.
            </p>
            <a href="mailto:sales@orchestra-mcp.com" class="inline-flex items-center px-6 py-3 border border-[#2a2a4a] text-white font-medium rounded-lg hover:bg-[#1e2a4a] transition-colors">
                Talk to Sales
            </a>
        </div>
    </main>
</body>
</html>
