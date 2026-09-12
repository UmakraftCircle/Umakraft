import { CharacterSource } from './character-source.js';
import { SkillSource } from './skill-source.js';
import { SupportSource } from './support-source.js';
import { RaceSource } from './race-source.js';
import { TrackSource } from './track-source.js';

export const UmaKnowledge = {
    CharacterSource: new CharacterSource(),
    SkillSource: new SkillSource(),
    SupportSource: new SupportSource(),
    RaceSource: new RaceSource(),
    TrackSource: new TrackSource()
};
