/**
 * What a figure is called on the patch pages (ADR-049). A snapshot keys each figure by its path
 * in the source record (`speed.scm`); the page names it in words. Known paths have a label and a
 * unit from this table; any other path is named from its own words ("Vehicle weapon · heat ·
 * per shot"), so a figure the table has not met is still shown, never dropped.
 */

export interface FigureLabel {
  readonly label: string;
  readonly unit?: string | undefined;
  /** The group the figure is listed under inside an entry. */
  readonly group: string;
}

/** Ship figure groups, in the order an entry lists them. */
export const SHIP_GROUPS = [
  "Hull and size",
  "Flight",
  "Shields",
  "Armour",
  "Weapons and power",
  "Fuel and quantum",
  "Signatures",
  "Cargo and storage",
  "Crew",
  "Insurance",
  "Role",
  "Other figures",
] as const;

/** Part figure groups, in order. */
export const PART_GROUPS = [
  "Weapon",
  "Missile",
  "Shield",
  "Power and cooling",
  "Quantum",
  "Radar",
  "Mining and salvage",
  "Item",
  "Durability",
  "Heat",
  "Distortion",
  "Signature",
  "Other figures",
] as const;

const SHIP: Readonly<Record<string, FigureLabel>> = {
  "sizes.length": { label: "Length", unit: "m", group: "Hull and size" },
  "sizes.beam": { label: "Beam", unit: "m", group: "Hull and size" },
  "sizes.height": { label: "Height", unit: "m", group: "Hull and size" },
  mass_hull: { label: "Hull mass", unit: "kg", group: "Hull and size" },
  mass_loadout: { label: "Loadout mass", unit: "kg", group: "Hull and size" },
  mass_total: { label: "Total mass", unit: "kg", group: "Hull and size" },
  health: { label: "Hull", unit: "HP", group: "Hull and size" },
  "speed.scm": { label: "SCM speed", unit: "m/s", group: "Flight" },
  "speed.max": { label: "Top speed", unit: "m/s", group: "Flight" },
  "speed.boost_forward": {
    label: "Boost forward",
    unit: "m/s",
    group: "Flight",
  },
  "speed.boost_backward": {
    label: "Boost backward",
    unit: "m/s",
    group: "Flight",
  },
  "speed.zero_to_scm": { label: "0 to SCM", unit: "s", group: "Flight" },
  "speed.zero_to_max": { label: "0 to top speed", unit: "s", group: "Flight" },
  "speed.scm_to_zero": { label: "SCM to stop", unit: "s", group: "Flight" },
  "speed.max_to_zero": {
    label: "Top speed to stop",
    unit: "s",
    group: "Flight",
  },
  "agility.pitch": { label: "Pitch", unit: "°/s", group: "Flight" },
  "agility.yaw": { label: "Yaw", unit: "°/s", group: "Flight" },
  "agility.roll": { label: "Roll", unit: "°/s", group: "Flight" },
  "agility.pitch_boosted": {
    label: "Pitch, boosted",
    unit: "°/s",
    group: "Flight",
  },
  "agility.yaw_boosted": {
    label: "Yaw, boosted",
    unit: "°/s",
    group: "Flight",
  },
  "agility.roll_boosted": {
    label: "Roll, boosted",
    unit: "°/s",
    group: "Flight",
  },
  "agility.acceleration.main": {
    label: "Forward acceleration",
    unit: "m/s²",
    group: "Flight",
  },
  "agility.acceleration.retro": {
    label: "Retro acceleration",
    unit: "m/s²",
    group: "Flight",
  },
  "agility.acceleration.vtol": {
    label: "VTOL acceleration",
    unit: "m/s²",
    group: "Flight",
  },
  "agility.acceleration.main_g": {
    label: "Forward acceleration",
    unit: "g",
    group: "Flight",
  },
  "agility.acceleration.retro_g": {
    label: "Retro acceleration",
    unit: "g",
    group: "Flight",
  },
  "agility.acceleration.vtol_g": {
    label: "VTOL acceleration",
    unit: "g",
    group: "Flight",
  },
  "shield.face_type": { label: "Shield faces", group: "Shields" },
  "shield.hp": { label: "Shield health", unit: "HP", group: "Shields" },
  "shield.regeneration": {
    label: "Shield regeneration",
    unit: "HP/s",
    group: "Shields",
  },
  "shield.regeneration_time": {
    label: "Shield regeneration time",
    unit: "s",
    group: "Shields",
  },
  "armor.health": { label: "Armour", unit: "HP", group: "Armour" },
  "armor.damage_multiplier.physical": {
    label: "Physical damage taken",
    unit: "×",
    group: "Armour",
  },
  "armor.damage_multiplier.energy": {
    label: "Energy damage taken",
    unit: "×",
    group: "Armour",
  },
  "armor.damage_multiplier.distortion": {
    label: "Distortion damage taken",
    unit: "×",
    group: "Armour",
  },
  "armor.damage_multiplier.thermal": {
    label: "Thermal damage taken",
    unit: "×",
    group: "Armour",
  },
  "armor.damage_multiplier.biochemical": {
    label: "Biochemical damage taken",
    unit: "×",
    group: "Armour",
  },
  "armor.damage_multiplier.stun": {
    label: "Stun damage taken",
    unit: "×",
    group: "Armour",
  },
  "armor.signal_multiplier.infrared": {
    label: "IR multiplier",
    unit: "×",
    group: "Signatures",
  },
  "armor.signal_multiplier.electromagnetic": {
    label: "EM multiplier",
    unit: "×",
    group: "Signatures",
  },
  "armor.signal_multiplier.cross_section": {
    label: "Cross-section multiplier",
    unit: "×",
    group: "Signatures",
  },
  "penetration_multiplier.fuse": {
    label: "Penetration, fuse",
    unit: "×",
    group: "Armour",
  },
  "penetration_multiplier.components": {
    label: "Penetration, components",
    unit: "×",
    group: "Armour",
  },
  "emission.ir": { label: "IR signature", group: "Signatures" },
  "emission.em_idle": { label: "EM signature, idle", group: "Signatures" },
  "emission.em_max": { label: "EM signature, maximum", group: "Signatures" },
  "cross_section.length": {
    label: "Cross-section, length",
    group: "Signatures",
  },
  "cross_section.width": { label: "Cross-section, width", group: "Signatures" },
  "cross_section.height": {
    label: "Cross-section, height",
    group: "Signatures",
  },
  "fuel.capacity": {
    label: "Hydrogen capacity",
    unit: "SCU",
    group: "Fuel and quantum",
  },
  "fuel.intake_rate": {
    label: "Fuel intake",
    unit: "SCU/s",
    group: "Fuel and quantum",
  },
  "quantum.quantum_speed": {
    label: "Quantum speed",
    unit: "m/s",
    group: "Fuel and quantum",
  },
  "quantum.quantum_spool_time": {
    label: "Quantum spool",
    unit: "s",
    group: "Fuel and quantum",
  },
  "quantum.quantum_fuel_capacity": {
    label: "Quantum fuel capacity",
    unit: "SCU",
    group: "Fuel and quantum",
  },
  "quantum.port_olisar_to_arccorp_time": {
    label: "Port Olisar to ArcCorp, time",
    unit: "s",
    group: "Fuel and quantum",
  },
  "quantum.port_olisar_to_arccorp_fuel": {
    label: "Port Olisar to ArcCorp, fuel",
    group: "Fuel and quantum",
  },
  "quantum.quantum_range": {
    label: "Quantum range",
    unit: "m",
    group: "Fuel and quantum",
  },
  cargo_capacity: { label: "Cargo", unit: "SCU", group: "Cargo and storage" },
  ore_capacity: { label: "Ore", unit: "SCU", group: "Cargo and storage" },
  vehicle_inventory: {
    label: "Personal storage",
    unit: "µSCU",
    group: "Cargo and storage",
  },
  "crew.min": { label: "Crew, minimum", group: "Crew" },
  "crew.max": { label: "Crew, maximum", group: "Crew" },
  "insurance.claim_time": {
    label: "Claim time",
    unit: "min",
    group: "Insurance",
  },
  "insurance.expedite_time": {
    label: "Expedite time",
    unit: "min",
    group: "Insurance",
  },
  "insurance.expedite_cost": {
    label: "Expedite cost",
    unit: "aUEC",
    group: "Insurance",
  },
  "power.generation_segments": {
    label: "Power made",
    unit: "segments",
    group: "Weapons and power",
  },
  "cooling.generation_segments": {
    label: "Coolant made",
    unit: "segments",
    group: "Weapons and power",
  },
  size_class: { label: "Size", group: "Role" },
  career: { label: "Career", group: "Role" },
  role: { label: "Role", group: "Role" },
};

const PART: Readonly<Record<string, FigureLabel>> = {
  mass: { label: "Mass", unit: "kg", group: "Item" },
  class: { label: "Class", group: "Item" },
  is_craftable: { label: "Craftable", group: "Item" },
  is_lootable: { label: "Lootable", group: "Item" },
  "vehicle_weapon.damage.burst": {
    label: "Damage per second",
    group: "Weapon",
  },
  "vehicle_weapon.damage.sustained_60s": {
    label: "Damage per second, sustained 60 s",
    group: "Weapon",
  },
  "vehicle_weapon.damage.alpha_total": {
    label: "Damage per shot",
    group: "Weapon",
  },
  "vehicle_weapon.damage_per_shot": {
    label: "Damage per shot, listed",
    group: "Weapon",
  },
  "vehicle_weapon.rpm": { label: "Fire rate", unit: "rpm", group: "Weapon" },
  "vehicle_weapon.range": { label: "Range", unit: "m", group: "Weapon" },
  "vehicle_weapon.capacity": { label: "Ammunition", group: "Weapon" },
  "vehicle_weapon.type": { label: "Weapon type", group: "Weapon" },
  "vehicle_weapon.ammunition.speed": {
    label: "Projectile speed",
    unit: "m/s",
    group: "Weapon",
  },
  "vehicle_weapon.ammunition.lifetime": {
    label: "Projectile lifetime",
    unit: "s",
    group: "Weapon",
  },
  "missile.damage_total": { label: "Damage", group: "Missile" },
  "missile.speed": { label: "Speed", unit: "m/s", group: "Missile" },
  "missile.signal_type": { label: "Tracks", group: "Missile" },
  "missile.lock_time": { label: "Lock time", unit: "s", group: "Missile" },
  "missile.lock_range_max": {
    label: "Lock range",
    unit: "m",
    group: "Missile",
  },
  "missile.lock_angle": { label: "Lock angle", unit: "°", group: "Missile" },
  "shield.max_health": { label: "Shield health", unit: "HP", group: "Shield" },
  "shield.regen_rate": {
    label: "Regeneration",
    unit: "HP/s",
    group: "Shield",
  },
  "shield.regen_delay.damage": {
    label: "Delay after damage",
    unit: "s",
    group: "Shield",
  },
  "shield.regen_delay.downed": {
    label: "Delay after going down",
    unit: "s",
    group: "Shield",
  },
  "power_plant.power_segment_generation": {
    label: "Power made",
    unit: "segments",
    group: "Power and cooling",
  },
  "cooler.coolant_segment_generation": {
    label: "Coolant made",
    unit: "segments",
    group: "Power and cooling",
  },
  "quantum_drive.standard_jump.drive_speed": {
    label: "Quantum speed",
    unit: "m/s",
    group: "Quantum",
  },
  "quantum_drive.standard_jump.spool_up_time": {
    label: "Spool",
    unit: "s",
    group: "Quantum",
  },
  "quantum_drive.standard_jump.cooldown_time": {
    label: "Cooldown",
    unit: "s",
    group: "Quantum",
  },
  "quantum_drive.quantum_fuel_requirement": {
    label: "Fuel per megametre",
    group: "Quantum",
  },
  "durability.health": { label: "Health", unit: "HP", group: "Durability" },
  "emission.ir": { label: "IR signature", group: "Signature" },
  "emission.em_max": { label: "EM signature", group: "Signature" },
  "emission.em_min": { label: "EM signature, minimum", group: "Signature" },
};

/** Words the source abbreviates, in the form the page writes them. */
const WORDS: Readonly<Record<string, string>> = {
  scm: "SCM",
  em: "EM",
  ir: "IR",
  hp: "HP",
  rpm: "RPM",
  vtol: "VTOL",
  qd: "QD",
  dps: "damage per second",
  max: "maximum",
  min: "minimum",
  regen: "regeneration",
  "60s": "60 s",
  g: "g",
};

/** "vehicle_weapon.heat.per_shot" → "Vehicle weapon · heat · per shot". */
export function humanize(path: string): string {
  const parts = path.split(".").map((segment) =>
    segment
      .split("_")
      .map((w) => WORDS[w.toLowerCase()] ?? w.toLowerCase())
      .join(" "),
  );
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shipGroupOf(path: string): string {
  const top = path.split(".")[0] ?? "";
  if (/^(sizes|mass_|health)/.test(top)) return "Hull and size";
  if (/^(speed|afterburner|agility)/.test(top)) return "Flight";
  if (/^shield/.test(top)) return "Shields";
  if (/^(armor|penetration)/.test(top)) return "Armour";
  if (/^(power|cooling)/.test(top)) return "Weapons and power";
  if (/^(fuel|quantum)/.test(top)) return "Fuel and quantum";
  if (/^(emission|signature|cross_section)/.test(top)) return "Signatures";
  if (/^(cargo|ore|vehicle_inventory|weapon_storage)/.test(top))
    return "Cargo and storage";
  if (/^(crew|seating)/.test(top)) return "Crew";
  if (top === "insurance") return "Insurance";
  if (/^(size_class|career|role)$/.test(top)) return "Role";
  return "Other figures";
}

function partGroupOf(path: string): string {
  const top = path.split(".")[0] ?? "";
  if (top === "vehicle_weapon") return "Weapon";
  if (top === "missile" || top === "bomb") return "Missile";
  if (top === "shield") return "Shield";
  if (/^(power_plant|cooler|resource_network)$/.test(top))
    return "Power and cooling";
  if (/^(quantum_drive|jump_drive)$/.test(top)) return "Quantum";
  if (top === "radar") return "Radar";
  if (/mining|salvage|tractor|towing/.test(top)) return "Mining and salvage";
  if (top === "durability") return "Durability";
  if (top === "temperature") return "Heat";
  if (top === "distortion") return "Distortion";
  if (top === "emission") return "Signature";
  if (/^(mass|class|is_)/.test(top)) return "Item";
  return "Other figures";
}

export function shipFigureLabel(path: string): FigureLabel {
  return SHIP[path] ?? { label: humanize(path), group: shipGroupOf(path) };
}

/** A part's own block, which the figure's group already names ("Radar", "Shield"). */
const PART_BLOCKS = new Set([
  "vehicle_weapon",
  "missile",
  "bomb",
  "shield",
  "power_plant",
  "cooler",
  "quantum_drive",
  "jump_drive",
  "radar",
  "durability",
  "temperature",
  "distortion",
  "emission",
]);

export function partFigureLabel(path: string): FigureLabel {
  const known = PART[path];
  if (known !== undefined) return known;
  const [head, ...rest] = path.split(".");
  const named =
    rest.length > 0 && head !== undefined && PART_BLOCKS.has(head)
      ? rest.join(".")
      : path;
  return { label: humanize(named), group: partGroupOf(path) };
}

const BLUEPRINT: Readonly<Record<string, FigureLabel>> = {
  craft_time_seconds: { label: "Craft time", unit: "s", group: "Blueprint" },
  is_available_by_default: {
    label: "Known from the start",
    group: "Blueprint",
  },
  unlocking_missions_count: {
    label: "Missions that unlock it",
    group: "Blueprint",
  },
  ingredient_count: { label: "Ingredients", group: "Blueprint" },
};

export function blueprintFigureLabel(path: string): FigureLabel {
  return BLUEPRINT[path] ?? { label: humanize(path), group: "Blueprint" };
}

/**
 * The part families the "Weapons and parts" section lists, by the source's part type, in order.
 * A type not named here is listed under its own words.
 */
export const PART_FAMILIES: readonly {
  readonly id: string;
  readonly label: string;
  readonly types: readonly string[];
}[] = [
  { id: "guns", label: "Ship guns", types: ["WeaponGun"] },
  {
    id: "missiles",
    label: "Missiles, torpedoes and bombs",
    types: ["Missile", "Bomb"],
  },
  {
    id: "racks",
    label: "Missile and bomb racks",
    types: ["MissileLauncher", "BombLauncher"],
  },
  { id: "shields", label: "Shields", types: ["Shield"] },
  { id: "power-plants", label: "Power plants", types: ["PowerPlant"] },
  { id: "coolers", label: "Coolers", types: ["Cooler"] },
  {
    id: "quantum-drives",
    label: "Quantum and jump drives",
    types: ["QuantumDrive", "JumpDrive"],
  },
  { id: "radars", label: "Radars", types: ["Radar"] },
  {
    id: "countermeasures",
    label: "Countermeasures",
    types: ["WeaponDefensive"],
  },
  {
    id: "mining-salvage",
    label: "Mining, salvage and tractor beams",
    types: [
      "WeaponMining",
      "MiningModifier",
      "SalvageHead",
      "SalvageModifier",
      "TractorBeam",
      "TowingBeam",
    ],
  },
  {
    id: "emp-interdiction",
    label: "EMP and interdiction",
    types: ["EMP", "QuantumInterdictionGenerator"],
  },
];
