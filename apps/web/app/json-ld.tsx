import { type JsonLd, jsonLdHtml } from "../lib/seo";

/** A JSON-LD block (spec 02, "SEO") rendered on the server; nothing else goes through innerHTML. */
export function JsonLdScript({ data }: { readonly data: JsonLd }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }}
    />
  );
}
