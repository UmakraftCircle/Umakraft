export class Formatter {
  /**
   * Formats items into a bulleted list
   */
  public list(items: string[]): string {
    return items.map(item => `• ${item.trim()}`).join('\n');
  }

  /**
   * Formats text into section titles
   */
  public header(title: string, level: number = 2): string {
    const hashes = '#'.repeat(level);
    return `${hashes} ${title.trim()}`;
  }

  /**
   * Formats a collection of records into a readable text-based or markdown table
   */
  public table(headers: string[], rows: string[][]): string {
    if (headers.length === 0) return '';

    // Calculate column widths
    const colWidths = headers.map((header, colIdx) => {
      const rowLengths = rows.map(row => (row[colIdx] ? row[colIdx].length : 0));
      return Math.max(header.length, ...rowLengths);
    });

    // Helper to pad columns
    const pad = (str: string, width: number) => str + ' '.repeat(Math.max(0, width - str.length));

    // Construct headers line
    const headerLine = '| ' + headers.map((h, i) => pad(h, colWidths[i])).join(' | ') + ' |';
    
    // Separator line
    const separatorLine = '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |';

    // Construct row lines
    const rowLines = rows.map(row => {
      return '| ' + headers.map((_, colIdx) => pad(row[colIdx] || '', colWidths[colIdx])).join(' | ') + ' |';
    });

    return [headerLine, separatorLine, ...rowLines].join('\n');
  }

  /**
   * Builds a structured text report containing multiple sections
   */
  public report(title: string, sections: { heading: string; content: string }[]): string {
    const border = '='.repeat(40);
    const body = sections.map(s => `[${s.heading.toUpperCase()}]\n${s.content}`).join('\n\n');
    return `${border}\n${title.toUpperCase()}\n${border}\n\n${body}\n${border}`;
  }
}
