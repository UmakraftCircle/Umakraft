import { ToolDefinition } from '@ai-agent-platform/shared';

/**
 * Metadata describing a tool capability before it is instantiated.
 * Registry discovers capabilities without constructing heavy resources.
 */
export interface ToolCapability {
  id: string;
  category: 'Filesystem' | 'Memory' | 'Discord' | 'Web' | 'Notification' | string;
  description: string;
  lazy: boolean;
  name?: string;
  parameters?: Record<string, any>;
}

/**
 * A disposable tool instance.
 * Lives for the duration of a single task execution and is disposed immediately after.
 */
export interface DisposableToolInstance extends ToolDefinition {
  capability?: ToolCapability;
  isDisposed?: boolean;
  dispose?: () => Promise<void> | void;
}

/**
 * Factory function for creating fresh tool instances on-demand.
 */
export type ToolFactory = () => Promise<DisposableToolInstance> | DisposableToolInstance;

/**
 * Registration binding capability metadata to its lazy factory.
 */
export interface ToolCapabilityRegistration {
  capability: ToolCapability;
  factory: ToolFactory;
}
