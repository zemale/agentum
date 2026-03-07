/**
 * Event Handlers
 * 
 * This module exports all event handlers and the registry.
 * Use this for importing handlers in other parts of the application.
 */

// Registry
export { 
  HandlersRegistry, 
  getHandlersRegistry, 
  registerDefaultHandlers,
  type EventHandler,
  type EventHandlerFunction,
} from './registry.js';

// Individual handlers
export { NotificationHandler, registerSSEConnection, getConnectedUserCount } from './notification.js';
export { AuditHandler, queryAuditLog, queryAuditLogByType, getAuditStats, cleanupOldAuditEvents } from './audit.js';
export { WalletHandler, getWalletStats, getUserWalletSummary } from './wallet.js';
