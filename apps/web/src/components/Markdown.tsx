import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function safeUrl(value: string): string {
  if (!value) return '';
  if (value.startsWith('#') || value.startsWith('/')) return value;
  try {
    const u = new URL(value, window.location.origin);
    return SAFE_PROTOCOLS.has(u.protocol) ? value : '';
  } catch {
    return '';
  }
}

const COMPONENTS: Components = {
  a({ href, children, ...rest }) {
    const safe = href ? safeUrl(href) : '';
    if (!safe) return <span>{children}</span>;
    return (
      <a
        {...rest}
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
      >
        {children}
      </a>
    );
  },
  p({ children }) {
    return <p style={{ margin: '0 0 8px' }}>{children}</p>;
  },
  strong({ children }) {
    return <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{children}</strong>;
  },
  em({ children }) {
    return <em style={{ fontStyle: 'italic' }}>{children}</em>;
  },
  ul({ children }) {
    return <ul style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{children}</ul>;
  },
  ol({ children }) {
    return <ol style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{children}</ol>;
  },
  li({ children }) {
    return <li style={{ margin: '2px 0' }}>{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote
        style={{
          margin: '6px 0',
          padding: '4px 10px',
          borderLeft: '3px solid var(--line)',
          color: 'var(--ink-3)',
        }}
      >
        {children}
      </blockquote>
    );
  },
  code({ className, children, ...rest }) {
    const inline = !className;
    if (inline) {
      return (
        <code
          {...rest}
          style={{
            padding: '1px 5px',
            borderRadius: 4,
            background: 'var(--bg-sunken)',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: '0.92em',
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        {...rest}
        className={className}
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: '0.92em',
        }}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre
        style={{
          margin: '6px 0',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--bg-sunken)',
          border: '1px solid var(--line)',
          overflowX: 'auto',
          fontSize: 12,
          lineHeight: 1.55,
        }}
      >
        {children}
      </pre>
    );
  },
  h1({ children }) {
    return <h1 style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 6px' }}>{children}</h1>;
  },
  h2({ children }) {
    return <h2 style={{ fontSize: 16, fontWeight: 600, margin: '12px 0 6px' }}>{children}</h2>;
  },
  h3({ children }) {
    return <h3 style={{ fontSize: 14, fontWeight: 600, margin: '10px 0 6px' }}>{children}</h3>;
  },
  h4({ children }) {
    return <h4 style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h4>;
  },
  hr() {
    return <hr style={{ margin: '10px 0', border: 0, borderTop: '1px solid var(--line)' }} />;
  },
  table({ children }) {
    return (
      <div style={{ overflowX: 'auto', margin: '6px 0' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 13,
            border: '1px solid var(--line)',
          }}
        >
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th
        style={{
          padding: '4px 8px',
          borderBottom: '1px solid var(--line)',
          textAlign: 'left',
          background: 'var(--bg-sunken)',
          fontWeight: 600,
        }}
      >
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>{children}</td>;
  },
};

interface MarkdownProps {
  text: string;
  trailing?: React.ReactNode;
}

export function Markdown({ text, trailing }: MarkdownProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['img']}
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
      {trailing}
    </div>
  );
}
