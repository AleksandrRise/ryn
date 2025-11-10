/**
 * Main Application Component
 * Handles routing, state management, and layout
 */

import React, { useState } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import OverviewPage from './pages/OverviewPage';
import ViolationsPage from './pages/ViolationsPage';
import CodeScansPage from './pages/CodeScansPage';
import IntegrationsPage from './pages/IntegrationsPage';
import SupportPage from './pages/SupportPage';
import AccountPage from './pages/AccountPage';
import AIAssistant from './components/AIAssistant/AIAssistant';
import Toast from './components/ui/Toast';
import Modal from './components/ui/Modal';
import { MenuIcon } from './components/ui/Icons';
import { PageType } from './types';
import './App.css';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('overview');
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: undefined as (() => void) | undefined });

  const handlePageChange = (page: PageType) => {
    setCurrentPage(page);
  };

  // Function to handle running a scan (used by header button in pages)
  // const handleRunScan = () => {
  //   setModal({
  //     isOpen: true,
  //     title: 'Run Security Scan',
  //     message: 'This will initiate a full security scan across all integrated repositories. This process may take several minutes. Continue?',
  //     onConfirm: () => {
  //       setToast({ show: true, message: 'Security scan initiated successfully!', type: 'success' });
  //       setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  //     },
  //   });
  // };

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage />;
      case 'violations':
        return <ViolationsPage />;
      case 'codescans':
        return <CodeScansPage />;
      case 'integrations':
        return <IntegrationsPage />;
      case 'support':
        return <SupportPage />;
      case 'account':
        return <AccountPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="app">
        <button
          className="mobile-menu-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <MenuIcon size={20} />
        </button>

        <Sidebar
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onAIAssistantOpen={() => setIsAIAssistantOpen(true)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="main">{renderPage()}</div>

        <AIAssistant
          isOpen={isAIAssistantOpen}
          onClose={() => setIsAIAssistantOpen(false)}
        />

        <Toast
          message={toast.message}
          type={toast.type}
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
        />

        <Modal
          isOpen={modal.isOpen}
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal({ ...modal, isOpen: false })}
        />
    </div>
  );
};

export default App;
