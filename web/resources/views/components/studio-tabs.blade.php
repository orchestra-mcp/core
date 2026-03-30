{{-- Studio-style Tab Navigation
     Usage:
     <x-studio-tabs :tabs="['Overview', 'Logs', 'Raw JSON']" :active="0" />
--}}

@props([
    'tabs' => [],
    'active' => 0,
    'model' => null,
])

<div class="flex items-center gap-0" style="border-bottom: 1px solid var(--color-border);">
    @foreach($tabs as $i => $tab)
        @php $isActive = $i === $active; @endphp
        <button
            @if($model) wire:click="$set('{{ $model }}', {{ $i }})" @endif
            class="px-4 py-2.5 text-[13px] font-medium transition-colors relative cursor-pointer"
            style="color: {{ $isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}; background: transparent; border: none;"
        >
            {{ $tab }}
            @if($isActive)
                <span class="absolute bottom-0 left-0 right-0 h-0.5" style="background: var(--color-brand-default);"></span>
            @endif
        </button>
    @endforeach
</div>
