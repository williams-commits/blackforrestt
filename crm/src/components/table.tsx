"use client";

import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from "@/components/ui/table";

/**
 * The ONE table component — now backed by shadcn/ui's table primitives.
 * Every data table in the CRM renders through these wrappers so styling,
 * density, header casing, row selection, and responsive behavior change in
 * exactly one place. The legacy `.table` CSS remains as the visual base
 * (neutral-mapped) while components migrate.
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
    <ShadcnTable className={cn("table", compact && "table-compact", className)}>
      {children}
    </ShadcnTable>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <ShadcnTableHeader {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <ShadcnTableBody {...props} />;
}

export function TR({
  selected = false,
  className = "",
  ...rest
}: { selected?: boolean } & HTMLAttributes<HTMLTableRowElement>) {
  return <ShadcnTableRow className={cn(selected && "selected", className)} {...rest} />;
}

export function TH({ children, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <ShadcnTableHead className={className} {...rest}>
      {children}
    </ShadcnTableHead>
  );
}

export function TD({ children, className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <ShadcnTableCell className={className} {...rest}>
      {children}
    </ShadcnTableCell>
  );
}

