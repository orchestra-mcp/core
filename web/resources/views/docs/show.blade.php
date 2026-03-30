<x-layouts.docs>
    {{-- Breadcrumbs --}}
    <nav class="flex items-center gap-2 text-sm text-[--color-brand-text-secondary] mb-8">
        <a href="{{ route('docs.index') }}" wire:navigate class="hover:text-white transition-colors">Docs</a>
        <span class="text-[--color-brand-text-secondary]">/</span>
        @php
            $catLabel = $categories[$doc['category']]['label'] ?? 'Docs';
        @endphp
        <span class="text-[--color-brand-text-secondary]">{{ $catLabel }}</span>
        <span class="text-[--color-brand-text-secondary]">/</span>
        <span class="text-white">{{ $doc['title'] }}</span>
    </nav>

    <div class="flex gap-8">
        {{-- Main content --}}
        <article class="flex-1 min-w-0">
            <h1 class="text-3xl font-bold text-white mb-6">{{ $doc['title'] }}</h1>

            {{-- Rendered markdown --}}
            <div class="docs-prose">
                {!! $html !!}
            </div>

            {{-- Prev / Next navigation --}}
            <div class="mt-16 pt-6 border-t border-[--color-border] flex items-center justify-between">
                @if($prev)
                    <a href="{{ route('docs.show', $prev['slug']) }}"
                       class="group flex items-center gap-2 text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors"
                    >
                        <svg class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                        <span>{{ $prev['title'] }}</span>
                    </a>
                @else
                    <div></div>
                @endif

                @if($next)
                    <a href="{{ route('docs.show', $next['slug']) }}"
                       class="group flex items-center gap-2 text-sm text-[--color-brand-text-secondary] hover:text-white transition-colors"
                    >
                        <span>{{ $next['title'] }}</span>
                        <svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round">
                            <path d="M9 6l6 6-6 6"/>
                        </svg>
                    </a>
                @else
                    <div></div>
                @endif
            </div>
        </article>

        {{-- Right sidebar: Table of Contents --}}
        @if(count($toc) > 0)
            <aside class="w-48 shrink-0 hidden xl:block">
                <div class="sticky top-24">
                    <h4 class="text-xs font-semibold text-[--color-brand-text-secondary] uppercase tracking-wider mb-3">
                        On this page
                    </h4>
                    <nav class="space-y-1.5">
                        @foreach($toc as $item)
                            <a href="#{{ $item['id'] }}"
                               class="block text-xs text-[--color-brand-text-secondary] hover:text-white transition-colors truncate {{ $item['level'] === 3 ? 'pl-3' : '' }}"
                            >
                                {{ $item['text'] }}
                            </a>
                        @endforeach
                    </nav>
                </div>
            </aside>
        @endif
    </div>

    {{-- Styles for rendered markdown --}}
    <style>
        .docs-prose h1 { font-size: 1.5rem; font-weight: 700; color: white; margin: 2rem 0 1rem; }
        .docs-prose h2 { font-size: 1.25rem; font-weight: 600; color: white; margin: 2rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); }
        .docs-prose h3 { font-size: 1.1rem; font-weight: 600; color: white; margin: 1.5rem 0 0.5rem; }
        .docs-prose h4 { font-size: 1rem; font-weight: 600; color: white; margin: 1.25rem 0 0.5rem; }

        .docs-prose h2[id], .docs-prose h3[id] { scroll-margin-top: 5rem; }

        .docs-prose p { color: var(--color-brand-text-secondary); line-height: 1.75; margin-bottom: 1rem; font-size: 0.9375rem; }
        .docs-prose a { color: var(--color-brand-cyan, #00e5ff); }
        .docs-prose a:hover { text-decoration: underline; }

        .docs-prose strong { color: white; font-weight: 600; }

        .docs-prose ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
        .docs-prose ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
        .docs-prose li { color: var(--color-brand-text-secondary); margin-bottom: 0.25rem; font-size: 0.9375rem; }

        .docs-prose code {
            background: var(--color-bg-card);
            color: var(--color-brand-cyan, #00e5ff);
            padding: 0.15rem 0.4rem;
            border-radius: 0.25rem;
            font-size: 0.8125rem;
            font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
        }

        .docs-prose pre {
            background: var(--color-bg-card);
            border: 1px solid var(--color-border);
            border-radius: 0.5rem;
            padding: 1rem;
            overflow-x: auto;
            margin-bottom: 1rem;
        }
        .docs-prose pre code {
            background: none;
            padding: 0;
            color: var(--color-brand-text);
            font-size: 0.8125rem;
        }

        .docs-prose blockquote {
            border-left: 3px solid var(--color-brand-cyan, #00e5ff);
            padding-left: 1rem;
            margin: 1rem 0;
            color: var(--color-brand-text-secondary);
            font-style: italic;
        }

        .docs-prose table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.875rem; }
        .docs-prose thead { background: var(--color-bg-card); }
        .docs-prose th { padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: white; border-bottom: 1px solid var(--color-border); }
        .docs-prose td { padding: 0.5rem 0.75rem; color: var(--color-brand-text-secondary); border-bottom: 1px solid var(--color-border); }
        .docs-prose tr:hover td { background: rgba(255,255,255,0.02); }

        .docs-prose hr { border: none; border-top: 1px solid var(--color-border); margin: 2rem 0; }

        .docs-prose img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    </style>
</x-layouts.docs>
