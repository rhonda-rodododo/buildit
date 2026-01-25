/**
 * Lazy-loaded Markdown Component
 * Reduces initial bundle size by loading react-markdown only when needed
 */

import { FC, Suspense, lazy } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Lazy load entire markdown renderer with plugins
const MarkdownRenderer = lazy(() =>
  Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
    import('rehype-sanitize'),
  ]).then(([ReactMarkdownModule, remarkGfmModule, rehypeSanitizeModule]) => {
    const ReactMarkdown = ReactMarkdownModule.default;
    const remarkGfm = remarkGfmModule.default;
    const rehypeSanitize = rehypeSanitizeModule.default;

    const Component: FC<MarkdownRendererProps> = ({ content, className }) => (
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            // Open links in new tab with security
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                {...props}
              >
                {children}
              </a>
            ),
            // Prevent rendering images (use media field instead)
            img: () => null,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );

    return { default: Component };
  })
);

interface LazyMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Markdown component with lazy loading
 * Shows skeleton while loading markdown renderer (~60KB)
 */
export const LazyMarkdown: FC<LazyMarkdownProps> = ({ content, className }) => {
  return (
    <Suspense
      fallback={
        <div className={className}>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      }
    >
      <MarkdownRenderer content={content} className={className} />
    </Suspense>
  );
};
