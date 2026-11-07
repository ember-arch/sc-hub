import type { MetadataRoute } from "next";
import { absolute } from "../lib/seo";

/** robots.txt: everything public except the component gallery. */
export default function robots(): MetadataRoute.Robots {
  return {
    // Compare is not disallowed: it carries noindex, which a crawler only sees if it may fetch it.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/gallery"] }],
    sitemap: absolute("/sitemap.xml"),
  };
}
