<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#121212">

    <title>{{ $document->title }} - Orchestra MCP</title>

    {{-- Open Graph --}}
    <meta property="og:title" content="{{ $document->title }}">
    <meta property="og:description" content="Shared document from Orchestra MCP">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Orchestra MCP">

    {{-- Fonts --}}
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700" rel="stylesheet">

    {{-- highlight.js for syntax highlighting --}}
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark-dimmed.min.css">
    <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>

    {{-- Mermaid for diagrams --}}
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>

    {{-- marked for client-side markdown rendering --}}
    <script src="https://cdn.jsdelivr.net/npm/marked@15/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked-gfm-heading-id/lib/index.umd.js"></script>

    {{-- Favicon --}}
    <link rel="icon" type="image/png" href="/favicon.png">

    {{-- Markdown preview styles (same as desktop app) --}}
    <link rel="stylesheet" href="/css/markdown-preview.css">

    <style>
        *,
        *::before,
        *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            height: 100%;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: hsl(0 0% 7.1%);
            color: hsl(0 0% 70.6%);
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: hsl(0 0% 18%); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: hsl(0 0% 27.1%); }

        .share-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* --- Top bar --- */
        .share-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 12px;
            height: 48px;
            background: hsl(0 0% 9%);
            border-bottom: 1px solid hsl(0 0% 18%);
            flex-shrink: 0;
            gap: 8px;
        }
        @media (min-width: 640px) {
            .share-topbar { padding: 0 24px; }
        }

        .share-topbar-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .share-topbar-logo {
            height: 24px;
            width: 24px;
        }

        .share-topbar-brand {
            font-size: 13px;
            font-weight: 600;
            background: linear-gradient(135deg, #00E5FF, #A900FF);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .share-topbar-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .share-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid hsl(0 0% 18%);
            background: hsl(0 0% 16.1%);
            color: hsl(0 0% 70.6%);
            cursor: pointer;
            transition: all 0.15s;
            text-decoration: none;
        }
        .share-btn:hover {
            background: hsl(0 0% 18%);
            color: hsl(0 0% 98%);
            border-color: hsl(0 0% 21.2%);
        }
        @media (max-width: 479px) {
            .share-btn-text { display: none; }
            .share-btn { padding: 6px 8px; }
        }

        /* --- Document header --- */
        .share-doc-header {
            max-width: 48rem;
            margin: 0 auto;
            padding: 24px 16px 0;
        }
        @media (min-width: 640px) {
            .share-doc-header { padding: 32px 24px 0; }
        }

        .share-doc-title {
            font-size: 1.375rem;
            font-weight: 700;
            color: hsl(0 0% 98%);
            margin-bottom: 12px;
        }
        @media (min-width: 640px) {
            .share-doc-title { font-size: 1.75rem; }
        }

        .share-doc-meta {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 12px;
            color: hsl(0 0% 53.7%);
            padding-bottom: 16px;
            border-bottom: 1px solid hsl(0 0% 18%);
            margin-bottom: 24px;
            flex-wrap: wrap;
        }

        .share-doc-meta-item {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .share-doc-meta-dot {
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background: hsl(0 0% 30.2%);
        }

        /* --- Content area --- */
        .share-content {
            flex: 1;
            padding: 0 16px 32px;
        }
        @media (min-width: 640px) {
            .share-content { padding: 0 24px 48px; }
        }

        /* --- Footer --- */
        .share-footer {
            padding: 16px 24px;
            text-align: center;
            font-size: 11px;
            color: hsl(0 0% 30.2%);
            border-top: 1px solid hsl(0 0% 14.1%);
        }

        .share-footer a {
            color: hsl(277 100% 65%);
            text-decoration: none;
        }
        .share-footer a:hover {
            text-decoration: underline;
        }

        /* --- Copy notification toast --- */
        .copy-toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 10px 16px;
            background: hsl(153 60% 53%);
            color: #000;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            opacity: 0;
            transform: translateY(8px);
            transition: all 0.3s;
            pointer-events: none;
            z-index: 1000;
        }
        .copy-toast.visible {
            opacity: 1;
            transform: translateY(0);
        }

        /* Override hljs background inside our code blocks */
        .code-block-wrapper .hljs,
        .markdown-preview pre .hljs {
            background: transparent !important;
        }
    </style>
</head>
<body>
    <div class="share-page">
        {{-- Top bar --}}
        <header class="share-topbar">
            <div class="share-topbar-left">
                <svg class="share-topbar-logo" viewBox="0 0 725.06 724.82" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="logo-grad" x1="671.57" y1="599.9" x2="188.27" y2="219.43" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stop-color="#a900ff"/>
                            <stop offset="1" stop-color="#00e5ff"/>
                        </linearGradient>
                    </defs>
                    <path fill="url(#logo-grad)" d="M670.75,54.19c-8.34-8.34-21.81-8.54-30.39-.45L61.86,599.32c-6.59,6.22-11.12,14.18-13.08,23.03-3.36,15.13,1.17,30.71,12.14,41.68,8.58,8.58,19.99,13.22,31.8,13.22,3.28,0,6.59-.36,9.87-1.09,8.84-1.96,16.81-6.49,23.03-13.08L671.19,84.58c8.09-8.58,7.9-22.05-.45-30.39Z"/>
                    <path fill="url(#logo-grad)" d="M661.8,158.12l-54.6,57.88c25.67,42.78,40.44,92.88,40.44,146.41,0,157.51-127.72,285.23-285.23,285.23-47.55,0-92.41-11.64-131.84-32.28l-54.56,57.88c54.46,32.75,118.25,51.58,186.41,51.58,200.16,0,362.41-162.25,362.41-362.41,0-75.77-23.25-146.11-63.02-204.29ZM362.41,77.18c53.59,0,103.72,14.8,146.54,40.54l57.88-54.6C508.65,23.29,438.25,0,362.41,0,162.25,0,0,162.25,0,362.41c0,68.22,18.86,132.04,51.68,186.54l57.85-54.56c-20.67-39.46-32.35-84.36-32.35-131.98,0-157.51,127.72-285.23,285.23-285.23Z"/>
                    <path fill="url(#logo-grad)" d="M362.41,130.87c-127.88,0-231.54,103.66-231.54,231.54,0,33.22,6.98,64.8,19.6,93.35l58.82-55.47c-3.02-12.15-4.6-24.83-4.6-37.89,0-87.11,70.6-157.72,157.72-157.72,16.31,0,32.01,2.48,46.81,7.05l58.79-55.44c-31.64-16.27-67.55-25.44-105.6-25.44ZM568.58,256.94l-55.47,58.82c4.56,14.73,7.01,30.4,7.01,46.64,0,87.11-70.6,157.72-157.72,157.72-12.99,0-25.64-1.58-37.72-4.53l-55.5,58.82c28.52,12.55,60.03,19.53,93.22,19.53,127.88,0,231.54-103.66,231.54-231.54,0-37.99-9.16-73.86-25.37-105.47Z"/>
                </svg>
                <span class="share-topbar-brand">Orchestra MCP</span>
            </div>
            <div class="share-topbar-right">
                <button class="share-btn" onclick="copyLink()" title="Copy link">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>
                        <path d="M10.5 5.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h2.5"/>
                    </svg>
                    <span class="share-btn-text">Copy Link</span>
                </button>
                <a href="https://orchestra-mcp.dev" class="share-btn" target="_blank" rel="noopener">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 8.5V12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5"/>
                        <path d="M10 2h4v4"/>
                        <path d="M14 2L7.5 8.5"/>
                    </svg>
                    <span class="share-btn-text">Orchestra MCP</span>
                </a>
            </div>
        </header>

        {{-- Document header --}}
        <div class="share-doc-header">
            <h1 class="share-doc-title">{{ $document->title }}</h1>
            <div class="share-doc-meta">
                <span class="share-doc-meta-item">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="2" width="12" height="12" rx="2"/>
                        <path d="M2 6h12"/>
                        <path d="M5 2v2"/>
                        <path d="M11 2v2"/>
                    </svg>
                    {{ \Carbon\Carbon::parse($document->created_at)->format('M j, Y') }}
                </span>
                <span class="share-doc-meta-dot"></span>
                <span class="share-doc-meta-item">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="8" cy="8" r="6.5"/>
                        <path d="M8 4.5V8l2.5 1.5"/>
                    </svg>
                    {{ max(1, ceil(str_word_count($document->content) / 200)) }} min read
                </span>
                <span class="share-doc-meta-dot"></span>
                <span class="share-doc-meta-item">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="8" cy="8" r="6.5"/>
                        <circle cx="8" cy="8" r="2"/>
                    </svg>
                    {{ number_format($document->view_count) }} {{ Str::plural('view', $document->view_count) }}
                </span>
                @if($document->visibility !== 'public')
                    <span class="share-doc-meta-dot"></span>
                    <span class="share-doc-meta-item" style="color: hsl(277 100% 65%);">
                        {{ ucfirst($document->visibility) }}
                    </span>
                @endif
            </div>
        </div>

        {{-- Markdown content (rendered client-side) --}}
        <div class="share-content">
            <div id="markdown-output" class="markdown-preview"></div>
        </div>

        {{-- Footer --}}
        <footer class="share-footer">
            Shared via <a href="https://orchestra-mcp.dev">Orchestra MCP</a>
            &mdash; AI-powered project management
        </footer>
    </div>

    {{-- Toast notification --}}
    <div id="copy-toast" class="copy-toast">Link copied!</div>

    {{-- Raw markdown content (hidden, used by JS) --}}
    <script id="raw-markdown" type="text/plain">{{ $document->content }}</script>

    <script>
        // ---- Initialize mermaid ----
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
                darkMode: true,
                background: 'hsl(0, 0%, 12.2%)',
                primaryColor: 'hsl(277, 100%, 50%)',
                primaryTextColor: 'hsl(0, 0%, 98%)',
                primaryBorderColor: 'hsl(0, 0%, 18%)',
                lineColor: 'hsl(0, 0%, 53.7%)',
                secondaryColor: 'hsl(0, 0%, 16.1%)',
                tertiaryColor: 'hsl(0, 0%, 12.2%)',
            },
        });

        // ---- Custom marked renderer for code blocks and tables ----
        const renderer = new marked.Renderer();

        // Code blocks: traffic lights + line numbers + syntax highlighting
        renderer.code = function({ text, lang }) {
            const language = lang || '';
            const displayLang = language ? language.toUpperCase() : 'CODE';

            // Mermaid blocks: render as diagram
            if (language === 'mermaid') {
                const id = 'mermaid-' + Math.random().toString(36).slice(2, 10);
                return `
                    <div class="mermaid-block-wrapper">
                        <div class="mermaid-block-header">
                            <span class="mermaid-block-lang">MERMAID</span>
                        </div>
                        <div class="mermaid-block-body">
                            <div class="mermaid" id="${id}">${text}</div>
                        </div>
                    </div>`;
            }

            // Syntax highlight
            let highlighted = text;
            if (language && hljs.getLanguage(language)) {
                try {
                    highlighted = hljs.highlight(text, { language }).value;
                } catch (e) {}
            } else {
                try {
                    highlighted = hljs.highlightAuto(text).value;
                } catch (e) {}
            }

            // Line numbers
            const lines = text.split('\n');
            const lineNums = lines.map((_, i) => `<span>${i + 1}</span>`).join('\n');

            return `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <div class="code-block-traffic-lights">
                            <span class="dot-red"></span>
                            <span class="dot-yellow"></span>
                            <span class="dot-green"></span>
                        </div>
                        <span class="code-block-lang">${displayLang}</span>
                        <button class="code-block-copy-btn" onclick="copyCode(this)">Copy</button>
                    </div>
                    <div class="code-block-body">
                        <div class="code-block-line-numbers">${lineNums}</div>
                        <code class="hljs">${highlighted}</code>
                    </div>
                </div>`;
        };

        // Tables: DataTable styling
        renderer.table = function({ header, rows }) {
            let headerHtml = '<thead><tr>';
            header.forEach(function(cell) {
                headerHtml += `<th>${cell.text}</th>`;
            });
            headerHtml += '</tr></thead>';

            let bodyHtml = '<tbody>';
            rows.forEach(function(row) {
                bodyHtml += '<tr>';
                row.forEach(function(cell) {
                    bodyHtml += `<td>${cell.text}</td>`;
                });
                bodyHtml += '</tr>';
            });
            bodyHtml += '</tbody>';

            return `
                <div class="data-table-wrapper">
                    <div class="data-table-header-bar">
                        <div class="data-table-icon">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="1.5" y="1.5" width="13" height="13" rx="2"/>
                                <line x1="1.5" y1="6" x2="14.5" y2="6"/>
                                <line x1="1.5" y1="10.5" x2="14.5" y2="10.5"/>
                                <line x1="6" y1="1.5" x2="6" y2="14.5"/>
                            </svg>
                        </div>
                        <span class="data-table-title">Table</span>
                    </div>
                    <div class="data-table-scroll">
                        <table class="data-table">${headerHtml}${bodyHtml}</table>
                    </div>
                </div>`;
        };

        // ---- Parse and render the markdown ----
        const rawMarkdown = document.getElementById('raw-markdown').textContent;

        marked.setOptions({
            renderer: renderer,
            gfm: true,
            breaks: false,
        });

        document.getElementById('markdown-output').innerHTML = marked.parse(rawMarkdown);

        // ---- Render mermaid diagrams after DOM update ----
        setTimeout(function() {
            try {
                mermaid.run({ querySelector: '.mermaid' });
            } catch (e) {
                console.warn('Mermaid rendering error:', e);
            }
        }, 100);

        // ---- Copy link function ----
        function copyLink() {
            navigator.clipboard.writeText(window.location.href).then(function() {
                const toast = document.getElementById('copy-toast');
                toast.classList.add('visible');
                setTimeout(function() { toast.classList.remove('visible'); }, 2000);
            });
        }

        // ---- Copy code block function ----
        function copyCode(btn) {
            const codeBlock = btn.closest('.code-block-wrapper');
            const code = codeBlock.querySelector('.code-block-body code');
            const text = code ? code.textContent : '';
            navigator.clipboard.writeText(text).then(function() {
                const original = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.color = 'hsl(153, 60%, 53%)';
                setTimeout(function() {
                    btn.textContent = original;
                    btn.style.color = '';
                }, 1500);
            });
        }
    </script>
</body>
</html>
