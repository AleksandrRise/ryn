/**
 * Type definitions for the Ryn Compliance Dashboard
 * @module types
 */

/**
 * Represents a page/route in the application
 */
export type PageType = 'overview' | 'violations' | 'codescans' | 'integrations' | 'support' | 'account';

/**
 * Represents a severity level for violations
 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Represents a status badge state
 */
export type StatusBadge = 'active' | 'warning' | 'inactive';

/**
 * Represents a change direction for statistics
 */
export type ChangeDirection = 'positive' | 'negative' | 'neutral';

/**
 * Represents a statistical metric card
 */
export interface StatCard {
  id: string;
  label: string;
  value: string | number;
  change?: string;
  changeDirection?: ChangeDirection;
  icon: string;
}

/**
 * Represents a violation item
 */
export interface Violation {
  id: string;
  title: string;
  severity: SeverityLevel;
  file: string;
  meta: string;
  timestamp: Date;
}

/**
 * Represents an integration
 */
export interface Integration {
  id: string;
  name: string;
  icon: string;
  tests: number;
  lastScan: string;
  status: StatusBadge;
}

/**
 * Represents an activity item in the feed
 */
export interface Activity {
  id: string;
  text: string;
  time: string;
  icon: string;
  value?: string;
}

/**
 * Represents chart data for a bar chart
 */
export interface ChartData {
  label: string;
  violations: number;
  fixes: number;
}

/**
 * Represents an AI chat message
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Represents a quick action button for AI assistant
 */
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

/**
 * Represents a toast notification
 */
export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

/**
 * Represents a modal configuration
 */
export interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}
