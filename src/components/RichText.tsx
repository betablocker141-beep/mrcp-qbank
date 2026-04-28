/**
 * RichText — renders question stems and explanations with support for:
 *
 *  Tables      | Header | Header |
 *              |--------|--------|
 *              | Cell   | Cell   |
 *
 *  Bold        **text** or __text__
 *  Italic      *text*  or _text_
 *  Code        `inline code`
 *  Bullets     - item  or  • item  or  * item
 *  Numbers     1. item
 *  Newlines    single → space (same paragraph), double → new paragraph
 */

import React from 'react';

// ── Inline formatter ──────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode[] {
  // Combined regex: **bold**, __bold__, *italic*, _italic_, `code`
  const pattern = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|`([^`]+)`/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // **bold** or __bold__
      nodes.push(<strong key={match.index} className="font-semibold text-gray-900">{match[2]}</strong>);
    } else if (match[3]) {
      // *italic* or _italic_
      nodes.push(<em key={match.index} className="italic">{match[4]}</em>);
    } else if (match[5] !== undefined) {
      // `code`
      nodes.push(
        <code key={match.index} className="font-mono text-[13px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
          {match[5]}
        </code>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

// ── Table parser ──────────────────────────────────────────────────────────────

function isTableRow(line: string) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorRow(line: string) {
  return /^\|[\s|:-]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line.trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function TableBlock({ lines }: { lines: string[] }) {
  if (lines.length < 1) return null;

  const headerLine = lines[0];
  const sepIdx = lines.findIndex((l, i) => i > 0 && isSeparatorRow(l));
  const dataStart = sepIdx >= 0 ? sepIdx + 1 : 1;

  const headers = parseTableCells(headerLine);
  const rows = lines.slice(dataStart).filter((l) => isTableRow(l)).map(parseTableCells);

  // Check column alignment from separator row
  const alignments: Array<'left' | 'center' | 'right'> = [];
  if (sepIdx >= 0) {
    const sepCells = parseTableCells(lines[sepIdx]);
    sepCells.forEach((cell) => {
      if (cell.startsWith(':') && cell.endsWith(':')) alignments.push('center');
      else if (cell.endsWith(':')) alignments.push('right');
      else alignments.push('left');
    });
  }

  const getAlign = (i: number): 'left' | 'center' | 'right' =>
    alignments[i] ?? 'left';

  const alignClass = (i: number) => {
    const a = getAlign(i);
    return a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';
  };

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm border-collapse min-w-[300px]">
        <thead>
          <tr className="bg-slate-700 text-white">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-4 py-2.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap ${alignClass(i)} ${
                  i < headers.length - 1 ? 'border-r border-slate-600' : ''
                }`}
              >
                {parseInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`transition-colors ${
                ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'
              } hover:bg-blue-50`}
            >
              {headers.map((_, ci) => {
                const cell = row[ci] ?? '';
                // Strip **bold** markers to get plain text for abnormality check
                const cellText = cell.replace(/\*\*/g, '').replace(/__/g, '').trim();
                // Highlight if: explicitly bolded with ** OR starts with a known abnormal keyword
                const isBoldMarked = cell.startsWith('**') && cell.endsWith('**');
                const isKeywordAbnormal = /^(low|high|elevated|reduced|↑|↓|raised|decreased)/i.test(cellText);
                const isAbnormal = isBoldMarked || isKeywordAbnormal;
                return (
                  <td
                    key={ci}
                    className={`px-4 py-2.5 ${alignClass(ci)} ${
                      ci < headers.length - 1 ? 'border-r border-gray-100' : ''
                    } ${ri < rows.length - 1 ? 'border-b border-gray-100' : ''} ${
                      isAbnormal ? 'font-semibold text-red-600' : 'text-gray-700'
                    }`}
                  >
                    {parseInline(cellText)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pre-normalizer: handles inline tables stored without real newlines ─────────
//
// Questions stored in DB often have table rows on a single line, e.g.:
//   "Blood tests show: | Hb | 7 g/dL | 13–18 | |---| | WBC | 3 | 4–11 | Next sentence."
//
// This function:
//   1. Normalises line-endings
//   2. Splits adjacent table rows written as "| X | | Y |" → "| X |\n| Y |"
//   3. Splits text-before-table and text-after-table onto separate lines

function preNormalize(text: string): string {
  // Step 1 – line endings
  let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2 – "| |" row boundaries → "|\n|"
  // Covers "| end of row | | start of next row |"
  s = s.replace(/\| \|/g, '|\n|');

  // Step 3 – per-line: extract inline table segments
  const lines = s.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Pure table row (starts AND ends with |) – already fine
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      out.push(line);
      continue;
    }

    // Line contains at least one pipe – might have an inline table segment
    if (trimmed.includes('|')) {
      const firstPipe = trimmed.indexOf('|');
      const before    = trimmed.slice(0, firstPipe).trim();
      const rest      = trimmed.slice(firstPipe);         // starts with '|'
      const lastPipe  = rest.lastIndexOf('|');
      const table     = rest.slice(0, lastPipe + 1).trim();
      const after     = rest.slice(lastPipe + 1).trim();

      // Only treat as table when there are ≥2 pipes and it forms a valid row
      const pipeCount = (table.match(/\|/g) || []).length;
      if (pipeCount >= 2 && table.startsWith('|') && table.endsWith('|')) {
        if (before) out.push(before);
        out.push(table);
        if (after) out.push(after);
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

// ── Block parser ──────────────────────────────────────────────────────────────

type Block =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'table'; lines: string[] }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'blank' };

function parseBlocks(text: string): Block[] {
  // Pre-normalise: fix inline tables + normalise line endings
  const raw = preNormalize(text);
  const lines = raw.split('\n');

  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      blocks.push({ type: 'blank' });
      i++;
      continue;
    }

    // Table block: collect consecutive table rows (including separator)
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i].trim()) || isSeparatorRow(lines[i].trim()))) {
        if (lines[i].trim() !== '') tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length > 0) {
        blocks.push({ type: 'table', lines: tableLines });
      }
      continue;
    }

    // Bullet list: - item, • item, * item (not *italic*)
    if (/^[-•*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-•*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'bullet-list', items });
      continue;
    }

    // Ordered list: 1. item, 2. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    // Regular paragraph: collect until blank line, table, or list
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isTableRow(lines[i].trim()) &&
      !/^[-•*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paraLines });
    }
  }

  return blocks;
}

// ── Main component ────────────────────────────────────────────────────────────

interface RichTextProps {
  text: string;
  className?: string;
}

export default function RichText({ text, className = '' }: RichTextProps) {
  if (!text) return null;

  const blocks = parseBlocks(text);

  return (
    <div className={`rich-text-content ${className}`}>
      {blocks.map((block, bi) => {
        switch (block.type) {
          case 'blank':
            return <div key={bi} className="h-2" />;

          case 'table':
            return <TableBlock key={bi} lines={block.lines} />;

          case 'paragraph': {
            // Join lines with a space (soft wrap), treat consecutive lines as same paragraph
            const combined = block.lines.join(' ');
            return (
              <p key={bi} className="leading-relaxed text-inherit">
                {parseInline(combined)}
              </p>
            );
          }

          case 'bullet-list':
            return (
              <ul key={bi} className="my-2 space-y-1 pl-1">
                {block.items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-2 leading-relaxed">
                    <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                    <span>{parseInline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'ordered-list':
            return (
              <ol key={bi} className="my-2 space-y-1 pl-1">
                {block.items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-2 leading-relaxed">
                    <span className="mt-0 w-5 flex-shrink-0 font-semibold text-slate-500 text-sm">
                      {ii + 1}.
                    </span>
                    <span>{parseInline(item)}</span>
                  </li>
                ))}
              </ol>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
