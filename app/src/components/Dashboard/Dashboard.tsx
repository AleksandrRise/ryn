/**
 * Dashboard/Overview Page Component
 * Main dashboard with stats, charts, integrations table, violations list, and activity feed
 */

import React, { useState } from 'react';
import {
  ShieldIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ActivityIcon,
  IntegrationsIcon,
  ClockIcon,
  FileTextIcon,
} from '../ui/Icons';
import { ChartData, Integration, Violation, Activity as ActivityType } from '../../types';
import './Dashboard.css';

interface DashboardProps {
  onRunScan: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onRunScan }) => {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  // Mock data - in a real app, this would come from an API or state management
  const stats = [
    { label: 'Total Scans', value: '847', change: '+12%', isPositive: true, icon: ShieldIcon },
    { label: 'Violations', value: '23', change: '-8%', isPositive: true, icon: AlertTriangleIcon },
    { label: 'Fixed Issues', value: '156', change: '+24%', isPositive: true, icon: CheckCircleIcon },
    { label: 'Compliance', value: '97%', change: '+2%', isPositive: true, icon: ActivityIcon },
  ];

  const chartData: ChartData[] = [
    { label: 'Mon', violations: 12, fixes: 18 },
    { label: 'Tue', violations: 8, fixes: 15 },
    { label: 'Wed', violations: 15, fixes: 22 },
    { label: 'Thu', violations: 7, fixes: 12 },
    { label: 'Fri', violations: 10, fixes: 20 },
    { label: 'Sat', violations: 5, fixes: 8 },
    { label: 'Sun', violations: 6, fixes: 10 },
  ];

  const integrations: Integration[] = [
    { id: '1', name: 'GitHub Actions', icon: 'github', tests: 234, lastScan: '2 hours ago', status: 'active' },
    { id: '2', name: 'GitLab CI/CD', icon: 'gitlab', tests: 189, lastScan: '5 hours ago', status: 'active' },
    { id: '3', name: 'Jenkins Pipeline', icon: 'jenkins', tests: 156, lastScan: '1 day ago', status: 'warning' },
    { id: '4', name: 'CircleCI', icon: 'circle', tests: 92, lastScan: '3 hours ago', status: 'active' },
  ];

  const violations: Violation[] = [
    {
      id: '1',
      title: 'Hardcoded API credentials detected',
      severity: 'critical',
      file: 'src/config/api.ts:42',
      meta: 'Security • Found by SonarQube',
      timestamp: new Date(),
    },
    {
      id: '2',
      title: 'SQL injection vulnerability',
      severity: 'high',
      file: 'src/database/queries.ts:128',
      meta: 'Security • Found by Snyk',
      timestamp: new Date(),
    },
    {
      id: '3',
      title: 'Deprecated dependency in use',
      severity: 'high',
      file: 'package.json',
      meta: 'Dependencies • Found by npm audit',
      timestamp: new Date(),
    },
  ];

  const activities: ActivityType[] = [
    {
      id: '1',
      text: 'Scan completed on main branch',
      time: '5 minutes ago',
      icon: 'shield',
      value: '234 tests passed',
    },
    {
      id: '2',
      text: 'New vulnerability detected in dependencies',
      time: '1 hour ago',
      icon: 'alert',
      value: '1 critical',
    },
    {
      id: '3',
      text: 'GitHub Actions integration updated',
      time: '3 hours ago',
      icon: 'integration',
    },
    {
      id: '4',
      text: 'Weekly compliance report generated',
      time: '1 day ago',
      icon: 'file',
      value: '97% compliant',
    },
  ];

  const maxValue = Math.max(...chartData.map(d => Math.max(d.violations, d.fixes)));

  return (
    <div className="page-container">
      <div className="header">
        <h1 className="page-title">Overview</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={onRunScan}>
            Run Scan
          </button>
        </div>
      </div>

      <div className="content">
        {/* Stats Grid */}
        <div className="stats-grid">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="stat-card">
                <div className="stat-icon">
                  <Icon size={22} />
                </div>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">{stat.value}</div>
                <div className={`stat-change ${stat.isPositive ? '' : 'negative'}`}>
                  {stat.change}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Chart Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Violations Trend</h2>
              <div className="card-tabs">
                {(['weekly', 'monthly', 'yearly'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`tab ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart">
              {chartData.map((data, index) => (
                <div key={index} className="bar-group">
                  <div className="bars">
                    <div
                      className="bar violations"
                      style={{ height: `${(data.violations / maxValue) * 100}%` }}
                    >
                      <div className="bar-tooltip">{data.violations} violations</div>
                    </div>
                    <div
                      className="bar fixes"
                      style={{ height: `${(data.fixes / maxValue) * 100}%` }}
                    >
                      <div className="bar-tooltip">{data.fixes} fixes</div>
                    </div>
                  </div>
                  <div className="bar-label">{data.label}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' }} />
                Violations
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: 'linear-gradient(180deg, #d4a574 0%, #c9985f 100%)' }} />
                Fixes
              </div>
            </div>
          </div>

          {/* Integrations Card */}
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
              {integrations.map((integration) => (
                <div key={integration.id} className="table-row">
                  <div className="integration-name">
                    <div className="integration-icon">
                      <IntegrationsIcon size={18} />
                    </div>
                    <span className="integration-text">{integration.name}</span>
                  </div>
                  <div className="metric-value">{integration.tests}</div>
                  <div className="metric-value">{integration.lastScan}</div>
                  <div>
                    <span className={`status-badge ${integration.status}`}>
                      {integration.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="main-grid" style={{ marginTop: '32px' }}>
          {/* Recent Violations */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Violations</h2>
            </div>
            <div className="violations-list">
              {violations.map((violation) => (
                <div key={violation.id} className="violation-item">
                  <div className="violation-header">
                    <div className="violation-info">
                      <div className="violation-title">{violation.title}</div>
                      <div className="violation-meta">{violation.meta}</div>
                    </div>
                    <span className={`severity ${violation.severity}`}>
                      {violation.severity}
                    </span>
                  </div>
                  <div className="violation-file">{violation.file}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Activity</h2>
            </div>
            <div className="activity-list">
              {activities.map((activity) => {
                let Icon = ClockIcon;
                if (activity.icon === 'shield') Icon = ShieldIcon;
                if (activity.icon === 'alert') Icon = AlertTriangleIcon;
                if (activity.icon === 'integration') Icon = IntegrationsIcon;
                if (activity.icon === 'file') Icon = FileTextIcon;

                return (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-icon">
                      <Icon size={20} />
                    </div>
                    <div className="activity-content">
                      <div className="activity-text">
                        {activity.text}
                        {activity.value && (
                          <span className="activity-value"> • {activity.value}</span>
                        )}
                      </div>
                      <div className="activity-time">{activity.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
