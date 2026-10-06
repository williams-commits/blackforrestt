import { Tooltip } from "./Tooltip";

/** Inline ⓘ that reveals a styled tooltip on hover or keyboard focus. */
export function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <span className="inline-flex cursor-help align-baseline focus-visible:outline-none" tabIndex={0}>
        <span aria-hidden className="ml-1 select-none text-inherit">ⓘ</span>
      </span>
    </Tooltip>
  );
}
