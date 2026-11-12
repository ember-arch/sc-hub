# Data model

This is the source for `packages/schema` (Zod) and `packages/db` (Drizzle). Build the Zod types first, generate JSON Schema from them for the pipeline's validation step, and derive the Drizzle tables from the same definitions. Field names here are the field names in code.

## Principles

1. Identity is the game `class_name`. Everything else is an attribute.
2. Every stat carries `channel` and `game_version`. There is no unversioned stat table.
3. Published versions are immutable. A fix is a new version.
4. Keep the raw record. Every stats table has a `raw` JSONB column with the normalized-but-unmapped remainder of the DataCore record, so a field we did not model is still queryable later without re-extracting.
5. Content is append-only with revisions. Nothing a source publishes is ever lost, and nothing displays that has been flagged for takedown.

## Enumerations

```
Channel          = LIVE | PTU | EPTU
VehicleStatus    = flight_ready | in_production | concept
VehicleKind      = ship | ground_vehicle
ItemType         = weapon | turret | missile_rack | missile | shield | power_plant | cooler |
                   quantum_drive | radar | fuel_tank | fuel_intake | jump_module | thruster |
                   armor | utility | mining_laser | tractor_beam | countermeasure | other
PortType         = same set as ItemType plus: paint, interior, cargo_grid
ContentSource    = comm_link | patch_notes | roadmap | progress_tracker | video | spectrum
EntityType       = vehicle | item | manufacturer | author
ModelTier        = preview | full
```

## Entities

### GameVersion
| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | |
| channel | Channel | |
| version | string | Full build string, e.g. `4.3.1-live.10234567` |
| detected_at | timestamp | When the pipeline saw it |
| published_at | timestamp | When the import flipped the pointer; null until then |
| manifest_url | string | R2 path of the data pack manifest |
| is_current | boolean | Exactly one true per channel; flipped in one transaction |

### Manufacturer
| Field | Type | Notes |
| --- | --- | --- |
| code | string PK | e.g. `AEGS`, `ANVL`, `RSI`, `DRAK` |
| name | string | |
| slug | string unique | |
| description | text | Fankit or localization copy only; never invented |
| logo_asset | string nullable | CDN path, fankit-sourced |

### Vehicle
| Field | Type | Notes |
| --- | --- | --- |
| class_name | string PK | e.g. `AEGS_Gladius` |
| slug | string unique | Kebab of display name; prefixed with manufacturer only on collision; never changes after first publish |
| name | string | Current display name (localized English) |
| manufacturer_code | FK Manufacturer | |
| kind | VehicleKind | |
| status | VehicleStatus | From ship matrix; the game files only know flyable ships |
| role | string nullable | Ship-matrix focus, e.g. `Light Fighter` |
| size_class | string nullable | vehicle, snub, small, medium, large, capital |
| base_variant_of | FK Vehicle nullable | Variants point at their base |
| is_hero | boolean | In the 20-ship 3D list |
| first_seen_version | string | |
| slug_history | string[] | Old slugs, served as redirects |

### VehicleStats (one row per vehicle per version)
| Field | Type | Notes |
| --- | --- | --- |
| class_name | FK Vehicle | PK with channel + game_version |
| channel | Channel | |
| game_version | string | |
| length_m, beam_m, height_m | number | |
| mass_kg | number | |
| cargo_scu | number nullable | |
| crew_min, crew_max | integer | |
| hull_hp | number nullable | |
| scm_speed, nav_speed | number nullable | m/s |
| hydrogen_fuel, quantum_fuel | number nullable | |
| hydrogen_capacity, quantum_capacity | number nullable | |
| raw | jsonb | Unmapped remainder |

### Port (hardpoint; one row per port per vehicle per version)
| Field | Type | Notes |
| --- | --- | --- |
| class_name | FK Vehicle | |
| channel, game_version | | |
| port_path | string | Path from the vehicle's root port, parent paths joined by `/`, for example `hardpoint_gun_nose/hardpoint_class_2`; PK with the three above. Game port names repeat under different parents (each missile rack has a `missile_01_attach`), so the name alone cannot be the key |
| port_name | string | Game port name; the last segment of port_path |
| port_type | PortType | |
| size_min, size_max | integer | |
| parent_port_path | string nullable | Nested ports (a turret's weapon ports) point at their parent's port_path |
| default_item_class | FK Item nullable | Stock loadout |
| position | string nullable | Human label if the game provides one |

### Item (component)
| Field | Type | Notes |
| --- | --- | --- |
| class_name | string PK | |
| slug | string unique | |
| name | string | |
| manufacturer_code | FK Manufacturer | |
| type | ItemType | |
| subtype | string nullable | e.g. ballistic gatling, laser repeater |
| size | integer | |
| grade | string nullable | A to D where the game has it |
| item_class | string nullable | military, civilian, industrial, stealth, competition |
| first_seen_version | string | |

### ItemStats (one row per item per version)
| Field | Type | Notes |
| --- | --- | --- |
| class_name | FK Item | PK with channel + game_version |
| channel, game_version | | |
| hp | number nullable | |
| power_draw, power_output | number nullable | power_output in segments (power plants) |
| heat_generation, cooling_rate | number nullable | cooling_rate in segments (coolers) |
| em_signature, ir_signature | number nullable | |
| weapon_damage, weapon_fire_rate, weapon_range, projectile_speed | number nullable | Weapons only |
| shield_hp, shield_regen, shield_delay | number nullable | Shields only |
| qd_speed, qd_range, qd_fuel_per_jump, qd_spool_time | number nullable | Quantum drives only |
| raw | jsonb | Everything else, including per-type fields not listed |

Rule: a type-specific field left null for other types is fine. Do not create one table per item type in v1; the calculator (v2) can project views.

### Paint
| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | |
| class_name | FK Vehicle | |
| name | string | |
| preview_asset | string nullable | |

### Model (3D)
| Field | Type | Notes |
| --- | --- | --- |
| class_name | FK Vehicle | PK with channel + game_version + tier |
| channel | Channel | |
| game_version | string | |
| tier | ModelTier | |
| url | string | CDN path |
| bytes | integer | |
| triangles | integer | |
| texture_count | integer | |
| checksum | string | |
| takedown | boolean | |

### ContentItem
| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | |
| source | ContentSource | |
| external_id | string | Source's own id; unique with source |
| url | string | Canonical link back to the source; always displayed |
| title | string | |
| summary | text nullable | First paragraph or source-provided excerpt; never generated |
| body_html | text | Sanitized; quotes and formatting preserved |
| published_at | timestamp | |
| fetched_at | timestamp | |
| revision | integer | Increments when the source changes the item |
| author_id | FK Author nullable | Spectrum only |
| thread_id, thread_title | string nullable | Spectrum only |
| forum | string nullable | Where on its source the item was published: a Spectrum post's forum; a video's YouTube channel, "Star Citizen" or "Squadron 42" (ADR-050) |
| takedown | boolean | When true: 410, purged from search |

### Author (CIG staff on Spectrum)
| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | |
| handle | string unique | |
| display_name | string | |
| role | string nullable | As shown on Spectrum (badge or title) |
| first_seen | timestamp | |
| post_count | integer | Derived |
| takedown | boolean | Removes the author page and hides all posts |

No avatars, no personal details beyond what Spectrum shows on the post itself.

### EntityLink
| Field | Type | Notes |
| --- | --- | --- |
| content_item_id | FK ContentItem | |
| entity_type | EntityType | |
| entity_key | string | class_name, manufacturer code, or author id |
| matched_text | string | |
| char_start, char_end | integer | |
| confidence | number | 0 to 1 |
| confirmed | boolean | Manual confirmation flips low-confidence links visible |

Display threshold is `confidence ≥ 0.9 OR confirmed`.

## Entity-link confidence table

| Match | Confidence |
| --- | --- |
| Exact `class_name` or exact full display name (manufacturer + model) | 1.0 |
| Model name with its manufacturer name within 40 characters | 0.95 |
| Model name alone, not in the exclusion list, 6+ characters | 0.9 |
| Model name alone, in the exclusion list (Arrow, Hawk, Nomad, Eclipse, Hornet, Spirit, and others added over time) | 0.6 |
| Fuzzy match (edit distance 1 on a 7+ character name) | 0.5 |

The exclusion list is `workers/link-entities/exclusions.json`. Add to it when a false link is found; never special-case in code.

## Version diff

The normalize step emits `diff.json` per run: for each entity, fields added, removed, or changed versus the previous version of the same channel, with old and new values. Phase 2 displays it on ship pages as "changed in this version"; a later phase builds patch pages from it.

Until it exists, the patch pages (ADR-049) compare build snapshots instead: `fixtures/patches/<build>.json.gz`, one per build the Star Citizen Wiki API keeps, each holding every ship's, part's and blueprint's figures as the source states them (`PatchSnapshot` in `packages/schema/entities/patch.ts`). A comparison computes the same three things `diff.json` will hold (entities added and removed, figures changed with old and new values) for any two builds. When the pipeline publishes a version it can write a snapshot of the same shape (`source: "pipeline"`), which is how PTU builds reach the pages.

## Slugs and redirects

A slug is computed once when an entity is first published. If the display name changes, the old slug is appended to `slug_history` and the app serves a 301 from it. A slug collision across manufacturers is resolved by prefixing the manufacturer code to the newer entity's slug; when the collision is found at one first publish (a bootstrap pack, a first import), every colliding entity gets the prefix. If the prefixed slug still collides (components that share one display name within a manufacturer, placeholders among them), the slug is the kebab-case `class_name`, which is unique by definition.
