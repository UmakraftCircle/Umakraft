export function pushRelayMessage(m: any): void;
export function drainRelayInbox(afterId: any): {
    id: string;
    author_id: string;
    author_name: string;
    channel_id: string;
    guild_id: string | null;
    content: string;
    mentions_bot: boolean;
    created_at: number;
}[];
export function relayInboxSize(): number;
export function clearRelayInbox(): void;
//# sourceMappingURL=relay-inbox.d.cts.map