import { SearchField, TextLink } from "ui";
import { Site } from "../lib/site";

/** Unknown routes and slugs: say what happened and offer the search. */
export default function NotFound() {
  return (
    <Site>
      <div className="flex max-w-prose flex-col gap-6 pt-8">
        <h1 className="text-title text-primary">Not found</h1>
        <p className="text-body text-secondary">
          There is no page at this address, so search for a ship, component or
          manufacturer or go to the <TextLink href="/">home page</TextLink>.
        </p>
        <SearchField />
      </div>
    </Site>
  );
}
