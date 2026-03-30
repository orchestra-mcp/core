<x-layouts.docs>
    <h1 class="text-3xl font-bold text-white">Documentation</h1>
    <p class="mt-3 text-lg text-[--color-brand-text-secondary]">
        Everything you need to set up, configure, and extend Orchestra MCP.
    </p>

    {{-- Category Cards --}}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
        @foreach($categories as $catId => $cat)
            @php
                $catDocs = $docs[$catId] ?? [];
                $firstDoc = count($catDocs) > 0 ? $catDocs[0] : null;
                $href = $firstDoc ? route('docs.show', $firstDoc['slug']) : '#';
                $iconColors = [
                    'getting-started' => 'text-green-400',
                    'api-reference' => 'text-cyan-400',
                    'architecture' => 'text-purple-400',
                    'guides' => 'text-amber-400',
                ];
                $iconColor = $iconColors[$catId] ?? 'text-brand-cyan';
            @endphp
            <a href="{{ $href }}"
               class="group block rounded-xl border border-[--color-border] bg-[--color-bg-card] p-6 transition-all hover:border-white/20 hover:shadow-lg hover:shadow-white/5"
            >
                <div class="flex items-start gap-4">
                    {{-- Icon --}}
                    <div class="shrink-0 mt-0.5">
                        @switch($cat['icon'])
                            @case('rocket')
                                <svg class="w-6 h-6 {{ $iconColor }}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 15L3 21M15 9l6-6M12.5 3.5C15.5 5 18.5 8 20 11L14 17 7 10l6-6.5Z"/>
                                    <circle cx="15" cy="9" r="1.5"/>
                                </svg>
                                @break
                            @case('code')
                                <svg class="w-6 h-6 {{ $iconColor }}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M7 8L3 12l4 4M17 8l4 4-4 4M14 4l-4 16"/>
                                </svg>
                                @break
                            @case('layers')
                                <svg class="w-6 h-6 {{ $iconColor }}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M2 12l10 6 10-6M2 17l10 6 10-6M2 7l10-5 10 5-10 5L2 7Z"/>
                                </svg>
                                @break
                            @case('book')
                                <svg class="w-6 h-6 {{ $iconColor }}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M2 3h6.5c1.5 0 2.5.75 2.5 2v14l-2-1.5H2V3ZM22 3h-6.5c-1.5 0-2.5.75-2.5 2v14l2-1.5H22V3Z"/>
                                </svg>
                                @break
                        @endswitch
                    </div>

                    <div class="min-w-0">
                        <h2 class="text-lg font-semibold text-white group-hover:text-brand-cyan transition-colors">
                            {{ $cat['label'] }}
                        </h2>
                        <p class="mt-1 text-sm text-[--color-brand-text-secondary] leading-relaxed">
                            {{ $cat['description'] }}
                        </p>
                        <p class="mt-3 text-xs text-[--color-brand-text-secondary]">
                            {{ count($catDocs) }} {{ Str::plural('article', count($catDocs)) }}
                        </p>
                    </div>
                </div>
            </a>
        @endforeach
    </div>

    {{-- All Docs List --}}
    <section class="mt-16">
        <h2 class="text-2xl font-bold text-white mb-6 pb-2 border-b border-[--color-border]">
            All Documentation
        </h2>

        @foreach($categories as $catId => $cat)
            @php $catDocs = $docs[$catId] ?? []; @endphp

            @if(count($catDocs) > 0)
                <div class="mb-8">
                    <h3 class="text-xs font-semibold text-[--color-brand-text-secondary] uppercase tracking-wider mb-3">
                        {{ $cat['label'] }}
                    </h3>
                    <div class="bg-[--color-bg-card] rounded-lg border border-[--color-border] divide-y divide-[--color-border]">
                        @foreach($catDocs as $doc)
                            <a href="{{ route('docs.show', $doc['slug']) }}"
                               class="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                            >
                                <div class="flex items-center gap-3 min-w-0">
                                    <svg class="w-4 h-4 shrink-0 text-[--color-brand-text-secondary]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                                        <path d="M7 3h8l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2Z"/>
                                        <path d="M15 3v5h5"/>
                                    </svg>
                                    <span class="text-sm text-white group-hover:text-brand-cyan transition-colors truncate">
                                        {{ $doc['title'] }}
                                    </span>
                                </div>
                                <svg class="w-4 h-4 shrink-0 text-[--color-brand-text-secondary] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round">
                                    <path d="M9 6l6 6-6 6"/>
                                </svg>
                            </a>
                        @endforeach
                    </div>
                </div>
            @endif
        @endforeach

        @if(collect($docs)->flatten(1)->isEmpty())
            <div class="text-center py-16">
                <svg class="w-12 h-12 mx-auto text-[--color-brand-text-secondary] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1">
                    <path d="M2 3h6.5c1.5 0 2.5.75 2.5 2v14l-2-1.5H2V3ZM22 3h-6.5c-1.5 0-2.5.75-2.5 2v14l2-1.5H22V3Z"/>
                </svg>
                <h3 class="text-lg font-semibold text-white mb-1">No documentation yet</h3>
                <p class="text-sm text-[--color-brand-text-secondary]">
                    Add markdown files to the <code class="text-brand-cyan bg-[--color-bg-card] px-1.5 py-0.5 rounded text-xs">/docs</code> directory to populate this page.
                </p>
            </div>
        @endif
    </section>
</x-layouts.docs>
