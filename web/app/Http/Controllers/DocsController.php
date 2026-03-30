<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use League\CommonMark\CommonMarkConverter;
use League\CommonMark\Extension\GithubFlavoredMarkdownExtension;
use League\CommonMark\Environment\Environment;
use League\CommonMark\MarkdownConverter;

class DocsController extends Controller
{
    /**
     * Documentation categories with their directory patterns.
     */
    protected array $categories = [
        'getting-started' => [
            'label' => 'Getting Started',
            'description' => 'Learn how to set up and use Orchestra MCP',
            'icon' => 'rocket',
            'patterns' => ['getting-started', 'quickstart', 'installation', 'introduction'],
        ],
        'api-reference' => [
            'label' => 'API Reference',
            'description' => 'MCP tools, endpoints, and protocol documentation',
            'icon' => 'code',
            'patterns' => ['api', 'reference', 'mcp-protocol', 'tools'],
        ],
        'architecture' => [
            'label' => 'Architecture',
            'description' => 'System design, database schema, and technical decisions',
            'icon' => 'layers',
            'patterns' => ['architecture', 'design', 'adr', 'schema', 'database'],
        ],
        'guides' => [
            'label' => 'Guides',
            'description' => 'Step-by-step tutorials and how-to guides',
            'icon' => 'book',
            'patterns' => ['guide', 'tutorial', 'howto', 'self-hosting'],
        ],
    ];

    /**
     * Display the docs index page with all categories.
     */
    public function index()
    {
        $docs = $this->loadDocsIndex();

        return view('docs.index', [
            'categories' => $this->categories,
            'docs' => $docs,
        ]);
    }

    /**
     * Display a single doc page by slug.
     */
    public function show(string $slug)
    {
        $doc = $this->findDoc($slug);

        if (! $doc) {
            abort(404, 'Documentation page not found.');
        }

        $html = $this->renderMarkdown($doc['content']);

        // Extract table of contents from headings
        $toc = $this->extractToc($doc['content']);

        // Determine prev/next navigation
        $allDocs = $this->loadDocsIndex();
        $flatDocs = collect($allDocs)->flatten(1)->values();
        $currentIndex = $flatDocs->search(fn ($d) => $d['slug'] === $slug);
        $prev = $currentIndex > 0 ? $flatDocs[$currentIndex - 1] : null;
        $next = $currentIndex < $flatDocs->count() - 1 ? $flatDocs[$currentIndex + 1] : null;

        return view('docs.show', [
            'doc' => $doc,
            'html' => $html,
            'toc' => $toc,
            'prev' => $prev,
            'next' => $next,
            'categories' => $this->categories,
            'allDocs' => $allDocs,
        ]);
    }

    /**
     * Load all docs grouped by category.
     */
    protected function loadDocsIndex(): array
    {
        $docsPath = base_path('docs');
        $grouped = [];

        foreach ($this->categories as $catId => $catConfig) {
            $grouped[$catId] = [];
        }

        if (! File::isDirectory($docsPath)) {
            return $grouped;
        }

        // Scan for markdown files in the docs directory
        $files = File::allFiles($docsPath);

        foreach ($files as $file) {
            if (! Str::endsWith($file->getFilename(), ['.md', '.mdx'])) {
                continue;
            }

            $relativePath = $file->getRelativePathname();
            $slug = Str::of($relativePath)
                ->replaceLast('.md', '')
                ->replaceLast('.mdx', '')
                ->replace('/', '-')
                ->slug()
                ->toString();

            $content = $file->getContents();
            $title = $this->extractTitle($content, $file->getFilenameWithoutExtension());
            $category = $this->classifyDoc($relativePath);

            $grouped[$category][] = [
                'slug' => $slug,
                'title' => $title,
                'path' => $relativePath,
                'category' => $category,
                'content' => $content,
            ];
        }

        return $grouped;
    }

    /**
     * Find a doc by slug.
     */
    protected function findDoc(string $slug): ?array
    {
        $allDocs = $this->loadDocsIndex();

        foreach ($allDocs as $docs) {
            foreach ($docs as $doc) {
                if ($doc['slug'] === $slug) {
                    return $doc;
                }
            }
        }

        // Fallback: try to find by partial match
        foreach ($allDocs as $docs) {
            foreach ($docs as $doc) {
                if (Str::contains($doc['slug'], $slug) || Str::contains($slug, $doc['slug'])) {
                    return $doc;
                }
            }
        }

        return null;
    }

    /**
     * Extract title from markdown content or filename.
     */
    protected function extractTitle(string $content, string $fallbackFilename): string
    {
        // Check for frontmatter title
        if (preg_match('/^---\s*\n.*?title:\s*["\']?(.+?)["\']?\s*\n.*?---/s', $content, $matches)) {
            return $matches[1];
        }

        // Check for first h1
        if (preg_match('/^#\s+(.+)$/m', $content, $matches)) {
            return trim($matches[1]);
        }

        // Fallback to formatted filename
        return Str::of($fallbackFilename)
            ->replace(['-', '_'], ' ')
            ->title()
            ->toString();
    }

    /**
     * Classify a doc into a category based on its path.
     */
    protected function classifyDoc(string $path): string
    {
        $lower = Str::lower($path);

        foreach ($this->categories as $catId => $catConfig) {
            foreach ($catConfig['patterns'] as $pattern) {
                if (Str::contains($lower, $pattern)) {
                    return $catId;
                }
            }
        }

        return 'getting-started';
    }

    /**
     * Render markdown to HTML using league/commonmark.
     */
    protected function renderMarkdown(string $content): string
    {
        // Strip frontmatter
        if (Str::startsWith(trim($content), '---')) {
            $content = preg_replace('/^---\s*\n.*?\n---\s*\n/s', '', $content, 1);
        }

        $config = [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
        ];

        $environment = new Environment($config);
        $environment->addExtension(new GithubFlavoredMarkdownExtension());

        $converter = new MarkdownConverter($environment);

        return $converter->convert($content)->getContent();
    }

    /**
     * Extract table of contents from heading elements.
     */
    protected function extractToc(string $content): array
    {
        $toc = [];

        preg_match_all('/^(#{2,3})\s+(.+)$/m', $content, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            $level = strlen($match[1]);
            $text = trim($match[2]);
            $id = Str::slug($text);

            $toc[] = [
                'level' => $level,
                'text' => $text,
                'id' => $id,
            ];
        }

        return $toc;
    }
}
