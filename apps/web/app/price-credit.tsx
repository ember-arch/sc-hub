import { TextLink, formatDate } from "ui";
import { PLEDGE_STORE_CREDIT, UEX_CREDIT } from "ui/legal";
import { pricesCopiedAt } from "../lib/acquisition";

/**
 * The credit line under any table outside the ship file that shows pledge or in-game prices
 * (ADR-013, docs/legal/attribution.md). `inGame` false for a table with pledge prices only.
 */
export function PriceCredit({ inGame = true }: { readonly inGame?: boolean }) {
  const copied = pricesCopiedAt();
  if (copied === null) return null;
  return (
    <p className="m-0 text-caption text-secondary">
      <TextLink
        href={PLEDGE_STORE_CREDIT.url}
        external
        className="text-secondary"
      >
        Pledge prices
      </TextLink>
      : the RSI pledge store, copied {formatDate(copied)}. The lowest standalone
      price on sale, or the last one listed.
      {inGame ? (
        <>
          {" "}
          <TextLink href={UEX_CREDIT.url} external className="text-secondary">
            In-game prices
          </TextLink>
          : the lowest reported to UEX Corp, via the Star Citizen Wiki API.{" "}
          {UEX_CREDIT.notice}
        </>
      ) : null}
    </p>
  );
}
