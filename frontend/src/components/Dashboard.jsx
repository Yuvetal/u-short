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
  const [createMode, setCreateMode] = useState('single');
  const [csvFile, setCsvFile] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

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

  // Helper to parse JSON responses safely and avoid HTML parser exceptions
  const safeParseJson = async (res) => {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
      throw new Error(`Server returned HTML (Status: ${res.status}). If you just pushed an update, please wait 2-3 minutes for the backend deployment on Render to finish building.`);
    }
    throw new Error(text || `Server returned invalid response (Status: ${res.status})`);
  };

  // Load URL catalog
  const fetchUrls = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/urls`);
      const data = await safeParseJson(res);
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

    // Duplicate destination URL confirmation check
    const normalizedInput = originalUrl.trim();
    const normalizedInputWithProto = /^https?:\/\//i.test(normalizedInput) ? normalizedInput : 'https://' + normalizedInput;
    const existing = urls.find(u => u.originalUrl.toLowerCase() === normalizedInputWithProto.toLowerCase());
    if (existing) {
      if (!window.confirm(`You already have a shortened link for this URL: /${existing.shortCode}. Do you want to create another duplicate short link?`)) {
        return;
      }
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
      const data = await safeParseJson(res);

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

  // Download a template CSV for bulk uploads
  const downloadCsvTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,url,customAlias,expiresAt\nhttps://google.com,google-home,\nhttps://github.com/Yuvetal/u-short,project-repo,2026-12-31\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'bulk_url_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download bulk processed results as CSV
  const downloadBulkCsvResults = () => {
    if (!bulkResults) return;
    
    let csvContent = 'data:text/csv;charset=utf-8,Original URL,Shortened URL,Custom Alias,Status,Error\n';
    
    // Add success rows
    bulkResults.created.forEach(u => {
      csvContent += `"${u.originalUrl}","${API_BASE}/${u.shortCode}","${u.customAlias || ''}","SUCCESS",""\n`;
    });
    
    // Add fail rows
    bulkResults.errors.forEach(e => {
      csvContent += `"${e.url || ''}","","","FAILED","${e.error}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shortened_bulk_links_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV and batch create short URLs
  const handleBulkShorten = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setBulkResults(null);

    if (!csvFile) {
      setFormError('Please select a CSV file to upload');
      return;
    }

    setSubmitting(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        
        const urlsToProcess = [];
        let startIndex = 0;

        // Header row skip
        if (lines[0] && (lines[0].toLowerCase().includes('url') || lines[0].toLowerCase().includes('alias'))) {
          startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(',').map(p => p.replace(/^["']|["']$/g, '').trim());
          if (parts[0]) {
            urlsToProcess.push({
              originalUrl: parts[0],
              customAlias: parts[1] || undefined,
              expiresAt: parts[2] || undefined
            });
          }
        }

        if (urlsToProcess.length === 0) {
          throw new Error('No valid URL records found in the CSV file');
        }

        if (urlsToProcess.length > 100) {
          throw new Error('Bulk shortening is limited to 100 links per request');
        }

        // Find existing duplicate destination URLs
        const duplicates = [];
        const filteredUrlsToProcess = [];

        urlsToProcess.forEach(item => {
          const normalizedInput = item.originalUrl.trim();
          const normalizedInputWithProto = /^https?:\/\//i.test(normalizedInput) ? normalizedInput : 'https://' + normalizedInput;
          const isDup = urls.some(u => u.originalUrl.toLowerCase() === normalizedInputWithProto.toLowerCase());
          if (isDup) {
            duplicates.push(item);
          } else {
            filteredUrlsToProcess.push(item);
          }
        });

        let finalUrlsToProcess = urlsToProcess;

        if (duplicates.length > 0) {
          const createDups = window.confirm(
            `We found ${duplicates.length} destination URL(s) in your CSV that already have active shortened links in your account.\n\n` +
            `• Click OK to create duplicate shortened links for them.\n` +
            `• Click Cancel to skip these duplicate URLs and only shorten the new ones.`
          );

          if (!createDups) {
            finalUrlsToProcess = filteredUrlsToProcess;
            if (finalUrlsToProcess.length === 0) {
              setFormSuccess('All URLs in the CSV were duplicates and were skipped by your request.');
              setSubmitting(false);
              return;
            }
          }
        }

        const res = await authFetch(`${API_BASE}/api/urls/bulk`, {
          method: 'POST',
          body: JSON.stringify({ urls: finalUrlsToProcess })
        });
        
        const data = await safeParseJson(res);
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Bulk URL processing request failed');
        }

        setFormSuccess(`Bulk processing complete! Created: ${data.data.length}, Failed: ${data.errors.length}`);
        setBulkResults({
          successCount: data.data.length,
          failCount: data.errors.length,
          created: data.data,
          errors: data.errors
        });

        setCsvFile(null);
        fetchUrls();

      } catch (err) {
        setFormError(err.message || 'Error occurred while processing bulk upload');
      } finally {
        setSubmitting(false);
      }
    };
    reader.readAsText(csvFile);
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
      const data = await safeParseJson(res);

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

  // Handle Toggle selection of links
  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Handle Select/Deselect All currently filtered URLs
  const handleSelectAll = (filteredList) => {
    const filteredIds = filteredList.map(u => u._id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      // Deselect all filtered items
      setSelectedIds(selectedIds.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered items (merge with existing selections)
      const newSelections = new Set([...selectedIds, ...filteredIds]);
      setSelectedIds(Array.from(newSelections));
    }
  };

  // Bulk Delete Selected links
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected shortened links and all of their visitor analytics history?`)) {
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/urls/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await safeParseJson(res);
      
      if (data.success) {
        setUrls(urls.filter(url => !selectedIds.includes(url._id)));
        setSelectedIds([]);
        if (selectedIds.includes(selectedUrlId)) {
          setSelectedUrlId(null);
          setAnalyticsData(null);
        }
      }
    } catch (err) {
      console.error('[Dashboard] Bulk deletion error:', err.message);
      alert(err.message || 'Bulk deletion failed');
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
      const data = await safeParseJson(res);
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
      const data = await safeParseJson(res);

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
            <h3 className="panel-title">Shortener Tool</h3>
            
            {/* Toggle Modes Tab Bar */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '20px',
              marginTop: '-8px'
            }}>
              <button 
                type="button"
                onClick={() => {
                  setCreateMode('single');
                  setFormError('');
                  setFormSuccess('');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  color: createMode === 'single' ? '#8854d0' : '#a4b0be',
                  fontWeight: '600',
                  borderBottom: createMode === 'single' ? '2.5px solid #8854d0' : 'none',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  transition: 'all 0.2s'
                }}
              >
                Single Link
              </button>
              <button 
                type="button"
                onClick={() => {
                  setCreateMode('bulk');
                  setFormError('');
                  setFormSuccess('');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  color: createMode === 'bulk' ? '#8854d0' : '#a4b0be',
                  fontWeight: '600',
                  borderBottom: createMode === 'bulk' ? '2.5px solid #8854d0' : 'none',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  transition: 'all 0.2s'
                }}
              >
                Bulk (CSV)
              </button>
            </div>
            
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

            {createMode === 'single' ? (
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
            ) : (
              /* Bulk Mode Layout */
              <form onSubmit={handleBulkShorten} className="creator-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Upload CSV File</label>
                  <div style={{
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: '14px',
                    padding: '20px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}>
                    <input 
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                      disabled={submitting}
                    />
                    <div style={{ color: '#0fbcf9', fontSize: '28px', marginBottom: '8px' }}>📂</div>
                    <span style={{ fontSize: '13px', color: '#a4b0be', display: 'block' }}>
                      {csvFile ? csvFile.name : 'Drag & drop or browse .csv'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={downloadCsvTemplate} 
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '10px' }}
                  >
                    Template CSV
                  </button>
                  
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={submitting || !csvFile}
                    style={{ flex: 2, padding: '10px', fontSize: '13px', borderRadius: '10px' }}
                  >
                    {submitting ? 'Processing...' : 'Shorten List'}
                  </button>
                </div>

                {bulkResults && (
                  <div style={{
                    marginTop: '12px',
                    background: 'rgba(15, 188, 249, 0.08)',
                    border: '1px solid rgba(15, 188, 249, 0.25)',
                    borderRadius: '12px',
                    padding: '14px',
                    textAlign: 'center'
                  }}>
                    <p style={{ fontSize: '13px', color: '#f5f7fa', marginBottom: '10px' }}>
                      Processed: <strong>{bulkResults.successCount}</strong> successfully,{' '}
                      <strong style={{ color: bulkResults.failCount > 0 ? '#ff4757' : '#a4b0be' }}>{bulkResults.failCount}</strong> failed.
                    </p>
                    <button 
                      type="button"
                      onClick={downloadBulkCsvResults}
                      className="btn btn-primary"
                      style={{
                        background: 'var(--accent-gradient)',
                        fontSize: '12px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        width: '100%',
                        marginBottom: bulkResults.failCount > 0 ? '12px' : 0
                      }}
                    >
                      Download Shortened CSV
                    </button>

                    {bulkResults.failCount > 0 && (
                      <div style={{
                        marginTop: '12px',
                        background: 'rgba(255, 71, 87, 0.06)',
                        border: '1px solid rgba(255, 71, 87, 0.2)',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'left',
                        maxHeight: '120px',
                        overflowY: 'auto'
                      }}>
                        <h5 style={{ fontSize: '11px', color: '#ff4757', marginBottom: '6px', fontWeight: '700' }}>FAILURES:</h5>
                        <ul style={{ fontSize: '11px', color: '#a4b0be', paddingLeft: '14px', margin: 0, listStyleType: 'disc' }}>
                          {bulkResults.errors.map((e, idx) => (
                            <li key={idx} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
                              Row {e.index + 1} ({e.url || 'Empty'}): <span style={{ color: '#ff6b81' }}>{e.error}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
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
                <>
                  {/* Bulk Operations Toolbar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '12px 18px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      <input 
                        type="checkbox"
                        checked={filteredUrls.length > 0 && filteredUrls.every(u => selectedIds.includes(u._id))}
                        onChange={() => handleSelectAll(filteredUrls)}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: '#8854d0',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontWeight: '500' }}>
                        {selectedIds.length > 0 
                          ? `Selected ${selectedIds.length} of ${filteredUrls.length} link(s)` 
                          : 'Select All Links'}
                      </span>
                    </div>

                    {selectedIds.length > 0 && (
                      <button 
                        onClick={handleBulkDelete}
                        className="btn btn-danger"
                        style={{
                          padding: '6px 14px',
                          fontSize: '12px',
                          borderRadius: '8px',
                          width: 'auto'
                        }}
                      >
                        Delete Selected
                      </button>
                    )}
                  </div>

                  <div className="catalog-list">
                    {filteredUrls.map((url) => {
                      const isExpired = url.expiresAt && new Date() > new Date(url.expiresAt);
                      const linkCode = `${API_BASE}/${url.shortCode}`;
                      return (
                        <div key={url._id} className="url-item-card">
                          <div className="url-item-header" style={{ gap: '16px' }}>
                            <input 
                              type="checkbox"
                              checked={selectedIds.includes(url._id)}
                              onChange={() => handleToggleSelect(url._id)}
                              style={{
                                width: '16px',
                                height: '16px',
                                accentColor: '#8854d0',
                                cursor: 'pointer',
                                marginTop: '4px',
                                flexShrink: 0
                              }}
                            />
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
              </>
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
