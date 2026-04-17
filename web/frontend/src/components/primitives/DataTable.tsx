import type { ReactNode } from "react";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

const ALIGN_CLASS: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/**
 * Presentational data table. Callers provide columns, rows, and a row-key selector.
 * When `rows` is empty and `empty` is supplied, the table body is replaced by that slot
 * (callers typically pass `<EmptyState ... />`).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const wrapperCls = ["w-full", className ?? ""].filter(Boolean).join(" ");

  if (rows.length === 0 && empty !== undefined) {
    return <div className={wrapperCls}>{empty}</div>;
  }

  return (
    <div className={wrapperCls}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted uppercase text-xs font-semibold border-b border-border">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={[
                  "px-3 py-2",
                  ALIGN_CLASS[col.align ?? "left"],
                  col.className ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = getRowKey(row);
            return (
              <tr
                key={key}
                className={[
                  "border-b border-border",
                  onRowClick ? "hover:bg-hover cursor-pointer" : "hover:bg-hover",
                ].join(" ")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={[
                      "px-3 py-2",
                      ALIGN_CLASS[col.align ?? "left"],
                      col.className ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
