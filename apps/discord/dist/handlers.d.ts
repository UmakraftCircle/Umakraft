import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
export declare function handleSync(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleFansGain(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleFansLeaderboard(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleLinkAdd(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleLinkRemove(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleLinkList(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleTrainerAutocomplete(interaction: AutocompleteInteraction): Promise<void>;
export declare function routeCommand(interaction: ChatInputCommandInteraction): Promise<void>;
//# sourceMappingURL=handlers.d.ts.map