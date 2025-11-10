/**
 * Support Page Component
 * Shows help resources, system status, and contact form
 */

import React from 'react';

const SupportPage: React.FC = () => {
  return (
    <>
      <div className="header">
        <h1 className="page-title">Support</h1>
      </div>

      <div className="content">
        <div className="main-grid">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Get Help</h2>
            </div>
            <div className="help-list">
              <button className="help-item">
                <div>
                  <strong>Documentation</strong>
                  <p>Complete guides for getting started, integrations, and best practices</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              <button className="help-item">
                <div>
                  <strong>Discord Community</strong>
                  <p>Join our Discord server to connect with other Ryn users</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">System Status</h2>
            </div>
            <div className="status-list">
              <div className="status-item">
                <span>API Services</span>
                <span className="status-badge active">Operational</span>
              </div>
              <div className="status-item">
                <span>Scan Engine</span>
                <span className="status-badge active">Operational</span>
              </div>
              <div className="status-item">
                <span>Dashboard</span>
                <span className="status-badge active">Operational</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{marginTop: '32px'}}>
          <div className="card-header">
            <h2 className="card-title">Contact Support</h2>
          </div>
          <div className="support-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input type="text" id="subject" className="form-input" placeholder="Brief description of your issue" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea id="message" className="form-textarea" rows={6} placeholder="Describe your issue in detail..."></textarea>
            </div>
            <button className="btn btn-primary">Send Message</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportPage;
