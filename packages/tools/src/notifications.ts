import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('NotificationTools');

/**
 * Sends an email notification via SMTP or a configured email provider.
 * Falls back to logging if no email credentials are configured.
 */
export const emailSend: ToolDefinition = {
  slug: 'email-send',
  name: 'Email: Send',
  description: 'Sends an email notification via configured SMTP or provider.',
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
  },
  handler: async (args) => {
    const to = args['to'];
    const subject = args['subject'];
    const body = args['body'];

    logger.info(`Sending email to "${to}" with subject "${subject}"...`);

    // In a real deployment, integrate with Resend, SendGrid, SES, or SMTP
    const providerUrl = process.env['EMAIL_API_URL'];
    const providerKey = process.env['EMAIL_API_KEY'];

    if (providerUrl && providerKey) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(providerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${providerKey}`
          },
          body: JSON.stringify({ to, subject, text: body }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Email provider returned ${response.status}: ${errText}`);
        }
      } finally {
        clearTimeout(timer);
      }

        logger.info(`Email sent successfully to ${to}`);
        return { success: true, to, subject, timestamp: new Date().toISOString() };
      } catch (error: any) {
        logger.error(`Failed to send email via provider: ${error.message}`);
        throw new Error(`Email delivery failed: ${error.message}`);
      }
    }

    // Fallback: log the email for development
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

/**
 * Sends a message to a Slack channel via webhook URL.
 */
export const slackSendMessage: ToolDefinition = {
  slug: 'slack-send-message',
  name: 'Slack: Send Message',
  description: 'Sends a Markdown-formatted message to a Slack channel via incoming webhook.',
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
  },
  handler: async (args) => {
    const message = args['message'];
    const webhookUrl = args['webhookUrl'] || process.env['SLACK_WEBHOOK_URL'];

    logger.info(`Sending Slack message: "${message.slice(0, 80)}..."`);

    if (webhookUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Slack webhook returned ${response.status}`);
        }
      } finally {
        clearTimeout(timer);
      }

        logger.info('Slack message sent successfully.');
        return { success: true, platform: 'slack', timestamp: new Date().toISOString() };
      } catch (error: any) {
        logger.error(`Failed to send Slack message: ${error.message}`);
        throw new Error(`Slack delivery failed: ${error.message}`);
      }
    }

    // Fallback
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

export const notificationTools = [emailSend, slackSendMessage];
