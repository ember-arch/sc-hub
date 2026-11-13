# fixtures/bootstrap

Some game data via the Star Citizen Wiki API (api.star-citizen.wiki).

The catalog until Phase 1 (ADR-004, ADR-022): 253 ships and vehicles of LIVE 4.10.3-LIVE.13165946, their stock loadouts, the components those loadouts reference and the catalogue of ship guns, missiles and torpedoes, shields, power plants, coolers and quantum drives the loadout editor offers (ADR-016), fetched from the Star Citizen Wiki API by `scripts/bootstrap-fixtures` on 2026-11-13T20:08:10.654Z. Phase 1 replaces this pack with records extracted from the game files; until then every page that shows this data carries the credit line above (`docs/legal/attribution.md`).

**Do not edit these files by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/index.ts
```

**For disposable databases only.** Seeding this pack into the database that will serve the site would freeze its placeholder slugs and first_seen_version values (slugs never change after first publish), and re-seeding a newer bootstrap version into the same database fails on the one-current-version-per-channel rule until the database is wiped (deleting packages/db/.pglite is enough locally). Phase 1 extraction replaces this pack; from then on the import job, not this seed, owns the channel pointer.

## Contents

Game version `4.10.3-LIVE.13165946`, channel LIVE, as reported by the API's default version at fetch time. `manifest.json` lists every file with its sha256, byte size and row count; `packages/schema` (`parsePack`) validates the whole pack before anything reads it.

| Ship | class_name | Manufacturer | Size | Status |
| --- | --- | --- | --- | --- |
| Avenger Stalker | `AEGS_Avenger_Stalker` | AEGS | small | flight_ready |
| Avenger Stalker | `AEGS_Avenger_Stalker_Display` | AEGS | small | flight_ready |
| Avenger Titan | `AEGS_Avenger_Titan` | AEGS | small | flight_ready |
| Avenger Titan Renegade | `AEGS_Avenger_Titan_Renegade` | AEGS | small | flight_ready |
| Avenger Warlock | `AEGS_Avenger_Warlock` | AEGS | small | flight_ready |
| Eclipse | `AEGS_Eclipse` | AEGS | small | flight_ready |
| Eclipse | `AEGS_Eclipse_BIS2950` | AEGS | small | flight_ready |
| Gladius | `AEGS_Gladius` | AEGS | small | flight_ready |
| Gladius Pirate | `AEGS_Gladius_PIR` | AEGS | small | flight_ready |
| Gladius Valiant | `AEGS_Gladius_Valiant` | AEGS | small | flight_ready |
| Hammerhead | `AEGS_Hammerhead_GS` | AEGS | large | flight_ready |
| Idris-M | `AEGS_Idris_M` | AEGS | capital | flight_ready |
| Idris-P | `AEGS_Idris_P` | AEGS | capital | flight_ready |
| Idris-P | `AEGS_Idris_P_FW_25` | AEGS | capital | flight_ready |
| Idris-P | `AEGS_Idris_P_TSG` | AEGS | capital | flight_ready |
| Javelin | `AEGS_Javelin` | AEGS | capital | concept |
| Reclaimer | `AEGS_Reclaimer` | AEGS | capital | flight_ready |
| Reclaimer 2949 Best In Show Edition | `AEGS_Reclaimer_Showdown` | AEGS | large | flight_ready |
| Redeemer | `AEGS_Redeemer` | AEGS | large | flight_ready |
| Retaliator | `AEGS_Retaliator` | AEGS | large | flight_ready |
| Sabre | `AEGS_Sabre` | AEGS | small | flight_ready |
| Sabre Comet | `AEGS_Sabre_Comet` | AEGS | small | flight_ready |
| Sabre Firebird | `AEGS_Sabre_Firebird` | AEGS | small | flight_ready |
| Sabre Peregrine | `AEGS_Sabre_Peregrine` | AEGS | small | flight_ready |
| Sabre Raven | `AEGS_Sabre_Raven` | AEGS | small | flight_ready |
| Sabre Raven EX | `AEGS_Sabre_Raven_EX` | AEGS | small | flight_ready |
| Tiburon | `AEGS_Tiburon` | AEGS | large | flight_ready |
| Vanguard Warden | `AEGS_Vanguard` | AEGS | medium | flight_ready |
| Vanguard Harbinger | `AEGS_Vanguard_Harbinger` | AEGS | medium | flight_ready |
| Vanguard Hoplite | `AEGS_Vanguard_Hoplite` | AEGS | medium | flight_ready |
| Vanguard Sentinel | `AEGS_Vanguard_Sentinel` | AEGS | medium | flight_ready |
| Arrow | `ANVL_Arrow` | ANVL | small | flight_ready |
| Asgard | `ANVL_Asgard` | ANVL | large | flight_ready |
| HM6 Ballista | `ANVL_Ballista` | ANVL |  | flight_ready |
| HM6 Ballista Dunestalker | `ANVL_Ballista_Dunestalker` | ANVL | vehicle | flight_ready |
| HM6 Ballista Snowblind | `ANVL_Ballista_Snowblind` | ANVL | vehicle | flight_ready |
| C8 Pisces | `ANVL_C8_Pisces` | ANVL | small | flight_ready |
| C8R Pisces Rescue | `ANVL_C8R_Pisces` | ANVL | small | flight_ready |
| C8X Pisces Expedition | `ANVL_C8X_Pisces_Expedition` | ANVL | small | flight_ready |
| Carrack | `ANVL_Carrack` | ANVL | large | flight_ready |
| Carrack | `ANVL_Carrack_BIS2950` | ANVL | large | flight_ready |
| Carrack Expedition | `ANVL_Carrack_Expedition` | ANVL | large | flight_ready |
| HM6 Centurion | `ANVL_Centurion` | ANVL |  | flight_ready |
| Gladiator | `ANVL_Gladiator` | ANVL | small | flight_ready |
| Hawk | `ANVL_Hawk` | ANVL | small | flight_ready |
| F7A Hornet Mk I | `ANVL_Hornet_F7A_Mk1` | ANVL | small | flight_ready |
| F7A Hornet Mk II | `ANVL_Hornet_F7A_Mk2` | ANVL | small | flight_ready |
| F7C Hornet Mk I | `ANVL_Hornet_F7C` | ANVL | small | flight_ready |
| F7C Hornet Mk II | `ANVL_Hornet_F7C_Mk2` | ANVL | small | flight_ready |
| F7C Hornet Wildfire Mk I | `ANVL_Hornet_F7C_Wildfire` | ANVL | small | flight_ready |
| F7C-M Super Hornet Mk I | `ANVL_Hornet_F7CM` | ANVL | small | flight_ready |
| F7C-M Hornet Heartseeker Mk I | `ANVL_Hornet_F7CM_Heartseeker` | ANVL | small | flight_ready |
| F7C-M Super Hornet Mk II | `ANVL_Hornet_F7CM_Mk2` | ANVL | small | flight_ready |
| F7C-M Hornet Heartseeker Mk II | `ANVL_Hornet_F7CM_Mk2_Heartseeker` | ANVL | small | flight_ready |
| F7C-R Hornet Tracker Mk I | `ANVL_Hornet_F7CR` | ANVL | small | flight_ready |
| F7C-R Hornet Tracker Mk II | `ANVL_Hornet_F7CR_Mk2` | ANVL | small | flight_ready |
| F7C-S Hornet Ghost Mk I | `ANVL_Hornet_F7CS` | ANVL | small | flight_ready |
| F7C-S Hornet Ghost Mk II | `ANVL_Hornet_F7CS_Mk2` | ANVL | small | flight_ready |
| Hurricane | `ANVL_Hurricane` | ANVL | small | flight_ready |
| Liberator | `ANVL_Liberator` | ANVL | large | concept |
| F8A Lightning | `ANVL_Lightning_F8` | ANVL | small | flight_ready |
| F8C Lightning | `ANVL_Lightning_F8C` | ANVL | small | flight_ready |
| F8C Lightning Executive Edition | `ANVL_Lightning_F8C_Exec` | ANVL | small | flight_ready |
| F8C Lightning | `ANVL_Lightning_F8C_Plat` | ANVL | small | flight_ready |
| Paladin | `ANVL_Paladin` | ANVL | medium | flight_ready |
| HM6 Spartan | `ANVL_Spartan` | ANVL |  | flight_ready |
| Terrapin | `ANVL_Terrapin` | ANVL | small | flight_ready |
| Terrapin Medic | `ANVL_Terrapin_Medic` | ANVL | small | flight_ready |
| Valkyrie | `ANVL_Valkyrie` | ANVL | large | flight_ready |
| Valkyrie | `ANVL_Valkyrie_BIS2950` | ANVL | large | flight_ready |
| ATLS | `ARGO_ATLS` | ARGO | medium | flight_ready |
| ATLS GEO | `ARGO_ATLS_GEO` | ARGO | medium | flight_ready |
| ATLS Snowland Color | `ARGO_ATLS_GEO_Collector_Grad01` | ARGO | medium | flight_ready |
| ATLS Cool Metal Color | `ARGO_ATLS_GEO_Collector_Grad03` | ARGO | medium | flight_ready |
| Argo ATLS IKTI | `ARGO_ATLS_IKTI` | BANU | medium | flight_ready |
| CSV-SM | `ARGO_CSV_Cargo` | ARGO | medium | flight_ready |
| MOLE | `ARGO_MOLE` | ARGO | medium | flight_ready |
| MOTH | `ARGO_MOTH` | ARGO | medium | flight_ready |
| MPUV Cargo | `ARGO_MPUV` | ARGO | small | flight_ready |
| MPUV Tractor | `ARGO_MPUV_1T` | ARGO | small | flight_ready |
| MPUV Personnel | `ARGO_MPUV_Transport` | ARGO | small | flight_ready |
| RAFT | `ARGO_RAFT` | ARGO | medium | flight_ready |
| SRV | `ARGO_SRV` | ARGO | medium | flight_ready |
| Defender | `BANU_Defender` | BANU | small | flight_ready |
| HoverQuad | `CNOU_HoverQuad` | CNOU | small | flight_ready |
| Mustang Alpha | `CNOU_Mustang_Alpha` | CNOU | small | flight_ready |
| Mustang CitizenCon 2948 Edition | `CNOU_Mustang_Alpha_CitizenCon2018` | CNOU | small | flight_ready |
| Mustang Beta | `CNOU_Mustang_Beta` | CNOU | small | flight_ready |
| Mustang Delta | `CNOU_Mustang_Delta` | CNOU | small | flight_ready |
| Mustang Gamma | `CNOU_Mustang_Gamma` | CNOU | small | flight_ready |
| Mustang Omega | `CNOU_Mustang_Omega` | CNOU | small | flight_ready |
| Nomad | `CNOU_Nomad` | CNOU | small | flight_ready |
| Intrepid | `CRUS_Intrepid` | CRUS | small | flight_ready |
| A1 Spirit | `CRUS_Spirit_A1` | CRUS | medium | flight_ready |
| C1 Spirit | `CRUS_Spirit_C1` | CRUS | medium | flight_ready |
| Mercury Star Runner | `CRUS_Star_Runner` | CRUS | large | flight_ready |
| Ares Star Fighter Inferno | `CRUS_Starfighter_Inferno` | CRUS | medium | flight_ready |
| Ares Star Fighter Ion | `CRUS_Starfighter_Ion` | CRUS | medium | flight_ready |
| A2 Hercules Starlifter | `CRUS_Starlifter_A2` | CRUS | large | flight_ready |
| C2 Hercules Starlifter | `CRUS_Starlifter_C2` | CRUS | large | flight_ready |
| M2 Hercules Starlifter | `CRUS_Starlifter_M2` | CRUS | large | flight_ready |
| Buccaneer | `DRAK_Buccaneer` | DRAK | small | flight_ready |
| Caterpillar | `DRAK_Caterpillar` | DRAK | large | flight_ready |
| Caterpillar | `DRAK_Caterpillar_Boarded_ShatteredBlade` | DRAK | large | flight_ready |
| Caterpillar Pirate | `DRAK_Caterpillar_Pirate` | DRAK | large | flight_ready |
| Clipper | `DRAK_Clipper` | DRAK | small | flight_ready |
| Corsair | `DRAK_Corsair` | DRAK | large | flight_ready |
| Cutlass Black | `DRAK_Cutlass_Black` | DRAK | medium | flight_ready |
| Cutlass Black | `DRAK_Cutlass_Black_BIS2950` | DRAK | medium | flight_ready |
| Cutlass Blue | `DRAK_Cutlass_Blue` | DRAK | medium | flight_ready |
| Cutlass Blue | `DRAK_Cutlass_Blue_BIS2950` | DRAK | medium | flight_ready |
| Cutlass Red | `DRAK_Cutlass_Red` | DRAK | medium | flight_ready |
| Cutlass Red | `DRAK_Cutlass_Red_BIS2950` | DRAK | medium | flight_ready |
| Cutlass Steel | `DRAK_Cutlass_Steel` | DRAK | medium | flight_ready |
| Cutter | `DRAK_Cutter` | DRAK | small | flight_ready |
| Cutter Rambler | `DRAK_Cutter_Rambler` | DRAK | small | flight_ready |
| Cutter Scout | `DRAK_Cutter_Scout` | DRAK | small | flight_ready |
| Dragonfly | `DRAK_Dragonfly` | DRAK | small | flight_ready |
| Dragonfly Yellowjacket | `DRAK_Dragonfly_Yellow` | DRAK | small | flight_ready |
| Golem | `DRAK_Golem` | DRAK | small | flight_ready |
| Golem OX | `DRAK_Golem_OX` | DRAK | small | flight_ready |
| Herald | `DRAK_Herald` | DRAK | small | flight_ready |
| Ironclad | `DRAK_Ironclad` | DRAK | large | flight_ready |
| Ironclad Assault | `DRAK_Ironclad_Assault` | DRAK | large | flight_ready |
| Mule | `DRAK_Mule` | DRAK | medium | flight_ready |
| Pitbull | `DRAK_Pitbull` | DRAK | small | flight_ready |
| Vulture | `DRAK_Vulture` | DRAK | small | flight_ready |
| Prowler | `ESPR_Prowler` | ESPR | medium | flight_ready |
| Prowler Utility | `ESPR_Prowler_Utility` | ESPR | medium | flight_ready |
| Talon | `ESPR_Talon` | ESPR | small | flight_ready |
| Talon Shrike | `ESPR_Talon_Shrike` | ESPR | small | flight_ready |
| Railen | `GAMA_Railen` | GAMA | large | flight_ready |
| Syulen | `GAMA_Syulen` | GAMA | medium | flight_ready |
| Tyilui | `GAMA_Tyilui` | GAMA | large | flight_ready |
| Basher | `GLSN_Basher` | GLSN | small | flight_ready |
| Shiv | `GLSN_Shiv` | GLSN | medium | flight_ready |
| MDC | `GRIN_MDC` | GRIN | vehicle | flight_ready |
| MTC | `GRIN_MTC` | GRIN | medium | flight_ready |
| PTV | `GRIN_PTV` | GRIN | medium | flight_ready |
| ROC | `GRIN_ROC` | GRIN | medium | flight_ready |
| ROC-DS | `GRIN_ROC_DS` | GRIN | medium | flight_ready |
| STV | `GRIN_STV` | GRIN | medium | flight_ready |
| UTV | `GRIN_UTV` | GRIN | medium | flight_ready |
| L-21 Wolf | `KRIG_L21_Wolf` | KRIG | small | flight_ready |
| L-22 Alpha Wolf | `KRIG_L22_AlphaWolf` | KRIG | small | flight_ready |
| P-52 Merlin | `KRIG_P52_Merlin` | KRIG | small | flight_ready |
| P-72 Archimedes | `KRIG_P72_Archimedes` | KRIG | small | flight_ready |
| P-72 Archimedes Emerald | `KRIG_P72_Archimedes_Emerald` | KRIG | small | flight_ready |
| S-65 Stingray | `KRIG_S65_Stingray` | KRIG | small | flight_ready |
| S-65 Stingray | `KRIG_S65_Stingray_BALLISTIC` | KRIG | small | flight_ready |
| MISC Fortune | `MISC_Fortune` | MISC | small | flight_ready |
| MISC Freelancer | `MISC_Freelancer` | MISC | medium | flight_ready |
| MISC Freelancer DUR | `MISC_Freelancer_DUR` | MISC | medium | flight_ready |
| MISC Freelancer MAX | `MISC_Freelancer_MAX` | MISC | medium | flight_ready |
| MISC Freelancer MIS | `MISC_Freelancer_MIS` | MISC | medium | flight_ready |
| Fury | `MISC_Fury` | MRAI | snub | flight_ready |
| Fury LX | `MISC_Fury_LX` | MRAI | snub | flight_ready |
| Fury MX | `MISC_Fury_Miru` | MRAI | snub | flight_ready |
| MISC Hull A | `MISC_Hull_A` | MISC | small | flight_ready |
| MISC Hull B | `MISC_Hull_B` | MISC | large | flight_ready |
| MISC Hull C | `MISC_Hull_C` | MISC | large | flight_ready |
| MISC Prospector | `MISC_Prospector` | MISC | small | flight_ready |
| Razor | `MISC_Razor` | MRAI | small | flight_ready |
| Razor EX | `MISC_Razor_EX` | MRAI | small | flight_ready |
| Razor LX | `MISC_Razor_LX` | MRAI | small | flight_ready |
| MISC Reliant Kore | `MISC_Reliant` | MISC | medium | flight_ready |
| MISC Reliant Mako | `MISC_Reliant_Mako` | MISC | medium | flight_ready |
| MISC Reliant Sen | `MISC_Reliant_Sen` | MISC | medium | flight_ready |
| MISC Reliant Tana | `MISC_Reliant_Tana` | MISC | medium | flight_ready |
| MISC Starfarer | `MISC_Starfarer` | MISC | large | flight_ready |
| MISC Starfarer Gemini | `MISC_Starfarer_Gemini` | MISC | large | flight_ready |
| MISC Starlancer MAX | `MISC_Starlancer_Max` | MISC | medium | flight_ready |
| MISC Starlancer TAC | `MISC_Starlancer_TAC` | MISC | large | flight_ready |
| MISC Starlite | `MISC_Starlite` | MISC | small | flight_ready |
| Guardian | `MRAI_Guardian` | MRAI | small | flight_ready |
| Guardian MX | `MRAI_Guardian_MX` | MRAI | small | flight_ready |
| Guardian QI | `MRAI_Guardian_QI` | MRAI | small | flight_ready |
| Pulse | `MRAI_Pulse` | MRAI | small | flight_ready |
| Pulse LX | `MRAI_Pulse_LX` | MRAI | small | flight_ready |
| 100i | `ORIG_100i` | ORIG | small | flight_ready |
| 125a | `ORIG_125a` | ORIG | small | flight_ready |
| 135c | `ORIG_135c` | ORIG | small | flight_ready |
| 300i | `ORIG_300i` | ORIG | small | flight_ready |
| 315p | `ORIG_315p` | ORIG | small | flight_ready |
| 325a | `ORIG_325a` | ORIG | small | flight_ready |
| 350r | `ORIG_350r` | ORIG | small | flight_ready |
| 400i | `ORIG_400i` | ORIG | large | flight_ready |
| 600i | `ORIG_600i` | ORIG | large | flight_ready |
| 600i 2951 BIS | `ORIG_600i_BIS2951` | ORIG | large | flight_ready |
| 600i Touring | `ORIG_600i_Touring` | ORIG | large | flight_ready |
| 85X Limited | `ORIG_85X` | ORIG | small | flight_ready |
| 890 Jump | `ORIG_890Jump` | ORIG | capital | flight_ready |
| M50 Interceptor | `ORIG_m50` | ORIG | small | flight_ready |
| M80 | `ORIG_m80` | ORIG | small | flight_ready |
| X1 | `ORIG_X1` | ORIG | small | flight_ready |
| X1 Force | `ORIG_X1_Force` | ORIG | small | flight_ready |
| X1 Velocity | `ORIG_X1_Velocity` | ORIG | small | flight_ready |
| Apollo Medivac | `RSI_Apollo_Medivac` | RSI | large | flight_ready |
| Apollo Triage | `RSI_Apollo_Triage` | RSI | large | flight_ready |
| Aurora Mk I CL | `RSI_Aurora_GS_CL` | RSI | small | flight_ready |
| Aurora Mk I ES | `RSI_Aurora_GS_ES` | RSI | small | flight_ready |
| Aurora Mk I LN | `RSI_Aurora_GS_LN` | RSI | small | flight_ready |
| Aurora Mk I LX | `RSI_Aurora_GS_LX` | RSI | small | flight_ready |
| Aurora Mk I MR | `RSI_Aurora_GS_MR` | RSI | small | flight_ready |
| Aurora Mk I SE | `RSI_Aurora_GS_SE` | RSI | small | flight_ready |
| Aurora Mk II | `RSI_Aurora_Mk2` | RSI | small | flight_ready |
| Constellation Mk IV Andromeda | `RSI_Constellation_Andromeda_GS` | RSI | large | flight_ready |
| Constellation Mk IV Andromeda | `RSI_Constellation_Andromeda_GS_Display` | RSI | large | flight_ready |
| Constellation Mk IV Aquila | `RSI_Constellation_Aquila_GS` | RSI | large | flight_ready |
| Constellation Mk V Centaurus | `RSI_Constellation_Mk5_Centaurus` | RSI | large | flight_ready |
| Constellation Mk V Centaurus | `RSI_Constellation_Mk5_Centaurus_Display` | RSI | large | flight_ready |
| Constellation Mk IV Phoenix | `RSI_Constellation_Phoenix` | RSI | large | flight_ready |
| Constellation Mk IV Phoenix | `RSI_Constellation_Phoenix_GS` | RSI | large | flight_ready |
| Constellation Mk IV Taurus | `RSI_Constellation_Taurus` | RSI | large | flight_ready |
| Constellation Mk IV Taurus | `RSI_Constellation_Taurus_GS` | RSI | large | flight_ready |
| Galaxy | `RSI_Galaxy` | RSI | large | concept |
| Galaxy | `RSI_Galaxy_TEMP_Cargo` | RSI | large | concept |
| Galaxy | `RSI_Galaxy_TEMP_Medical` | RSI | large | concept |
| Hermes | `RSI_Hermes` | RSI | large | flight_ready |
| Lynx | `RSI_Lynx` | RSI |  | flight_ready |
| Mantis | `RSI_Mantis` | RSI | small | flight_ready |
| Meteor | `RSI_Meteor` | RSI | small | flight_ready |
| Perseus | `RSI_Perseus` | RSI | large | flight_ready |
| Polaris | `RSI_Polaris` | RSI | capital | flight_ready |
| Polaris | `RSI_Polaris_Collector_Military` | RSI | capital | flight_ready |
| Salvation | `RSI_Salvation` | RSI | small | flight_ready |
| Scorpius | `RSI_Scorpius` | RSI | small | flight_ready |
| Scorpius Antares | `RSI_Scorpius_Antares` | RSI | small | flight_ready |
| Skylark | `RSI_Skylark` | RSI | small | flight_ready |
| Skylark | `RSI_Skylark_Display` | RSI | small | flight_ready |
| Ursa Medivac | `RSI_Ursa_Medivac` | RSI |  | flight_ready |
| Ursa | `RSI_Ursa_Rover` | RSI |  | flight_ready |
| Ursa Fortuna | `RSI_Ursa_Rover_Emerald` | RSI |  | flight_ready |
| Zeus Mk II CL | `RSI_Zeus_CL` | RSI | medium | flight_ready |
| Zeus Mk II CL | `RSI_Zeus_CL_Collector_Indust` | RSI | medium | flight_ready |
| Zeus Mk II ES | `RSI_Zeus_ES` | RSI | medium | flight_ready |
| Cyclone | `TMBL_Cyclone` | TMBL | medium | flight_ready |
| Cyclone AA | `TMBL_Cyclone_AA` | TMBL | medium | flight_ready |
| Cyclone MT | `TMBL_Cyclone_MT` | TMBL | medium | flight_ready |
| Cyclone RC | `TMBL_Cyclone_RC` | TMBL | medium | flight_ready |
| Cyclone RN | `TMBL_Cyclone_RN` | TMBL | medium | flight_ready |
| Cyclone TR | `TMBL_Cyclone_TR` | TMBL | medium | flight_ready |
| Nova | `TMBL_Nova` | TMBL |  | flight_ready |
| Storm | `TMBL_Storm` | TMBL |  | flight_ready |
| Storm AA | `TMBL_Storm_AA` | TMBL |  | flight_ready |
| Blade | `VNCL_Blade` | ESPR | small | flight_ready |
| Glaive | `VNCL_Glaive` | ESPR | medium | flight_ready |
| Vanduul Scythe | `VNCL_Scythe` | ESPR | medium | flight_ready |
| Stinger | `VNCL_Stinger` | ESPR | medium | flight_ready |
| Nox | `XIAN_Nox` | XNAA | small | flight_ready |
| Nox Kue | `XIAN_Nox_Kue` | XNAA | small | flight_ready |
| Khartu-al | `XIAN_Scout` | XNAA | medium | flight_ready |
| San'tok.yāi | `XNAA_SanTokYai` | XNAA | small | flight_ready |

| File | Rows |
| --- | --- |
| GameVersion | 1 |
| Manufacturer | 60 |
| Vehicle | 253 |
| VehicleStats | 253 |
| Port | 24789 |
| Item | 2924 |
| ItemStats | 2924 |

## How the API's vocabulary was mapped

Every value is the API's own; the script only maps the API's type names onto the data model's enumerations (`scripts/bootstrap-fixtures/map.ts`, recorded in ADR-004). Where the API's meaning was ambiguous the field is null and the original values stay in `raw`:

- `VehicleStats.hydrogen_fuel` and `quantum_fuel` are null; `fuel.capacity` and `quantum.quantum_fuel_capacity` map to the two capacity fields.
- `ItemStats.power_output` is the power plant's `power_segment_generation` and `cooling_rate` the cooler's `coolant_segment_generation`, both in segments.
- `ItemStats.power_draw`, `heat_generation`, `em_signature`, `shield_delay` and `qd_fuel_per_jump` are null (the API gives ranges or pairs). `qd_range` is null because every drive's `jump_range` is the float maximum, the game's "no limit".
- Units are the API's: metres, kilograms, SCU, metres per second, and degrees per second for the turn rates in `raw.agility` (ADR-043). No conversion was applied.
- `Vehicle.base_variant_of` is null: the API exposes no base-variant relation.
- `Vehicle.role` is the ship-matrix focus list joined with commas.
- Ports of type `` (8878), `AmmoBox` (13), `Container` (50), `LifeSupportGenerator` (221), `Misc` (691), `Module` (16), `SalvageFieldEmitter` (6), `SalvageFieldSupporter` (2), `SalvageFillerStation` (10), `SalvageInternalStorage` (6), `ToolArm` (18), `UNDEFINED` (42), `WeaponAttachment` (712), `WeaponMount` (13) are kept as `other` and carry no stock item; `Paints` ports are kept as `paint` without one. Only component ports reference an `Item`.
- Interior fittings and controllers are not hardpoints and have no row: `AIModule` (78), `AirTrafficController` (219), `AttachedPart` (364), `CapacitorAssignmentController` (245), `CommsController` (247), `ControlPanel` (22), `CoolerController` (247), `Decal` (4), `Display` (475), `DockingAnimator` (47), `DockingCollar` (265), `Door` (616), `DoorController` (247), `EnergyController` (248), `Flair_Floor` (2), `FlightController` (221), `FuelController` (217), `LandingSystem` (218), `Light` (3), `LightController` (252), `MiningController` (11), `MissileController` (267), `Relay` (573), `Room` (47), `SalvageController` (54), `Seat` (624), `SeatAccess` (707), `SeatDashboard` (416), `SelfDestruct` (250), `ShieldController` (241), `TargetSelector` (1), `Usable` (258), `WeaponController` (514), `WheeledController` (27), `unnamed` (1).
- Slugs are the kebab-case display name, prefixed with the manufacturer code only on collision.

## Samples

`samples/` holds raw API responses trimmed by rule (first port of each type, English text only) for the mapper's unit tests. They are the only raw responses in the repository.

## Source

- https://api.star-citizen.wiki/api/game-versions/default
- https://api.star-citizen.wiki/api/vehicles?page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/vehicles?page[size]=200&page[number]=2
- https://api.star-citizen.wiki/api/vehicles?page[size]=200&page[number]=3
- https://api.star-citizen.wiki/api/vehicles?page[size]=200&page[number]=4
- https://api.star-citizen.wiki/api/vehicles?page[size]=200&page[number]=5
- https://api.star-citizen.wiki/api/vehicles?page[size]=200&page[number]=6
- https://api.star-citizen.wiki/api/vehicles?page[size]=200&page[number]=7
- https://api.star-citizen.wiki/api/vehicles/97648869-5fa5-42da-b804-4d9314289539?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3e4de942-5611-4f88-a151-89fb6bf6cd26?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0079c5d5-1678-4f8c-85ba-18ca8f642af6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d9bc09ce-4c74-4f72-892e-a833c094f4e6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9474f571-8467-4d83-b1fe-f64103d363f4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c9b3ef78-9c47-4052-bf70-ecf32c55c001?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/57bd0ed2-4360-4205-b35e-a89db92fc491?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b6b59889-7226-458e-a6b0-1c9392128a3c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b3d87a94-6858-4d3c-ba59-1ef29d727d1a?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d6cb3db3-b1e0-47a5-8c62-a64285dbb675?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/395f30ae-f930-4929-b881-d711fde7e70f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f0caa993-4c6b-4402-8ef1-d91879060f3b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4b0585b0-b60b-4c52-a744-d812e5e9ad58?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/deb6d97e-38ce-48a2-9e12-d63eb01a0207?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e829391e-d1de-408a-ad23-cfa80003f559?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/841e3ff7-7e71-4573-82a9-909973ae3c05?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/05a4f566-36a4-495c-99a4-dbedc5105cb6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f05b74b2-06cf-44d0-8607-c09487359384?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/94d31d2e-5fa8-460c-9fa4-2942b6f0ce33?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9a25d006-5706-4c70-9ac6-df795688fe09?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/93e1a434-f4fa-43ee-a40c-71bcae5073bc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/17276ad3-7636-40b8-969a-877a2b439b37?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9e4b2b2b-1b5a-4d53-84a2-fe6ed1e43172?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b9bc6679-81ad-472b-8b98-866c72fe6a89?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/33ba66d8-da04-432b-80b8-566bf6301659?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ac7ec306-b272-432e-8284-491da614419c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a6952b66-a5c5-4550-9fb3-4432e8612d24?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/34615358-6b8e-4c27-b29e-f936e254e2a3?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0e614cd8-a509-4721-a629-b89e6e83569e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/58544d8c-f000-47a4-9ec6-ad663dbd8ff0?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a8208d11-32d4-4a4a-82c4-fd7f498b2ae6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/34295443-da9b-4e6c-9335-69d5f3b29a88?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f80d39f3-50fc-4fca-ada1-76de4c237e3f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8aa6a16e-6c06-4db8-ac6d-165f97bf2565?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/eaeb562d-d4ac-43bd-a843-e8a6d69fad82?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8ffde65b-ee9b-4a50-b386-3111175736b2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/afae3e97-7f7e-45a3-9f3b-fe268479775b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a04a1503-ac5c-4520-bc22-4b1a1a198eff?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/50f551e3-3435-4cbe-9ecf-8712855a8e27?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/aaeb976b-7a79-4a9c-91ee-07ed05d4a399?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/20d5f617-147a-4530-a753-a7afd1875fd1?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1bed9058-e284-4c0f-b561-6ba57ab4f99d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/831fdcfc-337a-4350-967d-e693d19efeee?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f6d606c9-b324-4efa-814f-15a59047a6a5?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1c5ffd9c-92d5-4922-a0dd-826a2bcebf02?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f1b224dd-273e-488f-9dee-fbf73f44f462?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/27515ffd-04df-413f-8533-34612d906c7d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f3f7b2e8-1e11-4649-82c6-3106ec966655?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c0f1d217-388c-453a-b6c1-3cb5c2cfc4d8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/41494cbf-8d90-4bb5-abd3-3b20cd694fc9?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8b7e0d33-21c1-4057-8e5b-bf391b5091b2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6759360c-8b2f-4a89-b7c6-82e94b873c1b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4075e1a5-40a8-4444-6e04-8d4c4196618c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/474444e0-0c7b-50af-0f2f-d702d7ef9cbe?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/933ca746-3c36-470f-8245-a247a3776455?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/fb231ba1-dba1-4c9f-823a-746c772ae92f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0af2064a-c02d-4801-a434-09d802ba6573?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4f83f89d-480b-4d1b-867a-13772742d828?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b140e32f-a96b-462f-8c7b-e7243577b2f4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8c2eefb6-d880-47c9-8fd0-1f88865d5511?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6f8bfcc3-2ade-4976-a8e9-fd07de5c3601?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/95b11c76-31ea-4bf3-9894-fb29caecb927?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3fbff8f5-90f0-4c97-93f2-62d180aa8736?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/63b90c8d-459c-4a27-8cf6-db706ffc49ae?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6fa37a02-3d65-448c-a989-02d42d9574dc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3a586d52-4829-4504-8e3a-4ee300bb40cc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/609ce4ca-0f46-44a5-b6d3-2c2f87417126?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1e837261-78d9-4d5b-b17c-90d312d6a3dd?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/663b6047-5b06-489c-a906-bc91fb7d6e63?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/71f76583-1061-4215-9d05-839a4fb6cabc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/64f7df97-d423-4360-a25b-176801cb4819?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b67123fd-72b3-43e7-bfb3-069d59ba6190?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e5d9a28d-4fed-4893-a3e0-c8e10999aef0?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/49e65480-0ab3-bead-8207-2da32c2e00ab?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/71ac02d7-7345-4409-9d60-25def73279be?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b617902a-6cab-457b-9eb8-494274f659b8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9c26b25a-9285-4074-94d1-163db2aa8cbb?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0920e187-515d-466a-9c6a-a7dde9d2b1bc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/35f6ad71-01c6-4762-a18b-99c7fdde9760?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/61cc74dc-fff7-4a1f-b0bf-6f092bcdf023?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/881e3879-a186-44da-8b47-1d8f0a846438?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6f0e14a9-cb6c-4b71-ae92-376867bb1be8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/09c9fa95-5b5a-4200-9ff8-3b288df9925b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a10bcff6-7985-431f-b0ea-bdb51e6d3f98?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8b2016c5-0eba-4cc7-87a2-24b7cd4b82d8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f183c17c-eb46-47d6-8029-24f4189be6f2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/48a46604-7786-44f5-9c22-fa298fad141e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d4abc245-9a8d-43fe-a33d-c7988af62d0f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0fd8f4c0-01e1-4410-85af-31ecb96f0897?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4a7a4b9d-ae3c-4375-af63-4100f831f43c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a13e7de9-3c22-4981-86ec-6b38394d1b10?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e8efe30c-5a1e-4ca2-a956-424b352f80c2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ecdfd0df-6c5f-4183-a24b-9e1546e00a4e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ff19fce8-136b-44b6-98a1-8ec25762acb2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/aaa12a00-a1e7-4dfc-8626-3bebb005209f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e19fc6c3-f5fa-4623-9a17-b00a29b71500?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/674e0a52-4469-4b55-ba0d-6aecc44d1728?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e17ccf62-f2d2-4c4e-a132-a3000d40fbde?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/cf9aa91e-15bf-435c-a22d-f2cadc4485ce?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/84cfa722-9a24-48f1-87af-637f45b340a0?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1810d1a7-61e3-4d95-bafb-0f11758c7683?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/081236f5-9549-4a60-9123-6ae21f0cd261?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/16ff4365-ac34-4b09-a132-d52d51f688d4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a852bb00-e395-468f-9adc-78b3df9c82f6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/439c5671-acad-4eb6-9f09-ba54165d1cb5?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/973bc147-4422-48a6-99c8-6ff0ead25bdf?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f8c8fe5c-1aa3-41d7-86b0-6bb54b249541?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/968249b2-ca7c-4b41-8f58-730673fefc8c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1164be4d-623e-4ef7-bc3d-4cdb45c22ec5?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/34506e83-b7b8-4804-a7bb-f31f11bb9214?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/16aa514f-12ac-43a4-b51d-44447252186e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f203e95e-927c-43b0-947b-e8cb3025d23e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c0b86c69-55ac-4af3-a722-d46282813e91?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9611b8ed-cc96-4b5c-aa1e-baefe7d5bb1c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8c23e3f9-b2e6-42a6-92ab-e023f1e0c643?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c8e10f09-38a0-4730-9dd3-eb0a510c9e43?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/04571d49-0680-4b84-bdb1-dbebeb22c898?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a50ce1a2-6178-4988-a05b-72d7df8d65f9?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/30aab266-9131-4a07-808b-61c868cb404f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/78a6c0c5-b364-430f-8e8c-0389fef66fcc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3bee9f2d-4494-4560-b9f8-463bc90695cb?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/05d033f3-5628-497c-b1c4-8fb112f079a1?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/7533ff77-836c-4bd2-9171-487d9c63863c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/5cf39b3b-41d8-45c1-8ef2-d4678c7a7b85?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/efec4d48-77ab-4cba-9add-a3d96c5be8d8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/dc39ca6b-1d76-4db5-9346-356f49954978?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0d4a1f2b-0fda-433e-a631-1071be157fcc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/565d8121-50a9-4920-af50-f176caef0431?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c03e7aef-6411-4e85-9c10-e89862884433?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1b7318af-7607-40b5-ba1b-54134089c284?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/bdeb88d1-c003-4dfa-942d-5043988e1c68?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e1afb014-fe71-4da9-89ae-c30fcf9c0782?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4da0c1b0-cc77-86e4-93d5-759a2e6f7581?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4ce214f3-16e2-d9ea-2b2c-16d0bf1359ba?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b58f7735-9454-4a0a-b724-2bc8d61961d7?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c926495d-3775-4fbf-88cc-bd243431a82f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/bf785bee-f393-4904-aaa8-987952570938?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4484a044-bbd5-e716-736a-2dda30a3efa4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/13c3f610-7bbd-4464-bd36-d716de49a125?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/eefb1595-cb25-409e-997b-db328e28f1e5?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/7780e93d-1cc3-43b4-9b32-9923af19775a?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9e381490-082c-4af1-a5b2-51453788e940?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/384d7e27-daec-4554-a8e9-6920a10a86c1?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3ea9bcd8-1ddd-4714-a537-7b2675e8c2d2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/93b13680-9aa6-4c21-b998-e4f8880f7c12?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/887cd720-7337-44ae-9708-828ccf808649?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/37659ff0-a803-4a4f-97ff-ad59822061ed?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d868dfb9-5bcd-4f7b-a40a-3aa5bbf7d705?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/533b9b62-33eb-4b34-95eb-d43fe3e020ff?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b616b3ad-123c-40f2-80bd-b8f4109633aa?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f07430f8-e8d1-4c3d-b07d-b9d08dc4a647?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/310be6d1-ea0f-45d8-87b0-0fc9f8aa1530?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ea2c22bc-c2f0-42dc-967d-3300f9232f91?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/36726a9f-7e14-4942-bc4f-1a398b5bef6a?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c42bf65e-f3f2-4234-8c19-8276bfd5de3a?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4481572d-66c8-4f7a-90c3-0150052fde10?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/16099337-179f-473e-8bc9-545e38ef0a32?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/fb484074-f33f-4977-a052-2937e8508acc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6585ae24-738f-42d2-8d3e-eff4a21eaca9?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/34077e67-5e2c-4903-a17c-2d0e163751c7?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/087b2253-2fc7-4fae-9f9d-97f64b7c43db?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/528fdddc-c97f-4ae8-a00e-11a59fc3662d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1b3a41ea-6942-44de-9514-315e81c36bb4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/41a84db8-062b-4359-ad16-611ad540fbdb?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/2000c8d9-f151-4148-babe-6d9e413e2114?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e25212d6-2078-4a91-8f5a-5863e9a8d583?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/7aed1f98-fa95-4166-b8d2-73c1704346ab?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/11ebc47d-4763-4faa-9020-171cf6c2651f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/48fa3c7c-1f29-2045-cd29-b5c8ab9aeabc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/40e7a0a7-4a31-a952-fd27-5eadd534a2ae?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8c2730d4-52c1-43fb-9972-d9956fb7ea1f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0e11d3df-88cc-4e4a-8ba0-c2e6943a2802?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3a7bfe4f-7a6c-4818-aba8-0f1019c3a647?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3e911bb5-1a94-4501-bd63-560557f1b492?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/91c9418e-6240-4fb1-a18a-1e22ebfb7747?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/41ff82e7-ce4e-4dbc-ad7c-7ef52fbe569c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/62e33393-5d68-4191-aba5-3b81ce4f3bf9?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/14d6ba03-86ad-47f8-b940-e8a82d2d52b6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d4662193-10ab-4912-8ca4-d64ead0e6f3b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/bfdf94df-32fc-497c-b9fa-c98f3fa4c83b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1b201ef2-b4dd-46c2-978e-47a13e0a7f81?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/86d0db63-70b6-41eb-be32-a14190ebd57d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/305052b9-dfce-4917-a909-48c1a63c6753?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/df2166dd-70ba-4b10-90ee-bb2ae203b3e8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/38d93014-74d8-4ff9-9a2c-edf817590730?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a5a8e4e5-939c-4f7b-ab48-5f7db556d5a4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/70580bce-2347-4e96-9260-dee6394f483d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ebee8a7f-8e4a-4bed-9e5d-76822724c9f0?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/88f279d0-afd2-442f-83e9-d470552364d3?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0932c4f1-d05c-48c4-9ccb-78410b639555?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3d371fd4-50e2-4b5e-859f-1086e905c946?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b8a2669a-76cb-497c-9090-6ff9a173b220?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b4791030-9d64-4f98-85cb-ca106f868c5e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/34821163-e32e-42bf-99df-8f42ba66ef34?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6c6e9731-3d70-4f1b-84c2-9dbf3c1f97c7?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4b6700e5-38bd-4d8d-9281-ef82996b135f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/96b11061-68ce-4896-9424-fc8804a410ae?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/83a450d1-e6b1-437e-9aee-18316ed34c29?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/469d850e-b86b-47fc-9ee2-df81d775ccc8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6ec72f64-2002-481c-b7c9-b132476ba6aa?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0d690d1a-9f57-4976-bff1-ec46bf039e75?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c4ceff45-d851-44b1-921b-bfef93a6cd6a?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f68ee841-88d1-46f3-a1e2-5dc71d9d5d97?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4b530bea-aab5-475a-a1b4-749989627940?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4e6f4187-6b7e-4c67-93bf-a41658922ba6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/cec2111b-4c71-4968-8035-634de6561cf3?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b17ef3ab-9518-40fd-803f-c2468175ccf6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/203cb135-4f12-4a23-bd53-30910134bac8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3c9af040-d919-4afc-b768-45821a5b913c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c6cfa4d9-e794-4bb6-8da9-54cb779ea109?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e32d125f-a3f8-4bc7-b0e6-cb7edf22b7ac?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c2956880-b82a-42d0-962b-eb736dac1536?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/13a02a6d-7d67-4d22-8530-d4d2c8443f66?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c989caf2-84a5-4c01-b99e-5fc9f8d0ce8e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ff873dda-2b79-4fa3-b3ce-535b8adff5e2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e20211a3-e615-4103-a099-c00fb4fd1552?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/14b8caeb-d5e1-4816-9537-86ef19afada8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4369e7f9-f2e5-4b62-969f-8b35e623ff29?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6c44bcd6-d4c4-41c7-8939-a576e3aa9482?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/30e0f7ac-26fc-4d31-a231-af625511e37e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e07d46e4-92cd-462d-8cda-e17b5051a9eb?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/aaa0cdcd-907c-4533-b3fc-181ede06076d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/57ea2eaa-c495-43ae-bc96-c6f53a8e46ef?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e98521b6-ea2f-4c10-9050-abc29d89d0e8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4eea10ca-d254-462b-8a44-7de6852dc1d4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/48415834-ac12-4c28-ad01-7c210f30c2da?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d1f27f85-90db-4b5d-8ac2-09a9e9ee1315?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6135a874-4cb1-4f49-9f29-5781e5991f2b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e7eeba8d-b108-48a1-a332-d9edbab2b9c1?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/2f231daa-95e5-4cb2-a32e-4db8f29a30d6?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ce937681-caa2-4cfa-ab80-f5bf2a5b9a6c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/dc537d66-2abb-43aa-9d37-4e963fc6e9e2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/039a2768-1aff-4969-b2a4-ed8aeb21dae1?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/316c6601-b405-4a3a-abac-394c655718f8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/718f4435-628b-4436-bb80-bf9cfef9a945?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f8ac4c26-8f4d-4cb3-9be2-7d867a95a877?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/fdb1e6be-8de7-44a0-8359-ad1c5eb6a9fc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/38ae749f-d4fc-4dfd-907b-ed8db61f3d88?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/11b660a2-c77c-490b-9e85-ee70400c5cf8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9dc9c257-c413-416a-ab9b-06fbadf18d1e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/50ddaf5e-a8e3-42fe-a1d3-7267f39b39b0?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1b57cdac-693b-410b-8343-68fa194c94ae?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/01c24704-ae47-4b31-931c-d35655edaa05?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/829d0525-e67e-4e57-9f52-b4e572a4f73d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b416dbbf-53f2-489e-a9dc-456286aa6c70?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/58e25524-8bd3-450f-8442-7b58fdfc8a50?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4559fbe2-55ab-a5a8-4e77-75106cb96ab7?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/478bfc10-9577-ac19-262a-d40a93c3fcb2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/752f2ea8-159a-4a58-b4af-fd79054b3e2f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c984fac2-06c0-4776-8f93-07ebd2c26ad3?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d8987dc2-340d-4312-8d4f-aee7e7fac823?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d7828052-56fb-41a6-ae7d-bc29b0bdf68c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6fa21dc8-c838-4134-a74a-0cd8313bcad8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a6e1bb18-8a11-4bbc-865e-45fd84e7b469?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8e27d568-f424-4dc9-a10f-ca4c34efab85?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ec956be2-8e3a-460d-b3a8-97df4cb12b78?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9f4e2cea-f7dc-4155-9cb2-95bb42a74141?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/c21530fa-5ba9-4f10-9864-88622e8df974?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/562b0c9b-4635-4b40-8e57-09feb3056073?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d26ba152-8cfb-4f2c-9995-2c5ec3f0707f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/7ecd6678-86b1-478a-8668-823f4e3ca016?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ecadf2b2-a404-4776-9289-04af91538d76?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/1e26a179-45cf-4541-ade6-0f0daf7c372b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/d1c3fa10-b2d9-421e-8301-97dbf4d0c115?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e4d9c1c3-d0d0-4581-b0a5-27a4c536b039?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/7a37e5c1-a659-4b8b-aa30-22a540f5df22?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/01051d26-084e-4b4f-9566-ebd2251db0aa?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e50eb3fc-bbc1-4baf-8878-8e8ca7e832ce?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/42724505-2d5b-41ec-adb1-e4c2ee4e855c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4ed10b1c-df4f-4ab0-430e-b5b9f33b0f94?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4c034eef-329c-4336-850e-49bfb1f06a15?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/43f4f9c3-70ad-4549-8a10-0045afbbda10?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/3155e6fd-e1c8-4c15-9bd1-f8e3c2c7174f?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/2e14be84-643f-404c-9df8-e38351fa1f99?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/656d529f-ea3c-4bb4-8ca0-883071734e87?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/40a1f83b-3623-49e6-8168-ab8223998aa2?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/a5a5b055-c5d7-4384-9951-f15d47b88789?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/bc4aa5c5-2e9b-40d6-aa95-0757a763efff?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/83318d44-b6c1-42d8-bcd1-284318718b42?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/edc1421b-59ee-4233-b292-abc2c3ea0a1a?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/2f88be37-7825-4fe1-afae-2ca9d2b01114?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/81586add-ea18-4a95-bf0e-d102ab78d46b?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6a77c8c6-87ef-4d01-9401-024e1b3fcc74?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/cd876c8a-0242-4665-9226-fd793008e5d1?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/ebf015be-7bf9-44e9-ad9c-b5c65f00c530?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/6b621d46-86d6-4f5a-835f-b98242c51876?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8c375d7e-0e44-42e8-b84b-c8d6b2e1256c?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/953f8277-43a5-4f88-b139-ee997ee5c482?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/02fe3279-3598-4ce6-96dc-0bc5cb90dfdc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f8ee95ed-cc18-4d65-a9d2-2d14d26d106d?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e4770804-b43a-4c2d-a4e4-fedd410e50fb?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/4b0436fc-32cb-4ce8-804b-11ed8677aa48?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8dbb42e4-e127-4153-9694-2845142c3e51?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0194943d-1164-4b5f-a85e-79ebc0ebe621?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/bda93768-c01f-40b4-a92e-f31876cd33d0?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/064951d7-3dd0-49c2-8b88-d2d7f809633e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b389839d-fdf9-4c41-850a-4e7461250304?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f80914cf-643e-4b7e-b715-eaf9aa572954?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/b8a352bb-74a8-415b-9e08-77f684ac91b8?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/515269d2-fea4-473f-b416-5f6677a54b55?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8bbcd2cd-1e4b-4b0b-a65c-385bb2a02c32?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/0d4c5000-ffdb-41f5-9de1-d64252dfef21?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/e379e38c-459a-4705-be7d-49a5f5d7a928?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/5d2bf0b6-d9be-4738-8717-0f455c461d8a?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/28f22bb8-9f1c-4a46-9a39-20bcb1e5000e?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/f7b8addd-9253-495c-a278-bdaa236e6cbc?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/daddeefa-fef0-4146-b630-a33d6e8904d3?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8f262a17-633f-43d8-8689-ff345d723b24?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/204a6ce4-1634-4f87-9955-04c70e44c8af?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/8f61dc58-74ca-4dc6-aa95-c3105f10bba4?include=hardpoints
- https://api.star-citizen.wiki/api/vehicles/9634b4d6-9f5a-4ad2-8574-431c15e3bc5d?include=hardpoints
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=2
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=3
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=4
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=5
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=6
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=7
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=8
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=9
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=10
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=11
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=12
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=13
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=14
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=15
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=16
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=17
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=18
- https://api.star-citizen.wiki/api/items?filter[type]=Armor,Bomb,BombLauncher,Cooler,EMP,ExternalFuelTank,FuelIntake,FuelTank,GroundVehicleMissileLauncher,JumpDrive,MainThruster,ManneuverThruster,MiningModifier,Missile,MissileLauncher,PowerPlant,QuantumDrive,QuantumFuelTank,QuantumInterdictionGenerator,Radar,SalvageHead,SalvageModifier,Shield,TowingBeam,TractorBeam,Turret,TurretBase,UtilityTurret,WeaponDefensive,WeaponGun,WeaponMining&filter[include_irrelevant]=true&sort=class_name&page[size]=200&page[number]=19
- https://api.star-citizen.wiki/api/items?filter[type]=WeaponGun&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=Missile&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=Shield&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=PowerPlant&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=Cooler&page[size]=200&page[number]=1
- https://api.star-citizen.wiki/api/items?filter[type]=QuantumDrive&page[size]=200&page[number]=1

344 requests, spaced at least 2.5 seconds apart. Non-commercial use; "Please credit api.star-citizen.wiki in public projects."
