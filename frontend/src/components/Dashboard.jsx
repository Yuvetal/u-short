import React, { useState, useEffect } from 'react';
import API_BASE from '../config';
import { useAuth } from '../context/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Link2,
  Copy,
  Check,
  Trash2,
  BarChart3,
  QrCode,
  Calendar,
  ChevronDown,
  ChevronUp,
  LogOut,
  ArrowLeft,
  ExternalLink,
  Edit3,
  Search,
  Plus,
  Globe,
  Monitor,
  Laptop
} from 'lucide-react';
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

const Dashboard = () => {
  const { user, logout, authFetch } = useAuth();
  const [urls, setUrls] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Clipboard tracking for transient copy states
  const [copiedId, setCopiedId] = useState(null);

  // Analytics view controls
  const [selectedUrlId, setSelectedUrlId] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Edit Destination URL modal controls
  const [editUrl, setEditUrl] = useState(null);
  const [newDestinationUrl, setNewDestinationUrl] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // QR Modal state
  const [qrLink, setQrLink] = useState(null);

  // Load URL catalog
  const fetchUrls = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/urls`);
      const data = await res.json();
      if (data.success) {
        setUrls(data.data);
      }
    } catch (err) {
      console.error('[Dashboard] Error retrieving catalog:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, []);

  // Handle URL creation submit
  const handleShorten = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!originalUrl) {
      setFormError('Please provide the destination URL target');
      return;
    }

    setSubmitting(true);
    try {
      const body = { originalUrl };
      if (customAlias) body.customAlias = customAlias;
      if (expiresAt) body.expiresAt = expiresAt;

      const res = await authFetch(`${API_BASE}/api/urls`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'URL shortening failed');
      }

      setFormSuccess(`URL shortened successfully: /${data.data.shortCode}`);
      setOriginalUrl('');
      setCustomAlias('');
      setExpiresAt('');
      setShowAdvanced(false);
      
      // Refresh list
      fetchUrls();

    } catch (err) {
      setFormError(err.message || 'Server error encountered during URL shortening');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle URL deletion
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this shortened link and all of its visitor analytics history?')) {
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/urls/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.success) {
        setUrls(urls.filter(url => url._id !== id));
        if (selectedUrlId === id) {
          setSelectedUrlId(null);
          setAnalyticsData(null);
        }
      }
    } catch (err) {
      console.error('[Dashboard] Deletion error:', err.message);
    }
  };

  // Handle Clipboard Copy
  const handleCopy = (id, code) => {
    const fullShortUrl = `${API_BASE}/${code}`;
    navigator.clipboard.writeText(fullShortUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch detailed metrics
  const loadAnalytics = async (id) => {
    setSelectedUrlId(id);
    setLoadingAnalytics(true);
    setAnalyticsData(null);
    try {
      const res = await authFetch(`${API_BASE}/api/urls/${id}/analytics`);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.data);
      }
    } catch (err) {
      console.error('[Dashboard] Analytics aggregation error:', err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Handle Destination Update Submit
  const handleUpdateDestination = async (e) => {
    e.preventDefault();
    setEditError('');
    
    if (!newDestinationUrl) {
      setEditError('Please enter a new destination target URL');
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE}/api/urls/${editUrl._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ originalUrl: newDestinationUrl })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Target update failed');
      }

      // Update local catalog array
      setUrls(urls.map(u => u._id === editUrl._id ? { ...u, originalUrl: newDestinationUrl } : u));
      
      // Close modal
      setEditUrl(null);
      setNewDestinationUrl('');

      // Refresh analytics view if currently active
      if (selectedUrlId === editUrl._id) {
        loadAnalytics(editUrl._id);
      }

    } catch (err) {
      setEditError(err.message || 'Encountered error updating destination URL');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Filtering list
  const filteredUrls = urls.filter(url => 
    url.shortCode.toLowerCase().includes(search.toLowerCase()) || 
    url.originalUrl.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-layout">
      {/* Navigation Header */}
      <nav className="nav-bar">
        <div className="nav-logo">
          <span>⚡</span> KATO.LINK
        </div>
        <div className="nav-links">
          <span className="user-email">{user?.email}</span>
          <button onClick={logout} className="btn btn-outline logout-btn">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>

      {/* Main Grid View */}
      <main className="dashboard-container">
        {/* Left Side Column - Creator Controls */}
        <div className="dashboard-sidebar">
          <div className="glass-panel">
            <h3 className="panel-title">Shorten Target URL</h3>
            
            {formError && (
              <div style={{
                background: 'rgba(255, 71, 87, 0.12)',
                border: '1px solid rgba(255, 71, 87, 0.3)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '16px',
                color: '#ff4757',
                fontSize: '13px'
              }}>
                {formError}
              </div>
            )}

            {formSuccess && (
              <div style={{
                background: 'rgba(46, 213, 115, 0.12)',
                border: '1px solid rgba(46, 213, 115, 0.3)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '16px',
                color: '#2ed573',
                fontSize: '13px'
              }}>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleShorten} className="creator-form">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Destination URL</label>
                <div className="input-container">
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com/very/long/query/param?id=42"
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
              </div>

              {/* Advanced Configurations Drawer */}
              <div 
                className="advanced-trigger"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>Advanced Customizations</span>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>

              {showAdvanced && (
                <div className="advanced-fields">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Custom Alias (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="custom-short-slug"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Expiration Date (Optional)</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Plus size={18} /> {submitting ? 'Generating...' : 'Shorten URL'}
              </button>
            </form>
          </div>

          {/* Quick Metrics card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '15px', color: '#a4b0be', marginBottom: '12px', fontWeight: '600' }}>YOUR CLOUD USAGE</h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'Outfit' }}>{urls.length}</span>
              <span style={{ color: '#747d8c', fontSize: '13px' }}>active links generated</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
              <span style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'Outfit', color: '#0fbcf9' }}>
                {urls.reduce((acc, curr) => acc + curr.clicks, 0)}
              </span>
              <span style={{ color: '#747d8c', fontSize: '13px' }}>total redirection clicks</span>
            </div>
          </div>
        </div>

        {/* Right Side Column - Dynamic Display Pane */}
        <div>
          {selectedUrlId ? (
            /* ================== DETAILED ANALYTICS VIEW ================== */
            <div className="analytics-section">
              <div className="section-header">
                <button onClick={() => setSelectedUrlId(null)} className="back-btn">
                  <ArrowLeft size={16} /> Back to Catalog
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      const activeUrlObj = urls.find(u => u._id === selectedUrlId);
                      if (activeUrlObj) {
                        setEditUrl(activeUrlObj);
                        setNewDestinationUrl(activeUrlObj.originalUrl);
                      }
                    }} 
                    className="btn btn-outline"
                    style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '10px' }}
                  >
                    <Edit3 size={14} /> Edit Target
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedUrlId)} 
                    className="btn btn-danger"
                    style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '10px' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>

              {loadingAnalytics && (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(136, 84, 208, 0.1)',
                    borderTopColor: '#8854d0',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                  }}></div>
                  <p style={{ color: '#a4b0be' }}>Gathering visitor interactions...</p>
                </div>
              )}

              {analyticsData && (
                <>
                  <div>
                    <h2 style={{ fontSize: '28px', marginBottom: '4px' }}>/{analyticsData.shortCode}</h2>
                    <p style={{ color: '#a4b0be', wordBreak: 'break-all', fontSize: '14px' }}>
                      Redirects to:{' '}
                      <a href={analyticsData.originalUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {analyticsData.originalUrl} <ExternalLink size={12} />
                      </a>
                    </p>
                  </div>

                  {/* Summary aggregate metrics */}
                  <div className="metrics-summary-grid">
                    <div className="metric-card">
                      <h4 style={{ fontSize: '13px', color: '#a4b0be', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Interactions</h4>
                      <div className="metric-number">{analyticsData.totalClicks}</div>
                      <p style={{ fontSize: '12px', color: '#747d8c' }}>accumulated redirection events</p>
                    </div>

                    <div className="metric-card">
                      <h4 style={{ fontSize: '13px', color: '#a4b0be', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Visited</h4>
                      <div className="metric-number" style={{ fontSize: '18px', padding: '15px 0', margin: 0, fontWeight: '700' }}>
                        {analyticsData.lastVisited ? new Date(analyticsData.lastVisited).toLocaleString() : 'No clicks logged'}
                      </div>
                      <p style={{ fontSize: '12px', color: '#747d8c' }}>last incoming request timestamp</p>
                    </div>

                    <div className="metric-card">
                      <h4 style={{ fontSize: '13px', color: '#a4b0be', textTransform: 'uppercase', letterSpacing: '0.5px' }}>QR Code Link</h4>
                      <div style={{ padding: '8px 0' }}>
                        <button 
                          onClick={() => setQrLink(`${API_BASE}/${analyticsData.shortCode}`)}
                          className="btn btn-outline"
                          style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', margin: '0 auto' }}
                        >
                          <QrCode size={14} /> Open QR Canvas
                        </button>
                      </div>
                      <p style={{ fontSize: '12px', color: '#747d8c' }}>scan to redirect mobile browsers</p>
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="charts-grid">
                    {/* Click History Trend Curve */}
                    <div className="glass-panel full-width-chart">
                      <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700' }}>DAILY VISITS (LAST 14 DAYS)</h4>
                      <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                          <AreaChart data={analyticsData.dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8854d0" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#8854d0" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="date" stroke="#747d8c" fontSize={11} tickLine={false} />
                            <YAxis stroke="#747d8c" fontSize={11} tickLine={false} allowDecimals={false} />
                            <Tooltip 
                              contentStyle={{ background: '#10141e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f5f7fa' }}
                            />
                            <Area type="monotone" dataKey="count" name="Clicks" stroke="#8854d0" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClicks)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Browser Distribution */}
                    <div className="glass-panel">
                      <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Monitor size={16} style={{ color: '#0fbcf9' }} /> BROWSER ANALYTICS
                      </h4>
                      {analyticsData.browserShare.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#747d8c', fontSize: '13px' }}>No browser data logged yet</div>
                      ) : (
                        <div style={{ width: '100%', height: 200 }}>
                          <ResponsiveContainer>
                            <BarChart data={analyticsData.browserShare} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                              <XAxis type="number" hide />
                              <YAxis dataKey="browser" type="category" stroke="#a4b0be" fontSize={12} tickLine={false} axisLine={false} width={80} />
                              <Tooltip 
                                contentStyle={{ background: '#10141e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                              />
                              <Bar dataKey="count" name="Visits" fill="#0fbcf9" radius={[0, 4, 4, 0]}>
                                {analyticsData.browserShare.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#0fbcf9' : '#0fbcf9aa'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Operating System Distribution */}
                    <div className="glass-panel">
                      <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Laptop size={16} style={{ color: '#8854d0' }} /> OS ANALYTICS
                      </h4>
                      {analyticsData.osShare.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#747d8c', fontSize: '13px' }}>No OS data logged yet</div>
                      ) : (
                        <div style={{ width: '100%', height: 200 }}>
                          <ResponsiveContainer>
                            <BarChart data={analyticsData.osShare} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                              <XAxis type="number" hide />
                              <YAxis dataKey="os" type="category" stroke="#a4b0be" fontSize={12} tickLine={false} axisLine={false} width={80} />
                              <Tooltip 
                                contentStyle={{ background: '#10141e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                              />
                              <Bar dataKey="count" name="Visits" fill="#8854d0" radius={[0, 4, 4, 0]}>
                                {analyticsData.osShare.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#8854d0' : '#8854d0aa'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Geo Location Map Summary */}
                    <div className="glass-panel full-width-chart">
                      <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={16} style={{ color: '#2ed573' }} /> TOP COUNTRIES
                      </h4>
                      {analyticsData.countryShare.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#747d8c', fontSize: '13px' }}>No geolocation logs recorded</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                          {analyticsData.countryShare.map((c, idx) => (
                            <div 
                              key={c.country}
                              style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid var(--border)',
                                borderRadius: '14px',
                                padding: '16px',
                                textAlign: 'center'
                              }}
                            >
                              <div style={{ fontSize: '13px', color: '#a4b0be', fontWeight: '500' }}>
                                {c.country === 'IN' ? '🇮🇳 India' : c.country === 'US' ? '🇺🇸 United States' : c.country === 'GB' ? '🇬🇧 United Kingdom' : c.country}
                              </div>
                              <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'Outfit', color: '#2ed573', marginTop: '6px' }}>{c.count}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Visit Logs list */}
                    <div className="glass-panel full-width-chart">
                      <h4 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: '700' }}>RECENT VISITOR LOGS (LAST 50 CLICKS)</h4>
                      {analyticsData.recentHistory.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px' }}>
                          <p style={{ fontSize: '14px' }}>No click events logged for this short URL yet.</p>
                        </div>
                      ) : (
                        <div className="logs-list">
                          {analyticsData.recentHistory.map((log, idx) => (
                            <div key={idx} className="log-item">
                              <div className="log-info">
                                <span style={{ color: '#f5f7fa', fontWeight: '600' }}>{log.ipAddress}</span>
                                <span>•</span>
                                <span>{log.browser} ({log.os})</span>
                              </div>
                              <div className="log-meta">
                                <span className="meta-badge badge-active" style={{ marginRight: '12px', fontSize: '10px' }}>{log.country}</span>
                                <span style={{ color: '#747d8c' }}>{new Date(log.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </>
              )}
            </div>
          ) : (
            /* ================== URL CATALOG VIEW ================== */
            <div className="catalog-section">
              <div className="section-header">
                <h2 className="catalog-title">Active Links</h2>
                {/* Search Bar Input */}
                <div className="search-bar" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search codes or target URLs..."
                    style={{ paddingLeft: '40px' }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '14px', top: '16px', color: '#747d8c' }} />
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(136, 84, 208, 0.1)',
                    borderTopColor: '#8854d0',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }}></div>
                </div>
              ) : filteredUrls.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔗</div>
                  <h3>No links found</h3>
                  <p style={{ marginTop: '8px', color: '#747d8c' }}>
                    {search ? "No links match your search filter." : "Create your first shortened code on the left to start gathering insights."}
                  </p>
                </div>
              ) : (
                <div className="catalog-list">
                  {filteredUrls.map((url) => {
                    const isExpired = url.expiresAt && new Date() > new Date(url.expiresAt);
                    const linkCode = `${API_BASE}/${url.shortCode}`;
                    return (
                      <div key={url._id} className="url-item-card">
                        <div className="url-item-header">
                          <div className="url-main-info">
                            <span className="short-url-link">
                              /{url.shortCode}
                            </span>
                            <span className="original-url-text" title={url.originalUrl}>
                              {url.originalUrl}
                            </span>
                          </div>

                          <div className="url-item-actions">
                            <button 
                              onClick={() => handleCopy(url._id, url.shortCode)}
                              className="action-btn"
                              title="Copy short URL"
                            >
                              {copiedId === url._id ? <Check size={16} style={{ color: '#2ed573' }} /> : <Copy size={16} />}
                            </button>
                            
                            <button 
                              onClick={() => setQrLink(linkCode)}
                              className="action-btn"
                              title="QR Code"
                            >
                              <QrCode size={16} />
                            </button>

                            <button 
                              onClick={() => loadAnalytics(url._id)}
                              className="action-btn"
                              title="View Analytics"
                            >
                              <BarChart3 size={16} style={{ color: '#8854d0' }} />
                            </button>

                            <button 
                              onClick={() => {
                                setEditUrl(url);
                                setNewDestinationUrl(url.originalUrl);
                              }}
                              className="action-btn"
                              title="Edit Target Destination"
                            >
                              <Edit3 size={16} />
                            </button>

                            <button 
                              onClick={() => handleDelete(url._id)}
                              className="action-btn delete-btn"
                              title="Delete Link"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Metadata Row */}
                        <div className="url-meta-grid">
                          <div className="meta-item">
                            <span className="meta-label">CLICKS</span>
                            <span className="meta-value" style={{ fontFamily: 'Outfit', fontSize: '15px' }}>{url.clicks}</span>
                          </div>
                          
                          <div className="meta-item">
                            <span className="meta-label">CREATED</span>
                            <span className="meta-value">{new Date(url.createdAt).toLocaleDateString()}</span>
                          </div>

                          <div className="meta-item">
                            <span className="meta-label">STATUS</span>
                            <span className={`meta-badge ${isExpired ? 'badge-expired' : 'badge-active'}`}>
                              {isExpired ? 'EXPIRED' : 'ACTIVE'}
                            </span>
                          </div>

                          {url.expiresAt && (
                            <div className="meta-item">
                              <span className="meta-label">EXPIRES</span>
                              <span className="meta-value" style={{ color: isExpired ? '#ff4757' : '#ffa502' }}>
                                {new Date(url.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ================== EDIT TARGET MODAL ================== */}
      {editUrl && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'left' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>Edit Link Target</h3>
            <p style={{ color: '#a4b0be', fontSize: '13px', marginBottom: '20px' }}>
              Updating target for: <strong style={{ color: '#f5f7fa' }}>/{editUrl.shortCode}</strong>
            </p>
            
            {editError && (
              <div style={{
                background: 'rgba(255, 71, 87, 0.12)',
                border: '1px solid rgba(255, 71, 87, 0.3)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '16px',
                color: '#ff4757',
                fontSize: '13px'
              }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateDestination}>
              <div className="form-group">
                <label className="form-label">New Destination URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={newDestinationUrl}
                  onChange={(e) => setNewDestinationUrl(e.target.value)}
                  disabled={editSubmitting}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditUrl(null)} 
                  className="btn btn-outline"
                  disabled={editSubmitting}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={editSubmitting}
                  style={{ flex: 1 }}
                >
                  {editSubmitting ? 'Updating...' : 'Save Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================== QR CODE MODAL OVERLAY ================== */}
      {qrLink && (
        <div className="modal-overlay" onClick={() => setQrLink(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>QR Code Link</h3>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', display: 'inline-block', margin: '0 auto 20px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)' }}>
              <QRCodeCanvas value={qrLink} size={180} />
            </div>
            <p style={{ color: '#a4b0be', fontSize: '13px', marginBottom: '24px', wordBreak: 'break-all' }}>
              {qrLink}
            </p>
            <button onClick={() => setQrLink(null)} className="btn btn-outline">
              Close Canvas
            </button>
          </div>
        </div>
      )}

      {/* Hackathon Affiliation Footer */}
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

export default Dashboard;
