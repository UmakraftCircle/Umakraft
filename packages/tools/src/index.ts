import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger('FilesystemTools');

// ── Path sandboxing ──

const WORKSPACE_ROOT = path.resolve(process.env['WORKSPACE_ROOT'] || process.cwd());

function resolveSafe(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath);
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path traversal blocked: "${filePath}" resolves outside workspace root`);
  }
  return resolved;
}

export const filesystemWriteFile: ToolDefinition = {
  slug: 'filesystem-write-file',
  name: 'Write File',
  description: 'Writes text content to a file in the workspace, creating any parent folders automatically.',
  parameters: {
    path: {
      type: 'string',
      description: 'The absolute or relative path to the file to write',
      required: true
    },
    content: {
      type: 'string',
      description: 'The text content to write into the file',
      required: true
    }
  },
  handler: async (args) => {
    const filePath = args['path'];
    const content = args['content'];
    
    logger.info(`Writing content to file: ${filePath}`);
    
    try {
      const fullPath = resolveSafe(filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return { success: true, path: fullPath, bytesWritten: Buffer.byteLength(content) };
    } catch (error: any) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }
};

export const filesystemReadFile: ToolDefinition = {
  slug: 'filesystem-read-file',
  name: 'Read File',
  description: 'Reads text content from a file in the workspace.',
  parameters: {
    path: {
      type: 'string',
      description: 'The path to the file to read',
      required: true
    }
  },
  handler: async (args) => {
    const filePath = args['path'];
    logger.info(`Reading content from file: ${filePath}`);
    try {
      const fullPath = resolveSafe(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return { success: true, content };
    } catch (error: any) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }
};

// ── Re-export web and notification tools ──
export { webFetch, webSearch, webTools } from './web.js';
export { emailSend, slackSendMessage, notificationTools } from './notifications.js';

export const allTools = [filesystemWriteFile, filesystemReadFile];
