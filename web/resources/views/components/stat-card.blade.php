{{-- Studio-style Stat Card
     Usage: <x-stat-card label="Active Tokens" :value="$count" color="cyan" icon="key" />
--}}

@props([
    'label' => '',
    'value' => '0',
    'color' => 'cyan',
    'icon' => '',
])

@php
    $colorMap = [
        'cyan' => ['bg' => 'rgba(0, 229, 255, 0.08)', 'text' => '#00E5FF'],
        'purple' => ['bg' => 'rgba(169, 0, 255, 0.08)', 'text' => '#A900FF'],
        'green' => ['bg' => 'hsl(153.1 60.2% 52.7% / 0.08)', 'text' => 'hsl(153.1 60.2% 52.7%)'],
        'amber' => ['bg' => 'hsl(38.9 100% 42.9% / 0.08)', 'text' => 'hsl(38.9 100% 42.9%)'],
    ];
    $c = $colorMap[$color] ?? $colorMap['cyan'];
@endphp

<div class="rounded-lg p-5" style="background: var(--color-bg-surface-200); border: 1px solid var(--color-border);">
    <div class="flex items-center gap-3 mb-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-md" style="background: {{ $c['bg'] }};">
            <svg class="w-[18px] h-[18px]" style="color: {{ $c['text'] }};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {!! $icon !!}
            </svg>
        </div>
        <span class="text-[13px] font-medium" style="color: var(--color-text-muted);">{{ $label }}</span>
    </div>
    <p class="text-3xl font-semibold" style="color: var(--color-text-primary);">{{ $value }}</p>
</div>
