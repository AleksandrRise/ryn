/**
 * Sidebar Component
 * Main navigation sidebar with logo, nav items, and AI assistant trigger
 */

import React from 'react';
import {
  GridIcon,
  AlertTriangleIcon,
  CodeScanIcon,
  IntegrationsIcon,
  HelpCircleIcon,
  UserIcon,
  SmileIcon
} from '../ui/Icons';
import { PageType } from '../../types';
import './Sidebar.css';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onAIAssistantOpen: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
  onAIAssistantOpen,
  isOpen,
  onClose
}) => {
  const navItems = [
    { id: 'overview' as PageType, label: 'Overview', icon: GridIcon },
    { id: 'violations' as PageType, label: 'Violations', icon: AlertTriangleIcon },
    { id: 'codescans' as PageType, label: 'Code Scans', icon: CodeScanIcon },
    { id: 'integrations' as PageType, label: 'Integrations', icon: IntegrationsIcon },
  ];

  const accountItems = [
    { id: 'support' as PageType, label: 'Support', icon: HelpCircleIcon },
    { id: 'account' as PageType, label: 'My Account', icon: UserIcon },
  ];

  const handleNavClick = (page: PageType) => {
    onPageChange(page);
    if (window.innerWidth <= 480) {
      onClose();
    }
  };

  return (
    <>
      <div
        className={`mobile-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />
      <div className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="logo">
          <div className="logo-icon">R</div>
          <div className="logo-text">RYN</div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Navigate</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-label">Account</div>
          {accountItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="nav-spacer" />

        <div className="ai-assistant-trigger">
          <button className="ai-assistant-btn" onClick={onAIAssistantOpen}>
            <div className="ai-assistant-btn-icon">
              <SmileIcon />
              <div className="ai-pulse-ring" />
            </div>
            <div className="ai-assistant-btn-content">
              <div className="ai-assistant-btn-title">AI Assistant</div>
              <div className="ai-assistant-btn-subtitle">Ask me anything</div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
