export interface LilyAIRequest {
  userId: string;
  username?: string;
  message: string;
  guildId?: string;
  channelId?: string;
}

export interface LilyAIResponse {
  success: boolean;
  response: string;
  error?: string;
}

export interface LilyAIContext {
  userId: string;
  sessionId: string;
  timestamp: Date;
}
