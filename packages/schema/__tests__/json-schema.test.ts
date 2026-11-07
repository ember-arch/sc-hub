import { Ajv2020 } from "ajv/dist/2020.js";
// ajv-formats is CommonJS with the plugin as module.exports; under Node-style ESM resolution the
// default import is the whole module, so the plugin function sits on `.default`.
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";
import { toJsonSchemas } from "../json-schema.js";
import { entityNames } from "../registry.js";
import { loadFixture } from "./helpers.js";

const addFormats = addFormatsModule.default;
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const schemas = toJsonSchemas();

describe("toJsonSchemas", () => {
  it("emits one schema per entity in the registry", () => {
    expect(Object.keys(schemas).sort()).toEqual([...entityNames].sort());
  });
});

describe.each(entityNames)("%s JSON Schema", (name) => {
  const schema = schemas[name];
  const validate = ajv.compile(schema);
  const fixture = loadFixture(name);

  it("declares draft 2020-12 and carries its title", () => {
    expect(schema["$schema"]).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
    expect(schema["title"]).toBe(name);
  });

  it("accepts the same fixture the Zod type accepts", () => {
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it("rejects an unknown field, like the Zod type does", () => {
    expect(validate({ ...fixture, unexpected_field: 1 })).toBe(false);
  });

  it("rejects a missing field, like the Zod type does", () => {
    for (const key of Object.keys(fixture)) {
      const copy: Record<string, unknown> = { ...fixture };
      delete copy[key];
      expect(validate(copy), `${name} without ${key} should fail`).toBe(false);
    }
  });
});
