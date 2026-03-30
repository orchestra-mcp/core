@props(['current' => 1, 'total' => 3, 'labels' => ['Company', 'Team', 'Connect']])

<div class="flex items-center justify-center gap-0 mb-8">
    @foreach($labels as $i => $label)
        <div class="flex items-center">
            <div class="flex items-center gap-1.5 sm:gap-2">
                <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold transition-colors
                    {{ $i + 1 < $current ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : ($i + 1 === $current ? 'gradient-bg text-white' : 'bg-[#2a2a2a] text-[#666666]') }}">
                    @if($i + 1 < $current)
                        <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                        </svg>
                    @else
                        {{ $i + 1 }}
                    @endif
                </div>
                <span class="text-[11px] sm:text-[13px] font-medium {{ $i + 1 <= $current ? 'text-[#ededed]' : 'text-[#666666]' }}">{{ $label }}</span>
            </div>
        </div>
        @if(!$loop->last)
            <div class="w-5 sm:w-10 h-px mx-1.5 sm:mx-3 {{ $i + 1 < $current ? 'bg-[#00E5FF]/30' : 'bg-[#333333]' }}"></div>
        @endif
    @endforeach
</div>
