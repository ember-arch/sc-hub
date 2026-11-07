import type { MetadataRoute } from "next";
import { absolute } from "../lib/seo";

/** robots.txt: everything public except the component gallery and compare permutations. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/gallery", "/compare"] }],
    sitemap: absolute("/sitemap.xml"),
  };
}
