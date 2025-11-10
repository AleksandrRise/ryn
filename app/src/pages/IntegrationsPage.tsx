/**
 * Integrations Page Component
 * Shows connected services and available integrations
 */

import React from 'react';

const IntegrationsPage: React.FC = () => {
  return (
    <>
      <div className="header">
        <h1 className="page-title">Integrations</h1>
        <div className="header-actions">
          <button className="btn btn-primary">Custom Integration</button>
        </div>
      </div>

      <div className="content">
        <div className="integrations-layout">
          <div className="integrations-main">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Connected Services</h2>
              </div>
              <div className="integrations-table">
                <div className="table-row table-header">
                  <div>Service</div>
                  <div>Connected</div>
                  <div>Last Sync</div>
                  <div>Status</div>
                </div>
                <div className="table-row">
                  <div className="integration-name">
                    <div className="integration-icon-small">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                      </svg>
                    </div>
                    <span className="integration-text">GitHub</span>
                  </div>
                  <div className="metric-value">4 repos</div>
                  <div className="metric-value">2m ago</div>
                  <div><span className="status-badge active">Active</span></div>
                </div>
                <div className="table-row">
                  <div className="integration-name">
                    <div className="integration-icon-small">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                      </svg>
                    </div>
                    <span className="integration-text">VS Code</span>
                  </div>
                  <div className="metric-value">Extension</div>
                  <div className="metric-value">5m ago</div>
                  <div><span className="status-badge active">Active</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="integrations-sidebar">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Available Integrations</h2>
              </div>
              <div className="available-integrations-list">
                <button className="integration-list-item">
                  <div className="integration-info">
                    <strong>GitHub</strong>
                    <p>Version control & CI/CD integration</p>
                  </div>
                  <button className="btn btn-primary">Connect</button>
                </button>
                <button className="integration-list-item">
                  <div className="integration-info">
                    <strong>VS Code</strong>
                    <p>IDE extension for real-time scanning</p>
                  </div>
                  <button className="btn btn-primary">Connect</button>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IntegrationsPage;
