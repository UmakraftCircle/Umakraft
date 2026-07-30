/**
 * All slash command definitions for the Umamusume Fan Tracker bot.
 *
 * Command tree:
 *   /sync                              [ADMIN]  — refresh cached data
 *   /fan gain [period]                 [ALL]    — fan count change (daily|weekly|monthly)
 *   /fan leaderboard [top] [period]    [ALL]    — ranked leaderboard
 *   /link add [user] [trainer]         [ADMIN]  — link Discord user to trainer (autocomplete)
 *   /link remove [user]                [ADMIN]  — unlink Discord user
 *   /link list                         [ALL]    — show all linked pairs
 */
export declare const syncCommand: import("discord.js").RESTPostAPIChatInputApplicationCommandsJSONBody;
export declare const fanCommand: import("discord.js").RESTPostAPIChatInputApplicationCommandsJSONBody;
export declare const linkCommand: import("discord.js").RESTPostAPIChatInputApplicationCommandsJSONBody;
export declare const ALL_COMMANDS: import("discord.js").RESTPostAPIChatInputApplicationCommandsJSONBody[];
//# sourceMappingURL=commands.d.ts.map