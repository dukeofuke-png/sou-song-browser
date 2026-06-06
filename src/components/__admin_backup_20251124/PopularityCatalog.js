import React, { useState, useEffect } from 'react';
import './PopularityCatalog.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function Badge({ tier }) {
  const colorMap = {
    Classic: '#7b1fa2',
    High: '#1976d2',
    Solid: '#388e3c',
    Emerging: '#f57c00'
  };
  return <span className="pop-badge" style={{ backgroundColor: colorMap[tier] || '#616161' }}>{tier}</span>;
}

export default function PopularityCatalog() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [minScorePercent, setMinScorePercent] = useState(50); // Store as percentage 0-100
  const [tier, setTier] = useState('');
  const [source, setSource] = useState('');
  const [limit, setLimit] = useState(50);
  const [seedLoaded, setSeedLoaded] = useState(false);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(new Set()); // Track selected songs for bulk promotion
  const [promoting, setPromoting] = useState(false); // Track if promotion is in progress

  const fetchCatalog = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (minScorePercent) params.append('minScore', minScorePercent / 100); // Convert to 0-1 for API
      if (tier) params.append('tier', tier);
      if (source) params.append('source', source);
      if (limit) params.append('limit', limit);
      const res = await fetch(`${API}/api/popularity/catalog?` + params.toString(), { credentials: 'include' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      setSongs(data.songs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSeed = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/popularity/seed/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Seed load failed');
      setSeedLoaded(true);
      await fetchCatalog();
      await fetchStats();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/api/popularity/seed/stats`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setStats(data);
        // If seed already has data, mark as loaded
        if (data.identities > 0) setSeedLoaded(true);
      }
    } catch {}
  };

  const promoteSong = async (song) => {
    if (!window.confirm(`Promote "${song.title}" by ${song.artist} to the main database?\n\nScore: ${(song.score * 100).toFixed(1)}%\nTier: ${song.tier}`)) {
      return;
    }
    
    setPromoting(true);
    setError(null);
    
    try {
      const res = await fetch(`${API}/api/popularity/promote/${encodeURIComponent(song.canonicalKey)}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error || 'Promotion failed');
      
      alert(`✅ Success! "${song.title}" added to database with ID ${data.songId}`);
      await fetchCatalog(); // Refresh to update UI
    } catch (e) {
      setError(`Promotion failed: ${e.message}`);
    } finally {
      setPromoting(false);
    }
  };

  const promoteSelected = async () => {
    if (selected.size === 0) {
      alert('No songs selected');
      return;
    }

    const selectedSongs = songs.filter(s => selected.has(s.canonicalKey));
    const eligibleSongs = selectedSongs.filter(s => s.score >= (stats?.threshold || 0.62));
    
    if (eligibleSongs.length === 0) {
      alert('None of the selected songs meet the minimum score threshold');
      return;
    }

    if (!window.confirm(`Promote ${eligibleSongs.length} song${eligibleSongs.length > 1 ? 's' : ''} to the main database?`)) {
      return;
    }

    setPromoting(true);
    setError(null);
    
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    for (const song of eligibleSongs) {
      try {
        const res = await fetch(`${API}/api/popularity/promote/${encodeURIComponent(song.canonicalKey)}`, {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.error || 'Promotion failed');
        succeeded++;
      } catch (e) {
        failed++;
        errors.push(`${song.title}: ${e.message}`);
      }
    }

    setPromoting(false);
    setSelected(new Set()); // Clear selection after promotion
    await fetchCatalog(); // Refresh catalog

    if (failed === 0) {
      alert(`✅ Success! Promoted ${succeeded} song${succeeded > 1 ? 's' : ''} to database`);
    } else {
      alert(`⚠️ Promoted ${succeeded}, failed ${failed}:\n\n${errors.join('\n')}`);
      setError(`Some promotions failed. Check console for details.`);
    }
  };

  const toggleSelection = (canonicalKey) => {
    const newSelected = new Set(selected);
    if (newSelected.has(canonicalKey)) {
      newSelected.delete(canonicalKey);
    } else {
      newSelected.add(canonicalKey);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    const eligibleKeys = songs
      .filter(s => s.score >= (stats?.threshold || 0.62))
      .map(s => s.canonicalKey);
    
    // If all eligible are selected, clear; otherwise select all eligible
    const allSelected = eligibleKeys.every(key => selected.has(key)) && eligibleKeys.length > 0;
    
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleKeys));
    }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchCatalog(); }, [minScorePercent, tier, source, limit]);

  return (
    <div className="popularity-catalog">
      <div className="pop-controls">
        <div className="pop-filters">
          <label>Min Score %
            <input type="number" step="5" min="0" max="100" value={minScorePercent} onChange={e => setMinScorePercent(parseInt(e.target.value) || 0)} />
          </label>
          <label>Tier
            <select value={tier} onChange={e => setTier(e.target.value)}>
              <option value="">All</option>
              <option value="Classic">Classic</option>
              <option value="High">High</option>
              <option value="Solid">Solid</option>
              <option value="Emerging">Emerging</option>
            </select>
          </label>
          <label>Source
            <input value={source} placeholder="(optional)" onChange={e => setSource(e.target.value)} />
          </label>
          <label>Limit
            <input type="number" min={1} max={500} value={limit} onChange={e => setLimit(parseInt(e.target.value) || 50)} />
          </label>
          <button onClick={fetchCatalog} disabled={loading}>Refresh</button>
          <button onClick={loadSeed} disabled={loading || seedLoaded}>Load Curated Seed</button>
        </div>
        <div className="pop-bulk-actions">
          <button 
            onClick={promoteSelected} 
            disabled={promoting || selected.size === 0}
            className="promote-selected-btn"
          >
            {promoting ? 'Promoting...' : `⬆ Promote Selected (${selected.size})`}
          </button>
        </div>
        {stats && (
          <div className="pop-stats">Seed Identities: {stats.identities} | Metrics: {stats.metrics}</div>
        )}
      </div>
      {error && <div className="pop-error">{error}</div>}
      {loading ? <div className="pop-loading">Loading...</div> : (
        <table className="pop-table">
          <thead>
            <tr>
              <th style={{width: '30px'}}>
                <input 
                  type="checkbox" 
                  onChange={toggleSelectAll}
                  checked={songs.filter(s => s.score >= (stats?.threshold || 0.62)).length > 0 && songs.filter(s => s.score >= (stats?.threshold || 0.62)).every(s => selected.has(s.canonicalKey))}
                  disabled={promoting || songs.filter(s => s.score >= (stats?.threshold || 0.62)).length === 0}
                  title="Select/Deselect all eligible songs"
                />
              </th>
              <th>Title</th>
              <th>Artist</th>
              <th>Score</th>
              <th>Tier</th>
              <th>Sources</th>
              <th>Components</th>
            </tr>
          </thead>
          <tbody>
            {songs.map(s => {
              const isEligible = s.score >= (stats?.threshold || 0.62);
              const isSelected = selected.has(s.canonicalKey);
              return (
              <tr key={s.canonicalKey} className={isSelected ? 'selected-row' : ''}>
                <td>
                  {isEligible ? (
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelection(s.canonicalKey)}
                      disabled={promoting}
                    />
                  ) : (
                    <span className="below-threshold" title={`Score ${(s.score * 100).toFixed(1)}% below threshold ${((stats?.threshold || 0.62) * 100).toFixed(0)}%`}>
                      ⛔
                    </span>
                  )}
                </td>
                <td>{s.title}</td>
                <td>{s.artist}</td>
                <td>{(s.score * 100).toFixed(1)}</td>
                <td><Badge tier={s.tier} /></td>
                <td>{s.sources.map(src => src.name).join(', ')}</td>
                <td className="pop-components">
                  {Object.entries(s.popularityComponents).map(([k,v]) => (
                    <span key={k} title={k}>{k}:{typeof v === 'number' ? v.toFixed(2) : v}</span>
                  ))}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
