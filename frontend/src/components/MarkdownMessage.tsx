import React from 'react'

interface MarkdownMessageProps {
  content: string
}

function formatMathSymbols(text: string): string {
  return text
    .replace(/\$R\^2\$/g, 'R²')
    .replace(/\$R\^\{2\}\$/g, 'R²')
    .replace(/\$R\^2_\{adj\}\$/g, 'R²_adj')
    .replace(/\$\\pm\$/g, '±')
    .replace(/\\pm\b/g, '±')
    .replace(/\$\\le\$/g, '≤')
    .replace(/\\le\b/g, '≤')
    .replace(/\$\\ge\$/g, '≥')
    .replace(/\\ge\b/g, '≥')
    .replace(/\$\\alpha\$/g, 'α')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\$\\beta\$/g, 'β')
    .replace(/\\beta\b/g, 'β')
    .replace(/\$\\sigma\$/g, 'σ')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\$F\$/g, 'F')
    .replace(/\$p\$/g, 'p')
    .replace(/\$p\s*([<>=])\s*([0-9.]+)\$/g, 'p $1 $2')
    .replace(/\$F\s*=\s*([0-9.]+)\$/g, 'F = $1')
}

function renderInline(text: string): React.ReactNode[] {
  const formatted = formatMathSymbols(text)
  // Split on bold (**...**) and inline code (`...`)
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(formatted)) !== null) {
    if (match.index > lastIndex) {
      parts.push(formatted.substring(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: 650, color: 'var(--text)' }}>
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--primary-light)',
            padding: '0.15rem 0.35rem',
            borderRadius: '4px',
            fontSize: '0.82rem',
            fontFamily: 'monospace'
          }}
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < formatted.length) {
    parts.push(formatted.substring(lastIndex))
  }

  return parts
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let isNumbered = false

  const flushList = () => {
    if (listItems.length > 0) {
      if (isNumbered) {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ paddingLeft: '1.25rem', margin: '0.4rem 0' }}>
            {listItems}
          </ol>
        )
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ paddingLeft: '1.25rem', margin: '0.4rem 0', listStyleType: 'disc' }}>
            {listItems}
          </ul>
        )
      }
      listItems = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      flushList()
      continue
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h3
          key={i}
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginTop: '0.85rem',
            marginBottom: '0.35rem',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          {renderInline(trimmed.substring(4))}
        </h3>
      )
      continue
    }

    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2
          key={i}
          style={{
            fontSize: '1.1rem',
            fontWeight: 750,
            marginTop: '1rem',
            marginBottom: '0.4rem',
            color: 'var(--text)'
          }}
        >
          {renderInline(trimmed.substring(3))}
        </h2>
      )
      continue
    }

    if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1
          key={i}
          style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            marginTop: '1.1rem',
            marginBottom: '0.5rem',
            color: 'var(--text)'
          }}
        >
          {renderInline(trimmed.substring(2))}
        </h1>
      )
      continue
    }

    // Unordered List
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (isNumbered && listItems.length > 0) flushList()
      isNumbered = false
      listItems.push(
        <li key={`li-${i}`} style={{ marginBottom: '0.25rem', lineHeight: 1.55 }}>
          {renderInline(trimmed.substring(2))}
        </li>
      )
      continue
    }

    // Ordered List (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
    if (numberedMatch) {
      if (!isNumbered && listItems.length > 0) flushList()
      isNumbered = true
      listItems.push(
        <li key={`li-${i}`} style={{ marginBottom: '0.25rem', lineHeight: 1.55 }}>
          {renderInline(numberedMatch[2])}
        </li>
      )
      continue
    }

    // Standard paragraph
    flushList()
    elements.push(
      <p key={i} style={{ margin: '0.4rem 0', lineHeight: 1.6 }}>
        {renderInline(trimmed)}
      </p>
    )
  }

  flushList()

  return <div style={{ fontSize: '0.88rem' }}>{elements}</div>
}
