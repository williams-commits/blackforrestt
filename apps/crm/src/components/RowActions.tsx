"use client";

import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  onClick: () => void;
  icon?: string;
  destructive?: boolean;
}

/**
 * Row action dropdown — the ⋯ kebab used on table rows and record headers.
 * Destructive actions sink to the end behind a separator so the primary
 * workflow stays visually separate from destructive ones.
 */
export function RowActions({
  actions,
  label,
}: {
  actions: RowAction[];
  /** Optional menu heading (defaults to none — the trigger is self-evident). */
  label?: string;
}) {
  const primary = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="tertiary"
          size="sm"
          className="w-7 px-0"
          aria-label="Row actions"
        >
          <Icon name="more" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {label ? <DropdownMenuLabel>{label}</DropdownMenuLabel> : null}
        {primary.map((action) => (
          <DropdownMenuItem key={action.label} onSelect={() => action.onClick()}>
            {action.icon ? <Icon name={action.icon} size={14} /> : null}
            {action.label}
          </DropdownMenuItem>
        ))}
        {destructive.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {destructive.map((action) => (
              <DropdownMenuItem
                key={action.label}
                variant="destructive"
                onSelect={() => action.onClick()}
              >
                {action.icon ? <Icon name={action.icon} size={14} /> : null}
                {action.label}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
