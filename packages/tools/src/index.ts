import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ToolCapability,
  DisposableToolInstance,
  ToolFactory,
  ToolCapabilityRegistration
} from './types.js';

import {
  webFetch,
  webSearch,
  webTools,
  webCapabilities,
  webRegistrations,
  webFetchCapability,
  webSearchCapability,
  createWebFetch,
  createWebSearch
} from './web.js';

import {
  emailSend,
  slackSendMessage,
  notificationTools,
  notificationCapabilities,
  notificationRegistrations,
  emailSendCapability,
  slackSendMessageCapability,
  createEmailSend,
  createSlackSendMessage
} from './notifications.js';

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

// ── Capabilities Metadata ──

export const filesystemWriteFileCapability: ToolCapability = {
  id: 'filesystem-write-file',
  category: 'Filesystem',
  description: 'Writes text content to a file in the workspace, creating any parent folders automatically.',
  lazy: true,
  name: 'Write File',
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
  }
};

export const filesystemReadFileCapability: ToolCapability = {
  id: 'filesystem-read-file',
  category: 'Filesystem',
  description: 'Reads text content from a file in the workspace.',
  lazy: true,
  name: 'Read File',
  parameters: {
    path: {
      type: 'string',
      description: 'The path to the file to read',
      required: true
    }
  }
};

/**
 * Creates an isolated, disposable instance of the filesystem write tool.
 */
export function createFilesystemWriteFile(): DisposableToolInstance {
  let isDisposed = false;
  return {
    slug: filesystemWriteFileCapability.id,
    name: filesystemWriteFileCapability.name!,
    description: filesystemWriteFileCapability.description,
    parameters: filesystemWriteFileCapability.parameters!,
    capability: filesystemWriteFileCapability,
    get isDisposed() {
      return isDisposed;
    },
    set isDisposed(v: boolean) {
      isDisposed = v;
    },
    dispose: () => {
      isDisposed = true;
      logger.debug('Disposed filesystem-write-file instance');
    },
    handler: async (args) => {
      if (isDisposed) {
        throw new Error('Cannot execute disposed tool instance: filesystem-write-file');
      }
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
}

/**
 * Creates an isolated, disposable instance of the filesystem read tool.
 */
export function createFilesystemReadFile(): DisposableToolInstance {
  let isDisposed = false;
  return {
    slug: filesystemReadFileCapability.id,
    name: filesystemReadFileCapability.name!,
    description: filesystemReadFileCapability.description,
    parameters: filesystemReadFileCapability.parameters!,
    capability: filesystemReadFileCapability,
    get isDisposed() {
      return isDisposed;
    },
    set isDisposed(v: boolean) {
      isDisposed = v;
    },
    dispose: () => {
      isDisposed = true;
      logger.debug('Disposed filesystem-read-file instance');
    },
    handler: async (args) => {
      if (isDisposed) {
        throw new Error('Cannot execute disposed tool instance: filesystem-read-file');
      }
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
}

export const filesystemWriteFile: DisposableToolInstance = createFilesystemWriteFile();
export const filesystemReadFile: DisposableToolInstance = createFilesystemReadFile();

export const filesystemCapabilities: ToolCapability[] = [
  filesystemWriteFileCapability,
  filesystemReadFileCapability
];

export const filesystemRegistrations: ToolCapabilityRegistration[] = [
  { capability: filesystemWriteFileCapability, factory: createFilesystemWriteFile },
  { capability: filesystemReadFileCapability, factory: createFilesystemReadFile }
];

export const allToolCapabilities: ToolCapability[] = [
  ...filesystemCapabilities,
  ...webCapabilities,
  ...notificationCapabilities
];

export const allToolRegistrations: ToolCapabilityRegistration[] = [
  ...filesystemRegistrations,
  ...webRegistrations,
  ...notificationRegistrations
];

/**
 * Registers all capability metadata into the given ToolRegistry without preloading instances.
 */
export function registerAllToolCapabilities(registry: {
  registerCapability: (capability: ToolCapability, factory: ToolFactory) => void;
}): void {
  for (const reg of allToolRegistrations) {
    registry.registerCapability(reg.capability, reg.factory);
  }
}

// ── Re-exports ──
export * from './types.js';
export {
  webFetch,
  webSearch,
  webTools,
  webCapabilities,
  webRegistrations,
  webFetchCapability,
  webSearchCapability,
  createWebFetch,
  createWebSearch
};
export {
  emailSend,
  slackSendMessage,
  notificationTools,
  notificationCapabilities,
  notificationRegistrations,
  emailSendCapability,
  slackSendMessageCapability,
  createEmailSend,
  createSlackSendMessage
};

export const allTools = [filesystemWriteFile, filesystemReadFile];

