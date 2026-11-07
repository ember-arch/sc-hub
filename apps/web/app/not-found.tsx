import { SearchField, TextLink } from "ui";
import { Site } from "../lib/site";

/** Unknown routes and slugs: say what happened and offer the search (spec 02 adds slug redirects). */
export default function NotFound() {
  return (
    <Site>
      <div className="flex max-w-prose flex-col gap-6 pt-8">
        <h1 className="text-title text-primary">Not found</h1>
        <p className="text-body text-secondary">
          There is no page at this address. Search for a ship, component or
          manufacturer, or go to the <TextLink href="/">home page</TextLink>.
        </p>
        <SearchField />
      </div>
    </Site>
  );
}
