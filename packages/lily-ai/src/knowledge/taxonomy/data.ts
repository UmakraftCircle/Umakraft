import { RunningStyle, Distance, Surface, Track, TaxonomyEntity } from './types.js';

export const TAXONOMY_DATA: TaxonomyEntity[] = [
  // Running Styles
  {
    id: 'RS_FRONT_RUNNER',
    canonical: RunningStyle.FRONT_RUNNER,
    type: 'running_style',
    aliases: ['front runner', 'nige', 'runner']
  },
  {
    id: 'RS_PACE_CHASER',
    canonical: RunningStyle.PACE_CHASER,
    type: 'running_style',
    aliases: ['pace chaser', 'senko', 'senkou', 'leader']
  },
  {
    id: 'RS_LATE_SURGER',
    canonical: RunningStyle.LATE_SURGER,
    type: 'running_style',
    aliases: ['late surger', 'sashi', 'chaser', 'betweener']
  },
  {
    id: 'RS_END_CLOSER',
    canonical: RunningStyle.END_CLOSER,
    type: 'running_style',
    aliases: ['end closer', 'oikomi', 'closer']
  },

  // Distances
  {
    id: 'DIST_SPRINT',
    canonical: Distance.SPRINT,
    type: 'distance',
    aliases: ['sprint', 'short']
  },
  {
    id: 'DIST_MILE',
    canonical: Distance.MILE,
    type: 'distance',
    aliases: ['mile']
  },
  {
    id: 'DIST_MEDIUM',
    canonical: Distance.MEDIUM,
    type: 'distance',
    aliases: ['medium', 'middle']
  },
  {
    id: 'DIST_LONG',
    canonical: Distance.LONG,
    type: 'distance',
    aliases: ['long']
  },

  // Surfaces
  {
    id: 'SURF_TURF',
    canonical: Surface.TURF,
    type: 'surface',
    aliases: ['turf', 'grass']
  },
  {
    id: 'SURF_DIRT',
    canonical: Surface.DIRT,
    type: 'surface',
    aliases: ['dirt', 'sand']
  },

  // Tracks
  { id: 'TRACK_NAKAYAMA', canonical: Track.NAKAYAMA, type: 'track', aliases: ['nakayama'] },
  { id: 'TRACK_TOKYO', canonical: Track.TOKYO, type: 'track', aliases: ['tokyo'] },
  { id: 'TRACK_HANSHIN', canonical: Track.HANSHIN, type: 'track', aliases: ['hanshin'] },
  { id: 'TRACK_KYOTO', canonical: Track.KYOTO, type: 'track', aliases: ['kyoto'] },
  { id: 'TRACK_CHUKYO', canonical: Track.CHUKYO, type: 'track', aliases: ['chukyo'] },
  { id: 'TRACK_OHI', canonical: Track.OHI, type: 'track', aliases: ['ohi', 'oi'] },
  { id: 'TRACK_KAWASAKI', canonical: Track.KAWASAKI, type: 'track', aliases: ['kawasaki'] },
  { id: 'TRACK_FUNABASHI', canonical: Track.FUNABASHI, type: 'track', aliases: ['funabashi'] },
  { id: 'TRACK_MORIOKA', canonical: Track.MORIOKA, type: 'track', aliases: ['morioka'] },

  // Example Skills
  { id: 'SKILL_CONCENTRATION', canonical: 'Concentration', type: 'skill', aliases: ['concentration', 'focus'] },
  { id: 'SKILL_PROFESSOR', canonical: 'Professor of Curvature', type: 'skill', aliases: ['professor of curvature', 'professor', 'arc professor'] },
  { id: 'SKILL_CORNER_ADEPT', canonical: 'Corner Adept ○', type: 'skill', aliases: ['corner adept', 'corner adept ○'] },
  { id: 'SKILL_VICTORY_SHOT', canonical: 'Victory Shot!', type: 'skill', aliases: ['victory shot', 'victory shot!'] },

  // Characters
  { id: 'CHAR_OGURI_CAP', canonical: 'Oguri Cap', type: 'character', aliases: ['oguri cap', 'oguri'] },
  { id: 'CHAR_MEJIRO_MCQUEEN', canonical: 'Mejiro McQueen', type: 'character', aliases: ['mejiro mcqueen', 'mcqueen'] },
  { id: 'CHAR_TOKAI_TEIO', canonical: 'Tokai Teio', type: 'character', aliases: ['tokai teio', 'teio'] }
];
