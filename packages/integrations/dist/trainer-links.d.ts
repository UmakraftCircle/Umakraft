export interface TrainerLink {
    discordUserId: string;
    trainerId: string;
    trainerName: string;
    linkedAt: string;
}
export declare class TrainerLinkStore {
    private tableReady;
    /** Ensure the trainer_links table exists (idempotent). */
    init(): Promise<void>;
    /** Return all linked trainer records. */
    getAll(): Promise<TrainerLink[]>;
    /** Look up a single link by Discord user ID. */
    getByDiscordUser(discordUserId: string): Promise<TrainerLink | null>;
    /** Insert or update a trainer link (upsert). */
    upsert(link: TrainerLink): Promise<void>;
    /** Remove a link. Returns the removed record or null. */
    remove(discordUserId: string): Promise<TrainerLink | null>;
    /** Count of linked users. */
    count(): Promise<number>;
}
export declare const trainerLinkStore: TrainerLinkStore;
//# sourceMappingURL=trainer-links.d.ts.map