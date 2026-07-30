import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger('FilesystemTools');

// ── Workspace sandbox ──

/**
 * Root directory that all filesystem tool paths must stay within.
 * Default: current working directory. Override with WORKSPACE_ROOT env var.
 */
const WORKSPACE_ROOT = path.resolve(process.env['WORKSPACE_ROOT'] || process.cwd());

function resolvePath(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath);

  // Ensure the resolved path stays within WORKSPACE_ROOT
  // Normalise both to handle trailing separators and symlinks
  const normRoot = path.normalize(WORKSPACE_ROOT) + path.sep;
  const normResolved = path.normalize(resolved) + path.sep;

  if (!normResolved.startsWith(normRoot) && path.normalize(resolved) !== path.normalize(WORKSPACE_ROOT)) {
    throw new Error(
      `Path traversal blocked: "${filePath}" resolves outside workspace root. ` +
      `Workspace root: ${WORKSPACE_ROOT}`
    );
  }

  return resolved;
}

// ── Tools ──

export const filesystemWriteFile: ToolDefinition = {
  slug: 'filesystem-write-file',
  name: 'Write File',
  description: 'Writes text content to a file in the workspace, creating any parent folders automatically.',
  parameters: {
    path: {
      type: 'string',
      description: 'Relative or absolute path within the workspace root',
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
      const fullPath = resolvePath(filePath);
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
      description: 'Relative or absolute path within the workspace root',
      required: true
    }
  },
  handler: async (args) => {
    const filePath = args['path'];
    logger.info(`Reading content from file: ${filePath}`);
    try {
      const fullPath = resolvePath(filePath);
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

export const allTools = [
  filesystemWriteFile,
  filesystemReadFile,
  webFetch,
  webSearch,
  emailSend,
  slackSendMessage,
];
