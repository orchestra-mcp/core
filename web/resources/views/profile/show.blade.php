<x-layouts.public
    :title="$user->name . ' (@' . $user->handle . ')'"
    :description="$user->bio ? Str::limit($user->bio, 160) : $user->name . ' on Orchestra MCP'"
>
    <div class="relative">
        {{-- Cover / background gradient glow --}}
        <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#00e5ff] opacity-[0.04] blur-[120px] rounded-full"></div>
            <div class="absolute top-20 left-1/3 w-[600px] h-[250px] bg-[#a900ff] opacity-[0.04] blur-[120px] rounded-full"></div>
        </div>

        {{-- Cover image (if set) --}}
        @if($user->cover_url)
            <div class="relative h-48 sm:h-64 overflow-hidden">
                <img src="{{ $user->cover_url }}" alt="" class="w-full h-full object-cover opacity-40">
                <div class="absolute inset-0" style="background: linear-gradient(to bottom, transparent 50%, #0f0f12 100%);"></div>
            </div>
        @else
            <div class="h-24 sm:h-32"></div>
        @endif

        {{-- Profile content --}}
        <div class="relative max-w-3xl mx-auto px-4 sm:px-6 {{ $user->cover_url ? '-mt-20' : 'pt-8' }} pb-16">

            {{-- Avatar --}}
            <div class="mb-6">
                <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#0f0f12] overflow-hidden public-glow"
                     style="background: linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(169, 0, 255, 0.15));">
                    @if($user->avatar_url ?? null)
                        <img src="{{ $user->avatar_url }}" alt="{{ $user->name }}" class="w-full h-full object-cover">
                    @else
                        <div class="w-full h-full flex items-center justify-center">
                            <span class="text-4xl sm:text-5xl font-bold public-gradient-text">
                                {{ strtoupper(substr($user->name, 0, 1)) }}
                            </span>
                        </div>
                    @endif
                </div>
            </div>

            {{-- Name and handle --}}
            <div class="mb-4">
                <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">{{ $user->name }}</h1>
                @if($user->handle)
                    <p class="mt-1 text-base text-[#666]">
                        <span class="public-gradient-text font-medium">@{{ $user->handle }}</span>
                    </p>
                @endif
            </div>

            {{-- Bio --}}
            @if($user->bio)
                <p class="text-[#a0a0a0] text-base leading-relaxed max-w-xl mb-6">{{ $user->bio }}</p>
            @endif

            {{-- Badges --}}
            @if($user->badges && count($user->badges) > 0)
                <div class="flex flex-wrap gap-2 mb-8">
                    @foreach($user->badges as $badge)
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-white/[0.08]"
                              style="background: rgba(255, 255, 255, 0.03);">
                            @if(isset($badge['icon']))
                                <span>{{ $badge['icon'] }}</span>
                            @endif
                            <span class="text-[#c0c0c0]">{{ $badge['label'] ?? $badge }}</span>
                        </span>
                    @endforeach
                </div>
            @endif

            {{-- Tabs --}}
            <div x-data="{ activeTab: 'projects' }" class="mt-8">
                {{-- Tab navigation --}}
                <div class="flex gap-1 border-b border-white/[0.08] mb-6">
                    @php
                        $tabs = [
                            'projects' => ['label' => 'Projects', 'icon' => 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'],
                            'agents' => ['label' => 'Agents', 'icon' => 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'],
                            'skills' => ['label' => 'Skills', 'icon' => 'M13 10V3L4 14h7v7l9-11h-7z'],
                        ];
                    @endphp
                    @foreach($tabs as $key => $tab)
                        <button
                            @click="activeTab = '{{ $key }}'"
                            :class="activeTab === '{{ $key }}'
                                ? 'text-white border-b-2 border-[#00e5ff]'
                                : 'text-[#666] hover:text-[#a0a0a0] border-b-2 border-transparent'"
                            class="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer -mb-[1px]"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="{{ $tab['icon'] }}"/>
                            </svg>
                            {{ $tab['label'] }}
                        </button>
                    @endforeach
                </div>

                {{-- Tab content --}}
                <div x-show="activeTab === 'projects'" x-transition>
                    <div class="rounded-xl border border-white/[0.08] p-8 sm:p-12 text-center" style="background: rgba(255, 255, 255, 0.02);">
                        <svg class="w-12 h-12 mx-auto mb-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                        </svg>
                        <p class="text-[#666] text-sm">No public projects yet</p>
                    </div>
                </div>

                <div x-show="activeTab === 'agents'" x-transition>
                    <div class="rounded-xl border border-white/[0.08] p-8 sm:p-12 text-center" style="background: rgba(255, 255, 255, 0.02);">
                        <svg class="w-12 h-12 mx-auto mb-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                        </svg>
                        <p class="text-[#666] text-sm">No public agents yet</p>
                    </div>
                </div>

                <div x-show="activeTab === 'skills'" x-transition>
                    <div class="rounded-xl border border-white/[0.08] p-8 sm:p-12 text-center" style="background: rgba(255, 255, 255, 0.02);">
                        <svg class="w-12 h-12 mx-auto mb-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        <p class="text-[#666] text-sm">No public skills yet</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-layouts.public>
