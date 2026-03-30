{{-- Studio-style Slide-out Panel (from right)
     Usage:
     <x-slide-panel :open="$showPanel" title="User Details">
         <x-slot:tabs>
             <button class="active">Overview</button>
             <button>Logs</button>
         </x-slot:tabs>
         <div>Panel content...</div>
     </x-slide-panel>
--}}

@props([
    'open' => false,
    'title' => '',
    'width' => 'w-[420px]',
])

<div
    x-data="{ panelOpen: @entangle($attributes->wire('model')).live ?? {{ $open ? 'true' : 'false' }} }"
    x-show="panelOpen"
    x-cloak
    class="fixed inset-0 z-50 flex justify-end"
>
    {{-- Backdrop --}}
    <div
        x-show="panelOpen"
        x-transition:enter="transition-opacity ease-out duration-200"
        x-transition:enter-start="opacity-0"
        x-transition:enter-end="opacity-100"
        x-transition:leave="transition-opacity ease-in duration-150"
        x-transition:leave-start="opacity-100"
        x-transition:leave-end="opacity-0"
        class="absolute inset-0"
        style="background: rgba(0,0,0,0.5);"
        @click="panelOpen = false"
    ></div>

    {{-- Panel --}}
    <div
        x-show="panelOpen"
        x-transition:enter="transition ease-out duration-300"
        x-transition:enter-start="translate-x-full"
        x-transition:enter-end="translate-x-0"
        x-transition:leave="transition ease-in duration-200"
        x-transition:leave-start="translate-x-0"
        x-transition:leave-end="translate-x-full"
        class="relative {{ $width }} max-w-full h-full flex flex-col"
        style="background: var(--color-bg-default); border-left: 1px solid var(--color-border);"
    >
        {{-- Header --}}
        <div class="flex items-center justify-between px-5 py-3.5 shrink-0" style="border-bottom: 1px solid var(--color-border);">
            <h3 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">{{ $title }}</h3>
            <button @click="panelOpen = false"
                    class="p-1 rounded transition-colors cursor-pointer"
                    style="color: var(--color-text-muted);">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>

        {{-- Tabs (optional) --}}
        @if(isset($tabs))
        <div class="flex items-center gap-0 px-5 shrink-0" style="border-bottom: 1px solid var(--color-border);">
            {{ $tabs }}
        </div>
        @endif

        {{-- Content --}}
        <div class="flex-1 overflow-y-auto p-5">
            {{ $slot }}
        </div>
    </div>
</div>
