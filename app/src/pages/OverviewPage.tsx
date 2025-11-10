/**
 * Overview Page Component
 * Shows dashboard with stats, trends, integrations, and recent activity
 */

import React, { useState } from 'react';

const OverviewPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('7days');

  return (
    <>
      <div className="header">
        <h1 className="page-title">Overview</h1>
        <div className="header-actions">
          <button className="btn btn-primary">Run Scan</button>
        </div>
      </div>

      <div className="content">
        <div className="stats-grid">
          <div className="stat-card" data-stat="coverage">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="stat-label">Total Scans</div>
            <div className="stat-value">847</div>
            <div className="stat-change">+12%</div>
          </div>

          <div className="stat-card" data-stat="violations">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="stat-label">Violations</div>
            <div className="stat-value">23</div>
            <div className="stat-change">-8%</div>
          </div>

          <div className="stat-card" data-stat="fixes">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="stat-label">Fixed Issues</div>
            <div className="stat-value">156</div>
            <div className="stat-change">+24%</div>
          </div>

          <div className="stat-card" data-stat="compliance">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="stat-label">Compliance</div>
            <div className="stat-value">97%</div>
            <div className="stat-change">+2%</div>
          </div>
        </div>

        <div className="main-grid">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Violations Trend</h2>
              <div className="card-tabs">
                <button className={`tab ${activeTab === '7days' ? 'active' : ''}`} onClick={() => setActiveTab('7days')}>7 Days</button>
                <button className={`tab ${activeTab === '30days' ? 'active' : ''}`} onClick={() => setActiveTab('30days')}>30 Days</button>
              </div>
            </div>
            <div className="chart">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                const violations = [12, 8, 15, 7, 10, 5, 6][i];
                const fixes = [18, 15, 22, 12, 20, 8, 10][i];
                return (
                  <div key={day} className="bar-group">
                    <div className="bars">
                      <div className="bar violations" style={{height: `${violations * 10}px`}}>
                        <div className="bar-tooltip">{violations} violations</div>
                      </div>
                      <div className="bar fixes" style={{height: `${fixes * 10}px`}}>
                        <div className="bar-tooltip">{fixes} fixes</div>
                      </div>
                    </div>
                    <div className="bar-label">{day}</div>
                  </div>
                );
              })}
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-dot" style={{background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)'}}></div>
                Violations
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{background: 'linear-gradient(180deg, #d4a574 0%, #c9985f 100%)'}}></div>
                Fixes
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Active Integrations</h2>
            </div>
            <div className="integrations-table">
              <div className="table-row table-header">
                <div>Name</div>
                <div>Tests</div>
                <div>Last Scan</div>
                <div>Status</div>
              </div>
              <div className="table-row">
                <div className="integration-name">
                  <div className="integration-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6"/><path d="M12 17v6"/>
                      <path d="M4.22 4.22l4.24 4.24"/><path d="M15.54 15.54l4.24 4.24"/>
                      <path d="M1 12h6"/><path d="M17 12h6"/>
                      <path d="M4.22 19.78l4.24-4.24"/><path d="M15.54 8.46l4.24-4.24"/>
                    </svg>
                  </div>
                  <span className="integration-text">GitHub Actions</span>
                </div>
                <div className="metric-value">234</div>
                <div className="metric-value">2 hours ago</div>
                <div><span className="status-badge active">Active</span></div>
              </div>
              <div className="table-row">
                <div className="integration-name">
                  <div className="integration-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6"/><path d="M12 17v6"/>
                      <path d="M4.22 4.22l4.24 4.24"/><path d="M15.54 15.54l4.24 4.24"/>
                      <path d="M1 12h6"/><path d="M17 12h6"/>
                      <path d="M4.22 19.78l4.24-4.24"/><path d="M15.54 8.46l4.24-4.24"/>
                    </svg>
                  </div>
                  <span className="integration-text">GitLab CI/CD</span>
                </div>
                <div className="metric-value">189</div>
                <div className="metric-value">5 hours ago</div>
                <div><span className="status-badge active">Active</span></div>
              </div>
              <div className="table-row">
                <div className="integration-name">
                  <div className="integration-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6"/><path d="M12 17v6"/>
                      <path d="M4.22 4.22l4.24 4.24"/><path d="M15.54 15.54l4.24 4.24"/>
                      <path d="M1 12h6"/><path d="M17 12h6"/>
                      <path d="M4.22 19.78l4.24-4.24"/><path d="M15.54 8.46l4.24-4.24"/>
                    </svg>
                  </div>
                  <span className="integration-text">Jenkins Pipeline</span>
                </div>
                <div className="metric-value">156</div>
                <div className="metric-value">1 day ago</div>
                <div><span className="status-badge warning">Warning</span></div>
              </div>
              <div className="table-row">
                <div className="integration-name">
                  <div className="integration-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6"/><path d="M12 17v6"/>
                      <path d="M4.22 4.22l4.24 4.24"/><path d="M15.54 15.54l4.24 4.24"/>
                      <path d="M1 12h6"/><path d="M17 12h6"/>
                      <path d="M4.22 19.78l4.24-4.24"/><path d="M15.54 8.46l4.24-4.24"/>
                    </svg>
                  </div>
                  <span className="integration-text">CircleCI</span>
                </div>
                <div className="metric-value">92</div>
                <div className="metric-value">3 hours ago</div>
                <div><span className="status-badge active">Active</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="main-grid" style={{marginTop: '32px'}}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Violations</h2>
            </div>
            <div className="violations-list">
              <div className="violation-item">
                <div className="violation-header">
                  <div className="violation-info">
                    <div className="violation-title">Hardcoded API credentials detected</div>
                    <div className="violation-meta">Security • Found by SonarQube</div>
                  </div>
                  <span className="severity critical">Critical</span>
                </div>
                <div className="violation-file">src/config/api.ts:42</div>
              </div>
              <div className="violation-item">
                <div className="violation-header">
                  <div className="violation-info">
                    <div className="violation-title">SQL injection vulnerability</div>
                    <div className="violation-meta">Security • Found by Snyk</div>
                  </div>
                  <span className="severity high">High</span>
                </div>
                <div className="violation-file">src/database/queries.ts:128</div>
              </div>
              <div className="violation-item">
                <div className="violation-header">
                  <div className="violation-info">
                    <div className="violation-title">Deprecated dependency in use</div>
                    <div className="violation-meta">Dependencies • Found by npm audit</div>
                  </div>
                  <span className="severity high">High</span>
                </div>
                <div className="violation-file">package.json</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Activity</h2>
            </div>
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="activity-content">
                  <div className="activity-text">Scan completed on main branch <span className="activity-value">• 234 tests passed</span></div>
                  <div className="activity-time">5 minutes ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div className="activity-content">
                  <div className="activity-text">New vulnerability detected in dependencies <span className="activity-value">• 1 critical</span></div>
                  <div className="activity-time">1 hour ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6"/><path d="M12 17v6"/>
                    <path d="M4.22 4.22l4.24 4.24"/><path d="M15.54 15.54l4.24 4.24"/>
                    <path d="M1 12h6"/><path d="M17 12h6"/>
                    <path d="M4.22 19.78l4.24-4.24"/><path d="M15.54 8.46l4.24-4.24"/>
                  </svg>
                </div>
                <div className="activity-content">
                  <div className="activity-text">GitHub Actions integration updated</div>
                  <div className="activity-time">3 hours ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div className="activity-content">
                  <div className="activity-text">Weekly compliance report generated <span className="activity-value">• 97% compliant</span></div>
                  <div className="activity-time">1 day ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OverviewPage;
