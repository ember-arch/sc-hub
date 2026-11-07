import type { Channel } from "schema";

export interface ChannelVersion {
  readonly channel: Channel;
  readonly version: string;
}

export interface PatchStripProps {
  /** Current version per channel from GameVersion rows; a missing channel shows its empty state. */
  readonly versions: readonly ChannelVersion[];
}

const SHOWN: readonly Channel[] = ["LIVE", "PTU"];

/** LIVE and PTU build strings, on home and in the footer (spec 00, criterion "Patch strip"). */
export function PatchStrip({ versions }: PatchStripProps) {
  return (
    <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-caption">
      {SHOWN.map((channel) => {
        const found = versions.find((v) => v.channel === channel);
        return (
          <div key={channel} className="flex items-baseline gap-2">
            <dt className="font-medium text-secondary">{channel}</dt>
            <dd className="m-0 font-mono text-primary">
              {found === undefined ? (
                <span className="font-sans text-secondary">
                  no build recorded
                </span>
              ) : (
                found.version
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
