# fixtures/bootstrap

Some game data via the Star Citizen Wiki API (api.star-citizen.wiki).

Bootstrap placeholders for Phase 0: five ships, their stock loadouts, the components those loadouts reference and the catalogue of ship guns, missiles and torpedoes, shields, power plants, coolers and quantum drives the loadout editor offers (ADR-016), fetched from the Star Citizen Wiki API by `scripts/bootstrap-fixtures` on 2026-11-08T22:22:55.346Z. Phase 1 replaces this pack with records extracted from the game files; until then every page that shows this data carries the credit line above (`docs/legal/attribution.md`).

**Do not edit these files by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/index.ts
```

**For disposable databases only.** Seeding this pack into the database that will serve the site would freeze its placeholder slugs and first_seen_version values (slugs never change after first publish), and re-seeding a newer bootstrap version into the same database fails on the one-current-version-per-channel rule until the database is wiped (deleting packages/db/.pglite is enough locally). Phase 1 extraction replaces this pack; from then on the import job, not this seed, owns the channel pointer.

## Contents

Game version `4.10.2-LIVE.12881860`, channel LIVE, as reported by the API's default version at fetch time. `manifest.json` lists every file with its sha256, byte size and row count; `packages/schema` (`parsePack`) validates the whole pack before anything reads it.

| Ship | class_name | Manufacturer | Size | Status |
| --- | --- | --- | --- | --- |
| Fury | `MISC_Fury` | MRAI | snub | flight_ready |
| Gladius | `AEGS_Gladius` | AEGS | small | flight_ready |
| Cutlass Black | `DRAK_Cutlass_Black` | DRAK | medium | flight_ready |
| Carrack | `ANVL_Carrack` | ANVL | large | flight_ready |
| Polaris | `RSI_Polaris` | RSI | capital | flight_ready |
| Perseus | `RSI_Perseus` | RSI | large | flight_ready |

| File | Rows |
| --- | --- |
| GameVersion | 1 |
| Manufacturer | 52 |
| Vehicle | 6 |
| VehicleStats | 6 |
| Port | 966 |
| Item | 578 |
| ItemStats | 578 |

## How the API's vocabulary was mapped

Every value is the API's own; the script only maps the API's type names onto the data model's enumerations (`scripts/bootstrap-fixtures/map.ts`, recorded in ADR-004). Where the API's meaning was ambiguous the field is null and the original values stay in `raw`:

- `VehicleStats.hydrogen_fuel` and `quantum_fuel` are null; `fuel.capacity` and `quantum.quantum_fuel_capacity` map to the two capacity fields.
- `ItemStats.power_draw`, `power_output`, `heat_generation`, `cooling_rate`, `em_signature`, `shield_delay`, `qd_range` and `qd_fuel_per_jump` are null (the API gives ranges or pairs).
- Units are the API's: metres, kilograms, SCU, metres per second. No conversion was applied.
- `Vehicle.base_variant_of` is null: the API exposes no base-variant relation.
- `Vehicle.role` is the ship-matrix focus list joined with commas.
- Ports of type `` (367), `LifeSupportGenerator` (6), `Misc` (18), `WeaponAttachment` (44) are kept as `other` and carry no stock item; `Paints` ports are kept as `paint` without one. Only component ports reference an `Item`.
- Interior fittings and controllers are not hardpoints and have no row: `AIModule` (13), `AirTrafficController` (6), `AttachedPart` (4), `CapacitorAssignmentController` (6), `CommsController` (6), `CoolerController` (6), `Display` (34), `DockingAnimator` (4), `DockingCollar` (8), `Door` (39), `DoorController` (6), `EnergyController` (6), `FlightController` (6), `FuelController` (6), `LandingSystem` (6), `LightController` (6), `MissileController` (20), `Relay` (32), `Room` (7), `SalvageController` (2), `Seat` (24), `SeatAccess` (36), `SeatDashboard` (13), `SelfDestruct` (6), `ShieldController` (6), `Usable` (4), `WeaponController` (30).
- Slugs are the kebab-case display name, prefixed with the manufacturer code only on collision.

## Samples

`samples/` holds raw API responses trimmed by rule (first port of each type, English text only) for the mapper's unit tests. They are the only raw responses in the repository.

## Source

- https://api.star-citizen.wiki/api/game-versions/default
- https://api.star-citizen.wiki/api/vehicles?filter[class_name]=MISC_Fury&page[size]=50
- https://api.star-citizen.wiki/api/vehicles/96b11061-68ce-4896-9424-fc8804a410ae?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles?filter[class_name]=AEGS_Gladius&page[size]=50
- https://api.star-citizen.wiki/api/vehicles/b6b59889-7226-458e-a6b0-1c9392128a3c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles?filter[class_name]=DRAK_Cutlass_Black&page[size]=50
- https://api.star-citizen.wiki/api/vehicles/b58f7735-9454-4a0a-b724-2bc8d61961d7?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles?filter[class_name]=ANVL_Carrack&page[size]=50
- https://api.star-citizen.wiki/api/vehicles/f6d606c9-b324-4efa-814f-15a59047a6a5?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles?filter[class_name]=RSI_Polaris&page[size]=50
- https://api.star-citizen.wiki/api/vehicles/a5a5b055-c5d7-4384-9951-f15d47b88789?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles?filter[class_name]=RSI_Perseus&page[size]=50
- https://api.star-citizen.wiki/api/vehicles/40a1f83b-3623-49e6-8168-ab8223998aa2?include=hardpoints
- https://api.star-citizen.wiki/api/items/98b48f87-bd84-47fd-a1fd-582df790baa9
- https://api.star-citizen.wiki/api/items/d3171a19-4d1d-439b-b3ec-d814231ee92e
- https://api.star-citizen.wiki/api/items/5d118473-dd82-4182-81a8-3bcf35b8d969
- https://api.star-citizen.wiki/api/items/0082c17c-4b9b-4458-bc13-bd64f0e87584
- https://api.star-citizen.wiki/api/items/ae7c31e7-756d-4884-99b3-edd23e925c46
- https://api.star-citizen.wiki/api/items/37670506-d57e-4dbe-be92-cbe85f1fe9ad
- https://api.star-citizen.wiki/api/items/cf57c4df-0fed-40bb-9771-10fc7853d8f9
- https://api.star-citizen.wiki/api/items/25aed8f9-b86f-4529-92a2-320f0abd9a1c
- https://api.star-citizen.wiki/api/items/ae33bd77-8c58-4259-9b3e-7b1cc0838a19
- https://api.star-citizen.wiki/api/items/83d9206c-85b2-491c-b312-d31f6c634374
- https://api.star-citizen.wiki/api/items/be1bce53-447b-42ce-9990-5a3053ab7e95
- https://api.star-citizen.wiki/api/items/5e79be94-5052-4617-b5d3-c433b4401e0b
- https://api.star-citizen.wiki/api/items/f82646a8-8eb7-4b2a-a1ad-0225972117ac
- https://api.star-citizen.wiki/api/items/758cda94-601c-438d-9171-bd048418c7b0
- https://api.star-citizen.wiki/api/items/f9672d39-1950-48c1-9cc6-8cb230fa522c
- https://api.star-citizen.wiki/api/items/514d62e4-5319-4390-81fa-c8b1eef8afb9
- https://api.star-citizen.wiki/api/items/6bb0d330-e344-46c6-94b6-027ffa4aaff1
- https://api.star-citizen.wiki/api/items/a8c6dd29-faf0-4c37-b92e-3caee7e33c37
- https://api.star-citizen.wiki/api/items/c74fbf65-d72e-4e5f-bb8b-115c2296f650
- https://api.star-citizen.wiki/api/items/a1bde463-b3ce-4959-9bc2-6ef0f6fb1494
- https://api.star-citizen.wiki/api/items/df022e28-9394-45f5-aa23-a38dd92391f5
- https://api.star-citizen.wiki/api/items/207f65ca-e81d-4069-818e-3d2d57e37272
- https://api.star-citizen.wiki/api/items/0b08ffbf-7c5a-410b-911c-98715c92e978
- https://api.star-citizen.wiki/api/items/d2f24bb0-9825-455d-852a-302a3ee290a4
- https://api.star-citizen.wiki/api/items/ebe4fcc2-e0ff-4662-9c85-ac85f7dd78f1
- https://api.star-citizen.wiki/api/items/18b795c5-25f1-444a-86c0-b5edd7cf0118
- https://api.star-citizen.wiki/api/items/4ec3037b-4b6f-4837-b00d-cd9b4836a82a
- https://api.star-citizen.wiki/api/items/335e94ef-d8e9-4ac3-8966-655881c1ea14
- https://api.star-citizen.wiki/api/items/a5107834-61e1-481d-b836-7ed6c08b14d5
- https://api.star-citizen.wiki/api/items/41ac4e69-f4f8-4efe-b499-0257bdf1aba3
- https://api.star-citizen.wiki/api/items/b5543ea6-b332-47d7-a02c-5f25620d2fd1
- https://api.star-citizen.wiki/api/items/d0b4ce5b-c8ba-4a9f-90b1-c9567a6c90e9
- https://api.star-citizen.wiki/api/items/26481148-0cf9-434c-817c-06695b8c86c5
- https://api.star-citizen.wiki/api/items/a3b2f085-073d-49b0-8c21-3c80a3bd4e49
- https://api.star-citizen.wiki/api/items/c1c90b07-15f3-40c7-aafd-bf99c25654dd
- https://api.star-citizen.wiki/api/items/7cb7dafc-d9c8-40de-8dc6-8b85bc0c48a5
- https://api.star-citizen.wiki/api/items/95536ade-bd7c-406b-b56d-f301aceca36a
- https://api.star-citizen.wiki/api/items/13eee13d-a9a1-4aad-9a33-ffc87f4912c6
- https://api.star-citizen.wiki/api/items/3d0717f3-8ac3-4a9a-9956-019e143def82
- https://api.star-citizen.wiki/api/items/6748fb26-796a-4b6d-8675-cc1c9d239ff1
- https://api.star-citizen.wiki/api/items/b25680c6-8b7c-4145-b212-c53449bc4305
- https://api.star-citizen.wiki/api/items/2a30fbef-8479-4f19-9c0b-34b37adae545
- https://api.star-citizen.wiki/api/items/b837397c-47b6-45e7-b409-db290a068b47
- https://api.star-citizen.wiki/api/items/34f8a503-41bc-4245-baea-e824c8a39411
- https://api.star-citizen.wiki/api/items/8c16ee3d-78fb-4fef-a369-b3d42952ec33
- https://api.star-citizen.wiki/api/items/b59528b8-7208-4ae2-a2f0-f38578cc0fad
- https://api.star-citizen.wiki/api/items/b394dd06-9f30-4cb2-9d86-0eae6db76833
- https://api.star-citizen.wiki/api/items/940266c3-89e2-45d4-952b-fc1c2bd3b64c
- https://api.star-citizen.wiki/api/items/2d9a37a3-e49e-4eab-8c37-bfd97b68880b
- https://api.star-citizen.wiki/api/items/ecc91543-dd12-458c-bf28-b893cba1e316
- https://api.star-citizen.wiki/api/items/adb59839-382c-43cf-aca5-fa9e8c4d1a6a
- https://api.star-citizen.wiki/api/items/caa39cbb-e87b-4570-b655-8b6540512c8c
- https://api.star-citizen.wiki/api/items/b494b197-5525-4317-9ff7-969b246ae94e
- https://api.star-citizen.wiki/api/items/17b1ef89-5c50-4d70-b351-c7eb1c1c4671
- https://api.star-citizen.wiki/api/items/51b09c51-df17-48e0-ba5e-8c36395ed4ad
- https://api.star-citizen.wiki/api/items/837cccba-2136-472e-ae98-0aad430ca01b
- https://api.star-citizen.wiki/api/items/b13b850c-f4f0-45bd-801d-a4d064a74cce
- https://api.star-citizen.wiki/api/items/c8797bce-6220-4d1e-bc6d-23da4a366a6d
- https://api.star-citizen.wiki/api/items/14cbe476-4050-4af5-8635-178519722f4b
- https://api.star-citizen.wiki/api/items/59346c37-671d-4aae-9eff-d38e13caa9c0
- https://api.star-citizen.wiki/api/items/272328f0-326f-4461-ad55-cb6ddb490795
- https://api.star-citizen.wiki/api/items/4896e3cd-b8ba-4ded-af9b-4c581e704a3c
- https://api.star-citizen.wiki/api/items/5453a817-dfd4-4143-aa11-840ca428540c
- https://api.star-citizen.wiki/api/items/bd13235d-1261-4b71-b32f-aed1a8beb526
- https://api.star-citizen.wiki/api/items/ecac1df2-4f6f-49df-9cce-f188d118a789
- https://api.star-citizen.wiki/api/items/694939f5-64b1-43d4-88a9-2a7248daaef5
- https://api.star-citizen.wiki/api/items/594e5e7a-1016-43f2-9999-4287bb7890ca
- https://api.star-citizen.wiki/api/items/7bf0536b-e299-4043-a47b-bfe83e6ecdb8
- https://api.star-citizen.wiki/api/items/347b5c12-71a3-4ee8-ab10-67e1cd617097
- https://api.star-citizen.wiki/api/items/b4ae27f2-8ff2-4ef7-b84f-31b514988bb1
- https://api.star-citizen.wiki/api/items/00003571-11df-4b9d-a30d-1392d2a4bde7
- https://api.star-citizen.wiki/api/items/aeb94360-f1cc-425f-bc06-76340b5c0cb7
- https://api.star-citizen.wiki/api/items/4317f2fc-4044-454e-8400-25c2e3c65136
- https://api.star-citizen.wiki/api/items/d358cf84-9c78-4929-a2ad-b9caade81962
- https://api.star-citizen.wiki/api/items/dee6efca-71ef-438c-b762-624f9ce649f3
- https://api.star-citizen.wiki/api/items/918ad61c-ea99-4040-b05a-a42cd5436aed
- https://api.star-citizen.wiki/api/items/bcdd8022-c2f4-49d0-8528-e4a3a7a01a03
- https://api.star-citizen.wiki/api/items/7fedca61-dfeb-4ecb-b421-e7c3ba55a584
- https://api.star-citizen.wiki/api/items/8197c45b-eaf4-4836-a8f0-837d1875cd9c
- https://api.star-citizen.wiki/api/items/acd1c5dc-ecc1-417d-9a4d-02c6e93998cd
- https://api.star-citizen.wiki/api/items/e8f087cf-12fc-4149-b8c2-59152716f363
- https://api.star-citizen.wiki/api/items/7646e90a-4f99-4209-883e-07d429529115
- https://api.star-citizen.wiki/api/items/5700db93-a193-4e4e-b3e8-e1500b60168f
- https://api.star-citizen.wiki/api/items/7a642c58-090a-4480-af2b-25fda4201630
- https://api.star-citizen.wiki/api/items/ea49d194-0c0b-43e1-82fb-d72f35c1af05
- https://api.star-citizen.wiki/api/items/91cbab68-afd2-456d-8df7-058d534b1668
- https://api.star-citizen.wiki/api/items/a02c039e-1efe-4a75-891f-dc08b6b60d26
- https://api.star-citizen.wiki/api/items/b9663f1c-c365-4c87-9086-1fdf626ede64
- https://api.star-citizen.wiki/api/items/40e08fff-cc9f-4cc6-9194-6f70a7f261d6
- https://api.star-citizen.wiki/api/items/baa24284-b180-4dcb-a08f-2b279e4e7109
- https://api.star-citizen.wiki/api/items/09030367-c1fd-48cd-a981-7115a4d43371
- https://api.star-citizen.wiki/api/items/6bea95f5-2898-434c-bffe-4b2b332d6440
- https://api.star-citizen.wiki/api/items/f8d3a1e1-0d75-45bb-a453-898a7cf83382
- https://api.star-citizen.wiki/api/items/fcf0cee0-94f6-4bfb-aed3-e255d7f1e12c
- https://api.star-citizen.wiki/api/items/01e5071c-2fac-4769-9fae-e1a7fbcaf34b
- https://api.star-citizen.wiki/api/items/4455fed7-094e-4844-a97e-f2f890e2369f
- https://api.star-citizen.wiki/api/items/6c32193d-15e0-486f-a833-1db0b1f93d05
- https://api.star-citizen.wiki/api/items/f3d9f6bf-4042-49b1-b09b-223b1ba289cd
- https://api.star-citizen.wiki/api/items/870cb1e6-befe-49c6-8b78-2e68e8e30330
- https://api.star-citizen.wiki/api/items/5d54b47d-6d47-4e09-b2b5-575c856ba7a1
- https://api.star-citizen.wiki/api/items/e1f82d07-0a5c-4668-8fc6-5a087eed1d1b
- https://api.star-citizen.wiki/api/items/0186d9c6-2bbd-440e-b389-31a3a96da303
- https://api.star-citizen.wiki/api/items/ddd8d826-755f-4033-a58c-823f7047e18c
- https://api.star-citizen.wiki/api/items/166cdea0-d77f-403d-afbf-3f6306cadeda
- https://api.star-citizen.wiki/api/items/688aab9c-bc62-4774-be7d-065dee7e2187
- https://api.star-citizen.wiki/api/items/5db93be6-1fa1-450f-b539-fedf8690cab2
- https://api.star-citizen.wiki/api/items/9a5c71d4-12c0-4994-a41f-98b6e6018151
- https://api.star-citizen.wiki/api/items/122c86dc-9d78-445d-9ebe-d2194ab94d4c
- https://api.star-citizen.wiki/api/items/796642bf-92fa-48ee-92aa-bf9ba38487a6
- https://api.star-citizen.wiki/api/items/fda65886-0ccb-4a80-a5ee-528b186d4584
- https://api.star-citizen.wiki/api/items/e2599be8-160c-4d20-87d0-3c080109842d
- https://api.star-citizen.wiki/api/items/27a34dd7-30aa-4eca-ae37-1f87e343e238
- https://api.star-citizen.wiki/api/items/16ba45f1-bd70-4b58-96d6-0ef822f59803
- https://api.star-citizen.wiki/api/items/b5cbef86-f37f-4e05-8aff-e0f61afe166e
- https://api.star-citizen.wiki/api/items/419bff00-12eb-43f7-b284-f8850519b9c6
- https://api.star-citizen.wiki/api/items/c18b2900-2259-4a94-bc76-8566ee183740
- https://api.star-citizen.wiki/api/items/69bd0212-7362-49a4-b476-54af2be9e8b7
- https://api.star-citizen.wiki/api/items/3c51d1b5-5904-466f-86e6-54acaacbe247
- https://api.star-citizen.wiki/api/items/bb88d816-eee1-4eef-a5a4-cec3bdaff005
- https://api.star-citizen.wiki/api/items/a031cc14-e14d-4ba8-8cdc-48990c4fdc86
- https://api.star-citizen.wiki/api/items/3260e018-64ca-42e9-b85a-8b80d24d5375
- https://api.star-citizen.wiki/api/items/b0ccd135-4424-417c-95e4-594a88d9b72f
- https://api.star-citizen.wiki/api/items/c00521d8-7551-4c26-889f-30bf09d9a821
- https://api.star-citizen.wiki/api/items/a39d0aa5-f1af-49fb-aad0-0c1cde0f133f
- https://api.star-citizen.wiki/api/items/5b0d1308-b34a-4b55-94f5-7270e03ca82a
- https://api.star-citizen.wiki/api/items/61d5e767-fcee-4e70-ae9e-7671b6692404
- https://api.star-citizen.wiki/api/items/17417d27-af6d-40fc-af97-ab6db7ab313c
- https://api.star-citizen.wiki/api/items/ab2179ae-90c8-46f8-9a94-af0f2b0ca71f
- https://api.star-citizen.wiki/api/items/aaec78bb-8928-4191-8b3e-ba2d880e6829
- https://api.star-citizen.wiki/api/items/c7a58dc6-24c5-4ee8-b181-39e6557f1ac7
- https://api.star-citizen.wiki/api/items/e44d42ad-c74f-4ed4-b33f-1c9297d16552
- https://api.star-citizen.wiki/api/items/29dc5b05-e164-429c-a162-71299198bab9
- https://api.star-citizen.wiki/api/items/e0dfadbd-97e7-450a-8a5e-ec3df3452962
- https://api.star-citizen.wiki/api/items/dbd219ff-eca1-4e6b-8426-783f119e102a
- https://api.star-citizen.wiki/api/items/a3b6896c-2b5d-44bb-81a7-74c2719c3d58
- https://api.star-citizen.wiki/api/items/09bbb9b4-d087-4204-a165-b02ffbec04c4
- https://api.star-citizen.wiki/api/items/cd8a9943-e305-4255-a556-01e35d9118ed
- https://api.star-citizen.wiki/api/items/fe3cc86e-a274-49a6-aa12-bd055cd94513
- https://api.star-citizen.wiki/api/items/01025f1e-84fc-4c60-834c-6144e78dd77f
- https://api.star-citizen.wiki/api/items/39896fbd-e0a5-4ebb-910c-1f510efb92d7
- https://api.star-citizen.wiki/api/items/11c01463-dd1b-4fef-89a9-9f4b545b9d6f
- https://api.star-citizen.wiki/api/items/02660f1b-9ffe-4c53-a737-715f634803ac
- https://api.star-citizen.wiki/api/items/71cfa6e0-1cbf-416e-b8ea-cdcd4b6e6733
- https://api.star-citizen.wiki/api/items/dfc9bc0a-8041-4d6a-b606-7d6da845b9ef
- https://api.star-citizen.wiki/api/items/17c25f97-8aed-4abb-b244-c973bc5d212e
- https://api.star-citizen.wiki/api/items/1461ba9c-95b4-42db-930e-e62dd7630798
- https://api.star-citizen.wiki/api/items/ea9b49a0-24b8-49be-a770-49b0d9993d8a
- https://api.star-citizen.wiki/api/items/2af8ae93-baf0-4a14-8685-21d734998dc0
- https://api.star-citizen.wiki/api/items/30e5fb7f-35c1-47af-92b9-0ebca8200464
- https://api.star-citizen.wiki/api/items/f2b386d2-2a92-43ba-b9ca-e12f26f466aa
- https://api.star-citizen.wiki/api/items/14555c7c-c84b-4cb7-80d9-a228cea01d01
- https://api.star-citizen.wiki/api/items/c765234f-2f12-4027-81cb-32601ac81b7d
- https://api.star-citizen.wiki/api/items/9efcaa00-869f-4235-9105-25b67afe6e83
- https://api.star-citizen.wiki/api/items/697ad29e-6757-40e3-ac3a-9b6a5d41175c
- https://api.star-citizen.wiki/api/items/dd27bdcf-4044-495b-a247-c6236c8d7ce8
- https://api.star-citizen.wiki/api/items/69c7156b-cd94-452c-8060-e825a3bd0717
- https://api.star-citizen.wiki/api/items/645d99e9-ae6b-4b09-aad8-61f9ccfc5f98
- https://api.star-citizen.wiki/api/items/6e672999-3441-462c-a95d-ef19ca2b7266
- https://api.star-citizen.wiki/api/items/bf1cc00a-6dd0-473e-aaa4-5f1455a6d297
- https://api.star-citizen.wiki/api/items/91df54bb-61ef-4fa0-8b7f-56e2c08420d1
- https://api.star-citizen.wiki/api/items/a86da959-eadd-4841-a31b-798a9ab21381
- https://api.star-citizen.wiki/api/items/1ffbc5d1-2993-43ee-942f-e57222084a38
- https://api.star-citizen.wiki/api/items/44224c1b-81d3-4346-ad8a-bdf81e73e0db
- https://api.star-citizen.wiki/api/items/044bbc7f-1baa-4034-a0d7-cb99ccf74738
- https://api.star-citizen.wiki/api/items/c283366e-e76a-4127-90d1-ee80cd296c37
- https://api.star-citizen.wiki/api/items/106ce33f-0838-448e-b455-66806866c62c
- https://api.star-citizen.wiki/api/items/ae0f5d20-d740-449c-920b-84ff32340321
- https://api.star-citizen.wiki/api/items/48e2b865-a936-4346-a621-582568ebd008
- https://api.star-citizen.wiki/api/items/e538a97f-d9cd-4997-9f43-11450e364af1
- https://api.star-citizen.wiki/api/items/339bd641-8dfb-4bc1-b273-5ffc5f702fbb
- https://api.star-citizen.wiki/api/items/925ec9df-cd0d-4c40-a5ad-6d22bdbfdeaa
- https://api.star-citizen.wiki/api/items/d9870a05-1a66-4a9a-bec6-30eb67e3a3ce
- https://api.star-citizen.wiki/api/items/86bfeaef-e0e2-4373-9dca-47e193c0b203
- https://api.star-citizen.wiki/api/items/a113eb5a-2759-4a55-ac48-7170c7d17f50
- https://api.star-citizen.wiki/api/items?filter[type]=WeaponGun&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=Missile&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=Shield&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=PowerPlant&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=Cooler&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=QuantumDrive&page[size]=200&page[number]=1

193 requests, spaced at least 2.5 seconds apart. Non-commercial use; "Please credit api.star-citizen.wiki in public projects."
