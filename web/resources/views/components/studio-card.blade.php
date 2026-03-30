{{-- Studio-style Card / Section
     Usage:
     <x-studio-card title="Profile" description="Your personal info.">
         <form>...</form>
     </x-studio-card>
--}}

@props([
    'title' => '',
    'description' => '',
    'danger' => false,
])

@php
    $borderColor = $danger ? 'hsl(10.2 77.9% 53.9% / 0.2)' : 'var(--color-border)';
    $titleColor = $danger ? 'hsl(9.7 85.2% 62.9%)' : 'var(--color-text-primary)';
@endphp

<div class="rounded-lg overflow-hidden" style="border: 1px solid {{ $borderColor }}; background: var(--color-bg-sidebar);">
    @if($title)
    <div class="px-6 py-3.5" style="border-bottom: 1px solid {{ $borderColor }};">
        <h2 class="text-[13px] font-semibold" style="color: {{ $titleColor }};">{{ $title }}</h2>
        @if($description)
            <p class="text-[12px] mt-0.5" style="color: var(--color-text-muted);">{{ $description }}</p>
        @endif
    </div>
    @endif
    <div class="p-6">
        {{ $slot }}
    </div>
</div>
