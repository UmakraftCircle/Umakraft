import {
  PURE_DB_CARDS,
  PURE_DB_SUPPORT_CARDS,
  PureDbCard,
  PureDbSupportCard,
} from './puredb-taxonomy.js';

/**
 * Character Taxonomy Item definition containing rich game stats, aptitudes,
 * lore, voice actor (seiyuu), and external wiki references.
 */
export interface CharacterTaxonomyItem {
  canonical: string;
  aliases: string[];
  type: 'character';
  japaneseName?: string;
  voiceActor?: string;
  birthday?: string;
  epithet?: string;
  role?: string;
  realHorseHistory?: string;
  mediaAppearances?: string[];
  growthRates?: Record<string, string>;
  surfaceAptitudes?: Record<string, string>;
  distanceAptitudes?: Record<string, string>;
  strategyAptitudes?: Record<string, string>;
  uniqueSkill?: string;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
  pureDbCards?: PureDbCard[];
}

/**
 * Support Card Taxonomy Item definition containing card type, rarity,
 * key skills, training bonuses, and external references.
 */
export interface SupportCardTaxonomyItem {
  canonical: string;
  aliases: string[];
  type: 'support-card';
  japaneseName?: string;
  cardType: 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Intelligence' | 'Friend' | 'Group';
  rarity: 'SSR' | 'SR' | 'R';
  keySkills?: string[];
  keyBonuses?: string;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
  pureDbSupportCards?: PureDbSupportCard[];
}

export interface GenericTaxonomyItem {
  canonical: string;
  aliases: string[];
  type: 'character' | 'support-card' | 'skill' | 'track' | 'scenario' | 'media' | 'lore-entity';
  japaneseName?: string;
  gametoraUrl?: string;
  umamusuWikiUrl?: string;
  fandomWikiUrl?: string;
  metadata?: Record<string, any>;
}

export type TaxonomyEntity =
  | CharacterTaxonomyItem
  | SupportCardTaxonomyItem
  | GenericTaxonomyItem;

export interface FuzzySearchOptions {
  /** Maximum number of results to return (default: 10). */
  limit?: number;
  /** Minimum match score threshold from 0 to 100 (default: 30). */
  minScore?: number;
  /** Whether to cross-reference and attach matching PureDB card variants (default: true). */
  includePureDb?: boolean;
}

export interface TaxonomyFuzzySearchOptions extends FuzzySearchOptions {
  /** Filter results by specific entity type. */
  type?: 'character' | 'support-card' | 'skill' | 'track' | 'scenario' | 'media' | 'lore-entity' | 'all';
}

export interface FuzzySearchResult<T> {
  item: T;
  score: number;
  matchedField: string;
  matchedText: string;
  highlight: string;
  distance: number;
}

// ─────────────────────────────────────────────────────────────
// TAXONOMY DATASETS
// ─────────────────────────────────────────────────────────────

export const CHARACTERS_TAXONOMY_DATA: CharacterTaxonomyItem[] = [
  {
    canonical: 'Special Week',
    aliases: ['special week', 'spe-chan', 'spe', 'スペシャルウィーク', 'special dreamer', 'specialweek', 'spe chan'],
    type: 'character',
    japaneseName: 'スペシャルウィーク',
    voiceActor: 'Ayaka Ohashi (大橋彩香)',
    birthday: 'May 2',
    epithet: 'Special Dreamer / Japan Cup Hero',
    role: 'Medium/Long Pace Chaser & Leader (Golden Generation)',
    realHorseHistory: '1995–2018 (Sunday Silence x Campaign Girl). 4 G1 wins including 1998 Tokyo Yushun & 1999 Japan Cup. Orphaned at birth, raised by human foster mother.',
    mediaAppearances: ['Anime Season 1 (Lead Protagonist)', 'Anime Season 2', 'Anime Season 3', 'Umayon', 'Umayuru'],
    growthRates: { Stamina: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'F', Mile: 'A', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'B', End: 'C' },
    uniqueSkill: 'Shooting Star (シューティングスター)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/special-week',
    umamusuWikiUrl: 'https://umamusu.wiki/Special_Week',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Special_Week',
  },
  {
    canonical: 'Silence Suzuka',
    aliases: ['silence suzuka', 'suzuka', 'サイレンススズカ', 'great escape', 'dimension crossing runaway'],
    type: 'character',
    japaneseName: 'サイレンススズカ',
    voiceActor: 'Marika Kouno (高野麻里佳)',
    birthday: 'May 1',
    epithet: 'Dimension Crossing Runaway / The Great Escape',
    role: 'Mile/Medium Front Runner (Escape / Great Runaway)',
    realHorseHistory: '1994–1998 (Sunday Silence x Waheeda). Legendary front runner with 6 consecutive graded wins including 1998 Takarazuka Kinen. Suffered tragic fracture in 1998 Tenno Sho Autumn.',
    mediaAppearances: ['Anime Season 1 (Co-Lead)', 'Anime Season 2', 'Anime Season 3', 'Umayon', 'Umayuru'],
    growthRates: { Speed: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'D', Mile: 'A', Medium: 'A', Long: 'E' },
    strategyAptitudes: { Front: 'A', Pace: 'B', Late: 'F', End: 'G' },
    uniqueSkill: 'The View from the Lead is Mine! (先頭の景色は譲らない…！)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/silence-suzuka',
    umamusuWikiUrl: 'https://umamusu.wiki/Silence_Suzuka',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Silence_Suzuka',
  },
  {
    canonical: 'Tokai Teio',
    aliases: ['tokai teio', 'teio', 'トウカイテイオー', 'miracle of teio', 'emperor child'],
    type: 'character',
    japaneseName: 'トウカイテイオー',
    voiceActor: 'Machico',
    birthday: 'April 20',
    epithet: "Miracle of Teio / The Emperor's Prodigal Child",
    role: 'Medium/Long Pace Chaser & Leader',
    realHorseHistory: '1988–2013 (Symboli Rudolf x Tokai Natural). Undefeated 1991 Satsuki Sho & Tokyo Yushun winner. Overcame 3 major bone fractures to win 1993 Arima Kinen after a 364-day absence.',
    mediaAppearances: ['Anime Season 2 (Lead Protagonist)', 'Anime Season 1', 'Anime Season 3', 'Umayon', 'Umayuru'],
    growthRates: { Speed: '+20%', Stamina: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'F', Mile: 'E', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'F' },
    uniqueSkill: 'Sky-High Teio Step (究極テイオーステップ)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/tokai-teio',
    umamusuWikiUrl: 'https://umamusu.wiki/Tokai_Teio',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Tokai_Teio',
  },
  {
    canonical: 'Oguri Cap',
    aliases: ['oguri cap', 'oguri', 'オグリキャップ', 'monster of kasamatsu', 'gray monster', 'gray beast'],
    type: 'character',
    japaneseName: 'オグリキャップ',
    voiceActor: 'Tomoyo Takayanagi (高柳知葉)',
    birthday: 'March 27',
    epithet: 'The Monster of Kasamatsu / Gray Beast of Heisei',
    role: 'Mile/Medium Pace Chaser & Late Runner (Turf & Dirt Dual-Aptitude)',
    realHorseHistory: '1985–2010 (Silver Shark x White Naruko). Regional NAR Kasamatsu phenomenon transferred to JRA, igniting the Second Horse Racing Boom. Won 1988 & 1990 Arima Kinen and 1989 Mile CS.',
    mediaAppearances: ['Umamusume: Cinderella Gray (Lead Protagonist)', 'Anime Season 1', 'Anime Season 2', 'Anime Season 3'],
    growthRates: { Speed: '+20%', Power: '+20%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'B' },
    distanceAptitudes: { Short: 'E', Mile: 'A', Medium: 'A', Long: 'B' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'A', End: 'D' },
    uniqueSkill: 'Triumphant Pulse (勝利の鼓動)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/oguri-cap',
    umamusuWikiUrl: 'https://umamusu.wiki/Oguri_Cap',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Oguri_Cap',
  },
  {
    canonical: 'Gold Ship',
    aliases: ['gold ship', 'golshi', 'ゴールドシップ', 'unpredictable trickster'],
    type: 'character',
    japaneseName: 'ゴールドシップ',
    voiceActor: 'Hitomi Ueda (上田瞳)',
    birthday: 'March 6',
    epithet: 'The Unpredictable Trickster / Golden Warp',
    role: 'Medium/Long End Closer (Oikomi)',
    realHorseHistory: '2009–present (Stay Gold x Point Flag). 6 G1 victories including 2012 Satsuki Sho, Kikuka Sho, Arima Kinen, and 2x Takarazuka Kinen (2013, 2014). Renowned for eccentric antics.',
    mediaAppearances: ['Anime Seasons 1-3 (Team Spica Mainstay)', 'PakaTube! Official VTuber Host', 'Umayon', 'Umayuru'],
    growthRates: { Stamina: '+20%', Power: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'G', Pace: 'C', Late: 'A', End: 'A' },
    uniqueSkill: 'Anchors Aweigh! (波乱万丈)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/gold-ship',
    umamusuWikiUrl: 'https://umamusu.wiki/Gold_Ship',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Gold_Ship',
  },
  {
    canonical: 'Mejiro McQueen',
    aliases: ['mejiro mcqueen', 'mcqueen', 'メジロマックイーン', 'end of a dynasty', 'elegant lady'],
    type: 'character',
    japaneseName: 'メジロマックイーン',
    voiceActor: 'Saori Oonishi (大西沙織)',
    birthday: 'April 3',
    epithet: 'The End of a Dynasty / Noble Lady of Mejiro',
    role: 'Medium/Long Leader & Stayers King',
    realHorseHistory: '1987–2006 (Mejiro Titan x Mejiro Aurora). 4 G1 wins including 1990 Kikuka Sho, 1991 & 1992 Tenno Sho Spring, 1993 Takarazuka Kinen. Supreme stayers dynasty heir.',
    mediaAppearances: ['Anime Season 2 (Co-Lead)', 'Anime Season 1', 'Anime Season 3', 'Umayon', 'Umayuru'],
    growthRates: { Stamina: '+20%', Intelligence: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'E' },
    distanceAptitudes: { Short: 'G', Mile: 'F', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'G' },
    uniqueSkill: 'The Duty of Dignity Calls (貴顕の使命を果たすべく)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/mejiro-mcqueen',
    umamusuWikiUrl: 'https://umamusu.wiki/Mejiro_McQueen',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Mejiro_McQueen',
  },
  {
    canonical: 'Rice Shower',
    aliases: ['rice shower', 'rice', 'ライスシャワー', 'black assassin', 'hero assassin', 'blue rose'],
    type: 'character',
    japaneseName: 'ライスシャワー',
    voiceActor: 'Reina Ueda (上田麗奈)',
    birthday: 'March 5',
    epithet: 'The Blue Rose / Black Assassin Turned Hero',
    role: 'Medium/Long Leader & Pace Chaser',
    realHorseHistory: '1989–1995 (Real Shadai x Bamboo Slipper). 3 G1 titles: 1992 Kikuka Sho (broke Mihono Bourbon Triple Crown), 1993 & 1995 Tenno Sho Spring (broke McQueen 3-peat). Tragic fall in 1995 Takarazuka.',
    mediaAppearances: ['Anime Season 2 (Hero Arc)', 'Anime Season 1', 'Umayon', 'Umayuru'],
    growthRates: { Stamina: '+10%', Guts: '+20%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'E', Mile: 'C', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'G' },
    uniqueSkill: 'Blue Rose Closer (ブルーローズ・チェイサー)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/rice-shower',
    umamusuWikiUrl: 'https://umamusu.wiki/Rice_Shower',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Rice_Shower',
  },
  {
    canonical: 'Daiwa Scarlet',
    aliases: ['daiwa scarlet', 'dasuka', 'ダイワスカーレット', 'miss perfect'],
    type: 'character',
    japaneseName: 'ダイワスカーレット',
    voiceActor: 'Chisa Kimura (木村千咲)',
    birthday: 'May 13',
    epithet: 'Miss Perfect / Queen of Wire-to-Wire',
    role: 'Mile/Medium Leader & Front Runner',
    realHorseHistory: '2004–present (Agnes Tachyon x Scarlet Bouquet). 12 career starts finishing top-2 in every race. 4 G1 wins including 2007 Oka Sho, Shuka Sho, Queen Elizabeth II Cup, and 2008 Arima Kinen.',
    mediaAppearances: ['Anime Seasons 1-3 (Vodka Rivalry & Spica)', 'Umayon', 'Umayuru'],
    growthRates: { Speed: '+10%', Guts: '+20%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'F', Mile: 'A', Medium: 'A', Long: 'B' },
    strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'E', End: 'G' },
    uniqueSkill: 'Red Ace (ブリリアント・レッド・エース)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/daiwa-scarlet',
    umamusuWikiUrl: 'https://umamusu.wiki/Daiwa_Scarlet',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Daiwa_Scarlet',
  },
  {
    canonical: 'Vodka',
    aliases: ['vodka', 'ウオッカ', 'derby queen'],
    type: 'character',
    japaneseName: 'ウオッカ',
    voiceActor: 'Azumi Waki (和氣あず未)',
    birthday: 'April 4',
    epithet: 'The Derby Queen / Maverick Champion',
    role: 'Mile/Medium Late / Betweener',
    realHorseHistory: '2004–2019 (Tanino Gimlet x Tanino Sister). 7 G1 wins; first filly in 64 years to win the Tokyo Yushun (Japanese Derby) in 2007. Hall of Fame legend.',
    mediaAppearances: ['Anime Seasons 1-3 (Daiwa Scarlet Rivalry & Spica)', 'Umayon', 'Umayuru'],
    growthRates: { Power: '+20%', Speed: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'F' },
    distanceAptitudes: { Short: 'F', Mile: 'A', Medium: 'A', Long: 'F' },
    strategyAptitudes: { Front: 'G', Pace: 'B', Late: 'A', End: 'F' },
    uniqueSkill: 'Cutting Edge (カッティング×DRIVE!)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/vodka',
    umamusuWikiUrl: 'https://umamusu.wiki/Vodka',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Vodka',
  },
  {
    canonical: 'Twin Turbo',
    aliases: ['twin turbo', 'turbo', 'ツインターボ', 'never give up turbo', 'jet engine turbo'],
    type: 'character',
    japaneseName: 'ツインターボ',
    voiceActor: 'Miharu Hanai (花井美春)',
    birthday: 'April 13',
    epithet: 'The Never-Give-Up Runaway Jet Engine',
    role: 'Mile/Medium Full-Throttle Front Runner (Great Escape)',
    realHorseHistory: '1988–1998 (Lyphard\'s Special x Laser City). Renowned for reckless runaway escapes; won the 1993 Tanabata Sho and 1993 All Comers by massive margins. Major emotional catalyst in Anime Season 2.',
    mediaAppearances: ['Anime Season 2 (Team Canopus Heart)', 'Anime Season 3', 'Umayuru'],
    growthRates: { Speed: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'D', Mile: 'A', Medium: 'A', Long: 'G' },
    strategyAptitudes: { Front: 'A', Pace: 'G', Late: 'G', End: 'G' },
    uniqueSkill: 'Engine Full Throttle! (エンジン全開！大爆走！)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/twin-turbo',
    umamusuWikiUrl: 'https://umamusu.wiki/Twin_Turbo',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Twin_Turbo',
  },
  {
    canonical: 'Nice Nature',
    aliases: ['nice nature', 'nature', 'ナイスネイチャ', 'bronze collector'],
    type: 'character',
    japaneseName: 'ナイスネイチャ',
    voiceActor: 'Kaori Maeda (前田佳織里)',
    birthday: 'April 16',
    epithet: 'The Bronze Collector / Beloved Underdog',
    role: 'Medium/Long Late / Betweener & Debuff Specialist',
    realHorseHistory: '1988–2023 (Nice Dancer x Urakawa Miyuki). Famous for finishing 3rd in three consecutive Arima Kinen races (1991, 1992, 1993). Lived to the remarkable age of 35.',
    mediaAppearances: ['Anime Season 2 (Team Canopus Co-Lead)', 'Anime Season 1', 'Anime Season 3', 'Umayuru'],
    growthRates: { Power: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'C', Pace: 'A', Late: 'A', End: 'C' },
    uniqueSkill: 'Sparkle in the Eyes (きっとその先は…)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/nice-nature',
    umamusuWikiUrl: 'https://umamusu.wiki/Nice_Nature',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Nice_Nature',
  },
  {
    canonical: 'King Halo',
    aliases: ['king halo', 'king', 'キングヘイロー', 'refined prince'],
    type: 'character',
    japaneseName: 'キングヘイロー',
    voiceActor: 'Iori Saeki (佐伯伊織)',
    birthday: 'April 28',
    epithet: 'Refined Prince of High Pedigree / First-Class Lady',
    role: 'Short/Mile End Closer & Late Runner (Golden Generation)',
    realHorseHistory: '1995–2019 (Dancing Brave x Goodbye Halo). Royal bloodline prodigy who faced 10 G1 defeats before triumphing in the 2000 Takamatsunomiya Kinen.',
    mediaAppearances: ['Anime Season 1 (Team Spica / Golden Generation)', 'Anime Season 2', 'Anime Season 3', 'Umayon'],
    growthRates: { Power: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'A', Mile: 'B', Medium: 'B', Long: 'C' },
    strategyAptitudes: { Front: 'G', Pace: 'B', Late: 'A', End: 'A' },
    uniqueSkill: 'Call Me King (プライド仕込みのパッカプル)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/king-halo',
    umamusuWikiUrl: 'https://umamusu.wiki/King_Halo',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/King_Halo',
  },
  {
    canonical: 'Grass Wonder',
    aliases: ['grass wonder', 'grass', 'グラスワンダー', 'wonder of chestnut'],
    type: 'character',
    japaneseName: 'グラスワンダー',
    voiceActor: 'Rena Maeda (前田玲奈)',
    birthday: 'February 18',
    epithet: 'The Wonder of Chestnut Hair / Fierce Yamato Nadeshiko',
    role: 'Mile/Long Pace Chaser & Late Runner (Golden Generation)',
    realHorseHistory: '1995–2024 (Silver Hawk x Ameriflora). 4 G1 wins including 1997 Asahi Hai Sansai Stakes, 1998 & 1999 Takarazuka Kinen, and 1999 Arima Kinen defeating Special Week.',
    mediaAppearances: ['Anime Season 1 (Team Rigil Rival)', 'Anime Season 2', 'Umayon', 'Umayuru'],
    growthRates: { Speed: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'A', Medium: 'B', Long: 'A' },
    strategyAptitudes: { Front: 'F', Pace: 'A', Late: 'A', End: 'C' },
    uniqueSkill: 'Spirit of the Nadeshiko (精神一到)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/grass-wonder',
    umamusuWikiUrl: 'https://umamusu.wiki/Grass_Wonder',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Grass_Wonder',
  },
  {
    canonical: 'El Condor Pasa',
    aliases: ['el condor pasa', 'el', 'エルコンドルパサー', 'masked champion', 'world traveler'],
    type: 'character',
    japaneseName: 'エルコンドルパサー',
    voiceActor: 'Minami Takahashi (髙橋ミナミ)',
    birthday: 'March 17',
    epithet: 'World Traveling Masked Champion',
    role: 'Mile/Medium Leader & Pace Chaser (Turf & Dirt Dual-Aptitude)',
    realHorseHistory: '1995–2002 (Kingmambo x Saddlers Gal). 1998 NHK Mile Cup & Japan Cup champion. 1999 European campaign: won Grand Prix de Saint-Cloud, 2nd in Prix de l\'Arc de Triomphe.',
    mediaAppearances: ['Anime Season 1 (Team Rigil / Spica Rival)', 'Anime Season 2', 'Umayon', 'Umayuru'],
    growthRates: { Speed: '+20%', Intelligence: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'B' },
    distanceAptitudes: { Short: 'E', Mile: 'A', Medium: 'A', Long: 'B' },
    strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'B', End: 'C' },
    uniqueSkill: 'Plan de Vuelo (プランチャ☆ガナドール)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/el-condor-pasa',
    umamusuWikiUrl: 'https://umamusu.wiki/El_Condor_Pasa',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/El_Condor_Pasa',
  },
  {
    canonical: 'Jungle Pocket',
    aliases: ['jungle pocket', 'pokke', 'ジャンポケ', 'ジャングルポケット', 'beginning of a new era'],
    type: 'character',
    japaneseName: 'ジャングルポケット',
    voiceActor: 'Yuri Fujimoto (藤本侑里)',
    birthday: 'May 7',
    epithet: 'The Roaring Challenger of the New Era',
    role: 'Medium/Long Late / Betweener Runner',
    realHorseHistory: '1998–2021 (Tony Bin x Dance Charmer). 2001 Tokyo Yushun (Derby) and 2001 Japan Cup champion. 2001 JRA Horse of the Year.',
    mediaAppearances: ['Umamusume: Beginning of a New Era (Movie Lead Protagonist)'],
    growthRates: { Speed: '+10%', Power: '+20%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'C', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'F', Pace: 'C', Late: 'A', End: 'B' },
    uniqueSkill: 'Howling Instinct (唸れ、我が獣性！)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/jungle-pocket',
    umamusuWikiUrl: 'https://umamusu.wiki/Jungle_Pocket',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Jungle_Pocket',
  },
  {
    canonical: 'Orfevre',
    aliases: ['orfevre', 'オルフェーヴル', 'golden tyrant', 'triple crown orfevre'],
    type: 'character',
    japaneseName: 'オルフェーヴル',
    voiceActor: 'Rina Hidaka (日高里菜)',
    birthday: 'May 14',
    epithet: 'The Golden Tyrant / 7th Triple Crown Sovereign',
    role: 'Medium/Long End Closer & Late Runner',
    realHorseHistory: '2008–present (Stay Gold x Oriental Art). 7th Japanese Triple Crown champion (2011), 6 G1 titles, 2x runner-up in Prix de l\'Arc de Triomphe (2012, 2013). Renowned for fierce temperament and overwhelming closing speed.',
    mediaAppearances: ['Game 3rd Anniversary Launch', 'Main Story Part 2'],
    growthRates: { Speed: '+15%', Stamina: '+15%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'E' },
    distanceAptitudes: { Short: 'G', Mile: 'B', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'G', Pace: 'B', Late: 'A', End: 'A' },
    uniqueSkill: 'Tyrant Reign (金色の暴君)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/orfevre',
    umamusuWikiUrl: 'https://umamusu.wiki/Orfevre',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Orfevre',
  },
  {
    canonical: 'Gentildonna',
    aliases: ['gentildonna', 'ジェンティルドンナ', 'iron maiden', 'triple tiara gentildonna'],
    type: 'character',
    japaneseName: 'ジェンティルドンナ',
    voiceActor: 'Yu Serizawa (芹澤優)',
    birthday: 'February 20',
    epithet: 'The Iron Maiden / Sovereign of Strength',
    role: 'Medium/Long Pace Chaser & Leader',
    realHorseHistory: '2009–present (Deep Impact x Donna Blini). 2012 Japanese Fillies Triple Tiara winner, 2x Japan Cup (2012, 2013), 2014 Dubai Sheema Classic, 2014 Arima Kinen (7 G1s). Hall of Fame inductee.',
    mediaAppearances: ['Game 3rd Anniversary Launch', 'Main Story Part 2'],
    growthRates: { Power: '+20%', Speed: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'B', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'C', Pace: 'A', Late: 'A', End: 'G' },
    uniqueSkill: 'Majestic Dominance (我が覇道に刮目せよ)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/gentildonna',
    umamusuWikiUrl: 'https://umamusu.wiki/Gentildonna',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Gentildonna',
  },
  {
    canonical: 'Maruzensky',
    aliases: ['maruzensky', 'マルゼンスキー', 'swimsuit maruzensky', 'mizumaru', 'supercar'],
    type: 'character',
    japaneseName: 'マルゼンスキー',
    voiceActor: 'Lynn',
    birthday: 'May 19',
    epithet: 'The Supercar / Undefeated Exotic Queen',
    role: 'Short/Mile Front Runner (Escape)',
    realHorseHistory: '1974–1997 (Nijinsky x Shil). Undefeated in 8 starts by an aggregate margin of 61 lengths. 1976 Asahi Hai Sansai Stakes winner.',
    mediaAppearances: ['Anime Seasons 1-3', 'Umayon', 'Umayuru'],
    growthRates: { Speed: '+10%', Intelligence: '+20%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'D' },
    distanceAptitudes: { Short: 'B', Mile: 'A', Medium: 'B', Long: 'C' },
    strategyAptitudes: { Front: 'A', Pace: 'B', Late: 'E', End: 'G' },
    uniqueSkill: 'Red Flame Gear / LP1211-M (紅焔ギア/LP1211-M)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/maruzensky',
    umamusuWikiUrl: 'https://umamusu.wiki/Maruzensky',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Maruzensky',
  },
  {
    canonical: 'Symboli Rudolf',
    aliases: ['symboli rudolf', 'rudolf', 'emperor', 'シンボリルドルフ', 'president rudolf'],
    type: 'character',
    japaneseName: 'シンボリルドルフ',
    voiceActor: 'Azusa Tadokoro (田所あずさ)',
    birthday: 'March 13',
    epithet: 'The Emperor / Seven-Crown Sovereign',
    role: 'Medium/Long Pace Chaser & Late Runner (Student Council President)',
    realHorseHistory: '1981–2011 (Partholon x Sweet Luna). Japan\'s first undefeated Triple Crown champion (1984), 7 G1 wins including 2x Arima Kinen, Japan Cup, Tenno Sho Spring.',
    mediaAppearances: ['Anime Seasons 1-3 (Student Council President)', 'Umayon', 'Umayuru'],
    growthRates: { Stamina: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'E' },
    distanceAptitudes: { Short: 'E', Mile: 'C', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'A', End: 'C' },
    uniqueSkill: "Behold Thine Emperor's Divine Might (汝、皇帝の神威を見よ)",
    gametoraUrl: 'https://gametora.com/umamusume/characters/symboli-rudolf',
    umamusuWikiUrl: 'https://umamusu.wiki/Symboli_Rudolf',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Symboli_Rudolf',
  },
  {
    canonical: 'Narita Taishin',
    aliases: ['narita taishin', 'taishin', 'ナリタタイシン', 'bnw taishin'],
    type: 'character',
    japaneseName: 'ナリタタイシン',
    voiceActor: 'Keiko Watanabe (渡部恵子)',
    birthday: 'June 10',
    epithet: 'The Prickly Miracle / BNW Generation Spurt',
    role: 'Medium/Long End Closer (Oikomi)',
    realHorseHistory: '1990–2020 (Rivlia x Taishin Lily). 1993 Satsuki Sho champion with legendary closing burst; formed the iconic BNW rivalry with Biwa Hayahide and Winning Ticket.',
    mediaAppearances: ['BNW\'s Oath OVA', 'Anime Season 2', 'Umayon'],
    growthRates: { Speed: '+10%', Guts: '+20%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'D', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'G', Pace: 'D', Late: 'B', End: 'A' },
    uniqueSkill: 'Nemesis (Nemesis)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/narita-taishin',
    umamusuWikiUrl: 'https://umamusu.wiki/Narita_Taishin',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Narita_Taishin',
  },
  {
    canonical: 'Kitasan Black',
    aliases: ['kitasan black', 'kitasan', 'キタサンブラック', 'festival king', 'matsuri kitasan'],
    type: 'character',
    japaneseName: 'キタサンブラック',
    voiceActor: 'Hinaki Yano (矢野妃菜喜)',
    birthday: 'March 10',
    epithet: 'Festival King / Seven-Time G1 Champion of the People',
    role: 'Medium/Long Front Runner & Leader',
    realHorseHistory: '2012–present (Black Tide x Sugar Heart). 7 G1 wins: Kikuka Sho, 2x Tenno Sho Spring, Tenno Sho Autumn, Japan Cup, Arima Kinen, Osaka Hai. 2x JRA Horse of the Year (2016, 2017).',
    mediaAppearances: ['Anime Season 3 (Lead Protagonist)', 'Anime Season 2', 'Umayuru'],
    growthRates: { Speed: '+20%', Stamina: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'F', Mile: 'C', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'A', Pace: 'A', Late: 'C', End: 'G' },
    uniqueSkill: 'Triumphant Festival (勝ち鬨の熱情)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/kitasan-black',
    umamusuWikiUrl: 'https://umamusu.wiki/Kitasan_Black',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Kitasan_Black',
  },
  {
    canonical: 'Satono Diamond',
    aliases: ['satono diamond', 'dia-chan', 'dia', 'サトノダイヤモンド', 'jinx breaker'],
    type: 'character',
    japaneseName: 'サトノダイヤモンド',
    voiceActor: 'Hina Tachibana (立花日菜)',
    birthday: 'January 30',
    epithet: 'The Diamond That Shattered the Jinx',
    role: 'Medium/Long Leader & Pace Chaser',
    realHorseHistory: '2013–present (Deep Impact x Malpensa). Broke the "Satono G1 Jinx" by winning the 2016 Kikuka Sho and 2016 Arima Kinen over Kitasan Black. 2016 Best 3-Year-Old Colt.',
    mediaAppearances: ['Anime Season 3 (Co-Lead)', 'Anime Season 2', 'Umayuru'],
    growthRates: { Stamina: '+15%', Intelligence: '+15%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'D', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'A', End: 'F' },
    uniqueSkill: 'Unbreakable Brilliance (きらめく無垢の祈り)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/satono-diamond',
    umamusuWikiUrl: 'https://umamusu.wiki/Satono_Diamond',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Satono_Diamond',
  },
  {
    canonical: 'Sakura Laurel',
    aliases: ['sakura laurel', 'laurel', 'サクラローレル', 'star blossom protagonist'],
    type: 'character',
    japaneseName: 'サクラローレル',
    voiceActor: 'Mina Manaka (真野美月)',
    birthday: 'May 8',
    epithet: 'The Phoenix of Spring / Cherry Blossom Sovereign',
    role: 'Medium/Long Late / Betweener & Pace Chaser',
    realHorseHistory: '1991–2020 (Rainbow Quest x Lola Lola). Overcame fragile legs to claim the 1996 Tenno Sho Spring and 1996 Arima Kinen. 1996 JRA Horse of the Year.',
    mediaAppearances: ['Umamusume: Star Blossom (Lead Protagonist)'],
    growthRates: { Stamina: '+20%', Power: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'E', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'E', Pace: 'A', Late: 'A', End: 'B' },
    uniqueSkill: 'Bloom into Tomorrow (サクラ前線、駆け抜けて)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/sakura-laurel',
    umamusuWikiUrl: 'https://umamusu.wiki/Sakura_Laurel',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Sakura_Laurel',
  },
  {
    canonical: 'Narita Top Road',
    aliases: ['narita top road', 'top road', 'ntr', 'ナリタトップロード', 'road to the top protagonist'],
    type: 'character',
    japaneseName: 'ナリタトップロード',
    voiceActor: 'Kanna Nakamura (中村カンナ)',
    birthday: 'April 4',
    epithet: 'The Bright Star of the 1999 Classic Generation',
    role: 'Medium/Long Leader & Pace Chaser',
    realHorseHistory: '1996–2005 (Soccer Boy x Floral Green). 1999 Kikuka Sho champion; formed the heroic 1999 Triple Crown trio with Admire Vega and TM Opera O.',
    mediaAppearances: ['Umamusume: Road to the Top (Lead Protagonist)', 'Anime Season 3'],
    growthRates: { Stamina: '+20%', Speed: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'F', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'G' },
    uniqueSkill: 'Climbing the High Road (想いを背負い、頂へ)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/narita-top-road',
    umamusuWikiUrl: 'https://umamusu.wiki/Narita_Top_Road',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Narita_Top_Road',
  },
  {
    canonical: 'Agnes Tachyon',
    aliases: ['agnes tachyon', 'tachyon', 'アグネスタキオン', 'mad scientist', 'light speed tachyon'],
    type: 'character',
    japaneseName: 'アグネスタキオン',
    voiceActor: 'Sumire Uesaka (上坂すみれ)',
    birthday: 'April 13',
    epithet: 'The Light-Speed Pioneer / Mad Genius of Tracen',
    role: 'Medium Leader & Pace Chaser',
    realHorseHistory: '1998–2009 (Sunday Silence x Agnes Flora). Undefeated in all 4 career starts including the 2001 Satsuki Sho before phantom tendon injury forced premature retirement. Top stallion.',
    mediaAppearances: ['Umamusume: Beginning of a New Era (Central Focus)', 'Anime Seasons 1-3', 'Umayuru'],
    growthRates: { Guts: '+20%', Speed: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'B', Medium: 'A', Long: 'B' },
    strategyAptitudes: { Front: 'B', Pace: 'A', Late: 'B', End: 'E' },
    uniqueSkill: 'U=ma2 (研究の極致)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/agnes-tachyon',
    umamusuWikiUrl: 'https://umamusu.wiki/Agnes_Tachyon',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Agnes_Tachyon',
  },
  {
    canonical: 'Manhattan Cafe',
    aliases: ['manhattan cafe', 'cafe', 'マンハッタンカフェ', 'coffee ghost'],
    type: 'character',
    japaneseName: 'マンハッタンカフェ',
    voiceActor: 'Yui Ogura (小倉唯)',
    birthday: 'March 5',
    epithet: 'The Shadow Stalker / Phantom of Long Distances',
    role: 'Long/Medium End Closer & Late Runner',
    realHorseHistory: '1998–2015 (Sunday Silence x Subtle Change). 3 G1 wins: 2001 Kikuka Sho, 2001 Arima Kinen, and 2002 Tenno Sho Spring.',
    mediaAppearances: ['Umamusume: Beginning of a New Era', 'Anime Season 2', 'Anime Season 3'],
    growthRates: { Stamina: '+30%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'E', Medium: 'B', Long: 'A' },
    strategyAptitudes: { Front: 'G', Pace: 'B', Late: 'A', End: 'A' },
    uniqueSkill: 'Silent Shadows (残光の彼方へ)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/manhattan-cafe',
    umamusuWikiUrl: 'https://umamusu.wiki/Manhattan_Cafe',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Manhattan_Cafe',
  },
  {
    canonical: 'Duramente',
    aliases: ['duramente', 'ドゥラメンテ', 'double crown duramente'],
    type: 'character',
    japaneseName: 'ドゥラメンテ',
    voiceActor: 'Shizuka Ishigami (石上静香)',
    birthday: 'March 22',
    epithet: 'The Two-Crown Tempest / Sovereign of Unruly Power',
    role: 'Medium/Long Late / Betweener & Leader',
    realHorseHistory: '2012–2021 (King Kamehameha x Admire Groove). Double Crown champion winning the 2015 Satsuki Sho and Tokyo Yushun with explosive final bursts. Sire of Titleholder, Stars on Earth, Liberty Island, and Dura Erede.',
    mediaAppearances: ['Anime Season 3 (Primary Rival to Kitasan Black)'],
    growthRates: { Speed: '+20%', Power: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'B', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'E', Pace: 'B', Late: 'A', End: 'A' },
    uniqueSkill: 'Roar of the Tempest (荒ぶる咆哮)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/duramente',
    umamusuWikiUrl: 'https://umamusu.wiki/Duramente',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Duramente',
  },
  {
    canonical: 'Cheval Grand',
    aliases: ['cheval grand', 'cheval', 'シュヴァルグラン', 'great horse grand'],
    type: 'character',
    japaneseName: 'シュヴァルグラン',
    voiceActor: 'Natsumi Nawa (夏吉ゆうこ)',
    birthday: 'March 14',
    epithet: 'The Silent Giant / Great Horse of the Grand Siblings',
    role: 'Medium/Long Late / Betweener & Pace Chaser',
    realHorseHistory: '2012–present (Heart\'s Cry x Halwa Sweet). 2017 Japan Cup champion defeating Kitasan Black and Rey de Oro.',
    mediaAppearances: ['Anime Season 3 (Major Rival Arc)'],
    growthRates: { Stamina: '+20%', Guts: '+10%' },
    surfaceAptitudes: { Turf: 'A', Dirt: 'G' },
    distanceAptitudes: { Short: 'G', Mile: 'D', Medium: 'A', Long: 'A' },
    strategyAptitudes: { Front: 'F', Pace: 'A', Late: 'A', End: 'B' },
    uniqueSkill: 'Quiet Surpass (静かなる大波)',
    gametoraUrl: 'https://gametora.com/umamusume/characters/cheval-grand',
    umamusuWikiUrl: 'https://umamusu.wiki/Cheval_Grand',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Cheval_Grand',
  },
];

export const SUPPORT_CARDS_TAXONOMY_DATA: SupportCardTaxonomyItem[] = [
  {
    canonical: 'SSR Kitasan Black (Speed)',
    aliases: ['ssr kitasan black', 'kitasan card', 'kitasan black ssr', 'speed kitasan', 'kitasan speed', 'professor kitasan'],
    type: 'support-card',
    japaneseName: '［迫る熱に押されて］キタサンブラック',
    cardType: 'Speed',
    rarity: 'SSR',
    keySkills: ['Professor of Curren (弧線のプロフェッサー)', 'Corner Adept ◯', 'Concentration', 'Straight Adept ◯'],
    keyBonuses: 'Top Tier Specialty Rate (80) + High Friendship Bonus (25%) + Training Effectiveness (15%) + Initial Bond',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Kitasan_Black_(Support_Card)',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Kitasan_Black_(Support_Card)',
  },
  {
    canonical: 'SSR Super Creek (Stamina)',
    aliases: ['ssr super creek', 'super creek card', 'creek card', 'stamina creek', 'arc maestro card'],
    type: 'support-card',
    japaneseName: '［一粒の安らぎ］スーパークリーク',
    cardType: 'Stamina',
    rarity: 'SSR',
    keySkills: ['Circle of Maestro / Arc Maestro (円弧のマエストロ)', 'Corner Recovery ◯', 'Pace Chaser Hints'],
    keyBonuses: 'Essential Stamina Card with guaranteed Arc Maestro on chain completion + 15% Race Bonus',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Super_Creek_(Support_Card)',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Super_Creek_(Support_Card)',
  },
  {
    canonical: 'SSR Fine Motion (Intelligence)',
    aliases: ['ssr fine motion', 'fine motion card', 'fine motion ssr', 'int fine motion', 'speed star card'],
    type: 'support-card',
    japaneseName: '［感謝は指先まで込めて］ファインモーション',
    cardType: 'Intelligence',
    rarity: 'SSR',
    keySkills: ['Speed Star (スピードスター)', 'Corner Adept ◯', 'Tail Held High (尻尾上がり)', 'Fall Runner ◯'],
    keyBonuses: 'High Training Effectiveness (15%) + Consistent Wit Training Stat Up + High Specialty Rate',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Fine_Motion_(Support_Card)',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Fine_Motion_(Support_Card)',
  },
  {
    canonical: 'SSR Rice Shower (Power)',
    aliases: ['ssr rice shower', 'power rice shower', 'rice shower card', 'power arc maestro'],
    type: 'support-card',
    japaneseName: '［幸せは曲がり角の向こう］ライスシャワー',
    cardType: 'Power',
    rarity: 'SSR',
    keySkills: ['Circle of Maestro (円弧のマエストロ)', 'Climber (直滑降)', 'Deep Breaths (深呼吸)'],
    keyBonuses: 'Provides Arc Maestro for Power training builds in Aoharu and TS Climax',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Rice_Shower_(Support_Card)',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Rice_Shower_(Support_Card)',
  },
  {
    canonical: 'SSR Mejiro Ramonu (Intelligence)',
    aliases: ['ssr mejiro ramonu', 'ramonu card', 'int ramonu', 'mejiro ramonu ssr', 'ramonu intelligence'],
    type: 'support-card',
    japaneseName: '［燦爛］メジロラモーヌ',
    cardType: 'Intelligence',
    rarity: 'SSR',
    keySkills: ['Superior Wisdom (優位形成)', 'Mile & Medium Acceleration Hints', 'Decisive Factor'],
    keyBonuses: 'Highest base training effect scaling per skill hint acquired (up to +20% extra stats)',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Mejiro_Ramonu_(Support_Card)',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Mejiro_Ramonu_(Support_Card)',
  },
  {
    canonical: 'SSR Duramente (Speed)',
    aliases: ['ssr duramente', 'duramente card', 'speed duramente', 'swift acceleration duramente'],
    type: 'support-card',
    japaneseName: '［超越］ドゥラメンテ',
    cardType: 'Speed',
    rarity: 'SSR',
    keySkills: ['Swift Acceleration (迅速果断 / 疾風怒濤)', 'Rampage (昂る鼓動)', 'Late Chaser Hints'],
    keyBonuses: 'Extreme speed raw ceiling multiplier for modern high stat cap scenarios (U.A.F., Great Food Festival)',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Duramente_(Support_Card)',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Duramente_(Support_Card)',
  },
  {
    canonical: 'SSR Tazuna Hayakawa (Friend)',
    aliases: ['ssr tazuna', 'tazuna hayakawa', 'tazuna card', 'friend tazuna', 'green devil tazuna'],
    type: 'support-card',
    japaneseName: '［ようこそ、トレセン学園へ！］駿川たづな',
    cardType: 'Friend',
    rarity: 'SSR',
    keySkills: ['Concentration (コンセントレーション)', 'Tailwind ◯'],
    keyBonuses: 'Energy recovery, mood upkeep, fail rate reduction, guaranteed gate skill',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Tazuna_Hayakawa',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Tazuna_Hayakawa',
  },
  {
    canonical: 'SSR Biko Pegasus (Speed)',
    aliases: ['ssr biko pegasus', 'biko pegasus card', 'biko card', 'speed biko', 'sprint biko'],
    type: 'support-card',
    japaneseName: '［必殺！ダブルキャロットパンチ！］ビコーペガサス',
    cardType: 'Speed',
    rarity: 'SSR',
    keySkills: ['Plan X (プランX)', 'Sprint Adept ◯', 'Sprint Gear'],
    keyBonuses: 'High Training Effectiveness (20%) + High Specialty Rate for Sprint Training Builds',
    gametoraUrl: 'https://gametora.com/umamusume/supports',
    umamusuWikiUrl: 'https://umamusu.wiki/Biko_Pegasus',
    fandomWikiUrl: 'https://umamusume.fandom.com/wiki/Biko_Pegasus',
  },
];

// ─────────────────────────────────────────────────────────────
// FUZZY MATCHING ALGORITHMS & SCORING
// ─────────────────────────────────────────────────────────────

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Normalizes text for case-insensitive, punctuation-tolerant comparison.
 */
export function normalizeFuzzyText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\[\]\(\)\{\}・/★☆♪~～\-_\.,:;!?'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates a similarity score (0.0 to 1.0) between two strings using normalized edit distance.
 */
export function stringSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeFuzzyText(s1);
  const norm2 = normalizeFuzzyText(s2);
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const maxLen = Math.max(norm1.length, norm2.length);
  const dist = levenshteinDistance(norm1, norm2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Evaluates how well a query matches candidate text and returns a score (0 - 100)
 * with details on match type and matched snippet.
 */
export function matchQueryAgainstCandidate(
  rawQuery: string,
  rawCandidate: string
): { score: number; matchedText: string; distance: number } {
  const q = normalizeFuzzyText(rawQuery);
  const c = normalizeFuzzyText(rawCandidate);

  if (!q || !c) {
    return { score: 0, matchedText: '', distance: 999 };
  }

  // 1. Exact string match
  if (q === c) {
    return { score: 100, matchedText: rawCandidate, distance: 0 };
  }

  // 2. Candidate starts with query or query starts with candidate
  if (c.startsWith(q)) {
    const ratio = q.length / c.length;
    const score = Math.round(90 + ratio * 8); // 90..98
    return { score, matchedText: rawCandidate, distance: c.length - q.length };
  }

  // 3. Word boundary / substring containment
  const queryTokens = q.split(' ').filter(Boolean);
  const candidateTokens = c.split(' ').filter(Boolean);

  if (c.includes(q)) {
    const ratio = q.length / c.length;
    const score = Math.round(82 + ratio * 8); // 82..90
    return { score, matchedText: rawCandidate, distance: c.length - q.length };
  }

  // 4. Token-level matching (e.g. "oguri" matches "oguri cap")
  let tokenMatches = 0;
  for (const qToken of queryTokens) {
    if (candidateTokens.some((cToken) => cToken.includes(qToken) || qToken.includes(cToken))) {
      tokenMatches++;
    }
  }

  if (tokenMatches > 0 && queryTokens.length > 0) {
    const coverage = tokenMatches / queryTokens.length;
    if (coverage === 1.0) {
      const score = Math.round(75 + (tokenMatches / Math.max(candidateTokens.length, 1)) * 12);
      return { score, matchedText: rawCandidate, distance: candidateTokens.length - tokenMatches };
    }
  }

  // 5. Edit distance similarity
  const sim = stringSimilarity(q, c);
  if (sim >= 0.55) {
    const score = Math.round(sim * 78);
    const dist = levenshteinDistance(q, c);
    return { score, matchedText: rawCandidate, distance: dist };
  }

  return { score: 0, matchedText: '', distance: 999 };
}

// ─────────────────────────────────────────────────────────────
// CORE FUZZY SEARCH FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Performs fuzzy search on Umamusume Characters using taxonomy data (canonical names,
 * aliases, Japanese names, voice actors/seiyuu, epithets, roles, and unique skills).
 *
 * @param query Search query (e.g. "oguri", "spe chan", "machico", "monster of kasamatsu")
 * @param options Configurable limit, minScore, and pureDb inclusion
 */
export function fuzzySearchCharacters(
  query: string,
  options: FuzzySearchOptions = {}
): FuzzySearchResult<CharacterTaxonomyItem>[] {
  const { limit = 10, minScore = 30, includePureDb = true } = options;
  const q = query.trim();
  if (!q) return [];

  const results: FuzzySearchResult<CharacterTaxonomyItem>[] = [];

  for (const char of CHARACTERS_TAXONOMY_DATA) {
    let bestScore = 0;
    let bestMatchedField = 'canonical';
    let bestMatchedText = char.canonical;
    let minDistance = 999;

    // 1. Canonical Name Match
    const canMatch = matchQueryAgainstCandidate(q, char.canonical);
    if (canMatch.score > bestScore) {
      bestScore = canMatch.score;
      bestMatchedField = 'canonical';
      bestMatchedText = char.canonical;
      minDistance = canMatch.distance;
    }

    // 2. Aliases Match
    for (const alias of char.aliases) {
      const aliasMatch = matchQueryAgainstCandidate(q, alias);
      if (aliasMatch.score > bestScore) {
        bestScore = aliasMatch.score;
        bestMatchedField = 'alias';
        bestMatchedText = alias;
        minDistance = aliasMatch.distance;
      }
    }

    // 3. Japanese Name Match
    if (char.japaneseName) {
      const jpMatch = matchQueryAgainstCandidate(q, char.japaneseName);
      if (jpMatch.score > bestScore) {
        bestScore = jpMatch.score;
        bestMatchedField = 'japaneseName';
        bestMatchedText = char.japaneseName;
        minDistance = jpMatch.distance;
      }
    }

    // 4. Voice Actor / Seiyuu Match
    if (char.voiceActor) {
      const vaMatch = matchQueryAgainstCandidate(q, char.voiceActor);
      if (vaMatch.score > bestScore) {
        bestScore = Math.round(vaMatch.score * 0.95);
        bestMatchedField = 'voiceActor';
        bestMatchedText = char.voiceActor;
        minDistance = vaMatch.distance;
      }
    }

    // 5. Epithet / Title Match
    if (char.epithet) {
      const epiMatch = matchQueryAgainstCandidate(q, char.epithet);
      if (epiMatch.score > bestScore) {
        bestScore = Math.round(epiMatch.score * 0.90);
        bestMatchedField = 'epithet';
        bestMatchedText = char.epithet;
        minDistance = epiMatch.distance;
      }
    }

    // 6. Unique Skill Match
    if (char.uniqueSkill) {
      const skillMatch = matchQueryAgainstCandidate(q, char.uniqueSkill);
      if (skillMatch.score > bestScore) {
        bestScore = Math.round(skillMatch.score * 0.88);
        bestMatchedField = 'uniqueSkill';
        bestMatchedText = char.uniqueSkill;
        minDistance = skillMatch.distance;
      }
    }

    if (bestScore >= minScore) {
      // Cross-reference PureDB cards if requested
      const itemWithPureDb: CharacterTaxonomyItem = { ...char };
      if (includePureDb) {
        const matchingPureDbCards = PURE_DB_CARDS.filter((c) => {
          const normCardName = normalizeFuzzyText(c.name);
          const normCharName = normalizeFuzzyText(char.canonical);
          return normCardName.includes(normCharName);
        });
        if (matchingPureDbCards.length > 0) {
          itemWithPureDb.pureDbCards = matchingPureDbCards;
        }
      }

      results.push({
        item: itemWithPureDb,
        score: bestScore,
        matchedField: bestMatchedField,
        matchedText: bestMatchedText,
        highlight: `${char.canonical} (matched on ${bestMatchedField}: "${bestMatchedText}")`,
        distance: minDistance,
      });
    }
  }

  // Sort descending by score, then ascending by edit distance
  results.sort((a, b) => b.score - a.score || a.distance - b.distance);
  return results.slice(0, limit);
}

/**
 * Performs fuzzy search on Umamusume Support Cards using taxonomy data (canonical card names,
 * aliases, card types, key skills, bonuses, and PureDB card definitions).
 *
 * @param query Search query (e.g. "kitasan speed", "arc maestro", "int fine motion", "tazuna")
 * @param options Configurable limit, minScore, and pureDb inclusion
 */
export function fuzzySearchSupportCards(
  query: string,
  options: FuzzySearchOptions = {}
): FuzzySearchResult<SupportCardTaxonomyItem>[] {
  const { limit = 10, minScore = 30, includePureDb = true } = options;
  const q = query.trim();
  if (!q) return [];

  const results: FuzzySearchResult<SupportCardTaxonomyItem>[] = [];

  for (const card of SUPPORT_CARDS_TAXONOMY_DATA) {
    let bestScore = 0;
    let bestMatchedField = 'canonical';
    let bestMatchedText = card.canonical;
    let minDistance = 999;

    // 1. Canonical Name Match
    const canMatch = matchQueryAgainstCandidate(q, card.canonical);
    if (canMatch.score > bestScore) {
      bestScore = canMatch.score;
      bestMatchedField = 'canonical';
      bestMatchedText = card.canonical;
      minDistance = canMatch.distance;
    }

    // 2. Aliases Match
    for (const alias of card.aliases) {
      const aliasMatch = matchQueryAgainstCandidate(q, alias);
      if (aliasMatch.score > bestScore) {
        bestScore = aliasMatch.score;
        bestMatchedField = 'alias';
        bestMatchedText = alias;
        minDistance = aliasMatch.distance;
      }
    }

    // 3. Japanese Name Match
    if (card.japaneseName) {
      const jpMatch = matchQueryAgainstCandidate(q, card.japaneseName);
      if (jpMatch.score > bestScore) {
        bestScore = jpMatch.score;
        bestMatchedField = 'japaneseName';
        bestMatchedText = card.japaneseName;
        minDistance = jpMatch.distance;
      }
    }

    // 4. Key Skills Match
    if (card.keySkills) {
      for (const skill of card.keySkills) {
        const skillMatch = matchQueryAgainstCandidate(q, skill);
        if (skillMatch.score > bestScore) {
          bestScore = Math.round(skillMatch.score * 0.92);
          bestMatchedField = 'keySkill';
          bestMatchedText = skill;
          minDistance = skillMatch.distance;
        }
      }
    }

    // 5. Card Type Match (e.g. "Speed card", "Intelligence SSR")
    const typeAlias = `${card.rarity} ${card.cardType}`;
    const typeMatch = matchQueryAgainstCandidate(q, typeAlias);
    if (typeMatch.score > bestScore) {
      bestScore = Math.round(typeMatch.score * 0.85);
      bestMatchedField = 'cardType';
      bestMatchedText = typeAlias;
      minDistance = typeMatch.distance;
    }

    if (bestScore >= minScore) {
      const itemWithPureDb: SupportCardTaxonomyItem = { ...card };
      if (includePureDb) {
        const normCardName = normalizeFuzzyText(card.canonical);
        const matchingPureDbSupports = PURE_DB_SUPPORT_CARDS.filter((s) => {
          const normPureName = normalizeFuzzyText(s.name);
          return normPureName.includes(normCardName) || normCardName.includes(normPureName);
        });
        if (matchingPureDbSupports.length > 0) {
          itemWithPureDb.pureDbSupportCards = matchingPureDbSupports;
        }
      }

      results.push({
        item: itemWithPureDb,
        score: bestScore,
        matchedField: bestMatchedField,
        matchedText: bestMatchedText,
        highlight: `${card.canonical} (matched on ${bestMatchedField}: "${bestMatchedText}")`,
        distance: minDistance,
      });
    }
  }

  // Sort descending by score, then ascending by edit distance
  results.sort((a, b) => b.score - a.score || a.distance - b.distance);
  return results.slice(0, limit);
}

/**
 * Universal fuzzy search across all taxonomy categories (Characters, Support Cards, or unified search).
 */
export function fuzzySearchTaxonomy(
  query: string,
  options: TaxonomyFuzzySearchOptions = {}
): FuzzySearchResult<TaxonomyEntity>[] {
  const { type = 'all', limit = 10 } = options;

  if (type === 'character') {
    return fuzzySearchCharacters(query, options);
  }
  if (type === 'support-card') {
    return fuzzySearchSupportCards(query, options);
  }

  // Combined search across characters and support cards
  const charResults = fuzzySearchCharacters(query, { ...options, limit: limit * 2 });
  const cardResults = fuzzySearchSupportCards(query, { ...options, limit: limit * 2 });

  const combined: FuzzySearchResult<TaxonomyEntity>[] = [...charResults, ...cardResults];
  combined.sort((a, b) => b.score - a.score || a.distance - b.distance);
  return combined.slice(0, limit);
}

/**
 * Top-level alias for `fuzzySearchTaxonomy`.
 */
export const fuzzySearch = fuzzySearchTaxonomy;

/**
 * Finds a character by query (name, alias, Japanese name, seiyuu, nickname, or title) using fuzzy matching.
 * Returns the best-matching CharacterTaxonomyItem with associated PureDB card entries, or null if below threshold.
 *
 * @param query Search query string (e.g. "spe", "oguri cap", "トウカイテイオー", "大橋彩香", "dasuka")
 * @param optionsOrMinScore Optional minScore threshold (default: 30) or FuzzySearchOptions object
 * @returns Matched CharacterTaxonomyItem or null
 */
export function findCharacter(
  query: string,
  optionsOrMinScore?: number | FuzzySearchOptions
): CharacterTaxonomyItem | null {
  const options: FuzzySearchOptions =
    typeof optionsOrMinScore === 'number'
      ? { minScore: optionsOrMinScore, limit: 1 }
      : { minScore: 30, limit: 1, ...optionsOrMinScore };

  const results = fuzzySearchCharacters(query, options);
  return results.length > 0 ? results[0].item : null;
}

/**
 * Finds a support card by query (card name, alias, rarity, type, or key skill) using fuzzy matching.
 * Returns the best-matching SupportCardTaxonomyItem with associated PureDB support card entries, or null if below threshold.
 *
 * @param query Search query string (e.g. "kitasan speed", "arc maestro", "ssr fine motion", "int ramonu")
 * @param optionsOrMinScore Optional minScore threshold (default: 30) or FuzzySearchOptions object
 * @returns Matched SupportCardTaxonomyItem or null
 */
export function findSupportCard(
  query: string,
  optionsOrMinScore?: number | FuzzySearchOptions
): SupportCardTaxonomyItem | null {
  const options: FuzzySearchOptions =
    typeof optionsOrMinScore === 'number'
      ? { minScore: optionsOrMinScore, limit: 1 }
      : { minScore: 30, limit: 1, ...optionsOrMinScore };

  const results = fuzzySearchSupportCards(query, options);
  return results.length > 0 ? results[0].item : null;
}

/**
 * Convenience helper to find the single best matching character result or null if below threshold.
 */
export function findBestCharacterMatch(
  query: string,
  minScore = 40
): FuzzySearchResult<CharacterTaxonomyItem> | null {
  const results = fuzzySearchCharacters(query, { limit: 1, minScore });
  return results.length > 0 ? results[0] : null;
}

/**
 * Convenience helper to find the single best matching support card result or null if below threshold.
 */
export function findBestSupportCardMatch(
  query: string,
  minScore = 40
): FuzzySearchResult<SupportCardTaxonomyItem> | null {
  const results = fuzzySearchSupportCards(query, { limit: 1, minScore });
  return results.length > 0 ? results[0] : null;
}

/**
 * Fuzzy search helper for PureDB card variations (e.g. `[Special Dreamer]Special Week`).
 */
export function searchPureDbCardsFuzzy(
  query: string,
  limit = 25
): { card: PureDbCard; score: number; matchedText: string }[] {
  const q = query.trim();
  if (!q) {
    return PURE_DB_CARDS.slice(0, limit).map((card) => ({
      card,
      score: 100,
      matchedText: card.name,
    }));
  }

  const results: { card: PureDbCard; score: number; matchedText: string; distance: number }[] = [];

  for (const card of PURE_DB_CARDS) {
    const match = matchQueryAgainstCandidate(q, card.name);
    if (match.score >= 30) {
      results.push({
        card,
        score: match.score,
        matchedText: match.matchedText,
        distance: match.distance,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || a.distance - b.distance);
  return results.slice(0, limit).map(({ card, score, matchedText }) => ({ card, score, matchedText }));
}

/**
 * Fuzzy search helper for PureDB support card entries.
 */
export function searchPureDbSupportCardsFuzzy(
  query: string,
  limit = 25
): { card: PureDbSupportCard; score: number; matchedText: string }[] {
  const q = query.trim();
  if (!q) {
    return PURE_DB_SUPPORT_CARDS.slice(0, limit).map((card) => ({
      card,
      score: 100,
      matchedText: card.name,
    }));
  }

  const results: { card: PureDbSupportCard; score: number; matchedText: string; distance: number }[] = [];

  for (const card of PURE_DB_SUPPORT_CARDS) {
    const match = matchQueryAgainstCandidate(q, card.name);
    if (match.score >= 30) {
      results.push({
        card,
        score: match.score,
        matchedText: match.matchedText,
        distance: match.distance,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || a.distance - b.distance);
  return results.slice(0, limit).map(({ card, score, matchedText }) => ({ card, score, matchedText }));
}
