@props([
    'title' => config('app.name', 'Orchestra MCP'),
    'description' => 'Turn Claude AI into a 24/7 Autonomous Company Operating System. 91+ MCP tools, persistent agent memory, team sync, and desktop app.',
    'canonical' => null,
    'ogType' => 'website',
    'ogImage' => '/img/cover.jpg',
    'noIndex' => false,
])

<title>{{ $title }}</title>
<meta name="description" content="{{ $description }}">
@if($canonical)
    <link rel="canonical" href="{{ $canonical }}">
@else
    <link rel="canonical" href="{{ url()->current() }}">
@endif

{{-- Open Graph --}}
<meta property="og:title" content="{{ $title }}">
<meta property="og:description" content="{{ $description }}">
<meta property="og:type" content="{{ $ogType }}">
<meta property="og:url" content="{{ url()->current() }}">
<meta property="og:image" content="{{ url($ogImage) }}">
<meta property="og:site_name" content="{{ config('app.name', 'Orchestra MCP') }}">
<meta property="og:locale" content="en_US">

{{-- Twitter Card --}}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ $title }}">
<meta name="twitter:description" content="{{ $description }}">
<meta name="twitter:image" content="{{ url($ogImage) }}">

@if($noIndex)
    <meta name="robots" content="noindex, nofollow">
@endif

{{-- JSON-LD Structured Data --}}
@php
    $jsonLd = json_encode([
        '@context' => 'https://schema.org',
        '@type' => 'WebApplication',
        'name' => 'Orchestra MCP',
        'url' => url('/'),
        'description' => 'Turn Claude AI into a 24/7 Autonomous Company Operating System.',
        'applicationCategory' => 'DeveloperApplication',
        'operatingSystem' => 'Any',
        'offers' => [
            '@type' => 'Offer',
            'price' => '0',
            'priceCurrency' => 'USD',
        ],
        'creator' => [
            '@type' => 'Organization',
            'name' => 'Orchestra MCP',
            'url' => url('/'),
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
@endphp
<script type="application/ld+json">
    {!! $jsonLd !!}
</script>
