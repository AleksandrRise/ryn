/**
 * Code Scans Page Component
 * Shows scan history with repository details
 */

import React from 'react';

const CodeScansPage: React.FC = () => {
  return (
    <>
      <div className="header">
        <h1 className="page-title">Code Scans</h1>
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Scan History</h2>
          </div>
          <div className="integrations-table">
            <div className="table-row table-header">
              <div>Repository</div>
              <div>Duration</div>
              <div>Issues Found</div>
              <div>Status</div>
            </div>
            <div className="table-row">
              <div className="integration-name">
                <div className="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                </div>
                <span className="integration-text">auth-service</span>
              </div>
              <div className="metric-value">2m 34s</div>
              <div className="metric-value">3 issues</div>
              <div><span className="status-badge active">Complete</span></div>
            </div>
            <div className="table-row">
              <div className="integration-name">
                <div className="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                </div>
                <span className="integration-text">payment-api</span>
              </div>
              <div className="metric-value">1m 47s</div>
              <div className="metric-value">0 issues</div>
              <div><span className="status-badge active">Complete</span></div>
            </div>
            <div className="table-row">
              <div className="integration-name">
                <div className="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                </div>
                <span className="integration-text">frontend-app</span>
              </div>
              <div className="metric-value">4m 12s</div>
              <div className="metric-value">7 issues</div>
              <div><span className="status-badge active">Complete</span></div>
            </div>
            <div className="table-row">
              <div className="integration-name">
                <div className="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                </div>
                <span className="integration-text">data-pipeline</span>
              </div>
              <div className="metric-value">3m 05s</div>
              <div className="metric-value">2 issues</div>
              <div><span className="status-badge active">Complete</span></div>
            </div>
          </div>
        </div>

        <div className="scan-stats-grid">
          <div className="scan-stat-card">
            <div className="scan-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="scan-stat-label">Avg Scan Time</div>
            <div className="scan-stat-value">2.8m</div>
            <div className="scan-stat-change positive">-15% faster</div>
          </div>

          <div className="scan-stat-card">
            <div className="scan-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
            </div>
            <div className="scan-stat-label">Files Scanned</div>
            <div className="scan-stat-value">24.3K</div>
            <div className="scan-stat-change positive">+892 today</div>
          </div>

          <div className="scan-stat-card">
            <div className="scan-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="scan-stat-label">Pass Rate</div>
            <div className="scan-stat-value">94.2%</div>
            <div className="scan-stat-change positive">+1.3% today</div>
          </div>

          <div className="scan-stat-card">
            <div className="scan-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="scan-stat-label">Issues Found</div>
            <div className="scan-stat-value">12</div>
            <div className="scan-stat-change negative">Needs attention</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeScansPage;
