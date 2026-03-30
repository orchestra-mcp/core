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
        title="Pricing - Orchestra MCP"
        description="Simple, transparent pricing. Start free and scale as your team grows. No hidden fees, no surprises."
    />

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-[--color-bg-default] text-[--color-text-secondary]">
    {{-- Navigation --}}
    <x-public-header activePage="pricing" />

    <main class="relative overflow-hidden">
        {{-- Background glow --}}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00E5FF] opacity-[0.06] blur-[120px] rounded-full"></div>
            <div class="absolute top-1/3 left-1/3 w-[600px] h-[300px] bg-[#A900FF] opacity-[0.06] blur-[120px] rounded-full"></div>
        </div>

        {{-- Header --}}
        <div class="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                <span class="gradient-text">Simple, transparent</span>
                <span class="text-white"> pricing</span>
            </h1>
            <p class="mt-4 text-base sm:text-lg text-[--color-brand-text-secondary] max-w-2xl mx-auto">
                Start free and scale as your team grows. No hidden fees, no surprises.
            </p>
        </div>

        {{-- Pricing cards --}}
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {{-- Free --}}
                <div class="relative bg-[--color-bg-surface] border border-[--color-border] rounded-2xl p-8 flex flex-col">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Free</h3>
                        <p class="mt-1 text-sm text-[--color-brand-text-secondary]">For individuals getting started</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">$0</span>
                        <span class="text-[--color-brand-text-secondary] text-sm">/month</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            1 user
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            1 project
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            3 agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            100 tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            50 MB memory
                        </li>
                    </ul>
                    <a href="{{ route('register') }}" wire:navigate class="block w-full text-center px-6 py-3 border border-[--color-border] text-white font-medium rounded-lg hover:bg-[--color-bg-surface-300] transition-colors">
                        Get Started
                    </a>
                </div>

                {{-- Pro (Most Popular) --}}
                <div class="relative bg-[--color-bg-surface] border-2 border-brand-cyan rounded-2xl p-8 flex flex-col ring-1 ring-brand-cyan/20">
                    {{-- Badge --}}
                    <div class="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span class="inline-flex items-center px-4 py-1 gradient-bg text-white text-xs font-bold rounded-full uppercase tracking-wider">Most Popular</span>
                    </div>
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Pro</h3>
                        <p class="mt-1 text-sm text-[--color-brand-text-secondary]">For professionals and small teams</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">$29</span>
                        <span class="text-[--color-brand-text-secondary] text-sm">/month</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            5 users
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            10 projects
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            20 agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            2,000 tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            500 MB memory
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Priority support
                        </li>
                    </ul>
                    <a href="{{ route('register') }}" wire:navigate class="block w-full text-center px-6 py-3 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-opacity">
                        Start Pro Trial
                    </a>
                </div>

                {{-- Team --}}
                <div class="relative bg-[--color-bg-surface] border border-[--color-border] rounded-2xl p-8 flex flex-col">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Team</h3>
                        <p class="mt-1 text-sm text-[--color-brand-text-secondary]">For growing teams and organizations</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">$99</span>
                        <span class="text-[--color-brand-text-secondary] text-sm">/month</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            25 users
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited projects
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            100 agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            10,000 tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            5 GB memory
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            SSO & audit logs
                        </li>
                    </ul>
                    <a href="{{ route('register') }}" wire:navigate class="block w-full text-center px-6 py-3 border border-[--color-border] text-white font-medium rounded-lg hover:bg-[--color-bg-surface-300] transition-colors">
                        Start Team Trial
                    </a>
                </div>

                {{-- Enterprise --}}
                <div class="relative bg-[--color-bg-surface] border border-[--color-border] rounded-2xl p-8 flex flex-col">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white">Enterprise</h3>
                        <p class="mt-1 text-sm text-[--color-brand-text-secondary]">For large-scale deployments</p>
                    </div>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-white">Custom</span>
                    </div>
                    <ul class="space-y-3 mb-8 flex-1">
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited users
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited projects
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited agents
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Unlimited tasks/month
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Custom memory limits
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Dedicated support & SLA
                        </li>
                        <li class="flex items-center gap-3 text-sm text-[--color-brand-text-secondary]">
                            <svg class="w-5 h-5 text-brand-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Self-hosted option
                        </li>
                    </ul>
                    <a href="mailto:sales@orchestra-mcp.com" class="block w-full text-center px-6 py-3 border border-[--color-border] text-white font-medium rounded-lg hover:bg-[--color-bg-surface-300] transition-colors">
                        Contact Sales
                    </a>
                </div>
            </div>
        </div>

        {{-- Comparison table --}}
        <div class="relative max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <h2 class="text-2xl font-bold text-white text-center mb-10">Compare Plans</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-[--color-border]">
                            <th class="text-left py-4 pr-4 text-[--color-brand-text-secondary] font-medium">Feature</th>
                            <th class="text-center py-4 px-4 text-white font-medium">Free</th>
                            <th class="text-center py-4 px-4 text-brand-cyan font-medium">Pro</th>
                            <th class="text-center py-4 px-4 text-white font-medium">Team</th>
                            <th class="text-center py-4 px-4 text-white font-medium">Enterprise</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[--color-border]">
                        <tr>
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">Users</td>
                            <td class="py-3 px-4 text-center text-white">1</td>
                            <td class="py-3 px-4 text-center text-white">5</td>
                            <td class="py-3 px-4 text-center text-white">25</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">Projects</td>
                            <td class="py-3 px-4 text-center text-white">1</td>
                            <td class="py-3 px-4 text-center text-white">10</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">Agents</td>
                            <td class="py-3 px-4 text-center text-white">3</td>
                            <td class="py-3 px-4 text-center text-white">20</td>
                            <td class="py-3 px-4 text-center text-white">100</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">Tasks / month</td>
                            <td class="py-3 px-4 text-center text-white">100</td>
                            <td class="py-3 px-4 text-center text-white">2,000</td>
                            <td class="py-3 px-4 text-center text-white">10,000</td>
                            <td class="py-3 px-4 text-center text-white">Unlimited</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">Memory</td>
                            <td class="py-3 px-4 text-center text-white">50 MB</td>
                            <td class="py-3 px-4 text-center text-white">500 MB</td>
                            <td class="py-3 px-4 text-center text-white">5 GB</td>
                            <td class="py-3 px-4 text-center text-white">Custom</td>
                        </tr>
                        <tr>
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">GitHub Integration</td>
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
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">SSO & Audit Logs</td>
                            <td class="py-3 px-4 text-center text-[--color-text-faint]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-[--color-text-faint]">
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
                            <td class="py-3 pr-4 text-[--color-brand-text-secondary]">Self-Hosted Option</td>
                            <td class="py-3 px-4 text-center text-[--color-text-faint]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-[--color-text-faint]">
                                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </td>
                            <td class="py-3 px-4 text-center text-[--color-text-faint]">
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
        <div class="relative max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 text-center">
            <h2 class="text-2xl font-bold text-white mb-4">Questions?</h2>
            <p class="text-[--color-brand-text-secondary] mb-6">
                Need help choosing a plan? Our team is here to help you find the right fit for your organization.
            </p>
            <a href="mailto:sales@orchestra-mcp.com" class="inline-flex items-center px-6 py-3 border border-[--color-border] text-white font-medium rounded-lg hover:bg-[--color-bg-surface-300] transition-colors">
                Talk to Sales
            </a>
        </div>
    </main>
    @livewireScripts
</body>
</html>
