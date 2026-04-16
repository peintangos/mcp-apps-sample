import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useColors } from "../theme.js";

export type AnswerColumnProps = {
  label: string;
  labelColor: string;
  content: string | null;
  meta?: { model?: string; latencyMs?: number };
  isLoading?: boolean;
  errorMessage?: string;
  placeholderMessage?: string;
};

export function AnswerColumn({
  label,
  labelColor,
  content,
  meta,
  isLoading,
  errorMessage,
  placeholderMessage,
}: AnswerColumnProps) {
  const colors = useColors();

  let body: ReactNode;
  if (errorMessage) {
    body = (
      <div
        style={{
          padding: "0.75rem",
          background: colors.errorBg,
          border: `1px solid ${colors.errorBorder}`,
          borderRadius: "0.5rem",
          color: colors.errorText,
          fontSize: "0.75rem",
          wordBreak: "break-word",
        }}
      >
        {errorMessage}
      </div>
    );
  } else if (isLoading) {
    body = (
      <div
        style={{
          padding: "1rem",
          color: colors.textMuted,
          textAlign: "center",
          fontStyle: "italic",
        }}
      >
        考え中…
      </div>
    );
  } else if (placeholderMessage) {
    body = (
      <div
        style={{
          padding: "1rem",
          color: colors.textMuted,
          fontStyle: "italic",
          fontSize: "0.8125rem",
          lineHeight: 1.6,
        }}
      >
        {placeholderMessage}
      </div>
    );
  } else if (content) {
    body = (
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p style={{ margin: "0.5rem 0", lineHeight: 1.65 }}>{children}</p>
            ),
            h1: ({ children }) => (
              <h3
                style={{
                  margin: "0.75rem 0 0.375rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                {children}
              </h3>
            ),
            h2: ({ children }) => (
              <h4
                style={{
                  margin: "0.625rem 0 0.375rem",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                }}
              >
                {children}
              </h4>
            ),
            h3: ({ children }) => (
              <h5
                style={{
                  margin: "0.5rem 0 0.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                }}
              >
                {children}
              </h5>
            ),
            ul: ({ children }) => (
              <ul style={{ margin: "0.5rem 0", paddingInlineStart: "1.25rem" }}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol style={{ margin: "0.5rem 0", paddingInlineStart: "1.25rem" }}>
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li style={{ margin: "0.125rem 0" }}>{children}</li>
            ),
            strong: ({ children }) => (
              <strong style={{ fontWeight: 700 }}>{children}</strong>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = className?.startsWith("language-");
              if (isBlock) {
                return (
                  <code
                    className={className}
                    style={{
                      fontFamily:
                        "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                      fontSize: "0.75rem",
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code
                  style={{
                    background: colors.codeBg,
                    padding: "0.0625rem 0.3125rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125em",
                    fontFamily:
                      "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre
                style={{
                  background: colors.codeBg,
                  border: `1px solid ${colors.border}`,
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  margin: "0.5rem 0",
                  overflowX: "auto",
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                }}
              >
                {children}
              </pre>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                style={{ color: labelColor, textDecoration: "underline" }}
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div
                style={{
                  overflowX: "auto",
                  margin: "0.75rem 0",
                }}
              >
                <table
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    fontSize: "0.75rem",
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead
                style={{
                  background: colors.surfaceAlt,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                {children}
              </thead>
            ),
            tr: ({ children }) => (
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {children}
              </tr>
            ),
            th: ({ children }) => (
              <th
                style={{
                  padding: "0.375rem 0.625rem",
                  textAlign: "left",
                  fontWeight: 700,
                  color: colors.text,
                  borderRight: `1px solid ${colors.border}`,
                }}
              >
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td
                style={{
                  padding: "0.375rem 0.625rem",
                  color: colors.text,
                  borderRight: `1px solid ${colors.border}`,
                  verticalAlign: "top",
                }}
              >
                {children}
              </td>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  } else {
    body = (
      <div
        style={{
          padding: "1rem",
          color: colors.textMuted,
          textAlign: "center",
          fontSize: "0.75rem",
        }}
      >
        (no content)
      </div>
    );
  }

  return (
    <section
      style={{
        padding: "1rem",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderLeft: `5px solid ${labelColor}`,
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        minWidth: 0,
        boxShadow: `0 2px 8px ${labelColor}22`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          borderBottom: `2px solid ${labelColor}`,
          paddingBottom: "0.5rem",
          gap: "0.5rem",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.125rem",
            fontWeight: 800,
            color: labelColor,
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </h2>
        {meta && (meta.model || typeof meta.latencyMs === "number") && (
          <span
            style={{
              fontSize: "0.6875rem",
              color: colors.textMuted,
              fontFamily:
                "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {meta.model ?? ""}
            {meta.model && typeof meta.latencyMs === "number" ? " · " : ""}
            {typeof meta.latencyMs === "number" ? `${meta.latencyMs}ms` : ""}
          </span>
        )}
      </header>
      <div
        style={{
          fontSize: "0.8125rem",
          color: colors.text,
          minWidth: 0,
        }}
      >
        {body}
      </div>
    </section>
  );
}
