@props(['current' => 1, 'total' => 3, 'labels' => ['Company', 'Team', 'Connect']])

<div class="flex items-center justify-center space-x-4 mb-8">
    @foreach($labels as $i => $label)
        <div class="flex items-center">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                {{ $i + 1 <= $current ? 'gradient-bg text-white' : 'bg-gray-700 text-gray-400' }}">
                {{ $i + 1 }}
            </div>
            <span class="ml-2 text-sm {{ $i + 1 <= $current ? 'text-white' : 'text-gray-500' }}">{{ $label }}</span>
        </div>
        @if(!$loop->last)
            <div class="w-12 h-0.5 {{ $i + 1 < $current ? 'gradient-bg' : 'bg-gray-700' }}"></div>
        @endif
    @endforeach
</div>
