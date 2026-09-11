import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import { ToolCapability, DisposableToolInstance, ToolCapabilityRegistration } from './types.js';

const logger = createLogger('NotificationTools');

// ── SSRF protection for webhook URLs ──

function validateWebhookUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`Invalid webhook URL: "${raw}"`); }
  if (url.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
  if (blocked.some(h => url.hostname.includes(h))) {
    throw new Error(`Webhook URL hostname is blocked: ${url.hostname}`);
  }
  return url;
}

// ── Capabilities Metadata ──

export const emailSendCapability: ToolCapability = {
  id: 'email-send',
  category: 'Notification',
  description: 'Sends an email notification via configured SMTP or provider.',
  lazy: true,
  name: 'Email: Send',
  parameters: {
    to: {
      type: 'string',
      description: 'Recipient email address',
      required: true
    },
    subject: {
      type: 'string',
      description: 'Email subject line',
      required: true
    },
    body: {
      type: 'string',
      description: 'Email body content (supports plain text and basic markdown)',
      required: true
    }
  }
};

export const slackSendMessageCapability: ToolCapability = {
  id: 'slack-send-message',
  category: 'Notification',
  description: 'Sends a Markdown-formatted message to a Slack channel via incoming webhook.',
  lazy: true,
  name: 'Slack: Send Message',
  parameters: {
    message: {
      type: 'string',
      description: 'Message text (supports Slack markdown formatting)',
      required: true
    },
    webhookUrl: {
      type: 'string',
      description: 'Slack incoming webhook URL (defaults to SLACK_WEBHOOK_URL env var)',
      required: false
    }
  }
};

/**
 * Creates an isolated, disposable instance of the email sender tool.
 */
export function createEmailSend(): DisposableToolInstance {
  let isDisposed = false;
  return {
    slug: emailSendCapability.id,
    name: emailSendCapability.name!,
    description: emailSendCapability.description,
    parameters: emailSendCapability.parameters!,
    capability: emailSendCapability,
    get isDisposed() {
      return isDisposed;
    },
    set isDisposed(v: boolean) {
      isDisposed = v;
    },
    dispose: () => {
      isDisposed = true;
      logger.debug('Disposed email-send instance');
    },
    handler: async (args) => {
      if (isDisposed) {
        throw new Error('Cannot execute disposed tool instance: email-send');
      }
      const to = args['to'];
      const subject = args['subject'];
      const body = args['body'];

      logger.info(`Sending email to "${to}" with subject "${subject}"...`);

      const providerUrl = process.env['EMAIL_API_URL'];
      const providerKey = process.env['EMAIL_API_KEY'];

      if (providerUrl && providerKey) {
        try {
          validateWebhookUrl(providerUrl);
          const response = await fetch(providerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${providerKey}`
            },
            body: JSON.stringify({ to, subject, text: body })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Email provider returned ${response.status}: ${errText}`);
          }

          logger.info(`Email sent successfully to ${to}`);
          return { success: true, to, subject, timestamp: new Date().toISOString() };
        } catch (error: any) {
          logger.error(`Failed to send email via provider: ${error.message}`);
          throw new Error(`Email delivery failed: ${error.message}`);
        }
      }

      logger.info(`[EMAIL FALLBACK] Would have sent to ${to}: "${subject}" — ${body.slice(0, 100)}...`);
      return {
        success: true,
        to,
        subject,
        mode: 'log-fallback',
        timestamp: new Date().toISOString(),
        warning: 'No EMAIL_API_URL configured — email was logged but not sent.'
      };
    }
  };
}

/**
 * Creates an isolated, disposable instance of the Slack notification tool.
 */
export function createSlackSendMessage(): DisposableToolInstance {
  let isDisposed = false;
  return {
    slug: slackSendMessageCapability.id,
    name: slackSendMessageCapability.name!,
    description: slackSendMessageCapability.description,
    parameters: slackSendMessageCapability.parameters!,
    capability: slackSendMessageCapability,
    get isDisposed() {
      return isDisposed;
    },
    set isDisposed(v: boolean) {
      isDisposed = v;
    },
    dispose: () => {
      isDisposed = true;
      logger.debug('Disposed slack-send-message instance');
    },
    handler: async (args) => {
      if (isDisposed) {
        throw new Error('Cannot execute disposed tool instance: slack-send-message');
      }
      const message = args['message'];
      const webhookUrl = args['webhookUrl'] || process.env['SLACK_WEBHOOK_URL'];

      logger.info(`Sending Slack message: "${message.slice(0, 80)}..."`);

      if (webhookUrl) {
        try {
          validateWebhookUrl(webhookUrl);
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message })
          });

          if (!response.ok) {
            throw new Error(`Slack webhook returned ${response.status}`);
          }

          logger.info('Slack message sent successfully.');
          return { success: true, platform: 'slack', timestamp: new Date().toISOString() };
        } catch (error: any) {
          logger.error(`Failed to send Slack message: ${error.message}`);
          throw new Error(`Slack delivery failed: ${error.message}`);
        }
      }

      logger.info(`[SLACK FALLBACK] Would have sent: "${message.slice(0, 80)}..."`);
      return {
        success: true,
        platform: 'slack',
        mode: 'log-fallback',
        timestamp: new Date().toISOString(),
        warning: 'No SLACK_WEBHOOK_URL configured — message was logged but not sent.'
      };
    }
  };
}

/**
 * Sends an email notification via SMTP or a configured email provider.
 * Falls back to logging if no email credentials are configured.
 */
export const emailSend: DisposableToolInstance = createEmailSend();

/**
 * Sends a message to a Slack channel via webhook URL.
 */
export const slackSendMessage: DisposableToolInstance = createSlackSendMessage();

export const notificationTools = [emailSend, slackSendMessage];

export const notificationCapabilities: ToolCapability[] = [
  emailSendCapability,
  slackSendMessageCapability
];

export const notificationRegistrations: ToolCapabilityRegistration[] = [
  { capability: emailSendCapability, factory: createEmailSend },
  { capability: slackSendMessageCapability, factory: createSlackSendMessage }
];

