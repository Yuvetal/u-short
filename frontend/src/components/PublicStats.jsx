import React, { useState, useEffect } from 'react';
import API_BASE from '../config';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, Globe, Monitor, Laptop, ArrowLeft, ExternalLink } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const PublicStats = () => {
  const { shortCode } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/urls/${shortCode}/stats`);
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to retrieve stats');
        }

        setStats(data.data);
      } catch (err) {
        setError(err.message || 'Could not fetch public stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [shortCode]);

  return (
    <div className="dashboard-layout">
      {/* Navigation Header */}
      <nav className="nav-bar">
        <Link to="/login" className="nav-logo">
          <span>⚡</span> KATO.LINK
        </Link>
        <div className="nav-links">
          <Link to="/login" className="btn btn-outline logout-btn">
            Sign In
          </Link>
          <Link to="/signup" className="btn btn-primary logout-btn">
            Register Free
          </Link>
        </div>
      </nav>

      <main className="dashboard-container" style={{ gridTemplateColumns: '1fr', maxWidth: '960px', padding: '40px 24px' }}>
        
        <div className="section-header" style={{ marginBottom: '12px' }}>
          <Link to="/login" className="back-btn">
            <ArrowLeft size={16} /> Create Your Own Short Links
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(136, 84, 208, 0.1)',
              borderTopColor: '#8854d0',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <p style={{ color: '#a4b0be' }}>Gathering metrics...</p>
          </div>
        ) : error ? (
          <div className="empty-state" style={{ padding: '80px 40px' }}>
            <div className="empty-icon" style={{ fontSize: '64px' }}>🔍</div>
            <h3 style={{ fontSize: '22px' }}>Public Stats Error</h3>
            <p style={{ marginTop: '8px', color: '#ff4757', fontWeight: '500' }}>{error}</p>
            <Link to="/login" className="btn btn-primary" style={{ maxWidth: '240px', margin: '24px auto 0' }}>
              Go to Workspace
            </Link>
          </div>
        ) : (
          <div className="analytics-section">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '32px' }}>Public Statistics for /{stats.shortCode}</h1>
                <span className="meta-badge badge-active" style={{ fontSize: '12px', padding: '4px 10px' }}>PUBLIC VIEW</span>
              </div>
              <p style={{ color: '#a4b0be', fontSize: '15px', marginTop: '4px' }}>
                Tracked link created on {new Date(stats.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Metrics cards */}
            <div className="metrics-summary-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="metric-card">
                <h4 style={{ fontSize: '13px', color: '#a4b0be', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Redirection Clicks</h4>
                <div className="metric-number" style={{ fontSize: '48px' }}>{stats.totalClicks}</div>
                <p style={{ fontSize: '12px', color: '#747d8c' }}>total accumulated hits</p>
              </div>

              <div className="metric-card">
                <h4 style={{ fontSize: '13px', color: '#a4b0be', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Link Lifetime Status</h4>
                <div className="metric-number" style={{ fontSize: '24px', padding: '16px 0', margin: 0, fontWeight: '700', color: stats.expiresAt && new Date() > new Date(stats.expiresAt) ? '#ff4757' : '#2ed573' }}>
                  {stats.expiresAt ? (new Date() > new Date(stats.expiresAt) ? 'EXPIRED' : `Expires: ${new Date(stats.expiresAt).toLocaleDateString()}`) : 'NEVER EXPIRES'}
                </div>
                <p style={{ fontSize: '12px', color: '#747d8c' }}>expiration lifecycle check</p>
              </div>
            </div>

            {/* Click Trend Curve */}
            <div className="glass-panel">
              <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700' }}>DAILY CLICKS (LAST 14 DAYS)</h4>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <AreaChart data={stats.dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPublicClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0fbcf9" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#0fbcf9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="date" stroke="#747d8c" fontSize={11} tickLine={false} />
                    <YAxis stroke="#747d8c" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ background: '#10141e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f5f7fa' }}
                    />
                    <Area type="monotone" dataKey="count" name="Clicks" stroke="#0fbcf9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPublicClicks)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Platform splits */}
            <div className="charts-grid">
              {/* Browser Allocation */}
              <div className="glass-panel">
                <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Monitor size={16} style={{ color: '#0fbcf9' }} /> BROWSER BREAKDOWN
                </h4>
                {stats.browserShare.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#747d8c', fontSize: '13px' }}>No browser events logged yet</div>
                ) : (
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <BarChart data={stats.browserShare} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="browser" type="category" stroke="#a4b0be" fontSize={12} tickLine={false} axisLine={false} width={80} />
                        <Tooltip 
                          contentStyle={{ background: '#10141e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" name="Visits" fill="#0fbcf9" radius={[0, 4, 4, 0]}>
                          {stats.browserShare.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#0fbcf9' : '#0fbcf9aa'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* OS Allocation */}
              <div className="glass-panel">
                <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Laptop size={16} style={{ color: '#8854d0' }} /> OS BREAKDOWN
                </h4>
                {stats.osShare.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#747d8c', fontSize: '13px' }}>No OS events logged yet</div>
                ) : (
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <BarChart data={stats.osShare} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="os" type="category" stroke="#a4b0be" fontSize={12} tickLine={false} axisLine={false} width={80} />
                        <Tooltip 
                          contentStyle={{ background: '#10141e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" name="Visits" fill="#8854d0" radius={[0, 4, 4, 0]}>
                          {stats.osShare.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#8854d0' : '#8854d0aa'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Call to Action */}
            <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', background: 'linear-gradient(135deg, rgba(136, 84, 208, 0.15), rgba(15, 188, 249, 0.1))', border: '1px solid rgba(136, 84, 208, 0.25)' }}>
              <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Create Your Own Trackable Links</h3>
              <p style={{ color: '#a4b0be', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
                Join KATO.LINK today to shorten URLs, configure custom domain aliases, set lifetimes, and gather deep interaction insights.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <Link to="/signup" className="btn btn-primary" style={{ maxWidth: '160px' }}>Sign Up Free</Link>
                <Link to="/login" className="btn btn-outline" style={{ maxWidth: '160px' }}>Sign In</Link>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>
          This project is a part of a hackathon run by{' '}
          <a href="https://katomaran.com" className="footer-link" target="_blank" rel="noreferrer">
            https://katomaran.com
          </a>
        </p>
      </footer>
    </div>
  );
};

export default PublicStats;
