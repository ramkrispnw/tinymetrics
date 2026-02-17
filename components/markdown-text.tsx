import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface Props {
  content: string;
  baseColor?: string;
}

/**
 * Simple markdown renderer for AI responses.
 * Supports: bold, headers, bullets, numbered lists, tables, and emojis.
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
  // Match **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <Text key={`b-${match.index}`} style={{ fontWeight: "700" }}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Italic
      parts.push(
        <Text key={`i-${match.index}`} style={{ fontStyle: "italic" }}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      // Code
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

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/** Render a markdown table */
function TableBlock({
  lines,
  textColor,
  colors,
}: {
  lines: string[];
  textColor: string;
  colors: any;
}) {
  // Parse rows, skip separator rows (|---|---|)
  const rows = lines
    .filter((l) => !l.match(/^\|[\s\-:]+\|$/))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    );

  if (rows.length === 0) return null;

  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  return (
    <View style={[s.table, { borderColor: colors.border }]}>
      {/* Header */}
      <View style={[s.tableRow, { backgroundColor: colors.surface }]}>
        {headerRow.map((cell, ci) => (
          <View key={ci} style={[s.tableCell, ci > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
            <Text style={[s.tableCellText, { color: textColor, fontWeight: "700" }]}>
              {cell}
            </Text>
          </View>
        ))}
      </View>
      {/* Body */}
      {bodyRows.map((row, ri) => (
        <View
          key={ri}
          style={[
            s.tableRow,
            { borderTopWidth: 1, borderTopColor: colors.border },
            ri % 2 === 1 && { backgroundColor: colors.surface + "40" },
          ]}
        >
          {row.map((cell, ci) => (
            <View key={ci} style={[s.tableCell, ci > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
              <Text style={[s.tableCellText, { color: textColor }]}>
                {renderInline(cell, textColor, colors)}
              </Text>
            </View>
          ))}
        </View>
      ))}
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
  table: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginVertical: 4 },
  tableRow: { flexDirection: "row" },
  tableCell: { flex: 1, padding: 8 },
  tableCellText: { fontSize: 13, lineHeight: 18 },
});
