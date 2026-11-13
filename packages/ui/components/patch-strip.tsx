import type { Channel } from "schema";

export interface ChannelVersion {
  readonly channel: Channel;
  readonly version: string;
  /**
   * A newer version CIG has already released on this channel while the figures on record are
   * still `version`'s (ADR-049, amended): "4.10.3" beside "4.10.2-LIVE.12881860".
   */
  readonly released?: string | undefined;
}

export interface PatchStripProps {
  /** Current version per channel from GameVersion rows; a missing channel shows its empty state. */
  readonly versions: readonly ChannelVersion[];
}

/** LIVE always, with its empty state; PTU only when the data holds a PTU build (ADR-046). */
const ALWAYS: readonly Channel[] = ["LIVE"];
const WHEN_RECORDED: readonly Channel[] = ["PTU"];

/** The build strings, in the footer (spec 00, criterion "Patch strip"; ADR-046). */
export function PatchStrip({ versions }: PatchStripProps) {
  const recorded = new Set(versions.map((v) => v.channel));
  const shown = [
    ...ALWAYS,
    ...WHEN_RECORDED.filter((channel) => recorded.has(channel)),
  ];
  return (
    <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-caption">
      {shown.map((channel) => {
        const found = versions.find((v) => v.channel === channel);
        return (
          <div key={channel} className="flex items-baseline gap-2">
            <dt className="text-secondary">{channel}</dt>
            <dd className="m-0 font-mono text-primary">
              {found === undefined ? (
                <span className="font-sans text-secondary">
                  no build recorded
                </span>
              ) : found.released === undefined ? (
                found.version
              ) : (
                <>
                  {found.released}
                  <span className="font-sans text-secondary">
                    {" "}
                    {/* The dot is a separator, not a word to read aloud. */}
                    <span aria-hidden="true">·</span> figures from{" "}
                  </span>
                  {found.version}
                </>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
