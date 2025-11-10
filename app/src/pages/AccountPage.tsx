/**
 * Account Page Component
 * Shows profile settings, security, subscription, and preferences
 */

import React from 'react';

const AccountPage: React.FC = () => {
  return (
    <>
      <div className="header">
        <h1 className="page-title">My Account</h1>
      </div>

      <div className="content">
        <div className="account-layout">
          <div className="account-main">
            <div className="account-section">
              <h2 className="section-title">Full Name <span className="required">*</span></h2>
              <input type="text" className="form-input" defaultValue="Alex Johnson" />
            </div>

            <div className="account-section">
              <h2 className="section-title">Email Address <span className="required">*</span></h2>
              <input type="email" className="form-input" defaultValue="alex.johnson@company.com" />
            </div>

            <div className="account-section">
              <h2 className="section-title">Company <span className="optional">(optional)</span></h2>
              <input type="text" className="form-input" defaultValue="Tech Solutions Inc." />
            </div>

            <button className="btn btn-primary">Save Changes</button>

            <div className="account-section" style={{marginTop: '48px'}}>
              <h2 className="section-title">Security</h2>
              <div className="security-section">
                <div className="security-field">
                  <label>Current Password</label>
                  <input type="password" className="form-input" placeholder="Enter current password" />
                </div>
                <div className="security-field">
                  <label>New Password</label>
                  <input type="password" className="form-input" placeholder="Enter new password" />
                </div>
                <div className="security-field">
                  <label>Confirm New Password</label>
                  <input type="password" className="form-input" placeholder="Confirm new password" />
                </div>
                <button className="btn btn-primary">Update Password</button>
              </div>
            </div>
          </div>

          <div className="account-sidebar">
            <div className="plan-card">
              <div className="plan-header">
                <span className="plan-label">Current Plan</span>
                <h3 className="plan-name">Free</h3>
                <p className="plan-price">No billing • $0/month</p>
              </div>
              <div className="plan-features">
                <div className="plan-feature">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>100 scans per month</span>
                </div>
                <div className="plan-feature">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>1 team member</span>
                </div>
                <div className="plan-feature">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>Community support</span>
                </div>
              </div>
            </div>

            <div className="preferences-card">
              <h3 className="preferences-title">Preferences</h3>
              <div className="preferences-list">
                <div className="preference-item">
                  <div>
                    <strong>Email Notifications</strong>
                    <p>Receive alerts for violations</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="preference-item">
                  <div>
                    <strong>Auto-Fix <span className="demo-badge">(demo)</span></strong>
                    <p>Automatically fix violations</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AccountPage;
