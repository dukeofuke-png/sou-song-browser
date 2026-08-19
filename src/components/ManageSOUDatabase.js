import React, { useState, useEffect, useMemo } from 'react';
import { FiEye, FiEyeOff, FiSearch, FiFilter, FiDownload, FiPlus, FiSave, FiEdit2, FiMenu, FiMusic, FiChevronDown, FiChevronUp, FiLock, FiX } from 'react-icons/fi';
import './ManageSOUDatabase.css';

const ManageSOUDatabase = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all'); // New: search field selector
  const [sortField, setSortField] = useState('id'); // New: sort by field
  const [sortDirection, setSortDirection] = useState('desc'); // New: sort direction (desc = newest first)
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [savedViews, setSavedViews] = useState([]);
  const [currentViewName, setCurrentViewName] = useState('Default View');
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [columnOrder, setColumnOrder] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [inlineEditCell, setInlineEditCell] = useState(null); // { songId, columnKey }
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [enrichingSongs, setEnrichingSongs] = useState(new Set()); // song IDs currently being enriched
  const [enrichResults, setEnrichResults] = useState({}); // songId -> { success, enrichmentCount, error }

  // Default visible columns
  const defaultColumns = [
    'title',
    'artist',
    'year',
    'releaseDate',
    'genre',
    'level',
    'songSheetStatus',
    'tabStatus',
    'originalKey',
    'mode',
    'bpm',
    'spotifyPopularity'
  ];

  const [visibleColumns, setVisibleColumns] = useState(new Set(defaultColumns));

  // All available columns with metadata
  const availableColumns = {
    // Core Info - API (not editable)
    id: { label: 'ID', width: '80px', group: 'Core', searchable: true, sortable: true, editable: false, source: 'API' },
    title: { label: 'Title', width: '200px', group: 'Core', searchable: true, sortable: true, editable: false, source: 'API' },
    artist: { label: 'Artist', width: '180px', group: 'Core', searchable: true, sortable: true, editable: false, source: 'API' },
    year: { label: 'Year', width: '80px', group: 'Core', searchable: true, sortable: true, editable: false, source: 'API' },
    releaseDate: { label: 'Release Date', width: '120px', group: 'Core', searchable: true, sortable: true, editable: true, source: 'Override' },
    season: { label: 'Season', width: '100px', group: 'Core', searchable: true, sortable: true, editable: false, source: 'API' },
    
    // Classification
    genre: { label: 'Genre', width: '200px', group: 'Classification', searchable: true, sortable: true, editable: true, source: 'Augment' },
    tags: { label: 'Tags', width: '200px', group: 'Classification', searchable: true, sortable: false, editable: true, source: 'Augment' },
    
    // Teaching - Primary source (editable)
    level: { label: 'Level', width: '80px', group: 'Teaching', searchable: true, sortable: true, editable: true, source: 'Primary' },
    songSheetStatus: { label: 'Song Sheet', width: '120px', group: 'Teaching', searchable: true, sortable: true, editable: true, source: 'Primary' },
    tabStatus: { label: 'TAB', width: '100px', group: 'Teaching', searchable: true, sortable: true, editable: true, source: 'Primary' },
    teachingNotes: { label: 'Teaching Notes', width: '250px', group: 'Teaching', searchable: true, sortable: false, editable: true, source: 'Primary' },
    
    // Musical Details
    originalKey: { label: 'Original Key', width: '120px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Override' },
    souKeys: { label: 'SOU Keys', width: '120px', group: 'Musical', searchable: true, sortable: false, editable: true, source: 'Primary' },
    mode: { label: 'Mode', width: '100px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Override' },
    timeSignature: { label: 'Time Sig', width: '100px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Override' },
    bpm: { label: 'BPM', width: '80px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Override' },
    tempoLabel: { label: 'Tempo', width: '100px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Override' },
    numChords: { label: 'No. of Chords', width: '100px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Override' },
    chords: { label: 'Chords', width: '250px', group: 'Musical', searchable: true, sortable: false, editable: true, source: 'Override' },
    chordNumerals: { label: 'Chord Numerals', width: '200px', group: 'Musical', searchable: true, sortable: false, editable: true, source: 'Override' },
    strumStyle: { label: 'Strum Style', width: '180px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Primary' },
    fingerpickingStyle: { label: 'Fingerpicking', width: '180px', group: 'Musical', searchable: true, sortable: true, editable: true, source: 'Primary' },
    
    // Credits
    songwriters: { label: 'Songwriter', width: '200px', group: 'Credits', searchable: true, sortable: true, editable: true, source: 'Augment' },
    
    // Popularity - API (not editable)
    spotifyPopularity: { label: 'Popularity', width: '100px', group: 'Popularity', searchable: true, sortable: true, editable: false, source: 'API' },
    
    // Media - API (not editable)
    youtubeUrl: { label: 'YouTube', width: '100px', group: 'Media', searchable: false, sortable: false, editable: false, source: 'API' },
    spotifyTrackId: { label: 'Spotify', width: '100px', group: 'Media', searchable: false, sortable: false, editable: false, source: 'API' },
    songSheetUrl: { label: 'PDF', width: '100px', group: 'Media', searchable: false, sortable: false, editable: false, source: 'API' },
  };

  // Group columns by category
  const columnGroups = useMemo(() => {
    const groups = {};
    Object.entries(availableColumns).forEach(([key, meta]) => {
      if (!groups[meta.group]) groups[meta.group] = [];
      groups[meta.group].push({ key, ...meta });
    });
    return groups;
  }, []);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

  useEffect(() => {
    loadSongs();
    loadSavedViews();
    loadColumnOrder();
  }, []);

  // Initialize column order when visible columns change
  useEffect(() => {
    if (columnOrder.length === 0 && visibleColumns.size > 0) {
      setColumnOrder(Array.from(visibleColumns));
    }
  }, [visibleColumns]);

  const loadSongs = async () => {
    setLoading(true);
    setError('');
    try {
      // Load songs from backend API (converts CSV to JSON format with proper IDs)
      const response = await fetch(`${API_URL}/api/songs`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSongs(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load songs database');
      }
    } catch (err) {
      console.error('Load songs error:', err);
      setError('Failed to load songs database. Is the backend server running on port 3002?');
    } finally {
      setLoading(false);
    }
  };

  // Load saved views from localStorage
  const loadSavedViews = () => {
    try {
      const saved = localStorage.getItem('sou_database_views');
      if (saved) {
        setSavedViews(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load saved views:', err);
    }
  };

  // Save views to localStorage
  const saveViews = (views) => {
    try {
      localStorage.setItem('sou_database_views', JSON.stringify(views));
      setSavedViews(views);
    } catch (err) {
      console.error('Failed to save views:', err);
    }
  };

  // Load column order from localStorage
  const loadColumnOrder = () => {
    try {
      const saved = localStorage.getItem('sou_column_order');
      if (saved) {
        setColumnOrder(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load column order:', err);
    }
  };

  // Save column order to localStorage
  const saveColumnOrder = (order) => {
    try {
      localStorage.setItem('sou_column_order', JSON.stringify(order));
      setColumnOrder(order);
    } catch (err) {
      console.error('Failed to save column order:', err);
    }
  };

  // Filter songs based on search
  // Filter and sort songs
  const filteredSongs = useMemo(() => {
    let result = [...songs];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      
      result = result.filter(song => {
        // Search all fields
        if (searchField === 'all') {
          return (
            song.title?.toLowerCase().includes(search) ||
            song.artist?.toLowerCase().includes(search) ||
            song.id?.toString().toLowerCase().includes(search) ||
            (Array.isArray(song.genre) ? song.genre.some(g => g?.toLowerCase().includes(search)) : song.genre?.toLowerCase().includes(search)) ||
            song.originalKey?.toLowerCase().includes(search) ||
            song.mode?.toLowerCase().includes(search) ||
            song.level?.toString().includes(search) ||
            song.year?.toString().includes(search)
          );
        }
        
        // Search specific field
        const fieldValue = song[searchField];
        if (fieldValue === null || fieldValue === undefined) return false;
        
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v => v?.toString().toLowerCase().includes(search));
        }
        
        return fieldValue.toString().toLowerCase().includes(search);
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Handle arrays (use first element)
      if (Array.isArray(aVal)) aVal = aVal[0] || '';
      if (Array.isArray(bVal)) bVal = bVal[0] || '';

      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle strings
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return result;
  }, [songs, searchTerm, searchField, sortField, sortDirection]);

  // Toggle column visibility
  const toggleColumn = (columnKey) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnKey)) {
      newVisible.delete(columnKey);
      // Remove from column order
      setColumnOrder(prev => prev.filter(col => col !== columnKey));
    } else {
      newVisible.add(columnKey);
      // Add to end of column order
      setColumnOrder(prev => [...prev, columnKey]);
    }
    setVisibleColumns(newVisible);
  };

  // Save current view
  const handleSaveView = () => {
    if (!newViewName.trim()) return;

    const newView = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      columns: Array.from(visibleColumns),
      columnOrder: columnOrder,
      createdAt: new Date().toISOString()
    };

    const updatedViews = [...savedViews, newView];
    saveViews(updatedViews);
    setCurrentViewName(newViewName.trim());
    setNewViewName('');
    setSaveViewDialogOpen(false);
  };

  // Load a saved view
  const loadView = (view) => {
    setVisibleColumns(new Set(view.columns));
    setColumnOrder(view.columnOrder || view.columns);
    setCurrentViewName(view.name);
    setColumnSettingsOpen(false);
  };

  // Delete a saved view
  const deleteView = (viewId) => {
    const updatedViews = savedViews.filter(v => v.id !== viewId);
    saveViews(updatedViews);
  };

  // Column drag and drop handlers
  const handleDragStart = (e, columnKey) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    const targetIndex = newOrder.indexOf(targetColumnKey);

    // Remove dragged column
    newOrder.splice(draggedIndex, 1);
    // Insert at target position
    newOrder.splice(targetIndex, 0, draggedColumn);

    saveColumnOrder(newOrder);
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Handle column header click for sorting
  const handleColumnSort = (columnKey) => {
    if (!availableColumns[columnKey]?.sortable) return;
    
    if (sortField === columnKey) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(columnKey);
      setSortDirection('asc');
    }
  };

  // Select/deselect all songs
  const toggleSelectAll = () => {
    if (selectedSongs.size === filteredSongs.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(filteredSongs.map(s => s.id)));
    }
  };

  // Toggle individual song selection
  const toggleSongSelection = (songId) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  // Format cell value based on data type
  const formatCellValue = (song, columnKey) => {
    const value = song[columnKey];
    
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    // Array values (genre, tags, chords, etc.)
    if (Array.isArray(value)) {
      if (value.length === 0) return '—';
      return value.join(', ');
    }

    // Status badges (songSheetStatus, tabStatus)
    if (columnKey === 'songSheetStatus' || columnKey === 'tabStatus') {
      const status = String(value).toLowerCase();
      if (status === 'true' || status === 'yes') {
        return <span className="status-badge yes">Yes</span>;
      } else if (status === 'false' || status === 'no') {
        return <span className="status-badge no">No</span>;
      } else if (status === 'draft') {
        return <span className="status-badge draft">Draft</span>;
      }
      return value;
    }

    // Popularity score with visual bar
    if (columnKey === 'spotifyPopularity' && typeof value === 'number') {
      return (
        <div className="popularity-cell">
          <span className="popularity-value">{value}</span>
          <div className="popularity-bar-mini">
            <div 
              className="popularity-fill" 
              style={{ width: `${value}%` }}
            />
          </div>
        </div>
      );
    }

    return String(value);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const songsToExport = selectedSongs.size > 0 
      ? filteredSongs.filter(s => selectedSongs.has(s.id))
      : filteredSongs;

    if (songsToExport.length === 0) {
      alert('No songs to export');
      return;
    }

    // Get visible columns in order
    const columnsToExport = columnOrder.filter(col => visibleColumns.has(col));
    
    // Create CSV header
    const headers = columnsToExport.map(col => availableColumns[col].label);
    
    // Create CSV rows
    const rows = songsToExport.map(song => {
      return columnsToExport.map(col => {
        const value = song[col];
        
        // Handle arrays
        if (Array.isArray(value)) {
          return `"${value.join(', ')}"`;
        }
        
        // Handle strings with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value ?? '';
      });
    });

    // Combine into CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sou_database_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk edit fields
  const [bulkEditData, setBulkEditData] = useState({
    level: '',
    songSheetStatus: '',
    tabStatus: '',
    mode: ''
  });

  const handleBulkEdit = async () => {
    if (selectedSongs.size === 0) {
      alert('Please select songs to edit');
      return;
    }

    // Filter out empty values
    const updates = {};
    Object.keys(bulkEditData).forEach(key => {
      if (bulkEditData[key] !== '' && bulkEditData[key] !== null) {
        updates[key] = bulkEditData[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      alert('Please select at least one field to update');
      return;
    }

    try {
      // Call backend bulk update API
      const songIds = Array.from(selectedSongs);
      const response = await fetch(`${API_URL}/api/songs/bulk-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songIds, updates }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update songs');
      }

      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        console.warn('Some songs failed to update:', result.errors);
      }
      
      // Update local state with the changes
      setSongs(prev => prev.map(song => {
        if (selectedSongs.has(song.id)) {
          return { ...song, ...updates };
        }
        return song;
      }));

      alert(`Successfully updated ${result.updated} songs!`);
      setBulkEditOpen(false);
      setSelectedSongs(new Set());
      
      // Reset bulk edit form
      setBulkEditData({
        level: '',
        songSheetStatus: '',
        tabStatus: '',
        mode: ''
      });
    } catch (err) {
      console.error('Bulk edit error:', err);
      alert('Failed to update songs: ' + err.message);
    }
  };

  // Open edit modal for a song
  const handleRowClick = (song) => {
    setEditingSong(song);
    setEditFormData({ ...song });
    setEditModalOpen(true);
  };

  // Handle form field changes in edit modal
  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save edited song
  const handleSaveEdit = async () => {
    try {
      // Call backend API to update song
      const response = await fetch(`${API_URL}/api/songs/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to save song');
      }

      const updatedSong = await response.json();
      
      // Update local state
      setSongs(prev => prev.map(s => 
        (s.id === updatedSong.id || s.ID === updatedSong.ID) ? updatedSong : s
      ));
      
      alert('Song updated successfully!');
      setEditModalOpen(false);
      setEditingSong(null);
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save changes: ' + err.message);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditModalOpen(false);
    setEditingSong(null);
    setEditFormData({});
  };

  // Enrich a song via the rich pipeline (Wikipedia, Last.fm, GetSongBPM, Soundcharts)
  const handleEnrichSong = async (songId, e) => {
    if (e) e.stopPropagation();
    if (enrichingSongs.has(songId)) return; // already running

    setEnrichingSongs(prev => new Set([...prev, songId]));
    setEnrichResults(prev => ({ ...prev, [songId]: null }));

    try {
      const response = await fetch(`${API_URL}/api/songs/${songId}/enrich`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Enrichment failed');
      }

      if (data.success && data.song) {
        // Merge updated fields into local song list
        setSongs(prev => prev.map(s => (s.id === songId ? { ...s, ...data.song } : s)));
        // Also update the edit modal if this song is open
        setEditFormData(prev => prev.id === songId ? { ...prev, ...data.song } : prev);
      }

      setEnrichResults(prev => ({
        ...prev,
        [songId]: { success: data.success, enrichmentCount: data.enrichmentCount, message: data.message }
      }));
    } catch (err) {
      console.error('Enrich error:', err);
      setEnrichResults(prev => ({ ...prev, [songId]: { success: false, error: err.message } }));
    } finally {
      setEnrichingSongs(prev => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
    }
  };

  // Inline edit: double-click cell
  const handleCellDoubleClick = (song, columnKey) => {
    const colMeta = availableColumns[columnKey];
    if (!colMeta || !colMeta.editable) return;
    
    setInlineEditCell({ songId: song.id, columnKey });
    const currentValue = song[columnKey];
    setInlineEditValue(Array.isArray(currentValue) ? currentValue.join(', ') : currentValue || '');
  };

  // Save inline edit
  const handleSaveInlineEdit = async () => {
    if (!inlineEditCell) return;
    
    const { songId, columnKey } = inlineEditCell;
    const song = songs.find(s => s.id === songId || s.ID === songId);
    if (!song) return;
    
    try {
      // Handle array fields
      let newValue = inlineEditValue;
      if (Array.isArray(song[columnKey])) {
        newValue = inlineEditValue.split(',').map(v => v.trim()).filter(v => v);
      }
      
      // Call backend API to update single field
      const updates = { [columnKey]: newValue };
      const response = await fetch(`${API_URL}/api/songs/${songId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const updatedSong = await response.json();
      
      // Update local state
      setSongs(prev => prev.map(s => {
        if (s.id === songId || s.ID === songId) {
          return { ...s, [columnKey]: newValue };
        }
        return s;
      }));
      
      setInlineEditCell(null);
      setInlineEditValue('');
    } catch (err) {
      console.error('Inline edit error:', err);
      alert('Failed to save changes: ' + err.message);
    }
  };

  // Cancel inline edit
  const handleCancelInlineEdit = () => {
    setInlineEditCell(null);
    setInlineEditValue('');
  };

  // Handle Enter key in inline edit
  const handleInlineEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveInlineEdit();
    } else if (e.key === 'Escape') {
      handleCancelInlineEdit();
    }
  };

  // Get ordered visible columns
  const orderedVisibleColumns = useMemo(() => {
    return columnOrder.filter(col => visibleColumns.has(col));
  }, [columnOrder, visibleColumns]);

  return (
    <div className="manage-sou-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>
            <FiMusic /> Manage SOU Catalog
          </h1>
          <p>View and manage your teaching song collection ({songs.length} songs)</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="database-toolbar">
        <div className="toolbar-left">
          {/* Search with field selector */}
          <div className="search-box-group">
            <select 
              className="search-field-selector"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
            >
              <option value="all">All fields</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="id">ID</option>
              <option value="genre">Genre</option>
              <option value="originalKey">Key</option>
              <option value="mode">Mode</option>
              <option value="level">Level</option>
              <option value="year">Year</option>
              <option value="bpm">BPM</option>
            </select>
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder={searchField === 'all' ? 'Search all fields...' : `Search by ${searchField}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Selection info */}
          {selectedSongs.size > 0 && (
            <div className="selection-info">
              {selectedSongs.size} selected
            </div>
          )}
        </div>

        <div className="toolbar-right">
          {/* Bulk Edit Button (shows when songs selected) */}
          {selectedSongs.size > 0 && (
            <button 
              className="btn-secondary"
              onClick={() => setBulkEditOpen(true)}
            >
              <FiEdit2 /> Bulk edit
            </button>
          )}

          {/* Edit Columns Button */}
          <button 
            className="btn-edit-columns"
            onClick={() => setColumnSettingsOpen(!columnSettingsOpen)}
          >
            <FiFilter /> Edit columns
          </button>

          {/* Export Button */}
          <button 
            className="btn-secondary"
            onClick={handleExportCSV}
          >
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Column Settings Panel */}
      {columnSettingsOpen && (
        <div className="column-settings-panel">
          <div className="column-settings-header">
            <h3>Edit columns</h3>
            <button 
              className="close-settings"
              onClick={() => setColumnSettingsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="column-settings-body">
            {/* Saved Views */}
            {savedViews.length > 0 && (
              <div className="saved-views-section">
                <h4>Saved Views</h4>
                <div className="saved-views-list">
                  {savedViews.map(view => (
                    <div key={view.id} className="saved-view-item">
                      <button 
                        className="view-name-btn"
                        onClick={() => loadView(view)}
                      >
                        <FiEye /> {view.name}
                      </button>
                      <button 
                        className="delete-view-btn"
                        onClick={() => deleteView(view.id)}
                        title="Delete view"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Current View */}
            <div className="save-view-section">
              {!saveViewDialogOpen ? (
                <button 
                  className="btn-save-view"
                  onClick={() => setSaveViewDialogOpen(true)}
                >
                  <FiSave /> Save current view
                </button>
              ) : (
                <div className="save-view-form">
                  <input
                    type="text"
                    placeholder="View name..."
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveView()}
                    autoFocus
                  />
                  <div className="save-view-actions">
                    <button 
                      className="btn-save-confirm"
                      onClick={handleSaveView}
                      disabled={!newViewName.trim()}
                    >
                      Save
                    </button>
                    <button 
                      className="btn-cancel"
                      onClick={() => {
                        setSaveViewDialogOpen(false);
                        setNewViewName('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Column Groups */}
            {Object.entries(columnGroups).map(([groupName, columns]) => (
              <div key={groupName} className="column-group">
                <h4>{groupName}</h4>
                <div className="column-list">
                  {columns.map(col => (
                    <label key={col.key} className="column-checkbox">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                      />
                      <span className="checkbox-label">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="column-settings-footer">
            <div className="current-view-name">
              View: <strong>{currentViewName}</strong>
            </div>
            <button 
              className="btn-secondary"
              onClick={() => setColumnSettingsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Dialog */}
      {bulkEditOpen && (
        <div className="modal-overlay" onClick={() => setBulkEditOpen(false)}>
          <div className="bulk-edit-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Bulk Edit {selectedSongs.size} Songs</h3>
              <button 
                className="close-dialog"
                onClick={() => setBulkEditOpen(false)}
              >
                ×
              </button>
            </div>
            
            <div className="dialog-body">
              <p className="dialog-description">
                Select fields to update. Empty fields will not be changed.
              </p>

              <div className="bulk-edit-fields">
                <div className="edit-field">
                  <label>Level</label>
                  <select 
                    value={bulkEditData.level}
                    onChange={(e) => setBulkEditData({...bulkEditData, level: e.target.value})}
                  >
                    <option value="">— No change —</option>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                    <option value="4">Level 4</option>
                    <option value="5">Level 5</option>
                  </select>
                </div>

                <div className="edit-field">
                  <label>Song Sheet Status</label>
                  <select 
                    value={bulkEditData.songSheetStatus}
                    onChange={(e) => setBulkEditData({...bulkEditData, songSheetStatus: e.target.value})}
                  >
                    <option value="">— No change —</option>
                    <option value="TRUE">Yes</option>
                    <option value="FALSE">No</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div className="edit-field">
                  <label>TAB Status</label>
                  <select 
                    value={bulkEditData.tabStatus}
                    onChange={(e) => setBulkEditData({...bulkEditData, tabStatus: e.target.value})}
                  >
                    <option value="">— No change —</option>
                    <option value="TRUE">Yes</option>
                    <option value="FALSE">No</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div className="edit-field">
                  <label>Mode</label>
                  <select 
                    value={bulkEditData.mode}
                    onChange={(e) => setBulkEditData({...bulkEditData, mode: e.target.value})}
                  >
                    <option value="">— No change —</option>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="dialog-footer">
              <button 
                className="btn-secondary"
                onClick={() => setBulkEditOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleBulkEdit}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Song Modal */}
      {editModalOpen && editingSong && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="edit-song-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Edit Song: {editingSong.title}</h3>
              <button className="close-dialog" onClick={handleCancelEdit}>×</button>
            </div>

            <div className="dialog-body">
              <div className="edit-form">
                {/* Core Info - Non-editable */}
                <div className="form-section">
                  <h4>Core Information (API - Not Editable)</h4>
                  <div className="form-grid">
                    <div className="form-field non-editable-field">
                      <label><FiLock /> Title</label>
                      <input type="text" value={editFormData.title || ''} disabled />
                    </div>
                    <div className="form-field non-editable-field">
                      <label><FiLock /> Artist</label>
                      <input type="text" value={editFormData.artist || ''} disabled />
                    </div>
                    <div className="form-field non-editable-field">
                      <label><FiLock /> Year</label>
                      <input type="text" value={editFormData.year || ''} disabled />
                    </div>
                    <div className="form-field non-editable-field">
                      <label><FiLock /> Season</label>
                      <input type="text" value={editFormData.season || ''} disabled />
                    </div>
                  </div>
                </div>

                {/* Wikipedia Enrichment Data - Display Only */}
                {(editFormData.wikiBackground || editFormData.wikiComposition || editFormData.chartPeakUs || editFormData.chartPeakUk || editFormData.coverVersionsList) && (
                  <div className="form-section">
                    <h4>📚 Wikipedia Enrichment Data (Read-Only)</h4>
                    
                    {/* Chart Performance */}
                    {(editFormData.chartPeakUs || editFormData.chartPeakUk || editFormData.chartPeakAus || editFormData.chartPeakCanada || editFormData.chartPeakGermany || editFormData.chartPeakSweden) && (
                      <div style={{marginBottom: '20px'}}>
                        <h5 style={{marginBottom: '10px', color: '#2c3e50'}}>📊 Chart Performance</h5>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px'}}>
                          {editFormData.chartPeakUs && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇺🇸 <strong>US:</strong> #{editFormData.chartPeakUs}
                              {editFormData.chartPeakUs <= 10 && <span style={{marginLeft: '8px', color: '#e74c3c'}}>⭐ Top 10</span>}
                              {editFormData.chartPeakUs <= 40 && editFormData.chartPeakUs > 10 && <span style={{marginLeft: '8px', color: '#f39c12'}}>🎵 Top 40</span>}
                            </div>
                          )}
                          {editFormData.chartPeakUk && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇬🇧 <strong>UK:</strong> #{editFormData.chartPeakUk}
                              {editFormData.chartPeakUk <= 10 && <span style={{marginLeft: '8px', color: '#e74c3c'}}>⭐ Top 10</span>}
                              {editFormData.chartPeakUk <= 40 && editFormData.chartPeakUk > 10 && <span style={{marginLeft: '8px', color: '#f39c12'}}>🎵 Top 40</span>}
                            </div>
                          )}
                          {editFormData.chartPeakAus && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇦🇺 <strong>Australia:</strong> #{editFormData.chartPeakAus}
                            </div>
                          )}
                          {editFormData.chartPeakCanada && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇨🇦 <strong>Canada:</strong> #{editFormData.chartPeakCanada}
                            </div>
                          )}
                          {editFormData.chartPeakGermany && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇩🇪 <strong>Germany:</strong> #{editFormData.chartPeakGermany}
                            </div>
                          )}
                          {editFormData.chartPeakIreland && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇮🇪 <strong>Ireland:</strong> #{editFormData.chartPeakIreland}
                            </div>
                          )}
                          {editFormData.chartPeakFrance && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇫🇷 <strong>France:</strong> #{editFormData.chartPeakFrance}
                            </div>
                          )}
                          {editFormData.chartPeakSweden && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇸🇪 <strong>Sweden:</strong> #{editFormData.chartPeakSweden}
                            </div>
                          )}
                          {editFormData.chartPeakSwitzerland && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇨🇭 <strong>Switzerland:</strong> #{editFormData.chartPeakSwitzerland}
                            </div>
                          )}
                          {editFormData.chartPeakNetherlands && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇳🇱 <strong>Netherlands:</strong> #{editFormData.chartPeakNetherlands}
                            </div>
                          )}
                          {editFormData.chartPeakNewZealand && (
                            <div style={{padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px'}}>
                              🇳🇿 <strong>New Zealand:</strong> #{editFormData.chartPeakNewZealand}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Background */}
                    {editFormData.wikiBackground && (
                      <div style={{marginBottom: '20px'}}>
                        <h5 style={{marginBottom: '10px', color: '#2c3e50'}}>📖 Background</h5>
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '4px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {editFormData.wikiBackground}
                        </div>
                      </div>
                    )}

                    {/* Composition */}
                    {editFormData.wikiComposition && (
                      <div style={{marginBottom: '20px'}}>
                        <h5 style={{marginBottom: '10px', color: '#2c3e50'}}>🎼 Composition & Structure</h5>
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '4px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {editFormData.wikiComposition}
                        </div>
                      </div>
                    )}

                    {/* Cover Versions */}
                    {editFormData.coverVersionsList && (
                      <div style={{marginBottom: '20px'}}>
                        <h5 style={{marginBottom: '10px', color: '#2c3e50'}}>🎤 Notable Cover Versions ({editFormData.coverVersionsCount || 0})</h5>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                          {editFormData.coverVersionsList.split('|||').map((cover, idx) => {
                            const parts = cover.split(':');
                            const artist = parts[0]?.trim();
                            const description = parts.slice(1).join(':').trim();
                            return (
                              <div key={idx} style={{
                                padding: '8px 12px',
                                backgroundColor: '#e8f4f8',
                                borderRadius: '4px',
                                fontSize: '14px'
                              }}>
                                <strong>{artist}</strong>
                                {description && <span style={{color: '#555'}}> — {description}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Override Fields */}
                <div className="form-section">
                  <h4>Override Fields (Editable)</h4>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Release Date</label>
                      <input 
                        type="date" 
                        value={editFormData.releaseDate || ''}
                        onChange={(e) => handleEditFormChange('releaseDate', e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label>Mode (Major/Minor)</label>
                      <select 
                        value={editFormData.mode || ''}
                        onChange={(e) => handleEditFormChange('mode', e.target.value)}
                      >
                        <option value="">Select...</option>
                        <option value="Major">Major</option>
                        <option value="Minor">Minor</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Original Key</label>
                      <input 
                        type="text" 
                        value={editFormData.originalKey || ''}
                        onChange={(e) => handleEditFormChange('originalKey', e.target.value)}
                        placeholder="e.g., C, Am, D#"
                      />
                    </div>
                    <div className="form-field">
                      <label>Time Signature</label>
                      <input 
                        type="text" 
                        value={editFormData.timeSignature || ''}
                        onChange={(e) => handleEditFormChange('timeSignature', e.target.value)}
                        placeholder="e.g., 4/4, 3/4"
                      />
                    </div>
                    <div className="form-field">
                      <label>BPM</label>
                      <input 
                        type="number" 
                        value={editFormData.bpm || ''}
                        onChange={(e) => handleEditFormChange('bpm', e.target.value)}
                        min="0"
                        max="300"
                      />
                    </div>
                    <div className="form-field">
                      <label>Tempo Label</label>
                      <input 
                        type="text" 
                        value={editFormData.tempoLabel || ''}
                        onChange={(e) => handleEditFormChange('tempoLabel', e.target.value)}
                        placeholder="e.g., Moderate, Fast"
                      />
                    </div>
                    <div className="form-field">
                      <label>No. of Chords</label>
                      <input 
                        type="number" 
                        value={editFormData.numChords || ''}
                        onChange={(e) => handleEditFormChange('numChords', e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="form-field full-width">
                      <label>Chords</label>
                      <input 
                        type="text" 
                        value={editFormData.chords || ''}
                        onChange={(e) => handleEditFormChange('chords', e.target.value)}
                        placeholder="Comma-separated: C, F, G, Am"
                      />
                    </div>
                    <div className="form-field full-width">
                      <label>Chord Numerals</label>
                      <input 
                        type="text" 
                        value={editFormData.chordNumerals || ''}
                        onChange={(e) => handleEditFormChange('chordNumerals', e.target.value)}
                        placeholder="e.g., I, IV, V, vi"
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Source Fields */}
                <div className="form-section">
                  <h4>Primary Source (Editable)</h4>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Level</label>
                      <select 
                        value={editFormData.level || ''}
                        onChange={(e) => handleEditFormChange('level', e.target.value)}
                      >
                        <option value="">Select...</option>
                        <option value="1">Level 1</option>
                        <option value="2">Level 2</option>
                        <option value="3">Level 3</option>
                        <option value="4">Level 4</option>
                        <option value="5">Level 5</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Song Sheet Status</label>
                      <select 
                        value={editFormData.songSheetStatus || ''}
                        onChange={(e) => handleEditFormChange('songSheetStatus', e.target.value)}
                      >
                        <option value="">Select...</option>
                        <option value="TRUE">Yes</option>
                        <option value="FALSE">No</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>TAB Status</label>
                      <select 
                        value={editFormData.tabStatus || ''}
                        onChange={(e) => handleEditFormChange('tabStatus', e.target.value)}
                      >
                        <option value="">Select...</option>
                        <option value="TRUE">Yes</option>
                        <option value="FALSE">No</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>
                    <div className="form-field full-width">
                      <label>SOU Keys (Comma-separated)</label>
                      <input 
                        type="text" 
                        value={editFormData.souKeys || ''}
                        onChange={(e) => handleEditFormChange('souKeys', e.target.value)}
                        placeholder="e.g., C, G, Am"
                      />
                    </div>
                    <div className="form-field">
                      <label>Strum Style</label>
                      <input 
                        type="text" 
                        value={editFormData.strumStyle || ''}
                        onChange={(e) => handleEditFormChange('strumStyle', e.target.value)}
                        placeholder="e.g., Island, Swing"
                      />
                    </div>
                    <div className="form-field">
                      <label>Fingerpicking Style</label>
                      <input 
                        type="text" 
                        value={editFormData.fingerpickingStyle || ''}
                        onChange={(e) => handleEditFormChange('fingerpickingStyle', e.target.value)}
                        placeholder="e.g., Travis, Classical"
                      />
                    </div>
                    <div className="form-field full-width">
                      <label>Teaching Notes</label>
                      <textarea 
                        rows="3"
                        value={editFormData.teachingNotes || ''}
                        onChange={(e) => handleEditFormChange('teachingNotes', e.target.value)}
                        placeholder="Notes for teaching this song..."
                      />
                    </div>
                  </div>
                </div>

                {/* Augment Fields */}
                <div className="form-section">
                  <h4>Augment (Editable)</h4>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Genre</label>
                      <input 
                        type="text" 
                        value={editFormData.genre || ''}
                        onChange={(e) => handleEditFormChange('genre', e.target.value)}
                        placeholder="e.g., Rock, Pop, Jazz"
                      />
                    </div>
                    <div className="form-field full-width">
                      <label>Tags (Comma-separated)</label>
                      <input 
                        type="text" 
                        value={editFormData.tags || ''}
                        onChange={(e) => handleEditFormChange('tags', e.target.value)}
                        placeholder="e.g., beginner-friendly, classic, popular"
                      />
                    </div>
                    <div className="form-field full-width">
                      <label>Songwriter</label>
                      <input 
                        type="text" 
                        value={editFormData.songwriters || ''}
                        onChange={(e) => handleEditFormChange('songwriters', e.target.value)}
                        placeholder="Songwriter name(s)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dialog-footer">
              <button className="btn-secondary" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button
                className={`btn-enrich${enrichingSongs.has(editFormData.id) ? ' enriching' : ''}${enrichResults[editFormData.id]?.success ? ' enriched' : ''}`}
                onClick={(e) => handleEnrichSong(editFormData.id, e)}
                disabled={enrichingSongs.has(editFormData.id)}
                title="Fetch Wikipedia, Last.fm, chart data and BPM for this song"
              >
                {enrichingSongs.has(editFormData.id)
                  ? '⏳ Enriching…'
                  : enrichResults[editFormData.id]?.success
                  ? `✅ Enriched (${enrichResults[editFormData.id].enrichmentCount} fields)`
                  : enrichResults[editFormData.id]?.success === false
                  ? `❌ ${enrichResults[editFormData.id].error || enrichResults[editFormData.id].message || 'No data found'}`
                  : '⚡ Enrich Song'}
              </button>
              <button className="btn-primary" onClick={handleSaveEdit}>
                <FiSave /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="results-summary">
        Showing {filteredSongs.length} of {songs.length} songs
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading database...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadSongs}>Retry</button>
        </div>
      ) : (
        <div className="table-container">
          <table className="sou-database-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={selectedSongs.size === filteredSongs.length && filteredSongs.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="action-col" title="Enrich song with Wikipedia, Last.fm, and chart data">⚡</th>
                {orderedVisibleColumns.map(colKey => {
                  const colMeta = availableColumns[colKey];
                  const isSortable = colMeta.sortable;
                  const isSorted = sortField === colKey;
                  return (
                    <th 
                      key={colKey}
                      style={{ minWidth: colMeta.width }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, colKey)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, colKey)}
                      onDragEnd={handleDragEnd}
                      className={`${draggedColumn === colKey ? 'dragging' : ''} ${isSortable ? 'sortable' : ''} ${isSorted ? 'sorted' : ''}`}
                      title={isSortable ? "Click to sort, drag to reorder" : "Drag to reorder"}
                    >
                      <div 
                        className="th-content"
                        onClick={() => isSortable && handleColumnSort(colKey)}
                      >
                        <FiMenu className="drag-handle" />
                        <span>{colMeta.label}</span>
                        {isSorted && (
                          <span className="sort-indicator">
                            {sortDirection === 'asc' ? <FiChevronUp /> : <FiChevronDown />}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredSongs.map(song => (
                <tr 
                  key={song.id}
                  className={selectedSongs.has(song.id) ? 'selected' : ''}
                  onClick={() => handleRowClick(song)}
                  style={{ cursor: 'pointer' }}
                >
                  <td 
                    className="checkbox-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSongs.has(song.id)}
                      onChange={() => toggleSongSelection(song.id)}
                    />
                  </td>
                  <td
                    className="action-col"
                    onClick={(e) => e.stopPropagation()}
                    title={enrichResults[song.id]?.success ? `Enriched: ${enrichResults[song.id].enrichmentCount} fields updated` : enrichResults[song.id]?.error ? enrichResults[song.id].error : 'Enrich with Wikipedia, Last.fm & chart data'}
                  >
                    <button
                      className={`enrich-btn${enrichingSongs.has(song.id) ? ' enriching' : ''}${enrichResults[song.id]?.success ? ' enriched' : ''}${enrichResults[song.id]?.success === false ? ' enrich-failed' : ''}`}
                      onClick={(e) => handleEnrichSong(song.id, e)}
                      disabled={enrichingSongs.has(song.id)}
                    >
                      {enrichingSongs.has(song.id) ? '⏳' : enrichResults[song.id]?.success ? '✅' : enrichResults[song.id]?.success === false ? '❌' : '⚡'}
                    </button>
                  </td>
                  {orderedVisibleColumns.map(colKey => {
                    const colMeta = availableColumns[colKey];
                    const isEditing = inlineEditCell?.songId === song.id && inlineEditCell?.columnKey === colKey;
                    const isEditable = colMeta.editable;
                    
                    return (
                      <td 
                        key={colKey}
                        className={`${!isEditable ? 'non-editable' : 'editable'} ${isEditing ? 'editing' : ''}`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleCellDoubleClick(song, colKey);
                        }}
                        title={isEditable ? 'Double-click to edit, single-click row to view details' : 'Click row to view details (API field)'}
                      >
                        {isEditing ? (
                          <div className="inline-edit-container">
                            <input
                              type="text"
                              value={inlineEditValue}
                              onChange={(e) => setInlineEditValue(e.target.value)}
                              onKeyDown={handleInlineEditKeyDown}
                              onBlur={handleSaveInlineEdit}
                              autoFocus
                              className="inline-edit-input"
                            />
                          </div>
                        ) : (
                          <>
                            {!isEditable && <FiLock className="lock-icon" />}
                            {formatCellValue(song, colKey)}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {filteredSongs.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.size + 1} className="empty-state">
                    No songs found matching your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManageSOUDatabase;
