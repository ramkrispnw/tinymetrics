import React from "react";
import { Text, View, StyleSheet, ScrollView } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface Props {
  content: string;
  baseColor?: string;
}

/**
 * Simple markdown renderer for AI responses.
 * Supports: bold, headers, bullets, numbered lists, tables (frozen first column + horizontal scroll), and emojis.
 */
export function MarkdownText({ content, baseColor }: Props) {
  const colors = useColors();
  const textColor = baseColor || colors.foreground;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection: line starts with |
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(
        <TableBlock key={`table-${i}`} lines={tableLines} textColor={textColor} colors={colors} />
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<View key={`space-${i}`} style={{ height: 8 }} />);
      i++;
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <Text key={`h3-${i}`} style={[s.h3, { color: textColor }]}>
          {renderInline(line.slice(4), textColor, colors)}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <Text key={`h2-${i}`} style={[s.h2, { color: textColor }]}>
          {renderInline(line.slice(3), textColor, colors)}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <Text key={`h1-${i}`} style={[s.h1, { color: textColor }]}>
          {renderInline(line.slice(2), textColor, colors)}
        </Text>
      );
      i++;
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*)[•\-\*]\s+(.*)/);
    if (bulletMatch) {
      const indent = Math.min(Math.floor(bulletMatch[1].length / 2), 3);
      elements.push(
        <View key={`bullet-${i}`} style={[s.bulletRow, { paddingLeft: indent * 16 }]}>
          <Text style={[s.bulletDot, { color: textColor }]}>•</Text>
          <Text style={[s.bulletText, { color: textColor }]}>
            {renderInline(bulletMatch[2], textColor, colors)}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\s*)\d+[\.\)]\s+(.*)/);
    if (numMatch) {
      const num = line.match(/^(\s*)(\d+)[\.\)]/);
      const indent = Math.min(Math.floor((num?.[1]?.length || 0) / 2), 3);
      elements.push(
        <View key={`num-${i}`} style={[s.bulletRow, { paddingLeft: indent * 16 }]}>
          <Text style={[s.numLabel, { color: textColor }]}>{num?.[2] || "1"}.</Text>
          <Text style={[s.bulletText, { color: textColor }]}>
            {renderInline(numMatch[2], textColor, colors)}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      elements.push(
        <View key={`hr-${i}`} style={[s.hr, { backgroundColor: colors.border }]} />
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text key={`p-${i}`} style={[s.paragraph, { color: textColor }]}>
        {renderInline(line, textColor, colors)}
      </Text>
    );
    i++;
  }

  return <View style={s.container}>{elements}</View>;
}

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(
  text: string,
  textColor: string,
  colors: any
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(
        <Text key={`b-${match.index}`} style={{ fontWeight: "700" }}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      parts.push(
        <Text key={`i-${match.index}`} style={{ fontStyle: "italic" }}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      parts.push(
        <Text
          key={`c-${match.index}`}
          style={{
            fontFamily: "monospace",
            backgroundColor: colors.surface,
            paddingHorizontal: 4,
            borderRadius: 3,
            fontSize: 13,
          }}
        >
          {match[4]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Parse a markdown table line into cells.
 */
function parseCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/**
 * Returns true if a line is a markdown separator row (e.g. |---|:---:|---:|)
 */
function isSeparatorRow(line: string): boolean {
  const cells = parseCells(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

/**
 * Estimate column width in px based on longest content in that column.
 * Min 60px, max 160px, ~8px per character.
 */
function estimateColWidths(rows: string[][]): number[] {
  if (rows.length === 0) return [];
  const numCols = Math.max(...rows.map((r) => r.length));
  const widths: number[] = Array(numCols).fill(0);

  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const len = row[c].replace(/\*\*/g, "").replace(/\*/g, "").length;
      widths[c] = Math.max(widths[c], len);
    }
  }

  return widths.map((w) => Math.min(Math.max(w * 8, 60), 160));
}

/**
 * Render a single table cell's content.
 */
function CellContent({
  cell,
  textColor,
  colors,
  bold,
}: {
  cell: string;
  textColor: string;
  colors: any;
  bold?: boolean;
}) {
  return (
    <Text style={[s.tableCellText, { color: textColor, fontWeight: bold ? "700" : "400" }]}>
      {renderInline(cell, textColor, colors)}
    </Text>
  );
}

/**
 * Render a markdown table with a frozen first column and horizontally scrollable remaining columns.
 *
 * Layout:
 *   [ frozen col 0 ] | [ ScrollView → col 1, col 2, col 3 … ]
 *
 * Each row in the frozen column and the scrollable section must have the same height.
 * We achieve this by rendering them side-by-side in a flex-row, letting RN natural layout
 * match heights within each row.
 */
function TableBlock({
  lines,
  textColor,
  colors,
}: {
  lines: string[];
  textColor: string;
  colors: any;
}) {
  const dataLines = lines.filter((l) => !isSeparatorRow(l));
  const rows = dataLines.map(parseCells);

  if (rows.length === 0) return null;

  const headerRow = rows[0];
  const bodyRows = rows.slice(1);
  const colWidths = estimateColWidths(rows);

  // Only freeze first column if there are 3+ columns (otherwise just scroll the whole thing)
  const shouldFreeze = headerRow.length >= 3;
  const frozenWidth = shouldFreeze ? (colWidths[0] ?? 80) : 0;
  const scrollCols = shouldFreeze ? headerRow.length - 1 : headerRow.length;
  const startCol = shouldFreeze ? 1 : 0;

  const renderRow = (row: string[], ri: number, isHeader: boolean) => {
    const rowBg = isHeader
      ? colors.surface
      : ri % 2 === 1
      ? colors.surface + "60"
      : "transparent";

    return (
      <View
        key={`row-${ri}`}
        style={[
          s.tableRow,
          { backgroundColor: rowBg },
          !isHeader && { borderTopWidth: 1, borderTopColor: colors.border },
        ]}
      >
        {/* Frozen first column */}
        {shouldFreeze && (
          <View
            style={[
              s.tableCell,
              s.frozenCell,
              {
                width: frozenWidth,
                backgroundColor: isHeader ? colors.surface : rowBg,
                borderRightColor: colors.border,
                borderRightWidth: 1,
              },
            ]}
          >
            <CellContent
              cell={row[0] ?? ""}
              textColor={textColor}
              colors={colors}
              bold={isHeader}
            />
          </View>
        )}

        {/* Scrollable remaining columns */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={scrollCols > 2}
          contentContainerStyle={{ flexDirection: "row" }}
        >
          {Array.from({ length: scrollCols }, (_, idx) => {
            const ci = startCol + idx;
            return (
              <View
                key={ci}
                style={[
                  s.tableCell,
                  { width: colWidths[ci] ?? 80 },
                  idx > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                ]}
              >
                <CellContent
                  cell={row[ci] ?? ""}
                  textColor={textColor}
                  colors={colors}
                  bold={isHeader}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[s.table, { borderColor: colors.border }]}>
      {renderRow(headerRow, 0, true)}
      {bodyRows.map((row, ri) => renderRow(row, ri, false))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 2 },
  h1: { fontSize: 20, fontWeight: "800", lineHeight: 28, marginTop: 4, marginBottom: 4 },
  h2: { fontSize: 17, fontWeight: "700", lineHeight: 24, marginTop: 4, marginBottom: 2 },
  h3: { fontSize: 15, fontWeight: "700", lineHeight: 22, marginTop: 2, marginBottom: 2 },
  paragraph: { fontSize: 15, lineHeight: 22 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingRight: 8 },
  bulletDot: { fontSize: 15, lineHeight: 22, width: 12 },
  numLabel: { fontSize: 15, lineHeight: 22, width: 20, fontWeight: "600" },
  bulletText: { fontSize: 15, lineHeight: 22, flex: 1 },
  hr: { height: 1, marginVertical: 8 },
  table: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginVertical: 6 },
  tableRow: { flexDirection: "row" },
  tableCell: { paddingHorizontal: 10, paddingVertical: 8 },
  frozenCell: { zIndex: 1 },
  tableCellText: { fontSize: 13, lineHeight: 19 },
});
