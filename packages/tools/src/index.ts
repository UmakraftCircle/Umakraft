import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as fs from 'fs/promises';
import { realpath } from 'fs/promises';
import * as path from 'path';

const logger = createLogger('FilesystemTools');

// ── Workspace sandbox ──

/**
 * Root directory that all filesystem tool paths must stay within.
 * Default: current working directory. Override with WORKSPACE_ROOT env var.
 */
const WORKSPACE_ROOT = path.resolve(process.env['WORKSPACE_ROOT'] || process.cwd());

async function resolvePath(filePath: string): Promise<string> {
  // Resolve against workspace root first
  const lexical = path.resolve(WORKSPACE_ROOT, filePath);

  // Resolve symlinks to get the real path BEFORE containment check
  // This prevents symlink escapes (e.g. a symlink inside WORKSPACE_ROOT → /etc)
  let resolved: string;
  try {
    resolved = await realpath(lexical);
  } catch {
    // Path doesn't exist yet (e.g., writeFile creating a new file).
    // Walk up to find the first existing ancestor, resolve that, then append the rest.
    // This handles: mkdir -p of a new path that may have symlinks in its ancestry.
    let ancestor = lexical;
    const missing: string[] = [];
    while (ancestor !== path.parse(ancestor).root) {
      try {
        const stats = await fs.stat(ancestor);
        if (stats.isDirectory() || stats.isFile()) {
          break;
        }
      } catch {
        missing.unshift(path.basename(ancestor));
        ancestor = path.dirname(ancestor);
        continue;
      }
      missing.unshift(path.basename(ancestor));
      ancestor = path.dirname(ancestor);
    }

    try {
      resolved = path.join(await realpath(ancestor), ...missing);
    } catch {
      throw new Error(
        `Cannot resolve path "${filePath}": no existing ancestor found for containment check`
      );
    }
  }

  // Ensure the real resolved path stays within WORKSPACE_ROOT
  const normRoot = path.normalize(WORKSPACE_ROOT) + path.sep;
  const normResolved = path.normalize(resolved) + path.sep;

  if (!normResolved.startsWith(normRoot) && path.normalize(resolved) !== path.normalize(WORKSPACE_ROOT)) {
    throw new Error(
      `Path traversal blocked: "${filePath}" resolves outside workspace root via symlink. ` +
      `Resolved: ${resolved}, Workspace root: ${WORKSPACE_ROOT}`
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
      const fullPath = await resolvePath(filePath);
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
      const fullPath = await resolvePath(filePath);
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
