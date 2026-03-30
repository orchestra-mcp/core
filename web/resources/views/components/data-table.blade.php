{{-- Studio-style Data Table Component
     Usage:
     <x-data-table
         :columns="['Name', 'Email', 'Role', 'Created']"
         :searchable="true"
         :total="count($items)"
         totalLabel="users"
     >
         <x-slot:actions>
             <button>Create</button>
         </x-slot:actions>
         <x-slot:filters>
             <select>...</select>
         </x-slot:filters>
         @foreach($items as $item)
             <tr>...</tr>
         @endforeach
     </x-data-table>
--}}

@props([
    'columns' => [],
    'searchable' => false,
    'searchModel' => null,
    'searchPlaceholder' => 'Search...',
    'total' => null,
    'totalLabel' => 'items',
    'emptyIcon' => null,
    'emptyMessage' => 'No data found.',
])

<div class="rounded-lg overflow-hidden" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
    {{-- Toolbar: search + filters + actions --}}
    @if($searchable || isset($actions) || isset($filters))
    <div class="flex items-center justify-between gap-3 px-4 py-2.5" style="border-bottom: 1px solid var(--color-border);">
        <div class="flex items-center gap-3 flex-1 min-w-0">
            @if($searchable)
            <div class="relative flex-1 max-w-xs">
                <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                    type="text"
                    @if($searchModel) wire:model.live.debounce.300ms="{{ $searchModel }}" @endif
                    placeholder="{{ $searchPlaceholder }}"
                    class="w-full pl-8 pr-3 py-1.5 rounded text-[13px] studio-field"
                    style="background: var(--color-bg-input); border: 1px solid var(--color-border); color: var(--color-text-primary);"
                >
            </div>
            @endif

            @if(isset($filters))
                {{ $filters }}
            @endif
        </div>

        @if(isset($actions))
            <div class="flex items-center gap-2 shrink-0">
                {{ $actions }}
            </div>
        @endif
    </div>
    @endif

    {{-- Table --}}
    <div class="overflow-x-auto">
        <table class="w-full" style="border-collapse: collapse;">
            @if(count($columns) > 0)
            <thead>
                <tr style="border-bottom: 1px solid var(--color-border);">
                    @foreach($columns as $col)
                    <th class="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider whitespace-nowrap"
                        style="color: var(--color-text-muted); background: var(--color-bg-surface);">
                        {{ $col }}
                    </th>
                    @endforeach
                </tr>
            </thead>
            @endif
            <tbody>
                {{ $slot }}
            </tbody>
        </table>
    </div>

    {{-- Footer: total count --}}
    @if($total !== null)
    <div class="px-4 py-2" style="border-top: 1px solid var(--color-border);">
        <span class="text-[12px]" style="color: var(--color-text-muted);">Total: {{ number_format($total) }} {{ $totalLabel }} (estimated)</span>
    </div>
    @endif
</div>
