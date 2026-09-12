import { HandbookDocument } from './handbook-types.js';

export const CORE_HANDBOOK_DOCUMENTS: HandbookDocument[] = [
  // 1. Characters
  {
    id: 'guide_oguri_cap_build',
    title: 'Oguri Cap Build & Training Guide',
    category: 'Characters',
    tags: ['oguri_cap', 'character', 'build', 'dirt', 'turf', 'mile', 'medium', 'hybrid'],
    content: 'Oguri Cap is one of the most versatile Umamusume in the game, possessing A-rank aptitude in both Turf and Dirt, as well as Mile and Medium distances. Recommended build: Prioritize Speed (1200+) and Power (900+) for Mile/Medium. For Medium/Long races like Arima Kinen, ensure Stamina reaches at least 650 with 1-2 Gold Stamina recovery skills (e.g., Maestro). Her unique skill "Victory Shot" activates on the final corner when positioned in 3rd to 5th place, making Betweener or Leader optimal running styles.',
    source: 'Official Umamusume Data',
    version: '1.2.0',
    updatedAt: new Date('2026-03-01'),
    recommendations: [
      'Target 1200 Speed, 700 Stamina, 900 Power for Medium/Long races',
      'Use Super Creek SSR for Arc Maestro gold recovery',
      'Run as Leader or Betweener to reliably trigger her unique skill'
    ],
    prerequisites: ['Basic Training Mechanics', 'Inheritance Spark Guide'],
    relatedDocumentIds: ['guide_leader_style', 'guide_speed_cards', 'guide_stamina_skills'],
    taxonomyIds: ['character.oguri_cap', 'running_style.leader', 'running_style.betweener']
  },
  {
    id: 'guide_kitasan_black_build',
    title: 'Kitasan Black Build & Front Runner Guide',
    category: 'Characters',
    tags: ['kitasan_black', 'character', 'build', 'front_runner', 'medium', 'long'],
    content: 'Kitasan Black excels as a top-tier Front Runner in Medium and Long distance races. Her high innate speed and stamina growth rates make her training exceptionally consistent. Recommended stat distribution: 1200 Speed, 800+ Stamina, 800 Power, and 600 Wit. Equip early position-securing skills such as "Concentration" and late-race acceleration skills like "Angling x Scheming".',
    source: 'Curated Guides',
    version: '1.1.0',
    updatedAt: new Date('2026-02-15'),
    recommendations: [
      'Equip Concentration to guarantee clean gate start',
      'Pair with Seiun Sky unique inheritance for acceleration on final corner'
    ],
    relatedDocumentIds: ['guide_front_runner_strategy', 'guide_speed_cards'],
    taxonomyIds: ['character.kitasan_black', 'running_style.front_runner']
  },

  // 2. Running Styles
  {
    id: 'guide_front_runner_strategy',
    title: 'Front Runner Strategy & Build Guide',
    category: 'Running Styles',
    tags: ['front_runner', 'running_style', 'strategy', 'pace', 'lead', 'escape'],
    content: 'Front Runners lead the race from the opening gate to the finish line. Key strengths: Avoids getting boxed in by competitors and maintains uninterrupted pacing. Stat priority: Speed > Stamina > Wit > Power. Wit is vital for smart positioning and avoiding panic/over-pacing (Kakari). Essential skills: Groundwork, Concentration, Escape Artistry, and Angling x Scheming for final corner burst.',
    source: 'Curated Guides',
    version: '1.3.0',
    updatedAt: new Date('2026-02-20'),
    recommendations: [
      'Ensure high Wit (600+) to prevent Kakari and win positioning battles',
      'Acquire gate-start skills to establish immediate lead'
    ],
    relatedDocumentIds: ['guide_speed_cards', 'guide_kitasan_black_build'],
    taxonomyIds: ['running_style.front_runner']
  },
  {
    id: 'guide_betweener_style',
    title: 'Betweener Strategy & Positioning Guide',
    category: 'Running Styles',
    tags: ['betweener', 'running_style', 'strategy', 'power', 'spurt', 'overtake'],
    content: 'Betweeners conserve stamina in the middle pack before unleashing explosive power and acceleration in the final straight. Key requirements: High Power (900+) to weave through congested packs and avoid blockages. Essential skills: Acceleration bursts, positioning vision, and lane-switching skills (e.g., Rampaging Waves, Non-Stop Girl).',
    source: 'Curated Guides',
    version: '1.1.0',
    updatedAt: new Date('2026-01-10'),
    recommendations: [
      'Prioritize Power support cards to ensure clear passing lanes in the stretch',
      'Equip Non-Stop Girl for continuous overtaking acceleration'
    ],
    relatedDocumentIds: ['guide_oguri_cap_build', 'guide_skills_overview'],
    taxonomyIds: ['running_style.betweener']
  },

  // 3. Skills
  {
    id: 'guide_stamina_skills',
    title: 'Stamina Recovery & Gold Healing Skills Guide',
    category: 'Skills',
    tags: ['skills', 'stamina', 'recovery', 'gold_skill', 'maestro', 'gourmand'],
    content: 'Stamina recovery skills restore a percentage of maximum endurance during the race. Gold recovery skills (e.g., Arc Maestro, Gourmand, Iron Will) restore 5.5% of max stamina, equivalent to roughly 200 base Stamina in long distance events. Always prefer corner/middle-leg recovery skills over late-race heals, as late-race activations may trigger after endurance has already depleted.',
    source: 'Official Umamusume Data',
    version: '1.2.0',
    updatedAt: new Date('2026-02-05'),
    recommendations: [
      'Arc Maestro is the most reliable recovery skill across all tracks',
      'For 3000m+ races (e.g., Tenno Sho Spring), carry at least 2 Gold recovery skills'
    ],
    relatedDocumentIds: ['guide_races_tenno_sho_spring'],
    taxonomyIds: ['skill.arc_maestro', 'skill.recovery']
  },
  {
    id: 'guide_skills_overview',
    title: 'Speed, Acceleration, and Velocity Skills Mechanics',
    category: 'Skills',
    tags: ['skills', 'speed', 'acceleration', 'velocity', 'spurt', 'mechanics'],
    content: 'Speed skills increase maximum target velocity, whereas Acceleration skills shorten the time needed to reach top speed. When a runner enters the Last Spurt phase, Acceleration skills must trigger first to rapidly reach maximum speed before pure Speed skills take effect. Timing skill activations to the last corner or final straight entry is crucial for victory.',
    source: 'Official Umamusume Data',
    version: '1.4.0',
    updatedAt: new Date('2026-02-28'),
    recommendations: [
      'Do not stack pure speed skills without acceleration at the final stretch transition',
      'Look for skills that trigger precisely at the start of the final corner'
    ],
    relatedDocumentIds: ['guide_front_runner_strategy'],
    taxonomyIds: ['skill.speed', 'skill.acceleration']
  },

  // 4. Support Cards
  {
    id: 'guide_speed_cards',
    title: 'Speed SSR Support Cards & Deck Composition Guide',
    category: 'Support Cards',
    tags: ['support_cards', 'speed', 'ssr', 'deck', 'training', 'specialty_rate'],
    content: 'Speed cards form the backbone of almost every training deck. Top-tier Speed SSRs (such as Kitasan Black SSR, Biko Pegasus SSR, and Twin Turbo SSR) offer massive training effectiveness and high specialty rate (+80). Standard deck composition: 3 Speed + 2 Stamina + 1 Friend/Wit for Medium/Long, or 4 Speed + 2 Power for Short/Mile.',
    source: 'Curated Guides',
    version: '1.3.0',
    updatedAt: new Date('2026-03-05'),
    recommendations: [
      'Include at least 3 Speed support cards in most training decks',
      'Look for high Specialty Priority (Tokui-ritsu) to concentrate rainbow training'
    ],
    relatedDocumentIds: ['guide_oguri_cap_build', 'guide_front_runner_strategy'],
    taxonomyIds: ['card.speed_ssr']
  },

  // 5. Training
  {
    id: 'guide_spark_inheritance',
    title: 'Inheritance Spark & Parent Factor Selection Guide',
    category: 'Training',
    tags: ['inheritance', 'spark', 'parent', 'factors', 'affinity', 'white_factors'],
    content: 'Inheritance occurs at the start of training, in April of Year 2, and in April of Year 3. Blue factors provide permanent flat stat boosts (3-star Blue = +21 base stat). Red factors increase track/distance aptitude grades (e.g., B -> A). Compatibility (Affinity circle/double circle) directly boosts the probability of acquiring green unique skills and white skill hints.',
    source: 'Official Umamusume Data',
    version: '1.2.0',
    updatedAt: new Date('2026-01-25'),
    recommendations: [
      'Use 3-star Blue factor parents to gain 63+ bonus stats per inheritance event',
      'Ensure Double Circle (Affinity) compatibility between trainee and parents'
    ],
    relatedDocumentIds: ['guide_oguri_cap_build'],
    taxonomyIds: ['mechanic.inheritance', 'factor.blue_stat']
  },

  // 6. Races
  {
    id: 'guide_races_tenno_sho_spring',
    title: 'Tenno Sho Spring (3200m Long) Preparation Guide',
    category: 'Races',
    tags: ['tenno_sho_spring', 'long_distance', 'race', 'kyoto', 'stamina_threshold'],
    content: 'Tenno Sho (Spring) held at Kyoto Racecourse is a grueling 3200m Long race. Stamina requirement: Minimum 850 Stamina with 2 Gold recovery skills or 1050 pure Stamina. Runners with insufficient stamina will suffer severe late-race deceleration (Spurt Fail). Guts of at least 400 is also recommended to sustain speed in the final uphill stretch.',
    source: 'Official Umamusume Data',
    version: '1.1.0',
    updatedAt: new Date('2026-02-12'),
    recommendations: [
      'Minimum 850 Stamina + 2 Gold heals (Arc Maestro + Gourmand)',
      'Prepare Long-distance specific speed and recovery skills'
    ],
    relatedDocumentIds: ['guide_stamina_skills'],
    taxonomyIds: ['race.tenno_sho_spring', 'distance.long']
  },

  // 7. Tracks
  {
    id: 'guide_tracks_mechanics',
    title: 'Turf vs Dirt and Track Distance Brackets Guide',
    category: 'Tracks',
    tags: ['tracks', 'turf', 'dirt', 'distance', 'mile', 'sprint', 'medium', 'long'],
    content: 'Tracks are divided by surface (Turf or Dirt) and distance brackets: Sprint (<1400m), Mile (1401m-1800m), Medium (1801m-2400m), and Long (2401m+). Surface aptitude directly affects acceleration and power transfer on the track; grade penalties below A severely reduce performance.',
    source: 'Official Umamusume Data',
    version: '1.0.0',
    updatedAt: new Date('2026-01-15'),
    recommendations: [
      'Never run a race with surface or distance aptitude below A-rank',
      'Use Red factor inheritance to upgrade B aptitudes to A before debut'
    ],
    taxonomyIds: ['track.turf', 'track.dirt', 'distance.mile']
  },

  // 8. Club Systems
  {
    id: 'guide_club_fan_target',
    title: 'Umakraft Club Policies & Minimum Monthly Fan Target',
    category: 'Club Systems',
    tags: ['club', 'fan_target', '150m', 'policy', 'review', 'umakraft', 'rules'],
    content: 'Umakraft is a top-tier competitive Umamusume club. Standard member requirement: Minimum monthly fan target of 150 Million Fans (150M). Fan gains are tracked daily through automated snapshots by Lily. Members who fall below pace receive notifications and are reviewed during the monthly club audit.',
    source: 'Club Policies',
    version: '2.0.0',
    updatedAt: new Date('2026-03-01'),
    recommendations: [
      'Maintain an average daily fan gain of 5M fans to comfortably hit the 150M target',
      'Schedule G1 races during Year 2 and Year 3 to maximize fans per career run'
    ],
    relatedDocumentIds: ['guide_fan_optimization', 'guide_club_inactivity_policy']
  },
  {
    id: 'guide_club_inactivity_policy',
    title: 'Umakraft Club Inactivity & Member Evaluation Policy',
    category: 'Club Systems',
    tags: ['club', 'inactivity', 'review', 'kick', 'policy', 'evaluation'],
    content: 'Members with unexcused inactivity exceeding 3 consecutive days or severe fan gain deficits at mid-month audit are subject to leadership review. Members traveling or unable to play must notify club officers in advance to place their account on temporary leave.',
    source: 'Club Policies',
    version: '1.5.0',
    updatedAt: new Date('2026-02-18'),
    recommendations: [
      'Submit leave requests to club leadership prior to planned inactivity periods'
    ],
    relatedDocumentIds: ['guide_club_fan_target']
  },

  // 9. Fan Systems
  {
    id: 'guide_fan_optimization',
    title: 'Fan Gain Optimization & G1 Race Scheduling Strategy',
    category: 'Fan Systems',
    tags: ['fans', 'optimization', 'fan_gain', 'g1_races', '150m', 'schedule'],
    content: 'Achieving 150M+ monthly fans requires optimal career race scheduling. A single optimized training run with high Fan Bonus support cards (+50% to +80% fan bonus) can yield 500,000 to 800,000 fans. Key high-fan G1 races: Japan Cup (30k base fans), Arima Kinen (30k base fans), Tenno Sho Autumn/Spring (20k base fans), and Takarazuka Kinen (20k base fans).',
    source: 'Umakraft Documentation',
    version: '1.4.0',
    updatedAt: new Date('2026-03-02'),
    recommendations: [
      'Equip support cards with Fan Bonus sub-traits (+15% per card)',
      'Enter Triple Crown or Autumn Triple Crown races during Classic and Senior years'
    ],
    relatedDocumentIds: ['guide_club_fan_target']
  },

  // 10. Linking Systems
  {
    id: 'guide_account_linking',
    title: 'Trainer Account Linking & Verification Procedure',
    category: 'Linking Systems',
    tags: ['linking', 'account', 'trainer_id', 'discord', 'verification', 'link_request'],
    content: 'To enable automated fan tracking, leaderboard placement, and club profile synchronization, members must link their 9-digit Umamusume Trainer ID to their Discord account. Procedure: Use the command `/link <Trainer_ID>` or message Lily directly with your Trainer ID and in-game Trainer Name. An officer or automated verification will confirm the link.',
    source: 'Umakraft Documentation',
    version: '1.2.0',
    updatedAt: new Date('2026-01-20'),
    recommendations: [
      'Ensure in-game Trainer ID is entered accurately without spaces or hyphens'
    ],
    relatedDocumentIds: ['guide_lily_commands']
  },

  // 11. Bot Features
  {
    id: 'guide_lily_commands',
    title: 'Lily AI Assistant Features & Daily Snapshot Commands',
    category: 'Bot Features',
    tags: ['bot', 'lily', 'commands', 'snapshots', 'leaderboard', 'deficit', 'fan_tracker'],
    content: 'Lily AI provides 24/7 intelligent assistance for Umakraft members. Core capabilities: Daily fan gain tracking, deficit calculation against the 150M monthly goal, real-time leaderboard queries, interactive Umamusume build advice, taxonomy lookups, and handbook strategy guides. Ask Lily questions naturally in Discord DMs or club channels.',
    source: 'System Documentation',
    version: '2.1.0',
    updatedAt: new Date('2026-03-10'),
    recommendations: [
      'Ask "What is my fan deficit?" to check real-time progress towards the monthly target',
      'Ask "How do I build Oguri Cap?" to retrieve tailored character strategy guides'
    ],
    relatedDocumentIds: ['guide_account_linking', 'guide_club_fan_target']
  }
];

export class HandbookLoader {
  public static load(seedDocuments: HandbookDocument[] = CORE_HANDBOOK_DOCUMENTS): HandbookDocument[] {
    return [...seedDocuments];
  }
}
