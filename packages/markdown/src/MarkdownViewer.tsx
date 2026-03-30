import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

import { CodeBlock } from './CodeBlock'
import { DataTable } from './DataTable'
import { FrontmatterHeader } from './FrontmatterHeader'
import { parseFrontmatter } from './utils'

// ---------------------------------------------------------------------------
// MarkdownViewer — read-only markdown renderer
//
// Supports: GFM, syntax highlighting, raw HTML, frontmatter,
//           mermaid code blocks (rendered as styled code with "mermaid" class),
//           sortable data tables, heading anchors.
// ---------------------------------------------------------------------------

export interface MarkdownViewerProps {
  /** Raw markdown content (may include frontmatter) */
  content: string
  /** Custom className on the root wrapper */
  className?: string
  /** If provided, renders mermaid blocks via this component instead of CodeBlock */
  renderMermaid?: (code: string) => React.ReactNode
  /** Right-click handler for code blocks */
  onCodeContextMenu?: (e: React.MouseEvent, codeEl: HTMLElement, lang: string) => void
  /** Right-click handler for tables */
  onTableContextMenu?: (e: React.MouseEvent, tableEl: HTMLTableElement) => void
}

export function MarkdownViewer({
  content,
  className,
  renderMermaid,
  onCodeContextMenu,
  onTableContextMenu,
}: MarkdownViewerProps) {
  const hasFrontmatter = content.trimStart().startsWith('---')

  // Strip frontmatter from content for react-markdown
  const markdownBody = useMemo(() => {
    if (!hasFrontmatter) return content
    try {
      const { content: body } = parseFrontmatter(content)
      return body
    } catch {
      return content
    }
  }, [content, hasFrontmatter])

  // Custom components for react-markdown
  const markdownComponents: Record<string, React.ComponentType<any>> = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      pre: ({ node, ...props }: any) => <pre className="md-code-block" {...props} />,
      code: ({ className: cn, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(cn || '')
        const isInline = !cn

        if (isInline) {
          return (
            <code
              style={{
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.875em',
                fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
                color: 'var(--foreground-default)',
              }}
              {...props}
            >
              {children}
            </code>
          )
        }

        const language = match?.[1] ?? ''

        // Mermaid code blocks
        if (language === 'mermaid') {
          const mermaidCode =
            typeof children === 'string'
              ? children
              : Array.isArray(children)
                ? children.map((c: any) => (typeof c === 'string' ? c : '')).join('')
                : String(children ?? '')
          const cleanCode = mermaidCode.replace(/\n$/, '')

          if (renderMermaid) {
            return renderMermaid(cleanCode)
          }

          // Fallback: render as a styled code block with "mermaid" language label
          return (
            <CodeBlock className={cn} language="mermaid" {...props}>
              {children}
            </CodeBlock>
          )
        }

        return (
          <CodeBlock
            className={cn}
            language={language}
            onContextMenu={onCodeContextMenu}
            {...props}
          >
            {children}
          </CodeBlock>
        )
      },
      table: ({ children, ...props }: any) => (
        <DataTable onContextMenu={onTableContextMenu} {...props}>
          {children}
        </DataTable>
      ),
      blockquote: ({ children, ...props }: any) => (
        <blockquote className="md-blockquote" {...props}>
          {children}
        </blockquote>
      ),
      h1: ({ children, ...props }: any) => (
        <h1 className="md-h1" {...props}>
          {children}
        </h1>
      ),
      h2: ({ children, ...props }: any) => (
        <h2 className="md-h2" {...props}>
          {children}
        </h2>
      ),
      h3: ({ children, ...props }: any) => (
        <h3 className="md-h3" {...props}>
          {children}
        </h3>
      ),
      h4: ({ children, ...props }: any) => (
        <h4 className="md-h4" {...props}>
          {children}
        </h4>
      ),
      h5: ({ children, ...props }: any) => (
        <h5 className="md-h5" {...props}>
          {children}
        </h5>
      ),
      h6: ({ children, ...props }: any) => (
        <h6 className="md-h6" {...props}>
          {children}
        </h6>
      ),
      a: ({ children, href, ...props }: any) => (
        <a className="md-link" href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      ),
      ul: ({ children, ...props }: any) => (
        <ul className="md-ul" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }: any) => (
        <ol className="md-ol" {...props}>
          {children}
        </ol>
      ),
      hr: (props: any) => <hr className="md-hr" {...props} />,
      p: ({ children, ...props }: any) => (
        <p className="md-p" {...props}>
          {children}
        </p>
      ),
      img: ({ src, alt, ...props }: any) => (
        <img
          src={src}
          alt={alt ?? ''}
          className="md-img max-w-full rounded-lg"
          loading="lazy"
          {...props}
        />
      ),
      input: ({ type, checked, ...props }: any) => {
        if (type === 'checkbox') {
          return (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="md-checkbox mr-2"
              style={{ accentColor: 'hsl(277, 100%, 50%)' }}
              {...props}
            />
          )
        }
        return <input type={type} {...props} />
      },
    }),
    [onCodeContextMenu, onTableContextMenu, renderMermaid]
  )

  return (
    <div className={`markdown-preview ${className ?? ''}`.trim()}>
      {hasFrontmatter && <FrontmatterHeader raw={content} />}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={markdownComponents}
      >
        {markdownBody}
      </ReactMarkdown>
    </div>
  )
}
