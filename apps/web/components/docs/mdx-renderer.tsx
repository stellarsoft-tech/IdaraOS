"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Custom MDX components
import { DocumentHeader } from "./document-header"
import { DocumentFooter } from "./document-footer"
import { MermaidDiagram } from "./mermaid-diagram"
import { Callout } from "./callout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * MDX Components available in documents
 */
export const mdxComponents = {
  // Document-specific components
  DocumentHeader,
  DocumentFooter,
  MermaidDiagram,
  Callout,
  
  // UI components
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  
  // Standard HTML overrides with styling
  h1: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn("scroll-m-20 text-3xl font-bold tracking-tight mt-8 mb-4 first:mt-0", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn("scroll-m-20 text-2xl font-semibold tracking-tight mt-8 mb-4 border-b pb-2", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn("scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3", className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className={cn("scroll-m-20 text-lg font-semibold tracking-tight mt-4 mb-2", className)}
      {...props}
    />
  ),
  h5: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5
      className={cn("scroll-m-20 text-base font-semibold tracking-tight mt-4 mb-2", className)}
      {...props}
    />
  ),
  h6: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6
      className={cn("scroll-m-20 text-sm font-semibold tracking-tight mt-4 mb-2", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className={cn("leading-7 [&:not(:first-child)]:mt-4", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className={cn("my-4 ml-6 list-disc [&>li]:mt-2", className)} {...props} />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className={cn("my-4 ml-6 list-decimal [&>li]:mt-2", className)} {...props} />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className={cn("leading-7", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn("mt-4 border-l-4 border-primary/50 pl-4 italic text-muted-foreground", className)}
      {...props}
    />
  ),
  hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-6 border-border" {...props} />
  ),
  table: ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 w-full overflow-auto">
      <table className={cn("w-full border-collapse", className)} {...props} />
    </div>
  ),
  tr: ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className={cn("border-b border-border", className)} {...props} />
  ),
  th: ({ className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className={cn("px-4 py-2 text-left font-semibold bg-muted/50 [&[align=center]]:text-center [&[align=right]]:text-right", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td
      className={cn("px-4 py-2 [&[align=center]]:text-center [&[align=right]]:text-right", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className={cn("my-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm", className)}
      {...props}
    />
  ),
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className={cn("relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4 hover:text-primary/80", className)}
      {...props}
    />
  ),
  img: ({ className, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cn("rounded-lg border my-4 max-w-full", className)}
      alt={alt}
      {...props}
    />
  ),
  strong: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className={cn("font-semibold", className)} {...props} />
  ),
  em: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className={cn("italic", className)} {...props} />
  ),
}

/**
 * Simple markdown to React converter
 * Converts basic markdown syntax to React elements
 */
function parseMarkdown(content: string): React.ReactNode[] {
  // Normalize line endings (handle Windows \r\n and Mac \r)
  const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = normalizedContent.split("\n")
  const elements: React.ReactNode[] = []
  let currentBlock: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ""
  let inList = false
  let listType: "ul" | "ol" = "ul"
  let listItems: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let tableHeaders: string[] = []
  
  const flushCodeBlock = () => {
    if (currentBlock.length > 0) {
      const code = currentBlock.join("\n")
      
      // Check if it's a mermaid diagram
      if (codeBlockLang === "mermaid") {
        elements.push(
          <MermaidDiagram key={elements.length} chart={code} />
        )
      } else {
        elements.push(
          <mdxComponents.pre key={elements.length}>
            <mdxComponents.code>{code}</mdxComponents.code>
          </mdxComponents.pre>
        )
      }
      currentBlock = []
      codeBlockLang = ""
    }
  }
  
  const flushList = () => {
    if (listItems.length > 0) {
      const ListComponent = listType === "ul" ? mdxComponents.ul : mdxComponents.ol
      elements.push(
        <ListComponent key={elements.length}>
          {listItems.map((item, i) => (
            <mdxComponents.li key={i}>{parseInline(item)}</mdxComponents.li>
          ))}
        </ListComponent>
      )
      listItems = []
      inList = false
    }
  }
  
  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(
        <mdxComponents.table key={elements.length}>
          <thead>
            <mdxComponents.tr>
              {tableHeaders.map((header, i) => (
                <mdxComponents.th key={i}>{parseInline(header)}</mdxComponents.th>
              ))}
            </mdxComponents.tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <mdxComponents.tr key={i}>
                {row.map((cell, j) => (
                  <mdxComponents.td key={j}>{parseInline(cell)}</mdxComponents.td>
                ))}
              </mdxComponents.tr>
            ))}
          </tbody>
        </mdxComponents.table>
      )
      tableRows = []
      tableHeaders = []
      inTable = false
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        flushList()
        flushTable()
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
      }
      continue
    }
    
    if (inCodeBlock) {
      currentBlock.push(line)
      continue
    }
    
    // Empty line
    if (line.trim() === "") {
      flushList()
      flushTable()
      continue
    }
    
    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      flushList()
      flushTable()
      const level = headerMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6
      const text = headerMatch[2]
      const Header = mdxComponents[`h${level}`]
      elements.push(<Header key={elements.length}>{parseInline(text)}</Header>)
      continue
    }
    
    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      flushList()
      flushTable()
      elements.push(<mdxComponents.hr key={elements.length} />)
      continue
    }
    
    // Blockquote
    if (line.startsWith("> ")) {
      flushList()
      flushTable()
      elements.push(
        <mdxComponents.blockquote key={elements.length}>
          {parseInline(line.slice(2))}
        </mdxComponents.blockquote>
      )
      continue
    }
    
    // Unordered list
    const ulMatch = line.match(/^[-*+]\s+(.+)$/)
    if (ulMatch) {
      flushTable()
      if (!inList || listType !== "ul") {
        flushList()
        inList = true
        listType = "ul"
      }
      listItems.push(ulMatch[1])
      continue
    }
    
    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      flushTable()
      if (!inList || listType !== "ol") {
        flushList()
        inList = true
        listType = "ol"
      }
      listItems.push(olMatch[1])
      continue
    }
    
    // Table
    if (line.includes("|")) {
      flushList()
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean)
      
      // Check if this is a separator row
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        continue
      }
      
      if (!inTable) {
        inTable = true
        tableHeaders = cells
      } else {
        tableRows.push(cells)
      }
      continue
    }
    
    // Regular paragraph
    flushList()
    flushTable()
    elements.push(
      <mdxComponents.p key={elements.length}>{parseInline(line)}</mdxComponents.p>
    )
  }
  
  // Flush remaining
  flushCodeBlock()
  flushList()
  flushTable()
  
  return elements
}

/**
 * Parse inline markdown (bold, italic, code, links)
 */
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0
  
  while (remaining.length > 0) {
    // Bold **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/)
    if (boldMatch) {
      parts.push(<mdxComponents.strong key={key++}>{parseInline(boldMatch[2])}</mdxComponents.strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }
    
    // Italic *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)([^*_]+?)\1/)
    if (italicMatch) {
      parts.push(<mdxComponents.em key={key++}>{parseInline(italicMatch[2])}</mdxComponents.em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }
    
    // Inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      parts.push(<mdxComponents.code key={key++}>{codeMatch[1]}</mdxComponents.code>)
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }
    
    // Links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      parts.push(
        <mdxComponents.a key={key++} href={linkMatch[2]}>
          {linkMatch[1]}
        </mdxComponents.a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }
    
    // Images ![alt](url)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      parts.push(
        <mdxComponents.img key={key++} alt={imgMatch[1]} src={imgMatch[2]} />
      )
      remaining = remaining.slice(imgMatch[0].length)
      continue
    }
    
    // Plain text until next special character
    const plainMatch = remaining.match(/^[^*_`\[!]+/)
    if (plainMatch) {
      parts.push(plainMatch[0])
      remaining = remaining.slice(plainMatch[0].length)
      continue
    }
    
    // Single special character (not part of formatting)
    parts.push(remaining[0])
    remaining = remaining.slice(1)
  }
  
  return parts.length === 1 ? parts[0] : parts
}

/**
 * MDX Renderer Props
 */
interface MDXRendererProps {
  content: string
  className?: string
}

/**
 * MDX Renderer Component
 * Renders markdown content with custom styling and components
 */
export function MDXRenderer({ content, className }: MDXRendererProps) {
  const elements = React.useMemo(() => parseMarkdown(content), [content])
  
  return (
    <div className={cn("prose prose-neutral dark:prose-invert max-w-none", className)}>
      {elements}
    </div>
  )
}

