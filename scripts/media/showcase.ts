/**
 * The showcase ships (owner, 2026-11-08): the Anvil Odin is the concept hero page every design is
 * tested against, the RSI Perseus the live example. Each lists the official media it uses and
 * where every file comes from, so `fetch-showcase.ts` can copy them and the site can credit them.
 * Nothing here is game data; the Odin's figures come from RSI's ship matrix (ADR-010).
 */

export type ShowcaseSource = "rsi" | "fleetyards";

export interface ShowcaseFile {
  /** Local file name under fixtures/showcase/<slug>/. */
  readonly file: string;
  readonly url: string;
  readonly source: ShowcaseSource;
  readonly kind: "image" | "video" | "model";
}

export interface ShowcaseShip {
  readonly slug: string;
  readonly name: string;
  readonly manufacturer_code: string;
  /** RSI article the art and story come from, mirrored by the Star Citizen Wiki API. */
  readonly comm_link?:
    { readonly id: number; readonly url: string } | undefined;
  readonly files: readonly ShowcaseFile[];
  /** How the page places the files; text always comes from the article, never from here. */
  readonly layout: ShowcaseLayout;
}

export interface ShowcaseLayout {
  /** background, cutout (layered over background), header, lockup, topdown. */
  readonly roles: Readonly<Record<string, string>>;
  /** Article headings to show, in order, each with the media the article sets beside it. */
  readonly chapters: readonly {
    readonly heading: string;
    readonly image?: string;
    readonly video?: string;
  }[];
  readonly gallery: readonly string[];
  readonly schematics: readonly {
    readonly wide: string;
    readonly narrow?: string;
    readonly caption: string;
  }[];
}

/**
 * RSI's plain media URLs for named article images return 404; the article's own image proxy links
 * (robertsspaceindustries.com/i/...) serve the same files. Taken from the wiki API's image list.
 */
const PROXY: Readonly<Record<string, string>> = {
  "SC_Odin_Key_Background_2.jpg":
    "https://robertsspaceindustries.com/i/d9ce7556e1015db88bb66c210783b383b8784f6c/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskpXRpPJNoC24ndEh1QF85zAXMqJn8VR98/sc-odin-key-background-2.jpg",
  "ODIN_LOGO.png":
    "https://robertsspaceindustries.com/i/6aed72aabb3e107c2765c37295953254d7530cd2/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjURwea72PL3q4CKYAnmYotHLGRSZnNYMk/odin-logo.png",
  "ODIN_SHIP_OVERLAY.png":
    "https://robertsspaceindustries.com/i/09e98ac6625f2b88f4245f5e0e9d86227fdac66b/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskYaZ4MUUsKAfcVQG3oMv7FwgmmmfGevir/odin-ship-overlay.png",
  "THE-FIGHT-WITHIN.jpg":
    "https://robertsspaceindustries.com/i/6869e57399371f1d86c6d77bdf15c9cd9564525c/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskjA15z3WYymkM8kaFtn3sykBwfEDr18op/the-fight-within.jpg",
  "THE-PINNACLE-OF-PROPULSION.jpg":
    "https://robertsspaceindustries.com/i/d16cd3b8690f815dfc4f7ccb0356580e75e7b060/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskUXpDK2uNhfP1h36q5HJWaLZY9MSEsaea/the-pinnacle-of-propulsion.jpg",
  "PDCs0001-0110.jpg":
    "https://robertsspaceindustries.com/i/836eb3fd6756783b7f120f9986b8ff4554fa6731/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskvikffzTHKgEXh6pb7h1LXsFGpfG1Z1gr/pdcs0001-0110.jpg",
  "SC_ANVIL_Odin_Exterior-7.jpg":
    "https://robertsspaceindustries.com/i/dec2e6bae1185a35dc2088b195084911f4772c3e/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseYm4uyEx2dqguvhDTPZtjPYuBkRPp5h5G/sc-anvil-odin-exterior-7.jpg",
  "ARMING-A-GARRISON.jpg":
    "https://robertsspaceindustries.com/i/10c71dba7a31c10b585583171016f600ae7dabf9/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResizjXH7ryLP9RbejGZovU6ZY4LnLFfEYjY/arming-a-garrison.jpg",
  "AT-THE-CORE-OF-COMBAT.jpg":
    "https://robertsspaceindustries.com/i/4049e8cc8dcdd7b272f7b2b106468d61b11ecacb/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjHqNDnVdDS7AYP5YkU9ViYi8LtstQR82a/at-the-core-of-combat.jpg",
  "UNVEILING-DESTRUCTION.jpg":
    "https://robertsspaceindustries.com/i/24bd1f24f32a20d28537bc963f6b0f136f84b396/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjCXahAeUs9kHvFBWKDDo5cMF5JcPeNRsU/unveiling-destruction.jpg",
  "THE-ALL-KILLING-EYE.jpg":
    "https://robertsspaceindustries.com/i/caf16f672c86b7253564c8d82f6c0d02ccf50ddc/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseYijDUsr3akB862Cosq4y3qvPjS6XYsFU/the-all-killing-eye.jpg",
  "SHIP_TOPDOWN.png":
    "https://robertsspaceindustries.com/i/ca2cc85178863f548ac54762540d42dced2d111c/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseTk37vhY7qvVFMiMxX9tToBfvG55TkdXt/ship-topdown.png",
  "SC_ANVIL_Odin_Schematic_UPDATED.jpg":
    "https://robertsspaceindustries.com/i/3f35950807f6dd736b8edbc18c456e6ac8fbe245/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResejQ3iBvGGbW8Ym7ryDbkQR9krXweBUWDc/sc-anvil-odin-schematic-updated.jpg",
  "SC_ANVIL_Odin_Schematic_MOBILE_UPDATED.jpg":
    "https://robertsspaceindustries.com/i/ebb960f87eab847eeb38fef18a188bb6ddcef48d/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseTJnaeUEmFQqd93qej9AaSu3Nkpo83oYi/sc-anvil-odin-schematic-mobile-updated.jpg",
  "SC_ANVIL_Odin_Schematic_Callouts-Copy.jpg":
    "https://robertsspaceindustries.com/i/75da313beab8f9a714f79411747d306b91fc042f/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResikEYPRhWkFHJCuHjw1228WHNKyGGwcYmU/sc-anvil-odin-schematic-callouts-copy.jpg",
  "SC_ANVIL_Odin_Schematic_Callouts_MOBILE-Copy.jpg":
    "https://robertsspaceindustries.com/i/6c814c6d68064b90b82614ecfbfdc242b406d94d/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskPVZa6baPgjjkHqA7n8Q39mQQWmD1LHhY/sc-anvil-odin-schematic-callouts-mobile-copy.jpg",
  "All-Weapons-Opening0001-0240.jpg":
    "https://robertsspaceindustries.com/i/69262938cc7a7c97a79f810aba0cfd78633f5316/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjZZ77rxDDhQaJYZwV8dehTitjGLUGmDbL/all-weapons-opening0001-0240.jpg",
  "SC_ANVIL_Odin_WeaponStats_UPDATED.jpg":
    "https://robertsspaceindustries.com/i/90358c9ef5cdb0c496ad2975874c153636f832e2/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskURoEpDYhvGT5oo6cy8heXutRcDAiTHsL/sc-anvil-odin-weaponstats-updated.jpg",
  "SC_ANVIL_Odin_WeaponStatsMOBILE_UPDATED.jpg":
    "https://robertsspaceindustries.com/i/ad7a296ea3d831cb0425678b617098aa8263c3fd/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseBswQRSYt4pu8ZsK5PGs6zgd6kMQFtjfk/sc-anvil-odin-weaponstatsmobile-updated.jpg",
  "SC_ANVIL_Odin_Exterior-3.jpg":
    "https://robertsspaceindustries.com/i/d3699aecd34fcfa0f6bc78222f3e2d4e7d306dea/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskUPPk4LKumYRcqhGh4m8vUFUvCUmYtAeS/sc-anvil-odin-exterior-3.jpg",
  "SC_ANVIL_Odin_Interior-5.jpg":
    "https://robertsspaceindustries.com/i/71fdb939075f4160dcc3ff0eeedf4fb4a693be6e/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskHnvUtiB99LJTHmVhWWtwkJKrzVdzpS5L/sc-anvil-odin-interior-5.jpg",
  "SC_ANVIL_Odin_Exterior-2.jpg":
    "https://robertsspaceindustries.com/i/a25d3460772d9b862ff4e6ae94638352f648559e/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskPGLHjkQZsnX5qNMHrGP8wiKLjxV8v4mC/sc-anvil-odin-exterior-2.jpg",
  "SC_ANVIL_Odin_Interior-9.jpg":
    "https://robertsspaceindustries.com/i/e5e3b49a3c43cc3fc3b3f5dda35013ff18e5727d/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskCc8iwK4ZiTmmu3AsoquVxcqMtBW1t7oC/sc-anvil-odin-interior-9.jpg",
  "SC_ANVIL_Odin_Interior-7.jpg":
    "https://robertsspaceindustries.com/i/f0f3c8a518e8390838fc6d8e46e7bc92496976be/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseYqqY3BpWCU5QfT15H1UG8ssmCSLc27Gr/sc-anvil-odin-interior-7.jpg",
  "78.jpg":
    "https://robertsspaceindustries.com/i/9100aa34e1c1419a22a1c9b6fd34d4b1df811ad2/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjkFewRuaBu2uvqmmuqNW9yutmLNbS1aKY/78.jpg",
  "75-Copy.jpg":
    "https://robertsspaceindustries.com/i/c5516a82350e3a5b86b8b946409855b07b6412b1/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResiuYqiajHqwsPbVtHMW2nKCKFTzTwVUa1C/75-copy.jpg",
  "SC_ANVIL_Odin_Exterior-4.jpg":
    "https://robertsspaceindustries.com/i/ff44af4cd7d4bd9496f28632f87238d270f9d649/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskYac35ebVwGVkKrDCbRrkXeG6XR234oSE/sc-anvil-odin-exterior-4.jpg",
  "SC_ANVIL_Odin_Exterior-5.jpg":
    "https://robertsspaceindustries.com/i/92464b9a4a08700e3f1d5ebe480cae1fa638d409/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskkKzCYnuqQ3jevzU8GNTomaHY7hPKDKYS/sc-anvil-odin-exterior-5.jpg",
  "ODIN_Lockup.png":
    "https://robertsspaceindustries.com/i/9411f41b3d95296d13d7bd193a5284a1ae200755/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskHp3HgrWmhWC4YUW55aoxAHbtPkWHvSMt/odin-lockup.png",
  "RSI_Perseus_ImageGraphicsLines.png":
    "https://robertsspaceindustries.com/i/de48ff13de421a21baded9aef2517786246ce46e/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskw2XkVGKZ7Xq66kHytkSthYDyAUQaCp78/rsi-perseus-imagegraphicslines.png",
  "Perseus_HEADER.jpg":
    "https://robertsspaceindustries.com/i/a643edc28077da957c857ccd781684afb4c564fa/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResejbkEVev8vuXy3QPhwo9KzBh2BxZ9ivi2/perseus-header.jpg",
  "Mfr_rsi_perseus_logo_white_4k_lockup_ONLY.png":
    "https://robertsspaceindustries.com/i/1fec6e4a866fae8bfa32fecb2b42485ad4e8dc72/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskHjEMFrtR7YXYGimyazqodaeuHpCmoM18/mfr-rsi-perseus-logo-white-4k-lockup-only.png",
  "Interior_1.jpg":
    "https://robertsspaceindustries.com/i/2c02440edcdee73b2fa9bfdc5b1c6af7674872b7/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResivfEQTiae2XP4DaQj9JXWzLu1gwi3pdAv/interior-1.jpg",
  "Interior_5.jpg":
    "https://robertsspaceindustries.com/i/2b9334d6d394db6fe625beb2bf1a978982efadcd/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjCRGZyjToz6DsR54NUnnHWtCSTAAQvWSJ/interior-5.jpg",
  "Interior_4.jpg":
    "https://robertsspaceindustries.com/i/5e96679ead22426ff440d0f2bf51cf8c3a67f115/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjzzsj4CqXNkyWq9K1iuVrtdm2W4QgwMAE/interior-4.jpg",
  "Interior_3.jpg":
    "https://robertsspaceindustries.com/i/aeec73343de8e6be877b9e934735732e3e095fbd/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseTpmnfXeKQpuedywvRPYKQ2uk8JSgBweE/interior-3.jpg",
  "Interior_6.jpg":
    "https://robertsspaceindustries.com/i/db60a8451e9146e0ad594211dfd0691226c7c92f/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjT9frkps3nftGtt74SCX7WXymBHLcroQ2/interior-6.jpg",
  "1_CaptainsQuarters-Copy.png":
    "https://robertsspaceindustries.com/i/ffc7ef7c8568796126c735ae13c65b07ef218562/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskqY4sZLDeSCTXXoniyCcHp9F1ytZQdnAz/1-captainsquarters-copy.png",
  "2_CrewQuarters-Copy.png":
    "https://robertsspaceindustries.com/i/ba32a5adf4f726ff441944b51cd3730af52ad2b6/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskfNU6whpHjWdtC2TDtrRW8aX3itbA6h9Y/2-crewquarters-copy.png",
  "3_MessHall-Copy.png":
    "https://robertsspaceindustries.com/i/b38def8d9547c452184aab39cadbfd146ea17717/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResipCWc1zzitYQQmoShtY4J4MqBnUXmLjpa/3-messhall-copy.png",
  "Interior_2.jpg":
    "https://robertsspaceindustries.com/i/bdcd8ecc4c66e8b3f908c02eee45675ec7c07a8e/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResk2KMQYDf7XotQXhWvfZctusNZrsV3Tnwg/interior-2.jpg",
  "4_CargoHold-Copy.png":
    "https://robertsspaceindustries.com/i/d996ae716d4cd6a74bd37e1a8ba53064d8bda151/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResivY447Q16EPnmUtKKV3118diSKD32Bxpe/4-cargohold-copy.png",
  "5_TorpedoRoom-Copy.png":
    "https://robertsspaceindustries.com/i/6a1e1399705477b43413355a7085d0bfd7db3101/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResk2Mxqk2jE8fxV8pK73PCgTAsQyvTfYxc6/5-torpedoroom-copy.png",
  "6_EngineeringBay-Copy.png":
    "https://robertsspaceindustries.com/i/62dd194d6a4e0ea6cb25c946a4599ff900f117c8/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResiqMcNsMbLySAdh2f15XUtvcKwKRyi5uXU/6-engineeringbay-copy.png",
  "Star_Citizen_32_9_SALES_-BANNER.jpg":
    "https://robertsspaceindustries.com/i/a8ac6d19ef276dabfcfb2ce8fdd58f810ff53b93/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReskkNdYZkJpo4eSCauw3UEPGaTryFdVeVug/star-citizen-32-9-sales-banner.jpg",
  "Mfr_rsi_perseus_logo_white_4k.png":
    "https://robertsspaceindustries.com/i/20881627d01e24073b2d51153fdfbce902a82a01/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseuq1zdFbSxz8puANMPEr8QMnvbqW7D66r/mfr-rsi-perseus-logo-white-4k.png",
};

const rsi = (name: string): ShowcaseFile => {
  const url = PROXY[name];
  if (url === undefined) throw new Error(`no working URL for ${name}`);
  return { file: name, url, source: "rsi", kind: "image" };
};

/** Article videos exist only under media ids (their poster frames 404; chapter images stand in). */
const video = (id: string, n: number): ShowcaseFile[] => [
  {
    file: `video-${n}.mp4`,
    url: `https://media.robertsspaceindustries.com/${id}/source.mp4`,
    source: "rsi",
    kind: "video",
  },
];

export const SHOWCASE: readonly ShowcaseShip[] = [
  {
    slug: "odin",
    name: "Odin",
    manufacturer_code: "ANVL",
    comm_link: {
      id: 21133,
      url: "https://robertsspaceindustries.com/en/comm-link/transmission/21133-Anvil-Odin",
    },
    files: [
      rsi("SC_Odin_Key_Background_2.jpg"),
      rsi("ODIN_SHIP_OVERLAY.png"),
      rsi("ODIN_LOGO.png"),
      rsi("ODIN_Lockup.png"),
      rsi("THE-FIGHT-WITHIN.jpg"),
      rsi("THE-PINNACLE-OF-PROPULSION.jpg"),
      rsi("PDCs0001-0110.jpg"),
      rsi("SC_ANVIL_Odin_Exterior-7.jpg"),
      rsi("ARMING-A-GARRISON.jpg"),
      rsi("AT-THE-CORE-OF-COMBAT.jpg"),
      rsi("UNVEILING-DESTRUCTION.jpg"),
      rsi("THE-ALL-KILLING-EYE.jpg"),
      rsi("SHIP_TOPDOWN.png"),
      rsi("SC_ANVIL_Odin_Schematic_UPDATED.jpg"),
      rsi("SC_ANVIL_Odin_Schematic_MOBILE_UPDATED.jpg"),
      rsi("SC_ANVIL_Odin_Schematic_Callouts-Copy.jpg"),
      rsi("SC_ANVIL_Odin_Schematic_Callouts_MOBILE-Copy.jpg"),
      rsi("All-Weapons-Opening0001-0240.jpg"),
      rsi("SC_ANVIL_Odin_WeaponStats_UPDATED.jpg"),
      rsi("SC_ANVIL_Odin_Exterior-2.jpg"),
      rsi("SC_ANVIL_Odin_Exterior-3.jpg"),
      rsi("SC_ANVIL_Odin_Exterior-4.jpg"),
      rsi("SC_ANVIL_Odin_Exterior-5.jpg"),
      rsi("SC_ANVIL_Odin_Interior-5.jpg"),
      rsi("SC_ANVIL_Odin_Interior-7.jpg"),
      rsi("SC_ANVIL_Odin_Interior-9.jpg"),
      rsi("SC_ANVIL_Odin_WeaponStatsMOBILE_UPDATED.jpg"),
      rsi("78.jpg"),
      rsi("75-Copy.jpg"),
      ...video("907z65lvckcie", 1),
      ...video("meqm0flrf1683", 2),
      ...video("ns6umeu6gb7w5", 3),
      ...video("3p246qbd4kwlp", 4),
      ...video("grmgriqce1yoq", 5),
      {
        file: "odin_flight_holo.glb",
        url: "https://api.fleetyards.net/files/blobs/redirect/eyJfcmFpbHMiOnsiZGF0YSI6ImFjODk3YjA1LTQyYjgtNDYxNS1iY2MwLTIzMzhjMjExOTJkZSIsInB1ciI6ImJsb2JfaWQifX0=--00c9c203f293f05a57a8973f2167f180c6974bd2/flight_holo.glb/",
        source: "fleetyards",
        kind: "model",
      },
    ],
    layout: {
      roles: {
        background: "SC_Odin_Key_Background_2.jpg",
        cutout: "ODIN_SHIP_OVERLAY.png",
        topdown: "SHIP_TOPDOWN.png",
        poster: "SC_ANVIL_Odin_Exterior-5.jpg",
      },
      chapters: [
        { heading: "THE ALLFATHER OF WAR" },
        { heading: "THE FIGHT WITHIN", image: "THE-FIGHT-WITHIN.jpg" },
        {
          heading: "THE PINNACLE OF PROPULSION",
          image: "THE-PINNACLE-OF-PROPULSION.jpg",
        },
        {
          heading: "MORE IS MORE",
          image: "PDCs0001-0110.jpg",
          video: "video-1.mp4",
        },
        { heading: "RENEWED STRENGTH", image: "SC_ANVIL_Odin_Exterior-7.jpg" },
        {
          heading: "POWER IN YOUR HANDS",
          image: "ARMING-A-GARRISON.jpg",
          video: "video-2.mp4",
        },
        {
          heading: "AT THE CORE OF COMBAT",
          image: "AT-THE-CORE-OF-COMBAT.jpg",
        },
        {
          heading: "WHAT LIES BENEATH",
          image: "All-Weapons-Opening0001-0240.jpg",
          video: "video-5.mp4",
        },
        {
          heading: "THE ALL-KILLING EYE",
          image: "THE-ALL-KILLING-EYE.jpg",
          video: "video-4.mp4",
        },
        { heading: "PLAN OF ATTACK", image: "SC_ANVIL_Odin_Interior-5.jpg" },
        {
          heading: "THE ULTIMATE DETERRANT",
          image: "SC_ANVIL_Odin_Exterior-2.jpg",
        },
        { heading: "STAY ARMED", image: "SC_ANVIL_Odin_Interior-9.jpg" },
        {
          heading: "CARRYING THE FUTURE",
          image: "SC_ANVIL_Odin_Interior-7.jpg",
        },
      ],
      gallery: [
        "SC_ANVIL_Odin_Exterior-5.jpg",
        "UNVEILING-DESTRUCTION.jpg",
        "SC_ANVIL_Odin_Exterior-3.jpg",
        "SC_ANVIL_Odin_Exterior-4.jpg",
        "78.jpg",
        "75-Copy.jpg",
      ],
      schematics: [
        {
          wide: "SC_ANVIL_Odin_Schematic_UPDATED.jpg",
          narrow: "SC_ANVIL_Odin_Schematic_MOBILE_UPDATED.jpg",
          caption: "Schematic",
        },
        {
          wide: "SC_ANVIL_Odin_Schematic_Callouts-Copy.jpg",
          narrow: "SC_ANVIL_Odin_Schematic_Callouts_MOBILE-Copy.jpg",
          caption: "Callouts",
        },
        {
          wide: "SC_ANVIL_Odin_WeaponStats_UPDATED.jpg",
          narrow: "SC_ANVIL_Odin_WeaponStatsMOBILE_UPDATED.jpg",
          caption: "Armament",
        },
      ],
    },
  },
  {
    slug: "perseus",
    name: "Perseus",
    manufacturer_code: "RSI",
    comm_link: {
      id: 20738,
      url: "https://robertsspaceindustries.com/en/comm-link/transmission/20738-RSI-Perseus",
    },
    files: [
      rsi("Perseus_HEADER.jpg"),
      {
        file: "matrix-wallpaper.jpg",
        url: "https://media.robertsspaceindustries.com/1zli0ngsh3vk7/wallpaper_3840x2160.jpg",
        source: "rsi",
        kind: "image",
      },
      rsi("RSI_Perseus_ImageGraphicsLines.png"),
      rsi("Mfr_rsi_perseus_logo_white_4k_lockup_ONLY.png"),
      rsi("Mfr_rsi_perseus_logo_white_4k.png"),
      rsi("Star_Citizen_32_9_SALES_-BANNER.jpg"),
      rsi("Interior_1.jpg"),
      rsi("Interior_2.jpg"),
      rsi("Interior_3.jpg"),
      rsi("Interior_4.jpg"),
      rsi("Interior_5.jpg"),
      rsi("Interior_6.jpg"),
      rsi("1_CaptainsQuarters-Copy.png"),
      rsi("2_CrewQuarters-Copy.png"),
      rsi("3_MessHall-Copy.png"),
      rsi("4_CargoHold-Copy.png"),
      rsi("5_TorpedoRoom-Copy.png"),
      rsi("6_EngineeringBay-Copy.png"),
      {
        file: "render-1.jpg",
        url: "https://media.robertsspaceindustries.com/6v4oym2us4593/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "render-2.jpg",
        url: "https://media.robertsspaceindustries.com/dn1znbvbi0ye7/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "render-3.jpg",
        url: "https://media.robertsspaceindustries.com/gi1um1s4397k8/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "render-4.jpg",
        url: "https://media.robertsspaceindustries.com/p8adoopsyj2d0/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "render-5.jpg",
        url: "https://media.robertsspaceindustries.com/3zluawdf1dwb2/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "render-6.jpg",
        url: "https://media.robertsspaceindustries.com/j2id7c8bjhcpb/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "render-7.jpg",
        url: "https://media.robertsspaceindustries.com/px8nwq4rorl2d/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "render-8.jpg",
        url: "https://media.robertsspaceindustries.com/xlmhh1k4zzv9l/source.jpg",
        source: "rsi",
        kind: "image",
      },
      {
        file: "perseus_flight_holo_lite.glb",
        url: "https://api.fleetyards.net/files/blobs/redirect/eyJfcmFpbHMiOnsiZGF0YSI6ImEzY2IyY2YzLTdkNzktNDkxNi1hMTlmLTQwOWQzYmQ2M2Y2NSIsInB1ciI6ImJsb2JfaWQifX0=--505e7ee193c35c9bac41972a87de00088db7c9c5/flight_holo_lite.glb/",
        source: "fleetyards",
        kind: "model",
      },
    ],
    layout: {
      roles: {
        header: "Perseus_HEADER.jpg",
        poster: "matrix-wallpaper.jpg",
      },
      chapters: [
        { heading: "A FORCE FOR THE FUTURE" },
        {
          heading: "ALL-ROUND PERFORMANCE",
          image: "Star_Citizen_32_9_SALES_-BANNER.jpg",
        },
        { heading: "FRONTAL ASSAULT", image: "matrix-wallpaper.jpg" },
        { heading: "INTERIOR MOTIVE", image: "render-2.jpg" },
      ],
      gallery: [
        "render-3.jpg",
        "render-4.jpg",
        "render-5.jpg",
        "render-6.jpg",
        "render-7.jpg",
        "Interior_1.jpg",
      ],
      schematics: [],
    },
  },
];

export const CREDITS: Readonly<Record<ShowcaseSource, string>> = {
  rsi: "Roberts Space Industries",
  fleetyards:
    "3D model: CIG's in-game holoviewer model, converted by FleetYards.net",
};
