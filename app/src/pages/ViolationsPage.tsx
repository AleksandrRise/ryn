/**
 * Violations Page Component
 * Shows all security violations with filtering
 */

import React, { useState } from 'react';

const ViolationsPage: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <>
      <div className="header">
        <h1 className="page-title">Violations</h1>
        <div className="header-actions">
          <button className="btn btn-primary">Auto-Fix All</button>
        </div>
      </div>

      <div className="content">
        <div className="filter-bar">
          <button className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All</button>
          <button className={`filter-btn ${activeFilter === 'critical' ? 'active' : ''}`} onClick={() => setActiveFilter('critical')}>Critical</button>
          <button className={`filter-btn ${activeFilter === 'high' ? 'active' : ''}`} onClick={() => setActiveFilter('high')}>High</button>
          <button className={`filter-btn ${activeFilter === 'medium' ? 'active' : ''}`} onClick={() => setActiveFilter('medium')}>Medium</button>
        </div>

        <div className="violations-list">
          <div className="violation-item">
            <div className="violation-header">
              <div className="violation-info">
                <div className="violation-title">Missing MFA enforcement</div>
                <div className="violation-meta">CC.6.1 • 12 min ago</div>
              </div>
              <span className="severity critical">Critical</span>
            </div>
            <div className="violation-file">src/auth/routes.py:42</div>
          </div>

          <div className="violation-item">
            <div className="violation-header">
              <div className="violation-info">
                <div className="violation-title">Audit log missing context</div>
                <div className="violation-meta">CC.7.2 • 28 min ago</div>
              </div>
              <span className="severity high">High</span>
            </div>
            <div className="violation-file">api/admin/users.js:89</div>
          </div>

          <div className="violation-item">
            <div className="violation-header">
              <div className="violation-info">
                <div className="violation-title">Hardcoded API key detected</div>
                <div className="violation-meta">CC.6.7 • 1 hour ago</div>
              </div>
              <span className="severity critical">Critical</span>
            </div>
            <div className="violation-file">config/settings.py:15</div>
          </div>

          <div className="violation-item">
            <div className="violation-header">
              <div className="violation-info">
                <div className="violation-title">Insufficient password policy</div>
                <div className="violation-meta">CC.6.1 • 2 hours ago</div>
              </div>
              <span className="severity high">High</span>
            </div>
            <div className="violation-file">src/auth/password.py:23</div>
          </div>

          <div className="violation-item">
            <div className="violation-header">
              <div className="violation-info">
                <div className="violation-title">Missing rate limiting</div>
                <div className="violation-meta">CC.6.6 • 3 hours ago</div>
              </div>
              <span className="severity">Medium</span>
            </div>
            <div className="violation-file">api/routes/public.js:45</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ViolationsPage;
