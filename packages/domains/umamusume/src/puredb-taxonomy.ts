/**
 * PureDB Umamusume Taxonomy & Search Generator
 *
 * Authoritative taxonomy definitions, factor IDs, card masters, and search URL encoder
 * for uma.pure-db.com parent/factor search.
 */

export interface PureDbCard {
  id: number;
  characterId: number;
  name: string;
  rarity: number;
}

export interface PureDbSupportCard {
  id: number;
  name: string;
  rarity: number;
  commandId: number;
}

export interface PureDbFactorItem {
  value: number;
  label: string;
}

export interface PureDbFactorQuery {
  groupId: number;
  count: number;
  searchType: number; // 0 = All, 1 = Representative, 2 = Inheritance
}

export interface PureDbSearchCriteria {
  gameServerCode?: "global" | "japan";
  partnerCardIds?: number[];
  supportCardId?: number;
  supportCardLimitBreak?: number; // 0..4
  excludeCardIds?: number[];
  excludeCardSearchType?: number;
  blueFactors?: PureDbFactorQuery[];
  redFactors?: PureDbFactorQuery[];
  greenFactors?: PureDbFactorQuery[];
  commonSkillFactors?: PureDbFactorQuery[];
  raceFactors?: PureDbFactorQuery[];
  scenarioFactors?: PureDbFactorQuery[];
  otherFactors?: PureDbFactorQuery[];
  whiteFactorCountConditions?: any[];
  winCount?: number;
  g1WinCount?: number;
  searchCount?: number;
  excludeFullFollowerUser?: boolean;
  excludeArchivedChara?: boolean;
}

export const BLUE_FACTORS: Record<string, { groupId: number; name: string; emoji: string }> = {
  speed:   { groupId: 1, name: "Speed", emoji: "⚡" },
  stamina: { groupId: 2, name: "Stamina", emoji: "❤️" },
  power:   { groupId: 3, name: "Power", emoji: "💪" },
  guts:    { groupId: 4, name: "Guts", emoji: "🔥" },
  wisdom:  { groupId: 5, name: "Wisdom", emoji: "🧠" },
  any:     { groupId: 6, name: "Any Blue Factor", emoji: "✨" },
};

export const RED_FACTORS: Record<string, { groupId: number; name: string; emoji: string; category: string }> = {
  turf:      { groupId: 11, name: "Turf Track", emoji: "🌱", category: "Track" },
  dirt:      { groupId: 12, name: "Dirt Track", emoji: "🏜️", category: "Track" },
  short:     { groupId: 31, name: "Sprint (Short)", emoji: "⚡", category: "Distance" },
  mile:      { groupId: 32, name: "Mile", emoji: "🏃", category: "Distance" },
  middle:    { groupId: 33, name: "Middle", emoji: "🏆", category: "Distance" },
  long:      { groupId: 34, name: "Long", emoji: "🏔️", category: "Distance" },
  runner:    { groupId: 21, name: "Front (Runner)", emoji: "🥇", category: "Style" },
  leading:   { groupId: 22, name: "Pace (Leading)", emoji: "🥈", category: "Style" },
  betweener: { groupId: 23, name: "Late (Betweener)", emoji: "🥉", category: "Style" },
  chaser:    { groupId: 24, name: "End (Chaser)", emoji: "⚡", category: "Style" },
};

export const SCENARIO_FACTORS: Record<string, { groupId: number; name: string; emoji: string }> = {
  ura:           { groupId: 30001, name: "URA Finale", emoji: "🏆" },
  unity:         { groupId: 30002, name: "Unity Cup (Aoharu)", emoji: "⚡" },
  climax:        { groupId: 30003, name: "TS Climax Scenario", emoji: "👑" },
  grand_concert: { groupId: 30004, name: "Our Grand Concert (Grand Live)", emoji: "🎵" },
};

export const PURE_DB_CARDS: PureDbCard[] = [
  {
    "id": 100101,
    "characterId": 1001,
    "name": "[Special Dreamer]Special Week",
    "rarity": 3
  },
  {
    "id": 100102,
    "characterId": 1001,
    "name": "[Hopp'n♪Happy Heart]Special Week",
    "rarity": 3
  },
  {
    "id": 100103,
    "characterId": 1001,
    "name": "[Ruler of Japan]Special Week",
    "rarity": 3
  },
  {
    "id": 100201,
    "characterId": 1002,
    "name": "[Innocent Silence]Silence Suzuka",
    "rarity": 3
  },
  {
    "id": 100301,
    "characterId": 1003,
    "name": "[Peak Joy]Tokai Teio",
    "rarity": 3
  },
  {
    "id": 100302,
    "characterId": 1003,
    "name": "[Beyond the Horizon]Tokai Teio",
    "rarity": 3
  },
  {
    "id": 100401,
    "characterId": 1004,
    "name": "[Formula R]Maruzensky",
    "rarity": 3
  },
  {
    "id": 100402,
    "characterId": 1004,
    "name": "[Hot☆Summer Night]Maruzensky",
    "rarity": 3
  },
  {
    "id": 100501,
    "characterId": 1005,
    "name": "[Shooting Star Revue]Fuji Kiseki",
    "rarity": 3
  },
  {
    "id": 100502,
    "characterId": 1005,
    "name": "[Succès Étoilé]Fuji Kiseki",
    "rarity": 3
  },
  {
    "id": 100601,
    "characterId": 1006,
    "name": "[Starlight Beat]Oguri Cap",
    "rarity": 3
  },
  {
    "id": 100602,
    "characterId": 1006,
    "name": "[Ashen Miracle]Oguri Cap",
    "rarity": 3
  },
  {
    "id": 100701,
    "characterId": 1007,
    "name": "[Red Strife]Gold Ship",
    "rarity": 2
  },
  {
    "id": 100702,
    "characterId": 1007,
    "name": "[RUN! RUIN! LAUNCHER!]Gold Ship",
    "rarity": 3
  },
  {
    "id": 100801,
    "characterId": 1008,
    "name": "[Wild Top Gear]Vodka",
    "rarity": 2
  },
  {
    "id": 100901,
    "characterId": 1009,
    "name": "[Peak Blue]Daiwa Scarlet",
    "rarity": 2
  },
  {
    "id": 101001,
    "characterId": 1010,
    "name": "[Wild Frontier]Taiki Shuttle",
    "rarity": 3
  },
  {
    "id": 101002,
    "characterId": 1010,
    "name": "[Bubblegum☆Memories]Taiki Shuttle",
    "rarity": 3
  },
  {
    "id": 101101,
    "characterId": 1011,
    "name": "[Stone-Piercing Blue]Grass Wonder",
    "rarity": 2
  },
  {
    "id": 101102,
    "characterId": 1011,
    "name": "[Saintly Jade Cleric]Grass Wonder",
    "rarity": 3
  },
  {
    "id": 101201,
    "characterId": 1012,
    "name": "[Azure Amazon]Hishi Amazon",
    "rarity": 3
  },
  {
    "id": 101301,
    "characterId": 1013,
    "name": "[Frontline Elegance]Mejiro McQueen",
    "rarity": 3
  },
  {
    "id": 101302,
    "characterId": 1013,
    "name": "[End of the Skies]Mejiro McQueen",
    "rarity": 3
  },
  {
    "id": 101303,
    "characterId": 1013,
    "name": "[Fair Lady of the Waves]Mejiro McQueen",
    "rarity": 3
  },
  {
    "id": 101401,
    "characterId": 1014,
    "name": "[El☆Número 1]El Condor Pasa",
    "rarity": 2
  },
  {
    "id": 101402,
    "characterId": 1014,
    "name": "[Kukulkan Warrior]El Condor Pasa",
    "rarity": 3
  },
  {
    "id": 101501,
    "characterId": 1015,
    "name": "[O Sole Suo!]T.M. Opera O",
    "rarity": 3
  },
  {
    "id": 101502,
    "characterId": 1015,
    "name": "[New Year, Same Radiance!]T.M. Opera O",
    "rarity": 3
  },
  {
    "id": 101601,
    "characterId": 1016,
    "name": "[Maverick]Narita Brian",
    "rarity": 3
  },
  {
    "id": 101701,
    "characterId": 1017,
    "name": "[Emperor's Path]Symboli Rudolf",
    "rarity": 3
  },
  {
    "id": 101702,
    "characterId": 1017,
    "name": "[Archer by Moonlight]Symboli Rudolf",
    "rarity": 3
  },
  {
    "id": 101801,
    "characterId": 1018,
    "name": "[Empress Road]Air Groove",
    "rarity": 2
  },
  {
    "id": 101802,
    "characterId": 1018,
    "name": "[Quercus Civilis]Air Groove",
    "rarity": 3
  },
  {
    "id": 101901,
    "characterId": 1019,
    "name": "[Full-Color Fangirling]Agnes Digital",
    "rarity": 3
  },
  {
    "id": 101902,
    "characterId": 1019,
    "name": "[Fanatic♡Jiangshi]Agnes Digital",
    "rarity": 3
  },
  {
    "id": 102001,
    "characterId": 1020,
    "name": "[Reeling in the Big One]Seiun Sky",
    "rarity": 3
  },
  {
    "id": 102002,
    "characterId": 1020,
    "name": "[Soirée des Chatons]Seiun Sky",
    "rarity": 3
  },
  {
    "id": 102101,
    "characterId": 1021,
    "name": "[Fast as Lightning]Tamamo Cross",
    "rarity": 3
  },
  {
    "id": 102201,
    "characterId": 1022,
    "name": "[Noble Seamair]Fine Motion",
    "rarity": 3
  },
  {
    "id": 102202,
    "characterId": 1022,
    "name": "[Titania]Fine Motion",
    "rarity": 3
  },
  {
    "id": 102301,
    "characterId": 1023,
    "name": "[pf. Winning Equation...]Biwa Hayahide",
    "rarity": 3
  },
  {
    "id": 102302,
    "characterId": 1023,
    "name": "[Rouge Caroler]Biwa Hayahide",
    "rarity": 3
  },
  {
    "id": 102401,
    "characterId": 1024,
    "name": "[Scramble☆Zone]Mayano Top Gun",
    "rarity": 2
  },
  {
    "id": 102402,
    "characterId": 1024,
    "name": "[Sunlight Bouquet]Mayano Top Gun",
    "rarity": 3
  },
  {
    "id": 102501,
    "characterId": 1025,
    "name": "[Creeping Shadow]Manhattan Cafe",
    "rarity": 3
  },
  {
    "id": 102601,
    "characterId": 1026,
    "name": "[MB-19890425]Mihono Bourbon",
    "rarity": 3
  },
  {
    "id": 102602,
    "characterId": 1026,
    "name": "[CODE: ICING]Mihono Bourbon",
    "rarity": 3
  },
  {
    "id": 102701,
    "characterId": 1027,
    "name": "[Down the Line]Mejiro Ryan",
    "rarity": 1
  },
  {
    "id": 102801,
    "characterId": 1028,
    "name": "[Buono ☆ Alla Moda]Hishi Akebono",
    "rarity": 3
  },
  {
    "id": 102901,
    "characterId": 1029,
    "name": "[Darl'n Snowflake]Yukino Bijin",
    "rarity": 3
  },
  {
    "id": 103001,
    "characterId": 1030,
    "name": "[Rosy Dreams]Rice Shower",
    "rarity": 3
  },
  {
    "id": 103002,
    "characterId": 1030,
    "name": "[Vampire Makeover!]Rice Shower",
    "rarity": 3
  },
  {
    "id": 103101,
    "characterId": 1031,
    "name": "[Always Electrifying]Ines Fujin",
    "rarity": 3
  },
  {
    "id": 103201,
    "characterId": 1032,
    "name": "[tach-nology]Agnes Tachyon",
    "rarity": 1
  },
  {
    "id": 103301,
    "characterId": 1033,
    "name": "[Starry Nocturne]Admire Vega",
    "rarity": 3
  },
  {
    "id": 103401,
    "characterId": 1034,
    "name": "[Edomurasaki]Inari One",
    "rarity": 3
  },
  {
    "id": 103501,
    "characterId": 1035,
    "name": "[Get to Winning!]Winning Ticket",
    "rarity": 1
  },
  {
    "id": 103502,
    "characterId": 1035,
    "name": "[Dream Deliverer]Winning Ticket",
    "rarity": 3
  },
  {
    "id": 103601,
    "characterId": 1036,
    "name": "[unsigned]Air Shakur",
    "rarity": 3
  },
  {
    "id": 103701,
    "characterId": 1037,
    "name": "[Meisterschaft]Eishin Flash",
    "rarity": 3
  },
  {
    "id": 103702,
    "characterId": 1037,
    "name": "[Precise Chocolatier]Eishin Flash",
    "rarity": 3
  },
  {
    "id": 103801,
    "characterId": 1038,
    "name": "[Fille Éclair]Curren Chan",
    "rarity": 3
  },
  {
    "id": 103802,
    "characterId": 1038,
    "name": "[Ma Chérie of the New Moon]Curren Chan",
    "rarity": 3
  },
  {
    "id": 103901,
    "characterId": 1039,
    "name": "[Princess of Pink]Kawakami Princess",
    "rarity": 3
  },
  {
    "id": 104001,
    "characterId": 1040,
    "name": "[Authentic / 1928]Gold City",
    "rarity": 3
  },
  {
    "id": 104002,
    "characterId": 1040,
    "name": "[Autumn Cosmos]Gold City",
    "rarity": 3
  },
  {
    "id": 104101,
    "characterId": 1041,
    "name": "[Blossom in Learning]Sakura Bakushin O",
    "rarity": 1
  },
  {
    "id": 104201,
    "characterId": 1042,
    "name": "[Rocket☆Star]Seeking the Pearl",
    "rarity": 3
  },
  {
    "id": 104401,
    "characterId": 1044,
    "name": "[Platanus Witch]Sweep Tosho",
    "rarity": 3
  },
  {
    "id": 104501,
    "characterId": 1045,
    "name": "[Murmuring Stream]Super Creek",
    "rarity": 2
  },
  {
    "id": 104502,
    "characterId": 1045,
    "name": "[Chiffon-Wrapped Mummy]Super Creek",
    "rarity": 3
  },
  {
    "id": 104601,
    "characterId": 1046,
    "name": "[LOVE☆4EVER]Smart Falcon",
    "rarity": 3
  },
  {
    "id": 104602,
    "characterId": 1046,
    "name": "[Twilight Triumph]Smart Falcon",
    "rarity": 3
  },
  {
    "id": 104801,
    "characterId": 1048,
    "name": "[Jokester ☆ Vibes]Tosen Jordan",
    "rarity": 3
  },
  {
    "id": 105001,
    "characterId": 1050,
    "name": "[Nevertheless]Narita Taishin",
    "rarity": 3
  },
  {
    "id": 105002,
    "characterId": 1050,
    "name": "[Difference Engineer]Narita Taishin",
    "rarity": 3
  },
  {
    "id": 105101,
    "characterId": 1051,
    "name": "[Layered Petals]Nishino Flower",
    "rarity": 3
  },
  {
    "id": 105201,
    "characterId": 1052,
    "name": "[Bestest Prize ♪]Haru Urara",
    "rarity": 1
  },
  {
    "id": 105202,
    "characterId": 1052,
    "name": "[New Year ♪ New Urara!]Haru Urara",
    "rarity": 3
  },
  {
    "id": 105301,
    "characterId": 1053,
    "name": "[Iron Ambition]Bamboo Memory",
    "rarity": 3
  },
  {
    "id": 105601,
    "characterId": 1056,
    "name": "[Rising☆Fortune]Matikanefukukitaru",
    "rarity": 1
  },
  {
    "id": 105602,
    "characterId": 1056,
    "name": "[Lucky Tidings]Matikanefukukitaru",
    "rarity": 3
  },
  {
    "id": 105801,
    "characterId": 1058,
    "name": "[Turbulent Blue]Meisho Doto",
    "rarity": 3
  },
  {
    "id": 105802,
    "characterId": 1058,
    "name": "[Dot-o'-Lantern]Meisho Doto",
    "rarity": 3
  },
  {
    "id": 105901,
    "characterId": 1059,
    "name": "[Off the Line]Mejiro Dober",
    "rarity": 3
  },
  {
    "id": 105902,
    "characterId": 1059,
    "name": "[Sapphire Sojourn]Mejiro Dober",
    "rarity": 3
  },
  {
    "id": 106001,
    "characterId": 1060,
    "name": "[Poinsettia Ribbon]Nice Nature",
    "rarity": 1
  },
  {
    "id": 106002,
    "characterId": 1060,
    "name": "[Run & Win]Nice Nature",
    "rarity": 3
  },
  {
    "id": 106101,
    "characterId": 1061,
    "name": "[King of Emeralds]King Halo",
    "rarity": 1
  },
  {
    "id": 106102,
    "characterId": 1061,
    "name": "[Cheerleader in Noble White]King Halo",
    "rarity": 3
  },
  {
    "id": 106201,
    "characterId": 1062,
    "name": "[Clippety-Tippety-Clop]Matikanetannhauser",
    "rarity": 2
  },
  {
    "id": 106401,
    "characterId": 1064,
    "name": "[Line Breakthrough]Mejiro Palmer",
    "rarity": 3
  },
  {
    "id": 106701,
    "characterId": 1067,
    "name": "[Natural Brilliance]Satono Diamond",
    "rarity": 3
  },
  {
    "id": 106801,
    "characterId": 1068,
    "name": "[Gilded Shrine to Glory]Kitasan Black",
    "rarity": 3
  },
  {
    "id": 106901,
    "characterId": 1069,
    "name": "[Strength in Full Bloom]Sakura Chiyono O",
    "rarity": 3
  },
  {
    "id": 107101,
    "characterId": 1071,
    "name": "[Crystalline]Mejiro Ardan",
    "rarity": 3
  },
  {
    "id": 107201,
    "characterId": 1072,
    "name": "[Blazed Head, Covered Fists]Yaeno Muteki",
    "rarity": 3
  },
  {
    "id": 107401,
    "characterId": 1074,
    "name": "[Brunissage Line]Mejiro Bright",
    "rarity": 3
  },
  {
    "id": 108701,
    "characterId": 1087,
    "name": "[Flare]Aston Machan",
    "rarity": 3
  },
  {
    "id": 109801,
    "characterId": 1098,
    "name": "[Eightfold☆Fortune]Copano Rickey",
    "rarity": 3
  }
];

export const PURE_DB_SUPPORT_CARDS: PureDbSupportCard[] = [
  {
    "id": 30001,
    "name": "[The Brightest Star in Japan!] Special Week",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30002,
    "name": "[Beyond This Shining Moment] Silence Suzuka",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30003,
    "name": "[Dream Big!] Tokai Teio",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30004,
    "name": "[Breakaway Battleship] Gold Ship",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30005,
    "name": "[Wild Rider] Vodka",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30006,
    "name": "[Fairest Fleur] Grass Wonder",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30007,
    "name": "[Champion's Passion] El Condor Pasa",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30008,
    "name": "[Foolproof Plan] Seiun Sky",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30009,
    "name": "[Split the Sky, White Lightning!] Tamamo Cross",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30010,
    "name": "[Wave of Gratitude] Fine Motion",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30011,
    "name": "[Watch My Star Fly!] Ines Fujin",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30012,
    "name": "[BNWinner!] Winning Ticket",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30013,
    "name": "[7 More Centimeters] Air Shakur",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30014,
    "name": "[Run(my)way] Gold City",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30015,
    "name": "[Eat Fast! Yum Fast!] Sakura Bakushin O",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30016,
    "name": "[Piece of Mind] Super Creek",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30017,
    "name": "[My Umadol Way! ☆] Smart Falcon",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30018,
    "name": "[Even the Littlest Bud] Nishino Flower",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30019,
    "name": "[Urara's Day Off!] Haru Urara",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30020,
    "name": "[Double Carrot Punch!] Biko Pegasus",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30021,
    "name": "[Tracen Reception] Tazuna Hayakawa",
    "rarity": 3,
    "commandId": 0
  },
  {
    "id": 30022,
    "name": "[Your Team Ace] Mejiro McQueen",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30023,
    "name": "[Showered in Joy] Rice Shower",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30024,
    "name": "[Get Lots of Hugs for Me] Oguri Cap",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30025,
    "name": "[The Setting Sun and Rising Stars] Special Week",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30026,
    "name": "[Turbo Booooost!] Twin Turbo",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30027,
    "name": "[Go Ahead and Laugh] Mejiro Palmer",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30028,
    "name": "[Fire at My Heels] Kitasan Black",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30029,
    "name": "[The Will to Overtake] Satono Diamond",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30030,
    "name": "[Just Keep Going] Matikanetannhauser",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30031,
    "name": "[Hometown Cheers] Yukino Bijin",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30032,
    "name": "[Fiery Discipline] Yaeno Muteki",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30033,
    "name": "[Dreams <I>Do</I> Come True!] Winning Ticket",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30034,
    "name": "[Happiness Just around the Bend] Rice Shower",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30036,
    "name": "[Planned Perfection] Riko Kashimoto",
    "rarity": 3,
    "commandId": 0
  },
  {
    "id": 30038,
    "name": "[Peak Sakura Season] Sakura Chiyono O",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30039,
    "name": "[Princess Bride] Kawakami Princess",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30040,
    "name": "[Who Wants the First Bite?] Hishi Akebono",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30041,
    "name": "[My Thoughts, My Desires] Mejiro Dober",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30042,
    "name": "[Head-on Fight!] Bamboo Memory",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30043,
    "name": "[43, 8, 1] Nakayama Festa",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30044,
    "name": "[Two Pieces] Narita Brian",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30045,
    "name": "[It's All Mine!] Sweep Tosho",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30046,
    "name": "[Full-Blown Tantrum] Winning Ticket",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30047,
    "name": "[Mini☆Vacation] Daiwa Scarlet",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30048,
    "name": "[Winning Pitch] Mejiro Ryan",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30052,
    "name": "[From the Ground Up] Light Hello",
    "rarity": 3,
    "commandId": 0
  },
  {
    "id": 30053,
    "name": "[Hands Up, Crook!] Taiki Shuttle",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30054,
    "name": "[Daring to Dream] Nice Nature",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30055,
    "name": "[Paint the Sky Red] Seiun Sky",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30056,
    "name": "[Tonight, We Waltz] King Halo",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30057,
    "name": "[That Time I Became the Strongest] Gold Ship",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30058,
    "name": "[Regal Racers] Tokai Teio",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30059,
    "name": "[Fugue of Fortune] Mihono Bourbon",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30060,
    "name": "[Constellation of Stars] Twin Turbo",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30061,
    "name": "[Our Resounding Steps] Biwa Hayahide",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30062,
    "name": "[Winning Dream] Silence Suzuka",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30063,
    "name": "[Warm Heart, Soft Steps] Ikuno Dictus",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30064,
    "name": "[Beware! Halloween Night!] Tamamo Cross",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30065,
    "name": "[Magical Heroine] Zenno Rob Roy",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30066,
    "name": "[The Ghost Finds Halloween Magic] Mihono Bourbon",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30067,
    "name": "[Esteemed and Adored] Heirs to the Throne",
    "rarity": 3,
    "commandId": 0
  },
  {
    "id": 30068,
    "name": "[Cutie Pie with Shining Eyes] Curren Chan",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30069,
    "name": "[The Whistling Arrow's Taunt] Narita Brian",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30070,
    "name": "[Dancing Light into the Night] Yukino Bijin",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30071,
    "name": "[Make! Some! NOISE!] Daitaku Helios",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30072,
    "name": "[Party Formation] Mayano Top Gun",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30073,
    "name": "[Strict Shopper] Narita Taishin",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30074,
    "name": "[Dazzling Day in the Snow] Marvelous Sunday",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30075,
    "name": "[My Solo Spun in Spiraling Runs] Manhattan Cafe",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30076,
    "name": "[Searching for Unseen Sights] Silence Suzuka",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30077,
    "name": "[Lucky Star in the Sky] Admire Vega",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30078,
    "name": "[Touching Sleeves Is Good Luck! ♪] Matikanefukukitaru",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30079,
    "name": "[Leaping into the Unknown] Meisho Doto",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30080,
    "name": "[This Might Sting!] Sasami Anshinzawa",
    "rarity": 3,
    "commandId": 0
  },
  {
    "id": 30081,
    "name": "[Passing the Dream On] Team Sirius",
    "rarity": 3,
    "commandId": 0
  },
  {
    "id": 30082,
    "name": "[Little Cupcakes, Big Emotions] Nishino Flower",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30083,
    "name": "[Super! Sonic! Flower Power!] Sakura Bakushin O",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30084,
    "name": "[My Way] Tosen Jordan",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30085,
    "name": "[A Fan's Joy] Agnes Digital",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30086,
    "name": "[Peachy Silhouette] Narita Top Road",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30087,
    "name": "[Little by Little] Mejiro Bright",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30088,
    "name": "[Special Dreamers!] Satono Diamond",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30089,
    "name": "[A MORE MARVELOUS WORLD! ☆] Marvelous Sunday",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30090,
    "name": "[Enchaînement] Symboli Rudolf",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30091,
    "name": "[Escorte Étoile] Sirius Symboli",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30092,
    "name": "[Mag!c Number] Air Shakur",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30093,
    "name": "[Number 1 Outfit] Daiwa Scarlet",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30094,
    "name": "[Make These Feelings Reach You!] Bamboo Memory",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30095,
    "name": "[Cheer that Changed the World] Seeking the Pearl",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30096,
    "name": "[Go Go☆Princess!] Kawakami Princess",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30097,
    "name": "[Dear Mr. C.B.] Mr. C.B.",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30098,
    "name": "[Sunny Passion ♪] Haru Urara",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30099,
    "name": "[Beloved Orchid Bouquet] Ikuno Dictus",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30100,
    "name": "[Day I Dreamed Of] Rice Shower",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30101,
    "name": "[Q≠0] Agnes Tachyon",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30102,
    "name": "[Twinkle in Your Eyes ∞] El Condor Pasa",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30103,
    "name": "[Machitan☆Adventure] Matikanetannhauser",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30104,
    "name": "[\"Rhodonite and the Dreamstone\"] Zenno Rob Roy",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30105,
    "name": "[Take Hold of Our Dreams!] Special Week",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30106,
    "name": "[Tailwind to My Goals] Air Groove",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30107,
    "name": "[Sentimental Flare ♪] Maruzensky",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30108,
    "name": "[Trusting the Dice] Nakayama Festa",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30109,
    "name": "[A Good Heart Blossoms to Its Fullest] Sakura Chiyono O",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30110,
    "name": "[It's on the House] Manhattan Cafe",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30111,
    "name": "[Teio-Oo-Oo!!!] Tokai Teio",
    "rarity": 3,
    "commandId": 106
  },
  {
    "id": 30112,
    "name": "[TT Ignition!] Twin Turbo",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30113,
    "name": "[Uchronia Architect] Biwa Hayahide",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30114,
    "name": "[Ah, Such Majesty] Daiichi Ruby",
    "rarity": 3,
    "commandId": 102
  },
  {
    "id": 30115,
    "name": "[Moonlit Devil ♪] Mejiro Palmer",
    "rarity": 3,
    "commandId": 105
  },
  {
    "id": 30116,
    "name": "[Sunlit Angel ♪] Daitaku Helios",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30117,
    "name": "[Onwards, Demon Queen Lackeys!] Shinko Windy",
    "rarity": 3,
    "commandId": 103
  },
  {
    "id": 30121,
    "name": "[U & Me] Mihono Bourbon",
    "rarity": 3,
    "commandId": 101
  },
  {
    "id": 30145,
    "name": "[Welcome to Umayuru] Tanino Gimlet",
    "rarity": 3,
    "commandId": 102
  }
];

export const PURE_DB_GREEN_FACTORS: PureDbFactorItem[] = [
  {
    "value": 999999,
    "label": "Any (Green Factor)"
  },
  {
    "value": 100101,
    "label": "Shooting Star"
  },
  {
    "value": 100102,
    "label": "Dazzl'n ♪ Diver"
  },
  {
    "value": 100103,
    "label": "Dreams Donned with Pride!"
  },
  {
    "value": 100201,
    "label": "The View from the Lead Is Mine!"
  },
  {
    "value": 100301,
    "label": "Sky-High Teio Step"
  },
  {
    "value": 100302,
    "label": "Certain Victory"
  },
  {
    "value": 100401,
    "label": "Red Shift/LP1211-M"
  },
  {
    "value": 100402,
    "label": "A Kiss for Courage"
  },
  {
    "value": 100501,
    "label": "Lights of Vaudeville"
  },
  {
    "value": 100502,
    "label": "Ravissant"
  },
  {
    "value": 100601,
    "label": "Triumphant Pulse"
  },
  {
    "value": 100602,
    "label": "Festive Miracle"
  },
  {
    "value": 100701,
    "label": "Anchors Aweigh!"
  },
  {
    "value": 100702,
    "label": "564 Escapades"
  },
  {
    "value": 100801,
    "label": "Cut and Drive!"
  },
  {
    "value": 100901,
    "label": "Resplendent Red Ace"
  },
  {
    "value": 101001,
    "label": "Shooting for Victory!"
  },
  {
    "value": 101002,
    "label": "Joyful Voyage!"
  },
  {
    "value": 101101,
    "label": "Where There's a Will, There's a Way"
  },
  {
    "value": 101102,
    "label": "Superior Heal"
  },
  {
    "value": 101201,
    "label": "You and Me! One-on-One!"
  },
  {
    "value": 101301,
    "label": "The Duty of Dignity Calls"
  },
  {
    "value": 101302,
    "label": "Legacy of the Strong"
  },
  {
    "value": 101303,
    "label": "Your Smile Sparkles as the Waves"
  },
  {
    "value": 101401,
    "label": "Victoria por plancha ☆"
  },
  {
    "value": 101402,
    "label": "Condor's Fury"
  },
  {
    "value": 101501,
    "label": "This Dance Is for Vittoria!"
  },
  {
    "value": 101502,
    "label": "Barcarole of Blessings"
  },
  {
    "value": 101601,
    "label": "Shadow Break"
  },
  {
    "value": 101701,
    "label": "Behold Thine Emperor's Divine Might"
  },
  {
    "value": 101702,
    "label": "Arrows Whistle, Shadows Disperse"
  },
  {
    "value": 101801,
    "label": "Blazing Pride"
  },
  {
    "value": 101802,
    "label": "Eternal Moments"
  },
  {
    "value": 101901,
    "label": "OMG! (ﾟ∀ﾟ)  The Final Sprint! ☆"
  },
  {
    "value": 101902,
    "label": "THE MOE AAAA Thanks for My Life"
  },
  {
    "value": 102001,
    "label": "Angling and Scheming"
  },
  {
    "value": 102002,
    "label": "Break It Down!"
  },
  {
    "value": 102101,
    "label": "White Lightning Comin' Through!"
  },
  {
    "value": 102201,
    "label": "Fairy Tale"
  },
  {
    "value": 102202,
    "label": "Best day ever"
  },
  {
    "value": 102301,
    "label": "∴win Q.E.D."
  },
  {
    "value": 102302,
    "label": "Presents from X"
  },
  {
    "value": 102401,
    "label": "Flashy☆Landing"
  },
  {
    "value": 102402,
    "label": "Flowery☆Maneuver"
  },
  {
    "value": 102501,
    "label": "Chasing after You"
  },
  {
    "value": 102601,
    "label": "G00 1st. F∞;"
  },
  {
    "value": 102602,
    "label": "Operation Cacao"
  },
  {
    "value": 102701,
    "label": "Let's Pump Some Iron!"
  },
  {
    "value": 102801,
    "label": "YUMMY☆SPEED!"
  },
  {
    "value": 102901,
    "label": "Snow Bright, Snow Flight"
  },
  {
    "value": 103001,
    "label": "Blue Rose Closer"
  },
  {
    "value": 103002,
    "label": "Every Rose Has Its Fangs"
  },
  {
    "value": 103101,
    "label": "All Charged! It's Go Time!"
  },
  {
    "value": 103201,
    "label": "U=ma2"
  },
  {
    "value": 103301,
    "label": "Shooting Star of Dioskouroi"
  },
  {
    "value": 103401,
    "label": "Now We're Cruisin'!"
  },
  {
    "value": 103501,
    "label": "Our Ticket to Win!"
  },
  {
    "value": 103502,
    "label": "Ticket to Your Dreams!"
  },
  {
    "value": 103601,
    "label": "trigger:BEAT"
  },
  {
    "value": 103701,
    "label": "Schwarzes Schwert"
  },
  {
    "value": 103702,
    "label": "Guten Appetit ♪"
  },
  {
    "value": 103801,
    "label": "#LookatCurren"
  },
  {
    "value": 103802,
    "label": "One True Color"
  },
  {
    "value": 103901,
    "label": "A Princess Must Seize Victory!"
  },
  {
    "value": 104001,
    "label": "KEEP IT REAL."
  },
  {
    "value": 104002,
    "label": "Dancing in the Leaves"
  },
  {
    "value": 104101,
    "label": "Genius x Bakushin = Victory"
  },
  {
    "value": 104201,
    "label": "I'm Possible!"
  },
  {
    "value": 104401,
    "label": "Victory belongs to me—Strelitzia! ☆"
  },
  {
    "value": 104501,
    "label": "Pure Heart"
  },
  {
    "value": 104502,
    "label": "Give Mummy a Hug ♡"
  },
  {
    "value": 104601,
    "label": "SPARKLY☆STARDOM"
  },
  {
    "value": 104602,
    "label": "α-star*"
  },
  {
    "value": 104801,
    "label": "Pop & Polish"
  },
  {
    "value": 105001,
    "label": "Nemesis"
  },
  {
    "value": 105002,
    "label": "Hephaestus"
  },
  {
    "value": 105101,
    "label": "Budding Blossom"
  },
  {
    "value": 105201,
    "label": "Super-Duper Climax"
  },
  {
    "value": 105202,
    "label": "114th Time's the Charm"
  },
  {
    "value": 105301,
    "label": "Red-Hot Discipline!"
  },
  {
    "value": 105601,
    "label": "I See Victory in My Future!"
  },
  {
    "value": 105602,
    "label": "Bountiful Harvest"
  },
  {
    "value": 105801,
    "label": "I Never Goof Up!"
  },
  {
    "value": 105802,
    "label": "Spooky, Scary, Happy"
  },
  {
    "value": 105901,
    "label": "Moving Past, and Beyond"
  },
  {
    "value": 105902,
    "label": "Wherever This Wonder Leads"
  },
  {
    "value": 106001,
    "label": "Just a Little Farther!"
  },
  {
    "value": 106002,
    "label": "Go☆Go☆Goal!"
  },
  {
    "value": 106101,
    "label": "Prideful King"
  },
  {
    "value": 106102,
    "label": "Louder! Tracen Cheer!"
  },
  {
    "value": 106201,
    "label": "Go, Go, Mun!"
  },
  {
    "value": 106401,
    "label": "Keep Pushing Ahead"
  },
  {
    "value": 106701,
    "label": "Eternal Encompassing Shine"
  },
  {
    "value": 106801,
    "label": "Victory Cheer!"
  },
  {
    "value": 106901,
    "label": "Ambition to Surpass the Sakura"
  },
  {
    "value": 107101,
    "label": "A Lifelong Dream, A Moment's Flight"
  },
  {
    "value": 107201,
    "label": "Peerless Dance of Flowering Flames"
  },
  {
    "value": 107401,
    "label": "Lovely Spring Breeze"
  },
  {
    "value": 108701,
    "label": "Silent Letter"
  },
  {
    "value": 109801,
    "label": "Luck Runs My Way"
  }
];

export const PURE_DB_RACE_FACTORS: PureDbFactorItem[] = [
  {
    "value": 10001,
    "label": "February S."
  },
  {
    "value": 10002,
    "label": "Takamatsunomiya Kinen"
  },
  {
    "value": 10003,
    "label": "Osaka Hai"
  },
  {
    "value": 10004,
    "label": "Oka Sho"
  },
  {
    "value": 10005,
    "label": "Satsuki Sho"
  },
  {
    "value": 10006,
    "label": "Tenno Sho (Spring)"
  },
  {
    "value": 10007,
    "label": "NHK Mile C."
  },
  {
    "value": 10008,
    "label": "Victoria Mile"
  },
  {
    "value": 10009,
    "label": "Japanese Oaks"
  },
  {
    "value": 10010,
    "label": "Japanese Derby"
  },
  {
    "value": 10011,
    "label": "Yasuda Kinen"
  },
  {
    "value": 10012,
    "label": "Takarazuka Kinen"
  },
  {
    "value": 10013,
    "label": "Sprinters S."
  },
  {
    "value": 10014,
    "label": "Shuka Sho"
  },
  {
    "value": 10015,
    "label": "Kikuka Sho"
  },
  {
    "value": 10016,
    "label": "Tenno Sho (Autumn)"
  },
  {
    "value": 10017,
    "label": "Queen Elizabeth II Cup"
  },
  {
    "value": 10018,
    "label": "Mile Ch."
  },
  {
    "value": 10019,
    "label": "Japan C."
  },
  {
    "value": 10020,
    "label": "Champions C."
  },
  {
    "value": 10021,
    "label": "Hanshin J.F."
  },
  {
    "value": 10022,
    "label": "Asahi Hai F.S."
  },
  {
    "value": 10023,
    "label": "Arima Kinen"
  },
  {
    "value": 10024,
    "label": "Hopeful S."
  },
  {
    "value": 10025,
    "label": "Teio Sho"
  },
  {
    "value": 10026,
    "label": "J.D. Derby"
  },
  {
    "value": 10027,
    "label": "JBC L. Classic"
  },
  {
    "value": 10028,
    "label": "JBC Sprint"
  },
  {
    "value": 10029,
    "label": "JBC Classic"
  },
  {
    "value": 10030,
    "label": "Tokyo Daishoten"
  },
  {
    "value": 10031,
    "label": "M.C. Nambu Hai"
  },
  {
    "value": 10032,
    "label": "Kashiwa Kinen"
  },
  {
    "value": 10033,
    "label": "Zen-Nippon Junior Yushun"
  },
  {
    "value": 10034,
    "label": "Kawasaki Kinen"
  }
];

export const PURE_DB_COMMON_SKILL_FACTORS: PureDbFactorItem[] = [
  {
    "value": 20001,
    "label": "Right-Handed ○"
  },
  {
    "value": 20002,
    "label": "Left-Handed ○"
  },
  {
    "value": 20003,
    "label": "Tokyo Racecourse ○"
  },
  {
    "value": 20004,
    "label": "Nakayama Racecourse ○"
  },
  {
    "value": 20005,
    "label": "Hanshin Racecourse ○"
  },
  {
    "value": 20006,
    "label": "Kyoto Racecourse ○"
  },
  {
    "value": 20007,
    "label": "Chukyo Racecourse ○"
  },
  {
    "value": 20008,
    "label": "Sapporo Racecourse ○"
  },
  {
    "value": 20009,
    "label": "Hakodate Racecourse ○"
  },
  {
    "value": 20010,
    "label": "Fukushima Racecourse ○"
  },
  {
    "value": 20011,
    "label": "Niigata Racecourse ○"
  },
  {
    "value": 20012,
    "label": "Kokura Racecourse ○"
  },
  {
    "value": 20013,
    "label": "Standard Distance ○"
  },
  {
    "value": 20014,
    "label": "Non-Standard Distance ○"
  },
  {
    "value": 20015,
    "label": "Firm Conditions ○"
  },
  {
    "value": 20016,
    "label": "Wet Conditions ○"
  },
  {
    "value": 20017,
    "label": "Spring Runner ○"
  },
  {
    "value": 20018,
    "label": "Summer Runner ○"
  },
  {
    "value": 20019,
    "label": "Fall Runner ○"
  },
  {
    "value": 20020,
    "label": "Winter Runner ○"
  },
  {
    "value": 20021,
    "label": "Sunny Days ○"
  },
  {
    "value": 20022,
    "label": "Cloudy Days ○"
  },
  {
    "value": 20023,
    "label": "Rainy Days ○"
  },
  {
    "value": 20024,
    "label": "Snowy Days ○"
  },
  {
    "value": 20025,
    "label": "Inner Post Proficiency ○"
  },
  {
    "value": 20026,
    "label": "Outer Post Proficiency ○"
  },
  {
    "value": 20027,
    "label": "Maverick ○"
  },
  {
    "value": 20028,
    "label": "Competitive Spirit ○"
  },
  {
    "value": 20029,
    "label": "Target in Sight ○"
  },
  {
    "value": 20030,
    "label": "Long Shot ○"
  },
  {
    "value": 20033,
    "label": "Corner Adept ○"
  },
  {
    "value": 20034,
    "label": "Corner Acceleration ○"
  },
  {
    "value": 20035,
    "label": "Corner Recovery ○"
  },
  {
    "value": 20036,
    "label": "Straightaway Adept"
  },
  {
    "value": 20037,
    "label": "Straightaway Acceleration"
  },
  {
    "value": 20038,
    "label": "Straightaway Recovery"
  },
  {
    "value": 20043,
    "label": "Focus"
  },
  {
    "value": 20044,
    "label": "Lay Low"
  },
  {
    "value": 20045,
    "label": "Prudent Positioning"
  },
  {
    "value": 20046,
    "label": "Ramp Up"
  },
  {
    "value": 20047,
    "label": "Pace Strategy"
  },
  {
    "value": 20048,
    "label": "Calm in a Crowd"
  },
  {
    "value": 20049,
    "label": "Nimble Navigator"
  },
  {
    "value": 20050,
    "label": "Go with the Flow"
  },
  {
    "value": 20051,
    "label": "Homestretch Haste"
  },
  {
    "value": 20053,
    "label": "Early Lead"
  },
  {
    "value": 20054,
    "label": "Fast-Paced"
  },
  {
    "value": 20055,
    "label": "Final Push"
  },
  {
    "value": 20056,
    "label": "Stamina to Spare"
  },
  {
    "value": 20057,
    "label": "Preferred Position"
  },
  {
    "value": 20058,
    "label": "Prepared to Pass"
  },
  {
    "value": 20059,
    "label": "Position Pilfer"
  },
  {
    "value": 20060,
    "label": "Slick Surge"
  },
  {
    "value": 20061,
    "label": "Outer Swell"
  },
  {
    "value": 20062,
    "label": "Standing By"
  },
  {
    "value": 20063,
    "label": "Masterful Gambit"
  },
  {
    "value": 20064,
    "label": "Straightaway Spurt"
  },
  {
    "value": 20065,
    "label": "Sprinting Gear"
  },
  {
    "value": 20066,
    "label": "Wait-and-See"
  },
  {
    "value": 20067,
    "label": "Gap Closer"
  },
  {
    "value": 20068,
    "label": "Productive Plan"
  },
  {
    "value": 20069,
    "label": "Watchful Eye"
  },
  {
    "value": 20070,
    "label": "Updrafters"
  },
  {
    "value": 20071,
    "label": "Rosy Outlook"
  },
  {
    "value": 20072,
    "label": "Up-Tempo"
  },
  {
    "value": 20073,
    "label": "Steadfast"
  },
  {
    "value": 20074,
    "label": "Deep Breaths"
  },
  {
    "value": 20075,
    "label": "Inside Scoop"
  },
  {
    "value": 20076,
    "label": "Extra Tank"
  },
  {
    "value": 20077,
    "label": "Trick (Front)"
  },
  {
    "value": 20078,
    "label": "Trick (Rear)"
  },
  {
    "value": 20079,
    "label": "Frenzied Front Runners"
  },
  {
    "value": 20080,
    "label": "Frenzied Pace Chasers"
  },
  {
    "value": 20081,
    "label": "Frenzied Late Surgers"
  },
  {
    "value": 20082,
    "label": "Frenzied End Closers"
  },
  {
    "value": 20083,
    "label": "Subdued Front Runners"
  },
  {
    "value": 20084,
    "label": "Flustered Front Runners"
  },
  {
    "value": 20085,
    "label": "Hesitant Front Runners"
  },
  {
    "value": 20086,
    "label": "Subdued Pace Chasers"
  },
  {
    "value": 20087,
    "label": "Flustered Pace Chasers"
  },
  {
    "value": 20088,
    "label": "Hesitant Pace Chasers"
  },
  {
    "value": 20089,
    "label": "Subdued Late Surgers"
  },
  {
    "value": 20090,
    "label": "Flustered Late Surgers"
  },
  {
    "value": 20091,
    "label": "Hesitant Late Surgers"
  },
  {
    "value": 20092,
    "label": "Subdued End Closers"
  },
  {
    "value": 20093,
    "label": "Flustered End Closers"
  },
  {
    "value": 20094,
    "label": "Hesitant End Closers"
  },
  {
    "value": 20095,
    "label": "Oi Racecourse ○"
  },
  {
    "value": 20096,
    "label": "Sprint Straightaways ○"
  },
  {
    "value": 20097,
    "label": "Sprint Corners ○"
  },
  {
    "value": 20098,
    "label": "Huge Lead"
  },
  {
    "value": 20099,
    "label": "Countermeasure"
  },
  {
    "value": 20100,
    "label": "Meticulous Measures"
  },
  {
    "value": 20101,
    "label": "Intimidate"
  },
  {
    "value": 20102,
    "label": "Stop Right There!"
  },
  {
    "value": 20103,
    "label": "Mile Straightaways ○"
  },
  {
    "value": 20104,
    "label": "Mile Corners ○"
  },
  {
    "value": 20105,
    "label": "Shifting Gears"
  },
  {
    "value": 20106,
    "label": "Acceleration"
  },
  {
    "value": 20107,
    "label": "Unyielding Spirit"
  },
  {
    "value": 20108,
    "label": "Speed Eater"
  },
  {
    "value": 20109,
    "label": "Opening Gambit"
  },
  {
    "value": 20110,
    "label": "Medium Straightaways ○"
  },
  {
    "value": 20111,
    "label": "Medium Corners ○"
  },
  {
    "value": 20112,
    "label": "Hawkeye"
  },
  {
    "value": 20113,
    "label": "Thunderbolt Step"
  },
  {
    "value": 20114,
    "label": "Soft Step"
  },
  {
    "value": 20115,
    "label": "Tether"
  },
  {
    "value": 20116,
    "label": "Murmur"
  },
  {
    "value": 20117,
    "label": "Long Straightaways ○"
  },
  {
    "value": 20118,
    "label": "Long Corners ○"
  },
  {
    "value": 20119,
    "label": "Keeping the Lead"
  },
  {
    "value": 20120,
    "label": "Passing Pro"
  },
  {
    "value": 20121,
    "label": "Pressure"
  },
  {
    "value": 20122,
    "label": "Stamina Eater"
  },
  {
    "value": 20123,
    "label": "Smoke Screen"
  },
  {
    "value": 20124,
    "label": "Front Runner Straightaways ○"
  },
  {
    "value": 20125,
    "label": "Front Runner Corners ○"
  },
  {
    "value": 20126,
    "label": "Dodging Danger"
  },
  {
    "value": 20127,
    "label": "Leader's Pride"
  },
  {
    "value": 20128,
    "label": "Moxie"
  },
  {
    "value": 20129,
    "label": "Second Wind"
  },
  {
    "value": 20130,
    "label": "Restart"
  },
  {
    "value": 20131,
    "label": "Pace Chaser Straightaways ○"
  },
  {
    "value": 20132,
    "label": "Pace Chaser Corners ○"
  },
  {
    "value": 20133,
    "label": "Shrewd Step"
  },
  {
    "value": 20134,
    "label": "Straight Descent"
  },
  {
    "value": 20135,
    "label": "Hydrate"
  },
  {
    "value": 20136,
    "label": "Tactical Tweak"
  },
  {
    "value": 20137,
    "label": "Disorient"
  },
  {
    "value": 20138,
    "label": "Late Surger Straightaways ○"
  },
  {
    "value": 20139,
    "label": "Late Surger Corners ○"
  },
  {
    "value": 20140,
    "label": "Fighter"
  },
  {
    "value": 20141,
    "label": "1,500,000 CC"
  },
  {
    "value": 20142,
    "label": "A Small Breather"
  },
  {
    "value": 20143,
    "label": "Studious"
  },
  {
    "value": 20144,
    "label": "Sharp Gaze"
  },
  {
    "value": 20145,
    "label": "End Closer Straightaways ○"
  },
  {
    "value": 20146,
    "label": "End Closer Corners ○"
  },
  {
    "value": 20147,
    "label": "I Can See Right Through You"
  },
  {
    "value": 20148,
    "label": "After-School Stroll"
  },
  {
    "value": 20149,
    "label": "Levelheaded"
  },
  {
    "value": 20150,
    "label": "Strategist"
  },
  {
    "value": 20151,
    "label": "Intense Gaze"
  },
  {
    "value": 20152,
    "label": "Front Runner Savvy ○"
  },
  {
    "value": 20153,
    "label": "Pace Chaser Savvy ○"
  },
  {
    "value": 20154,
    "label": "Late Surger Savvy ○"
  },
  {
    "value": 20155,
    "label": "End Closer Savvy ○"
  },
  {
    "value": 20156,
    "label": "Lucky Seven"
  },
  {
    "value": 20157,
    "label": "Triple 7s"
  },
  {
    "value": 20158,
    "label": "Highlander"
  },
  {
    "value": 20159,
    "label": "Uma Stan"
  },
  {
    "value": 20160,
    "label": "Groundwork"
  },
  {
    "value": 20161,
    "label": "Tail Held High"
  },
  {
    "value": 20162,
    "label": "Shake It Out"
  },
  {
    "value": 20163,
    "label": "Sympathy"
  },
  {
    "value": 20164,
    "label": "Lone Wolf"
  },
  {
    "value": 20165,
    "label": "Slipstream"
  },
  {
    "value": 20166,
    "label": "Playtime's Over!"
  },
  {
    "value": 20167,
    "label": "Top Pick"
  },
  {
    "value": 20168,
    "label": "Forward, March!"
  },
  {
    "value": 20169,
    "label": "Be Still"
  },
  {
    "value": 20170,
    "label": "All I've Got"
  },
  {
    "value": 20190,
    "label": "Head-On"
  },
  {
    "value": 20200,
    "label": "Familiar Ground"
  },
  {
    "value": 20201,
    "label": "Feature Act"
  },
  {
    "value": 20202,
    "label": "Early Start"
  },
  {
    "value": 20203,
    "label": "Risky Business"
  },
  {
    "value": 20204,
    "label": "Light as a Feather"
  },
  {
    "value": 20207,
    "label": "Free-Spirited"
  },
  {
    "value": 20208,
    "label": "Take the Chance"
  },
  {
    "value": 20209,
    "label": "Fighting Spirit"
  },
  {
    "value": 20210,
    "label": "Eager"
  },
  {
    "value": 20211,
    "label": "Pumped"
  },
  {
    "value": 20212,
    "label": "Fearless"
  },
  {
    "value": 20213,
    "label": "With All My Soul"
  },
  {
    "value": 20215,
    "label": "Full Throttle"
  },
  {
    "value": 20216,
    "label": "Restraint"
  },
  {
    "value": 20217,
    "label": "Downhill Speedster"
  },
  {
    "value": 20219,
    "label": "All Set"
  },
  {
    "value": 20220,
    "label": "Kawasaki Racecourse ○"
  },
  {
    "value": 20221,
    "label": "Funabashi Racecourse ○"
  },
  {
    "value": 20222,
    "label": "Morioka Racecourse ○"
  },
  {
    "value": 20223,
    "label": "Night Races ○"
  },
  {
    "value": 20224,
    "label": "Sharp Turns ○"
  },
  {
    "value": 20225,
    "label": "Collaborative Graded Races ○"
  },
  {
    "value": 20226,
    "label": "Sunny Sign"
  },
  {
    "value": 20227,
    "label": "Comeback"
  },
  {
    "value": 20228,
    "label": "Full Tilt"
  },
  {
    "value": 20229,
    "label": "Rational"
  },
  {
    "value": 20230,
    "label": "Down in the Dirt ○"
  },
  {
    "value": 20231,
    "label": "Got the Spirit!"
  },
  {
    "value": 20232,
    "label": "Rapid Gain"
  },
  {
    "value": 20233,
    "label": "Solid Steps"
  },
  {
    "value": 20234,
    "label": "Muddy ○"
  },
  {
    "value": 20235,
    "label": "Dust Cloud"
  },
  {
    "value": 20236,
    "label": "Oppression"
  },
  {
    "value": 20237,
    "label": "On the Attack"
  },
  {
    "value": 20238,
    "label": "Breakin' Out"
  },
  {
    "value": 20239,
    "label": "Mad Dash"
  },
  {
    "value": 20240,
    "label": "Leap Forward"
  },
  {
    "value": 20241,
    "label": "Aspire"
  },
  {
    "value": 20242,
    "label": "Scramble"
  },
  {
    "value": 20243,
    "label": "Steady Gait"
  },
  {
    "value": 20245,
    "label": "Pedal to the Metal"
  },
  {
    "value": 20246,
    "label": "Firm Resolve"
  },
  {
    "value": 20247,
    "label": "Latch On"
  },
  {
    "value": 20248,
    "label": "My True Strength"
  },
  {
    "value": 20250,
    "label": "No Looking Back"
  },
  {
    "value": 21001,
    "label": "Ignited Spirit SPD"
  },
  {
    "value": 21002,
    "label": "Ignited Spirit STA"
  },
  {
    "value": 21003,
    "label": "Ignited Spirit PWR"
  },
  {
    "value": 21004,
    "label": "Ignited Spirit GUTS"
  },
  {
    "value": 21005,
    "label": "Ignited Spirit WIT"
  },
  {
    "value": 21006,
    "label": "Glittering Star"
  },
  {
    "value": 21007,
    "label": "On the Way to Our Dream"
  },
  {
    "value": 21008,
    "label": "Racing Spirit: Speed"
  },
  {
    "value": 21009,
    "label": "Racing Spirit: Stamina"
  },
  {
    "value": 21010,
    "label": "Racing Spirit: Power"
  },
  {
    "value": 21011,
    "label": "Racing Spirit: Guts"
  },
  {
    "value": 21012,
    "label": "Racing Spirit: Wit"
  },
  {
    "value": 21013,
    "label": "Racing Spirit: Mood"
  },
  {
    "value": 21014,
    "label": "Racing Spirit: Speed +"
  },
  {
    "value": 21015,
    "label": "Racing Spirit: Stamina +"
  },
  {
    "value": 21016,
    "label": "Racing Spirit: Power +"
  },
  {
    "value": 21017,
    "label": "Racing Spirit: Guts +"
  },
  {
    "value": 21018,
    "label": "Racing Spirit: Wit +"
  },
  {
    "value": 21019,
    "label": "Racing Spirit: Mood +"
  },
  {
    "value": 21020,
    "label": "Eyes on the Goal"
  },
  {
    "value": 21021,
    "label": "Ignited Spirit: Speed +"
  },
  {
    "value": 21022,
    "label": "Ignited Spirit: Stamina +"
  },
  {
    "value": 21023,
    "label": "Ignited Spirit: Power +"
  },
  {
    "value": 21024,
    "label": "Ignited Spirit: Guts +"
  },
  {
    "value": 21025,
    "label": "Ignited Spirit: Wit +"
  }
];

/**
 * Builds an authoritative Pure-DB search URL for the given criteria.
 */
export function buildPureDbSearchUrl(criteria: PureDbSearchCriteria, locale: string = "en-us"): string {
  const payload = {
    gameServerCode: criteria.gameServerCode ?? "global",
    partnerCardIds: criteria.partnerCardIds ?? [],
    supportCardId: criteria.supportCardId ?? 0,
    supportCardLimitBreak: criteria.supportCardLimitBreak ?? 4,
    excludeCardIds: criteria.excludeCardIds ?? [],
    excludeCardSearchType: criteria.excludeCardSearchType ?? 0,
    blueFactors: criteria.blueFactors ?? [],
    redFactors: criteria.redFactors ?? [],
    greenFactors: criteria.greenFactors ?? [],
    commonSkillFactors: criteria.commonSkillFactors ?? [],
    raceFactors: criteria.raceFactors ?? [],
    scenarioFactors: criteria.scenarioFactors ?? [],
    otherFactors: criteria.otherFactors ?? [],
    whiteFactorCountConditions: criteria.whiteFactorCountConditions ?? [],
    winCount: criteria.winCount ?? 0,
    g1WinCount: criteria.g1WinCount ?? 0,
    searchCount: criteria.searchCount ?? 100,
    excludeFullFollowerUser: criteria.excludeFullFollowerUser ?? true,
    excludeArchivedChara: criteria.excludeArchivedChara ?? true,
  };

  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr, "utf-8").toString("base64");
  const encoded = encodeURIComponent(base64);
  return `https://uma.pure-db.com/${locale}/search?searchInfo=${encoded}`;
}

/**
 * Parses a pure-db URL or base64 searchInfo payload back into search criteria.
 */
export function parsePureDbSearchUrl(urlOrSearchInfo: string): PureDbSearchCriteria | null {
  try {
    let base64 = urlOrSearchInfo.trim();
    if (base64.includes("searchInfo=")) {
      const url = new URL(base64);
      base64 = url.searchParams.get("searchInfo") || "";
    }
    const decodedStr = Buffer.from(decodeURIComponent(base64), "base64").toString("utf-8");
    return JSON.parse(decodedStr);
  } catch {
    return null;
  }
}

/**
 * Autocomplete / Lookup search helper for characters.
 */
export function searchCharacters(query: string, limit = 25): { name: string; value: string; card: PureDbCard }[] {
  const q = query.toLowerCase().trim();
  const filtered = PURE_DB_CARDS.filter((c) => {
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || String(c.id).includes(q) || String(c.characterId).includes(q);
  });
  return filtered.slice(0, limit).map((c) => ({
    name: c.name,
    value: String(c.id),
    card: c,
  }));
}

/**
 * Autocomplete / Lookup search helper for green factors (unique skills).
 */
export function searchGreenFactors(query: string, limit = 25): { name: string; value: string; factor: PureDbFactorItem }[] {
  const q = query.toLowerCase().trim();
  const filtered = PURE_DB_GREEN_FACTORS.filter((f) => {
    if (!q) return true;
    return f.label.toLowerCase().includes(q) || String(f.value).includes(q);
  });
  return filtered.slice(0, limit).map((f) => ({
    name: f.label,
    value: String(f.value),
    factor: f,
  }));
}

/**
 * Autocomplete / Lookup search helper for G1 race factors.
 */
export function searchRaceFactors(query: string, limit = 25): { name: string; value: string; factor: PureDbFactorItem }[] {
  const q = query.toLowerCase().trim();
  const filtered = PURE_DB_RACE_FACTORS.filter((f) => {
    if (!q) return true;
    return f.label.toLowerCase().includes(q) || String(f.value).includes(q);
  });
  return filtered.slice(0, limit).map((f) => ({
    name: f.label,
    value: String(f.value),
    factor: f,
  }));
}

/**
 * Autocomplete / Lookup search helper for common skill factors.
 */
export function searchCommonSkills(query: string, limit = 25): { name: string; value: string; factor: PureDbFactorItem }[] {
  const q = query.toLowerCase().trim();
  const filtered = PURE_DB_COMMON_SKILL_FACTORS.filter((f) => {
    if (!q) return true;
    return f.label.toLowerCase().includes(q) || String(f.value).includes(q);
  });
  return filtered.slice(0, limit).map((f) => ({
    name: f.label,
    value: String(f.value),
    factor: f,
  }));
}

/**
 * Autocomplete / Lookup search helper for support cards.
 */
export function searchSupportCards(query: string, limit = 25): { name: string; value: string; card: PureDbSupportCard }[] {
  const q = query.toLowerCase().trim();
  const filtered = PURE_DB_SUPPORT_CARDS.filter((s) => {
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || String(s.id).includes(q);
  });
  return filtered.slice(0, limit).map((s) => ({
    name: s.name,
    value: String(s.id),
    card: s,
  }));
}
