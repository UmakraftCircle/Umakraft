import { VocabularyRegistry, VocabularyEntry } from './vocabulary-registry.js';
import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_CORE_VOCABULARY: VocabularyEntry[] = [
  {
    word: 'run',
    definition: 'to move swiftly on foot with rapid steps',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['sprint', 'dash']
  },
  {
    word: 'runner',
    definition: 'a person or thing that runs',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['racer', 'sprinter']
  },
  {
    word: 'fast',
    definition: 'moving or able to move at high speed',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['quick', 'rapid', 'swift']
  },
  {
    word: 'slow',
    definition: 'operating, moving, or acting with little speed',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['sluggish', 'unhurried']
  },
  {
    word: 'speed',
    definition: 'the rate at which someone or something is able to move or operate',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['velocity', 'pace']
  },
  {
    word: 'stamina',
    definition: 'the ability to sustain prolonged physical or mental effort',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['endurance', 'energy']
  },
  {
    word: 'power',
    definition: 'physical strength and the capacity to exert force',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['strength', 'might']
  },
  {
    word: 'guts',
    definition: 'courage, determination, and tenacity under pressure',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['grit', 'perseverance', 'spirit']
  },
  {
    word: 'intelligence',
    definition: 'the ability to acquire and apply knowledge and skills',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['wit', 'intellect']
  },
  {
    word: 'walk',
    definition: 'to move at a regular pace by lifting and setting down each foot in turn',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'jump',
    definition: 'to push oneself off a surface and into the air',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['leap', 'bound']
  },
  {
    word: 'train',
    definition: 'to develop or enhance physical or mental capabilities through systematic practice',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['practice', 'exercise', 'condition']
  },
  {
    word: 'trainer',
    definition: 'a person who coaches, guides, and trains athletes or trainees',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['coach', 'mentor']
  },
  {
    word: 'race',
    definition: 'a competition between runners or athletes to determine who is the fastest',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['derby', 'contest', 'match']
  },
  {
    word: 'horse',
    definition: 'a powerful domesticated mammal known for speed and stamina',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['steed', 'equine']
  },
  {
    word: 'track',
    definition: 'a prepared surface or circuit dedicated to racing competitions',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['course', 'turf', 'circuit']
  },
  {
    word: 'win',
    definition: 'to be successful or victorious in a contest or competition',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['triumph', 'prevail']
  },
  {
    word: 'winner',
    definition: 'a person or participant that wins a competition',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['victor', 'champion']
  },
  {
    word: 'lose',
    definition: 'to be defeated or fail to win in a competition',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['fail']
  },
  {
    word: 'play',
    definition: 'to engage in activity for enjoyment, sport, or recreation',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'player',
    definition: 'a person participating in a game or competitive match',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['gamer', 'competitor']
  },
  {
    word: 'game',
    definition: 'a structured form of play or competitive amusement',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['match', 'title']
  },
  {
    word: 'start',
    definition: 'to begin a race, match, or course of action',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['commence', 'initiate']
  },
  {
    word: 'finish',
    definition: 'to reach the end of a race, contest, or progression',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['complete', 'conclude']
  },
  {
    word: 'champion',
    definition: 'a competitor who has defeated all rivals in a contest',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['titleholder']
  },
  {
    word: 'victory',
    definition: 'the defeat of an opponent or success in a contest',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['triumph', 'win']
  },
  {
    word: 'defeat',
    definition: 'the loss of a contest or failure to overcome an opponent',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['loss']
  },
  {
    word: 'friend',
    definition: 'a person whom one knows and with whom one has mutual affection and trust',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['companion', 'ally', 'pal']
  },
  {
    word: 'help',
    definition: 'to give assistance or support to someone',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['assist', 'aid']
  },
  {
    word: 'learn',
    definition: 'to gain knowledge or skill through study, experience, or teaching',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['master', 'acquire']
  },
  {
    word: 'think',
    definition: 'to use one\'s mind to consider or reason about something',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['ponder', 'reflect']
  },
  {
    word: 'understand',
    definition: 'to comprehend the meaning, nature, or significance of something',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['grasp', 'comprehend']
  },
  {
    word: 'speak',
    definition: 'to say words in order to convey information, thoughts, or feelings',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['talk', 'converse']
  },
  {
    word: 'write',
    definition: 'to compose text or communicate through written words',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'read',
    definition: 'to look at and understand the meaning of written text',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'listen',
    definition: 'to pay attention to sounds or spoken communication',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['hear']
  },
  {
    word: 'see',
    definition: 'to perceive with the eyes or become aware visually',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['view', 'look', 'observe']
  },
  {
    word: 'hear',
    definition: 'to perceive sound with the auditory system',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'give',
    definition: 'to transfer possession or deliver something freely to someone',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['grant', 'provide']
  },
  {
    word: 'take',
    definition: 'to grasp, seize, or acquire possession of something',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['seize', 'acquire']
  },
  {
    word: 'make',
    definition: 'to create, construct, or cause something to exist',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['create', 'build']
  },
  {
    word: 'go',
    definition: 'to move from one place or state to another',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['travel', 'proceed']
  },
  {
    word: 'come',
    definition: 'to move toward a specified destination or position',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['arrive', 'approach']
  },
  {
    word: 'good',
    definition: 'having high quality, favorable attributes, or moral excellence',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['great', 'fine', 'positive']
  },
  {
    word: 'bad',
    definition: 'of poor quality, unfavorable, or deficient',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['poor', 'terrible']
  },
  {
    word: 'great',
    definition: 'of remarkable ability, quality, or extent',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['magnificent', 'grand']
  },
  {
    word: 'small',
    definition: 'of limited size, dimensions, or degree',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['little', 'tiny']
  },
  {
    word: 'big',
    definition: 'of considerable size, extent, or importance',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['large', 'huge']
  },
  {
    word: 'strong',
    definition: 'possessing physical power, resilience, or vigor',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['powerful', 'mighty']
  },
  {
    word: 'weak',
    definition: 'lacking physical strength, energy, or firmness',
    partOfSpeech: 'adjective',
    language: 'en',
    aliases: ['frail', 'feeble']
  },
  {
    word: 'quickly',
    definition: 'at a fast speed or in a short time',
    partOfSpeech: 'adverb',
    language: 'en',
    aliases: ['rapidly', 'swiftly']
  },
  {
    word: 'slowly',
    definition: 'at a slow pace; not quickly',
    partOfSpeech: 'adverb',
    language: 'en',
    aliases: ['leisurely']
  },
  {
    word: 'well',
    definition: 'in an effective, proficient, or satisfactory manner',
    partOfSpeech: 'adverb',
    language: 'en',
    aliases: ['satisfactorily']
  },
  {
    word: 'badly',
    definition: 'in an unsatisfactory, inadequate, or harmful way',
    partOfSpeech: 'adverb',
    language: 'en',
    aliases: ['poorly']
  },
  {
    word: 'always',
    definition: 'at all times or on every occasion',
    partOfSpeech: 'adverb',
    language: 'en',
    aliases: ['forever', 'consistently']
  },
  {
    word: 'never',
    definition: 'at no time in the past, present, or future',
    partOfSpeech: 'adverb',
    language: 'en'
  },
  {
    word: 'often',
    definition: 'many times or at frequent intervals',
    partOfSpeech: 'adverb',
    language: 'en',
    aliases: ['frequently']
  },
  {
    word: 'now',
    definition: 'at the present time or moment',
    partOfSpeech: 'adverb',
    language: 'en',
    aliases: ['currently']
  },
  {
    word: 'then',
    definition: 'at that specific time or moment in the past or future',
    partOfSpeech: 'adverb',
    language: 'en'
  },
  {
    word: 'here',
    definition: 'in, at, or to this present place or location',
    partOfSpeech: 'adverb',
    language: 'en'
  },
  {
    word: 'there',
    definition: 'in, at, or to that specific place or position',
    partOfSpeech: 'adverb',
    language: 'en'
  },
  {
    word: 'i',
    definition: 'the pronoun used by a speaker to refer to themselves',
    partOfSpeech: 'pronoun',
    language: 'en'
  },
  {
    word: 'you',
    definition: 'the pronoun used to address the person or people being spoken to',
    partOfSpeech: 'pronoun',
    language: 'en'
  },
  {
    word: 'he',
    definition: 'the pronoun used to refer to a male person or animal',
    partOfSpeech: 'pronoun',
    language: 'en'
  },
  {
    word: 'she',
    definition: 'the pronoun used to refer to a female person or animal',
    partOfSpeech: 'pronoun',
    language: 'en'
  },
  {
    word: 'it',
    definition: 'the pronoun used to refer to an object, entity, or non-human animal',
    partOfSpeech: 'pronoun',
    language: 'en'
  },
  {
    word: 'we',
    definition: 'the pronoun used by a speaker to refer to themselves along with others',
    partOfSpeech: 'pronoun',
    language: 'en'
  },
  {
    word: 'they',
    definition: 'the pronoun used to refer to two or more people or things previously mentioned',
    partOfSpeech: 'pronoun',
    language: 'en'
  },
  {
    word: 'in',
    definition: 'expressing inclusion within a boundary, area, or container',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'on',
    definition: 'indicating contact with and support by a surface',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'at',
    definition: 'expressing location or arrival at a specific point or event',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'to',
    definition: 'expressing direction or motion toward a destination',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'for',
    definition: 'indicating purpose, recipient, or benefit',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'with',
    definition: 'accompanied by, in association with, or utilizing',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'from',
    definition: 'indicating source, origin, or starting point',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'by',
    definition: 'identifying the agent or means performing an action',
    partOfSpeech: 'preposition',
    language: 'en'
  },
  {
    word: 'and',
    definition: 'connecting words, clauses, or sentences of equal grammatical rank',
    partOfSpeech: 'conjunction',
    language: 'en'
  },
  {
    word: 'but',
    definition: 'introducing a contrast or qualification to a preceding statement',
    partOfSpeech: 'conjunction',
    language: 'en'
  },
  {
    word: 'or',
    definition: 'connecting alternatives or choices',
    partOfSpeech: 'conjunction',
    language: 'en'
  },
  {
    word: 'so',
    definition: 'and for that reason; therefore',
    partOfSpeech: 'conjunction',
    language: 'en'
  },
  {
    word: 'because',
    definition: 'for the reason that; since',
    partOfSpeech: 'conjunction',
    language: 'en'
  },
  {
    word: 'if',
    definition: 'introducing a conditional supposition or requirement',
    partOfSpeech: 'conjunction',
    language: 'en'
  },
  {
    word: 'although',
    definition: 'in spite of the fact that; even though',
    partOfSpeech: 'conjunction',
    language: 'en'
  },
  {
    word: 'hello',
    definition: 'a customary greeting or welcoming exclamation',
    partOfSpeech: 'interjection',
    language: 'en',
    aliases: ['hi', 'greetings']
  },
  {
    word: 'goodbye',
    definition: 'an expression of farewell used upon parting',
    partOfSpeech: 'interjection',
    language: 'en',
    aliases: ['bye', 'farewell']
  },
  {
    word: 'wow',
    definition: 'an exclamation expressing astonishment, wonder, or excitement',
    partOfSpeech: 'interjection',
    language: 'en'
  },
  {
    word: 'yay',
    definition: 'an exclamation of triumph, joy, or encouragement',
    partOfSpeech: 'interjection',
    language: 'en'
  },
  {
    word: 'please',
    definition: 'a polite formula used in making requests',
    partOfSpeech: 'interjection',
    language: 'en'
  },
  {
    word: 'thanks',
    definition: 'an exclamation expressing appreciation or gratitude',
    partOfSpeech: 'interjection',
    language: 'en',
    aliases: ['thank you', 'thx']
  },
  {
    word: 'buff',
    definition: 'an enhancement or boost to a character, ability, or stat',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['boost', 'upgrade']
  },
  {
    word: 'nerf',
    definition: 'a reduction in power or effectiveness applied by game balance updates',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['downgrade', 'weakening']
  },
  {
    word: 'aggro',
    definition: 'hostile attention and targeting from non-player enemies in a game',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['threat', 'hate']
  },
  {
    word: 'cooldown',
    definition: 'the required waiting duration after using an ability before it can be used again',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['cd']
  },
  {
    word: 'gank',
    definition: 'to ambush an unsuspecting or weaker opponent with numerical advantage',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['ambush']
  },
  {
    word: 'meta',
    definition: 'the most effective tactics available or dominant strategy in competitive gameplay',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['optimal', 'standard']
  },
  {
    word: 'dps',
    definition: 'damage per second; a measure of offensive output or a combat role focused on damage',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'tank',
    definition: 'a character role with high durability designed to absorb enemy attacks and protect allies',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'healer',
    definition: 'a character role specialized in restoring health and supporting teammates',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['medic', 'support']
  },
  {
    word: 'carry',
    definition: 'a character or player that leads their team to victory through late-game scaling',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'feed',
    definition: 'to die repeatedly to opponents, granting them excessive resources or advantages',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'glitch',
    definition: 'a temporary malfunction, bug, or unexpected behavior in game software',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['bug']
  },
  {
    word: 'patch',
    definition: 'a software update providing bug fixes, balance adjustments, or new content',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['update', 'hotfix']
  },
  {
    word: 'loot',
    definition: 'items, equipment, or currency acquired from defeating enemies or completing objectives',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['rewards', 'drops']
  },
  {
    word: 'grind',
    definition: 'to perform repetitive gameplay tasks to earn experience, levels, or items',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['farm']
  },
  {
    word: 'rng',
    definition: 'random number generator; referring to random chance mechanics in games',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'pve',
    definition: 'player versus environment; game modes where players battle computer-controlled opponents',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'pvp',
    definition: 'player versus player; game modes where players compete directly against each other',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'aoe',
    definition: 'area of effect; an ability or attack that impacts an entire designated zone',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'crit',
    definition: 'a critical hit that deals enhanced damage beyond standard attacks',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['critical hit']
  },
  {
    word: 'debuff',
    definition: 'a negative effect, curse, or penalty applied to a character',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['penalty', 'curse']
  },
  {
    word: 'mob',
    definition: 'a generic non-player monster or enemy creature in a video game',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['creature', 'monster']
  },
  {
    word: 'npc',
    definition: 'non-player character; a computer-controlled entity in a game',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'stun',
    definition: 'an incapacitating status effect temporarily preventing a target from acting',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'mana',
    definition: 'the magical energy resource consumed to activate spells and special abilities',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['mp', 'energy']
  },
  {
    word: 'hp',
    definition: 'hit points or health points representing the remaining vitality of a character',
    partOfSpeech: 'abbreviation',
    language: 'en',
    aliases: ['health', 'life']
  },
  {
    word: 'exp',
    definition: 'experience points earned to level up or enhance character capabilities',
    partOfSpeech: 'abbreviation',
    language: 'en',
    aliases: ['xp', 'experience']
  },
  {
    word: 'tier',
    definition: 'a classification level indicating the relative power or competitive standing of an entity',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['rank', 'grade']
  },
  {
    word: 'build',
    definition: 'the specific configuration of stats, skills, equipment, and talents chosen for a character',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['setup', 'loadout']
  },
  {
    word: 'loadout',
    definition: 'the selected combination of equipment, abilities, and weapons chosen before a match',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'quest',
    definition: 'an assigned objective or mission undertaken by a player for rewards',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['mission', 'task']
  },
  {
    word: 'raid',
    definition: 'a high-difficulty cooperative mission requiring a coordinated team of players',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'boss',
    definition: 'a formidable, high-power enemy encountered at the climax of a level or dungeon',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'speedrun',
    definition: 'a playthrough of a game or segment completed in the fastest time possible',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'clutch',
    definition: 'performing a decisive or victorious action under intense pressure',
    partOfSpeech: 'adjective',
    language: 'en'
  },
  {
    word: 'choke',
    definition: 'to fail unexpectedly under critical pressure when in a winning position',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'dm',
    definition: 'a direct message sent privately between users on Discord or chat platforms',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['direct message', 'pm']
  },
  {
    word: 'ping',
    definition: 'a notification or mention sent to alert a user or role in chat',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['mention', 'alert']
  },
  {
    word: 'mute',
    definition: 'to silence audio or revoke messaging and speaking permissions for a user',
    partOfSpeech: 'verb',
    language: 'en',
    aliases: ['silence']
  },
  {
    word: 'deafen',
    definition: 'to mute incoming sound from voice channels for a user',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'mod',
    definition: 'a moderator responsible for enforcing server guidelines and community order',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['moderator']
  },
  {
    word: 'admin',
    definition: 'an administrator with full management and governance permissions over a server',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['administrator']
  },
  {
    word: 'server',
    definition: 'a dedicated community space composed of text and voice channels on Discord',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['guild', 'community']
  },
  {
    word: 'guild',
    definition: 'the internal Discord architectural term for a server community',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['server']
  },
  {
    word: 'bot',
    definition: 'an automated software client interacting with chat messages and slash commands',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['agent', 'automaton']
  },
  {
    word: 'channel',
    definition: 'a dedicated topic space for text chat or voice conversations within a server',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['room']
  },
  {
    word: 'reaction',
    definition: 'an emoji attached to a message expressing a response or emotion',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['react']
  },
  {
    word: 'voice',
    definition: 'real-time spoken audio communication in a dedicated channel',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['vc']
  },
  {
    word: 'mention',
    definition: 'tagging a user or role using @ to send an alert in chat',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['ping']
  },
  {
    word: 'role',
    definition: 'a permission set and colored badge assigned to members in a server',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'kick',
    definition: 'to remove a member from a server while allowing them the ability to return',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'ban',
    definition: 'to permanently prohibit a member from joining or viewing a server',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'unban',
    definition: 'to lift a previous ban and allow a user re-entry to a server',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'webhook',
    definition: 'an HTTP POST endpoint allowing automated external systems to push messages into chat',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'embed',
    definition: 'a rich structured card containing titles, images, links, and fields in Discord chat',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'thread',
    definition: 'a sub-conversation stemming from a channel message to keep discussions focused',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'nitro',
    definition: 'Discord subscription service offering custom emotes, larger uploads, and profile perks',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'emoji',
    definition: 'a small digital icon or pictogram expressing emotion in messaging platforms',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['emote']
  },
  {
    word: 'sticker',
    definition: 'a large illustrated graphic sent in messaging platforms',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'slowmode',
    definition: 'a channel rate limiter enforcing a waiting interval between successive user messages',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'afk',
    definition: 'away from keyboard; temporarily away from the computer or chat',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'gg',
    definition: 'good game; expressed after a competitive match in sportsmanship',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'brb',
    definition: 'be right back; indicating a brief temporary absence',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'lol',
    definition: 'laugh out loud; an expression of amusement',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'meme',
    definition: 'a humorous image, video, or piece of text that is copied and spread rapidly online',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'btw',
    definition: 'by the way; introducing an incidental remark or topic',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'tbh',
    definition: 'to be honest; prefacing a frank and sincere opinion',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'idk',
    definition: 'I do not know; stating a lack of information or certainty',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'rofl',
    definition: 'rolling on the floor laughing; expressing intense amusement',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'smh',
    definition: 'shaking my head; expressing disbelief, exasperation, or disappointment',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'noob',
    definition: 'an inexperienced newcomer or beginner in a game or activity',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['newbie', 'novice']
  },
  {
    word: 'pro',
    definition: 'a highly experienced, proficient, or professional player',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['expert', 'master']
  },
  {
    word: 'lurk',
    definition: 'to read community discussions without actively posting or participating',
    partOfSpeech: 'verb',
    language: 'en'
  },
  {
    word: 'troll',
    definition: 'a person who posts inflammatory or provocative comments to bait reactions',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'op',
    definition: 'original poster in a forum thread or overpowered in game balance context',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'rip',
    definition: 'rest in peace; used colloquially to acknowledge a defeat or mishap',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'vibe',
    definition: 'the distinctive mood, feeling, or atmosphere surrounding a person or setting',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['mood', 'atmosphere']
  },
  {
    word: 'sus',
    definition: 'suspicious, dubious, or questionable in behavior',
    partOfSpeech: 'adjective',
    language: 'en'
  },
  {
    word: 'based',
    definition: 'courageously authentic, true to oneself, and unconcerned with others\' opinions',
    partOfSpeech: 'adjective',
    language: 'en'
  },
  {
    word: 'cringe',
    definition: 'causing feelings of acute embarrassment, secondhand awkwardness, or discomfort',
    partOfSpeech: 'adjective',
    language: 'en'
  },
  {
    word: 'ratio',
    definition: 'a reply receiving more likes or reactions than the original post, signifying disagreement',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'hype',
    definition: 'intense excitement, promotion, and anticipation surrounding an upcoming event',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'goat',
    definition: 'greatest of all time; an accolade celebrating unmatched athletic or skill mastery',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'cap',
    definition: 'a falsehood, lie, or exaggeration',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['lie']
  },
  {
    word: 'nocap',
    definition: 'speaking genuine truth without exaggeration or falsehood',
    partOfSpeech: 'phrase',
    language: 'en',
    aliases: ['for real', 'no lie']
  },
  {
    word: 'glhf',
    definition: 'good luck, have fun; a respectful greeting exchanged at the start of a match',
    partOfSpeech: 'abbreviation',
    language: 'en'
  },
  {
    word: 'front_runner',
    definition: 'a running tactic where the racer takes the lead immediately from the start gate',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['nige', 'front runner', 'pacemaker']
  },
  {
    word: 'pace_chaser',
    definition: 'a running tactic positioned directly behind the front runners before striking in the straight',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['senkou', 'pace chaser', 'leader']
  },
  {
    word: 'late_surger',
    definition: 'a running tactic that conserves stamina in mid-pack before launching a powerful late surge',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['sashi', 'late surger', 'betweener']
  },
  {
    word: 'end_closer',
    definition: 'a running tactic trailing near the back before deploying an explosive finishing burst',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['oikomi', 'end closer', 'chaser']
  },
  {
    word: 'turf',
    definition: 'a natural grass track racing surface',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['grass']
  },
  {
    word: 'dirt',
    definition: 'a sandy or earthen track racing surface',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['sand']
  },
  {
    word: 'sprint',
    definition: 'a short-distance race of 1400 meters or less prioritizing explosive top speed',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'mile',
    definition: 'a medium-short race distance between 1401 and 1800 meters balancing speed and stamina',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'medium',
    definition: 'a standard middle-distance race between 1801 and 2400 meters',
    partOfSpeech: 'adjective',
    language: 'en'
  },
  {
    word: 'long',
    definition: 'an endurance race distance of 2401 meters or greater demanding exceptional stamina',
    partOfSpeech: 'adjective',
    language: 'en'
  },
  {
    word: 'mood',
    definition: 'the emotional and motivational condition influencing training and race performance',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['morale']
  },
  {
    word: 'fan',
    definition: 'an enthusiastic supporter whose following unlocks scenario race prerequisites',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['supporter']
  },
  {
    word: 'debut',
    definition: 'the first official competitive race of a rookie racing athlete',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'maiden',
    definition: 'a race category reserved exclusively for athletes seeking their first career victory',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'classic',
    definition: 'prestigious three-year-old championship races including the Triple Crown circuit',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'senior',
    definition: 'the division for seasoned racers in their fourth competitive year and beyond',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'aura',
    definition: 'a visible energetic glow signifying heightened motivation, momentum, or resolve',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'factor',
    definition: 'an inheritable trait passed across generations to grant stat gains or skill hints',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['spark', 'inheritance']
  },
  {
    word: 'spark',
    definition: 'an inspiration trigger during training granting bonus stats or inspiration boosts',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'climax',
    definition: 'the decisive final competition phase culminating an athlete\'s training campaign',
    partOfSpeech: 'noun',
    language: 'en'
  },
  {
    word: 'aptitude',
    definition: 'the graded natural capability of an athlete across track surfaces and race distances',
    partOfSpeech: 'noun',
    language: 'en',
    aliases: ['grade', 'suitability']
  }
];

export class VocabularyLoader {
  /**
   * Loads vocabulary into a new VocabularyRegistry.
   */
  public static load(entries: VocabularyEntry[] = DEFAULT_CORE_VOCABULARY): VocabularyRegistry {
    const registry = new VocabularyRegistry();
    for (const entry of entries) {
      registry.register(entry);
    }
    return registry;
  }

  /**
   * Loads vocabulary from raw JSON string.
   */
  public static loadFromJson(jsonString: string): VocabularyRegistry {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid vocabulary JSON: expected array of VocabularyEntry');
    }
    return this.load(parsed as VocabularyEntry[]);
  }

  /**
   * Loads vocabulary from a JSON file path on disk, falling back to DEFAULT_CORE_VOCABULARY if not found.
   */
  public static loadFromFile(filePath?: string): VocabularyRegistry {
    if (filePath && fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.loadFromJson(content);
      } catch {
        // Fallback to default
      }
    }
    return this.load();
  }
}
