import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as fs from 'fs/promises';
import { realpath } from 'fs/promises';
import * as path from 'path';

const logger = createLogger('FilesystemTools');

// ── Workspace sandbox ──

const WORKSPACE_ROOT = path.resolve(process.env['WORKSPACE_ROOT'] || process.cwd());

/** Lexical containment check — fast, no realpath. Use for early rejection. */
function ensureLexicalContainment(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath);
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

/**
 * Realpath + containment check. Must be called IMMEDIATELY before the
 * file operation (readFile / writeFile) to avoid TOCTOU symlink swaps.
 */
async function verifyRealPath(lexical: string): Promise<string> {
  let resolved: string;
  try {
    resolved = await realpath(lexical);
  } catch {
    // Path doesn't exist yet (e.g. writeFile creating a new file).
    // Walk up to find the first existing ancestor, resolve that, then append the rest.
    let ancestor = lexical;
    const missing: string[] = [];
    while (ancestor !== path.parse(ancestor).root) {
      try {
        const stats = await fs.stat(ancestor);
        if (stats.isDirectory() || stats.isFile()) break;
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
        `Cannot resolve path "${lexical}": no existing ancestor for containment check`
      );
    }
  }

  const normRoot = path.normalize(WORKSPACE_ROOT) + path.sep;
  const normResolved = path.normalize(resolved) + path.sep;

  if (!normResolved.startsWith(normRoot) && path.normalize(resolved) !== path.normalize(WORKSPACE_ROOT)) {
    throw new Error(
      `Path traversal blocked: symlink escape detected. ` +
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
    path: { type: 'string', description: 'Relative or absolute path within the workspace root', required: true },
    content: { type: 'string', description: 'The text content to write into the file', required: true }
  },
  handler: async (args) => {
    const filePath = args['path'];
    const content = args['content'];
    logger.info(`Writing content to file: ${filePath}`);

    try {
      // Step 1: lexical containment (fast, no realpath)
      const lexical = ensureLexicalContainment(filePath);

      // Step 2: create parent directories
      await fs.mkdir(path.dirname(lexical), { recursive: true });

      // Step 3: realpath + containment IMMEDIATELY before the write (no TOCTOU gap)
      const safePath = await verifyRealPath(lexical);
      await fs.writeFile(safePath, content, 'utf-8');

      return { success: true, path: safePath, bytesWritten: Buffer.byteLength(content) };
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
    path: { type: 'string', description: 'Relative or absolute path within the workspace root', required: true }
  },
  handler: async (args) => {
    const filePath = args['path'];
    logger.info(`Reading content from file: ${filePath}`);
    try {
      // Step 1: lexical containment (fast, no realpath)
      const lexical = ensureLexicalContainment(filePath);

      // Step 2: realpath + containment IMMEDIATELY before the read (no TOCTOU gap)
      const safePath = await verifyRealPath(lexical);
      const content = await fs.readFile(safePath, 'utf-8');

      return { success: true, content };
    } catch (error: any) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }
};

// ── Import, then re-export web and notification tools ──
import { webFetch, webSearch, webTools } from './web.js';
import { emailSend, slackSendMessage, notificationTools } from './notifications.js';

export { webFetch, webSearch, webTools };
export { emailSend, slackSendMessage, notificationTools };

export const allTools = [
  filesystemWriteFile,
  filesystemReadFile,
  webFetch,
  webSearch,
  emailSend,
  slackSendMessage,
];
