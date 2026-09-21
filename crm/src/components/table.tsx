import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from "react";

/**
 * The ONE table component. Every data table in the CRM renders through
 * these primitives so styling, density, header casing, row selection, and
 * responsive behavior change in exactly one place (globals.css `.table`).
 *
 * Usage:
 *   <Table>
 *     <THead><TR><TH>Name</TH>…</TR></THead>
 *     <TBody><TR selected?><TD>…</TD>…</TR></TBody>
 *   </Table>
 */

export function Table({
  children,
  compact = false,
  className = "",
}: {
  children: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <table className={`table ${compact ? "table-compact" : ""} ${className}`}>{children}</table>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({
  selected = false,
  className = "",
  ...rest
}: { selected?: boolean } & HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`${selected ? "selected" : ""} ${className}`} {...rest} />;
}

export function TH({ children, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={className} {...rest}>
      {children}
    </th>
  );
}

export function TD({ children, className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={className} {...rest}>
      {children}
    </td>
  );
}
