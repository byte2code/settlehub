/** Builds RFC 4180 CSV and neutralises spreadsheet formula injection (=, +, -, @ prefixes). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let value = cell === null || cell === undefined ? '' : String(cell);
          if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(value)) value = `'${value}`;
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\r\n');
}
