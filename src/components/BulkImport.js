import React, { useState } from 'react';
import './BulkImport.css';

const BulkImport = ({ onComplete, onCancel }) => {
  const [songList, setSongList] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('manual'); // 'manual' | 'csv'

  const API_URL = process.env.REACT_APP_MATERIALS_URL || 'http://localhost:3002';

  const handleProcess = async () => {
    if (!songList.trim()) {
      alert('Please enter at least one song');
      return;
    }

    setProcessing(true);
    setResults(null);

    try {
      // Split by newlines and clean up
      const songs = songList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((song, index) => {
          const parts = song.split(' - ');
          const title = parts[0] || song;
          const artist = parts[1] || 'Unknown Artist';
          return { Title: title, Artist: artist };
        });

      // Call enrichment API
      const response = await fetch(`${API_URL}/api/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ songs })
      });

      if (!response.ok) {
        throw new Error('Enrichment failed');
      }

      const data = await response.json();
      
      // Format results for display
      const enrichedResults = data.songs.map((song, index) => ({
        id: `new-${index}`,
        original: songs[index].Title + (songs[index].Artist !== 'Unknown Artist' ? ` - ${songs[index].Artist}` : ''),
        ...song,
        status: 'ready'
      }));

      setResults(enrichedResults);
      setSelectedSongs(enrichedResults.map((s) => s.id));
    } catch (err) {
      alert('Failed to process song list: ' + err.message);
      console.error('Process error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleSong = (songId) => {
    setSelectedSongs((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  const handleImport = async () => {
    const songsToImport = results.filter((song) => selectedSongs.includes(song.id));

    if (songsToImport.length === 0) {
      alert('Please select at least one song to import');
      return;
    }

    setProcessing(true);

    try {
      // Import each song
      for (const song of songsToImport) {
        // Remove the temporary id field
        const { id, original, status, ...songData } = song;

        await fetch(`${API_URL}/api/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(songData),
        });
      }

      alert(`Successfully imported ${songsToImport.length} songs!`);
      onComplete();
    } catch (err) {
      alert('Failed to import songs');
      console.error('Import error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bulk-import">
      <div className="import-header">
        <h2>Bulk Import Songs</h2>
        <button onClick={onCancel} className="btn-close" disabled={processing}>
          ✕
        </button>
      </div>

      <div className="import-content">
        {/* Mode Switch */}
        <div className="mode-switch">
          <button className={mode==='manual'? 'active' : ''} onClick={()=>{setMode('manual'); setPreview(null);}} disabled={processing}>Manual List</button>
          <button className={mode==='csv'? 'active' : ''} onClick={()=>{setMode('csv'); setResults(null);}} disabled={processing}>CSV Upload</button>
        </div>

        {mode === 'manual' && !results ? (
          <div className="import-input">
            <div className="input-section">
              <h3>Enter Song List</h3>
              <p className="help-text">
                Enter one song per line. Format: "Title - Artist" or just "Title"
              </p>
              <textarea
                value={songList}
                onChange={(e) => setSongList(e.target.value)}
                placeholder={'Ain\'t No Sunshine - Bill Withers\nBlue Hawaii - Elvis Presley\nSomewhere Over The Rainbow'}
                rows={15}
                disabled={processing}
              />
            </div>

            <div className="input-actions">
              <button onClick={onCancel} disabled={processing} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleProcess} disabled={processing} className="btn-primary">
                {processing ? 'Processing...' : 'Process List'}
              </button>
            </div>
          </div>
        ) : mode === 'manual' && results ? (
          <div className="import-results">
            <div className="results-header">
              <h3>Review Songs ({selectedSongs.length} selected)</h3>
              <div className="results-actions">
                <button onClick={() => setResults(null)} className="btn-secondary">
                  ← Back to Edit
                </button>
                <button
                  onClick={() =>
                    setSelectedSongs(
                      selectedSongs.length === results.length ? [] : results.map((s) => s.id)
                    )
                  }
                  className="btn-secondary"
                >
                  {selectedSongs.length === results.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleImport}
                  disabled={processing || selectedSongs.length === 0}
                  className="btn-primary"
                >
                  {processing ? 'Importing...' : `Import ${selectedSongs.length} Songs`}
                </button>
              </div>
            </div>

            <div className="results-list">
              {results.map((song) => (
                <div key={song.id} className={`result-item ${selectedSongs.includes(song.id) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedSongs.includes(song.id)}
                    onChange={() => handleToggleSong(song.id)}
                  />
                  <div className="result-info">
                    <div className="result-title">{song.Title}</div>
                    <div className="result-artist">{song.Artist}</div>
                    <div className="result-metadata">
                      {song.BPM_Best && <span className="meta-badge">BPM: {song.BPM_Best}</span>}
                      {song.Key_Best && <span className="meta-badge">Key: {song.Key_Best}</span>}
                      {song.Genre && <span className="meta-badge">Genre: {song.Genre}</span>}
                      {song.releaseYear && <span className="meta-badge">Year: {song.releaseYear}</span>}
                    </div>
                    <div className="result-original">Source: {song.original}</div>
                  </div>
                  <div className={`result-status ${song.status}`}>
                    {song.status === 'ready' && '✓ Enriched'}
                    {song.status === 'found' && '🔍 Found'}
                    {song.status === 'error' && '⚠ Check'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mode === 'csv' && (
          <div className="csv-import">
            {!preview && (
              <div className="csv-upload-panel">
                <h3>Upload CSV</h3>
                <p className="help-text">CSV must include at least columns: Title, Artist. Optional: BPM_Best, Key_Best, Genre, releaseYear.</p>
                <input type="file" accept=".csv" disabled={processing} onChange={e=> setCsvFile(e.target.files[0] || null)} />
                <div className="input-actions">
                  <button onClick={onCancel} disabled={processing} className="btn-secondary">Cancel</button>
                  <button
                    onClick={async ()=>{
                      if(!csvFile){alert('Choose a CSV file first'); return;}
                      setProcessing(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', csvFile);
                        const resp = await fetch(`${API_URL}/api/import/preview`, { method:'POST', credentials:'include', body: formData });
                        if(!resp.ok) throw new Error('Preview failed');
                        const data = await resp.json();
                        setPreview(data);
                      } catch(e){
                        alert('Preview error: '+e.message);
                      } finally { setProcessing(false); }
                    }}
                    disabled={processing}
                    className="btn-primary"
                  >{processing? 'Analyzing...' : 'Preview CSV'}</button>
                </div>
              </div>
            )}

            {preview && (
              <div className="preview-results">
                <div className="results-header">
                  <h3>CSV Preview</h3>
                  <div className="results-actions">
                    <button onClick={()=>setPreview(null)} className="btn-secondary">← Back</button>
                  </div>
                </div>
                <div className="preview-summary">
                  <div className="summary-item">Incoming Rows: {preview.meta.totalIncoming}</div>
                  <div className="summary-item new">New: {preview.meta.newCount}</div>
                  <div className="summary-item dup">Exact Duplicates: {preview.meta.duplicateCount}</div>
                  <div className="summary-item upd">Potential Updates: {preview.meta.updateCount}</div>
                  <div className="summary-item fuzzy">Fuzzy Matches: {preview.meta.fuzzyCount}</div>
                </div>
                <div className="preview-section">
                  <h4>New Songs ({preview.newRows.length})</h4>
                  {preview.newRows.length === 0 && <div className="empty-sub">None</div>}
                  {preview.newRows.map((r,i)=>(
                    <div key={i} className="preview-row new-row">{r.Title} – {r.Artist}</div>
                  ))}
                </div>
                <div className="preview-section">
                  <h4>Potential Updates ({preview.updateCandidates.length})</h4>
                  {preview.updateCandidates.length === 0 && <div className="empty-sub">None</div>}
                  {preview.updateCandidates.map((c,i)=>(
                    <div key={i} className="preview-row update-row">
                      {c.Title} – {c.Artist}
                      <div className="changes">
                        {Object.entries(c.changes).map(([f,v])=> <span key={f} className="change-badge">{f}: {v.old || '∅'} → {v.new}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="preview-section">
                  <h4>Exact Duplicates ({preview.duplicateRows.length})</h4>
                  {preview.duplicateRows.length === 0 && <div className="empty-sub">None</div>}
                  {preview.duplicateRows.map((d,i)=>(
                    <div key={i} className="preview-row dup-row">{d.Title} – {d.Artist} (ID {d.ID})</div>
                  ))}
                </div>
                <div className="preview-section">
                  <h4>Fuzzy Matches ({preview.fuzzyChecks.length})</h4>
                  {preview.fuzzyChecks.length === 0 && <div className="empty-sub">None</div>}
                  {preview.fuzzyChecks.map((f,i)=>(
                    <div key={i} className="preview-row fuzzy-row">{f.incoming.Title} – {f.incoming.Artist} ≈ {f.existing.Title} (ID {f.existing.ID})</div>
                  ))}
                </div>
                <div className="commit-actions">
                  <button onClick={()=>setPreview(null)} className="btn-secondary" disabled={processing}>Back</button>
                  <button
                    className="btn-primary"
                    disabled={processing || (preview.newRows.length===0 && preview.updateCandidates.length===0)}
                    onClick={async ()=>{
                      if(!window.confirm('Confirm import of new songs and updates?')) return;
                      setProcessing(true);
                      try {
                        const body = {
                          newSongs: preview.newRows,
                          updates: preview.updateCandidates
                        };
                        const resp = await fetch(`${API_URL}/api/import/commit`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(body)});
                        if(!resp.ok) throw new Error('Commit failed');
                        const data = await resp.json();
                        alert(`Created ${data.committed.created.length}, Updated ${data.committed.updated.length}`);
                        onComplete();
                      } catch(e){
                        alert('Commit error: '+e.message);
                      } finally { setProcessing(false); }
                    }}
                  >{processing? 'Committing...' : 'Commit Import'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkImport;
