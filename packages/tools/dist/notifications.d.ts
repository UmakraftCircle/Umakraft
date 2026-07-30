import { ToolDefinition } from '@ai-agent-platform/shared';
/**
 * Sends an email notification via SMTP or a configured email provider.
 * Falls back to logging if no email credentials are configured.
 */
export declare const emailSend: ToolDefinition;
/**
 * Sends a message to a Slack channel via webhook URL.
 */
export declare const slackSendMessage: ToolDefinition;
export declare const notificationTools: ToolDefinition[];
//# sourceMappingURL=notifications.d.ts.map