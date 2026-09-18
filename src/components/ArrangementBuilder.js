import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FiMusic, FiSearch } from 'react-icons/fi';
import './ArrangementBuilder.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/** Build the chord-row display string fresh from a line's chords[] (render-only, never stored). */
function synthesizeChordRow(chords) {
  if (!chords.length) return '';
  const end = chords.reduce((m, c) => Math.max(m, c.position + c.chord.symbol.length), 0);
  const arr = new Array(end).fill(' ');
  chords
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((c) => {
      for (let i = 0; i < c.chord.symbol.length; i++) arr[c.position + i] = c.chord.symbol[i];
    });
  return arr.join('');
}

/** Plain whitespace-run tokenizer — not the real chord grammar, per 5.5.8. */
function tokenizeChordRowString(rowString) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(rowString)) !== null) {
    tokens.push({ position: m.index, symbol: m[0] });
  }
  return tokens;
}

/** A single draggable chord token, absolutely positioned by column. */
function ChordToken({ symbol, position, charWidth, ambiguous, onCommitPosition }) {
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    setDragOffset(0);
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setDragOffset(e.clientX - startXRef.current);
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    const deltaCols = dragOffset / charWidth;
    const newPosition = Math.max(0, Math.round(position + deltaCols));
    setDragging(false);
    setDragOffset(0);
    if (newPosition !== position) {
      onCommitPosition(newPosition);
    }
  };

  const left = Math.max(0, position * charWidth + (dragging ? dragOffset : 0));

  return (
    <span
      className={`chord-token${ambiguous ? ' chord-token-ambiguous' : ''}`}
      style={{ left: `${left}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      {symbol}
    </span>
  );
}

/** One paired lyric/chord row. Owns transient edit-mode + scroll-sync UI state only. */
function ArrangementLine({
  sectionId,
  lineIndex,
  lyric,
  chords,
  charWidth,
  ambiguousKeys,
  onLyricChange,
  onLyricRebase,
  onChordDrag,
  onRetokenizeRow,
}) {
  const lyricRef = useRef(null);
  const chordRowRef = useRef(null);
  const focusValueRef = useRef(lyric);
  const [editingRow, setEditingRow] = useState(false);
  const [draftText, setDraftText] = useState('');

  const keyPrefix = `${sectionId}::${lineIndex}::`;

  const rowWidthCh =
    Math.max(
      lyric.length,
      chords.reduce((m, c) => Math.max(m, c.position + c.chord.symbol.length), 0)
    ) + 4;

  const handleLyricFocus = (e) => {
    focusValueRef.current = e.target.value;
  };

  const handleLyricBlur = (e) => {
    onLyricRebase(focusValueRef.current, e.target.value);
  };

  const syncFromLyric = (e) => {
    if (chordRowRef.current) chordRowRef.current.scrollLeft = e.target.scrollLeft;
  };

  const syncFromChordRow = (e) => {
    if (lyricRef.current) lyricRef.current.scrollLeft = e.target.scrollLeft;
  };

  const enterEditMode = (e) => {
    if (e.target !== e.currentTarget) return; // clicked a token, not empty space
    setDraftText(synthesizeChordRow(chords));
    setEditingRow(true);
  };

  const commitEdit = () => {
    onRetokenizeRow(draftText);
    setEditingRow(false);
  };

  return (
    <div className="arrangement-line">
      <div className="chord-row-wrap" ref={chordRowRef} onScroll={syncFromChordRow}>
        {editingRow ? (
          <input
            type="text"
            autoFocus
            className="chord-row-input"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitEdit}
            style={{ width: `${rowWidthCh}ch` }}
          />
        ) : (
          <div className="chord-row" style={{ width: `${rowWidthCh}ch` }} onClick={enterEditMode}>
            {chords.map((c, idx) => (
              <ChordToken
                key={idx}
                symbol={c.chord.symbol}
                position={c.position}
                charWidth={charWidth}
                ambiguous={ambiguousKeys.has(`${keyPrefix}${idx}`)}
                onCommitPosition={(newPos) => onChordDrag(idx, newPos)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="lyric-row-wrap" ref={lyricRef} onScroll={syncFromLyric}>
        <input
          type="text"
          className="lyric-input"
          value={lyric}
          onFocus={handleLyricFocus}
          onBlur={handleLyricBlur}
          onChange={(e) => onLyricChange(e.target.value)}
          style={{ width: `${rowWidthCh}ch` }}
        />
      </div>
    </div>
  );
}

const ArrangementBuilder = () => {
  const [screen, setScreen] = useState('paste'); // 'paste' | 'review'

  // Song picker (Screen 1)
  const [allSongs, setAllSongs] = useState([]);
  const [songQuery, setSongQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [defaultTeachingKeyInput, setDefaultTeachingKeyInput] = useState('');

  // Source Key (Key Model Phase 1) — suggest-then-confirm, alongside the
  // existing (unchanged) default_teaching_key field. sourceKeySuggestion is
  // whatever GET /api/arrangements/song-key-suggestion returned for the
  // selected song; sourceKeyWasSuggested tracks whether the current input
  // still matches that suggestion verbatim (accepted as-is) or has been
  // edited (tutor override) — this decides source: 'song_data' vs
  // 'tutor_entered' on confirm.
  const [sourceKeySuggestion, setSourceKeySuggestion] = useState(null); // { tonic_spelling, tonic_pc, mode } | null
  const [sourceKeyInput, setSourceKeyInput] = useState('');
  const [sourceKeyWasSuggested, setSourceKeyWasSuggested] = useState(false);
  const [transpositionOrigin, setTranspositionOrigin] = useState(null); // last known persisted value, for display
  // A stored-but-unconfirmed transposition_origin (e.g. carried forward from
  // default_teaching_key by the Key Model Phase 1 migration), kept separate
  // from sourceKeySuggestion so both can be shown when they disagree. Null
  // whenever there's nothing to compare against, or once compared and found
  // to be the same key as the fresh suggestion (no false choice presented).
  const [savedUnconfirmedOrigin, setSavedUnconfirmedOrigin] = useState(null);
  const [confirmKeyStatus, setConfirmKeyStatus] = useState('idle'); // idle | confirming | success | error
  const [confirmKeyError, setConfirmKeyError] = useState('');

  // Existing arrangements for the selected song (Screen 1 picker)
  const [existingArrangements, setExistingArrangements] = useState(null); // null = not loaded yet
  const [arrangementsLoading, setArrangementsLoading] = useState(false);
  const [startingNew, setStartingNew] = useState(false);

  // Identity of whatever Arrangement is currently loaded in the review screen —
  // null id means this is a fresh/unsaved paste-import, not an existing row.
  const [loadedArrangementId, setLoadedArrangementId] = useState(null);
  const [loadedProvenance, setLoadedProvenance] = useState({
    import_source_text: null,
    import_source_type: null,
    import_source_url: null,
  });

  // Paste (Screen 1)
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [originalRawText, setOriginalRawText] = useState('');

  // Review (Screen 2) — canonical state
  const [bodyJson, setBodyJson] = useState(null);
  const [pendingKeys, setPendingKeys] = useState(new Set());
  const [ambiguousKeys, setAmbiguousKeys] = useState(new Set());

  // Persist
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | success | error
  const [saveError, setSaveError] = useState('');

  // Publish PDF (single action: publish -> generate-pdf, same click)
  const [publishState, setPublishState] = useState('idle'); // idle | publishing | generating | success | partial | error
  const [publishMessage, setPublishMessage] = useState('');
  const [publishedPdfUrl, setPublishedPdfUrl] = useState(null);

  // Charwidth measured once for the whole review screen.
  const measureRef = useRef(null);
  const [charWidth, setCharWidth] = useState(8);

  useEffect(() => {
    fetch(`${API_URL}/api/songs`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllSongs(Array.isArray(data) ? data : []))
      .catch(() => setAllSongs([]));
  }, []);

  useEffect(() => {
    if (screen === 'review' && measureRef.current) {
      const rect = measureRef.current.getBoundingClientRect();
      if (rect.width) setCharWidth(rect.width);
    }
  }, [screen]);

  const filteredSongs = useMemo(() => {
    if (!songQuery.trim()) return [];
    const q = songQuery.toLowerCase();
    return allSongs
      .filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.artist || '').toLowerCase().includes(q) ||
          (s.id || '').toString().toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [allSongs, songQuery]);

  const handleSelectSong = async (song) => {
    setSelectedSong(song);
    setSongQuery('');
    if (!titleInput) setTitleInput(song.title || '');

    setStartingNew(false);
    setExistingArrangements(null);
    setArrangementsLoading(true);

    // Source Key suggestion — honest empty state if none usable, no fabricated default.
    setSourceKeySuggestion(null);
    setSourceKeyInput('');
    setSourceKeyWasSuggested(false);
    setTranspositionOrigin(null);
    setConfirmKeyStatus('idle');
    setConfirmKeyError('');
    try {
      const keyRes = await fetch(`${API_URL}/api/arrangements/song-key-suggestion?song_id=${encodeURIComponent(song.id)}`, {
        credentials: 'include',
      });
      if (keyRes.ok) {
        const keyData = await keyRes.json();
        setSourceKeySuggestion(keyData);
        if (keyData.tonic_spelling) {
          setSourceKeyInput(keyData.tonic_spelling);
          setSourceKeyWasSuggested(true);
        }
      }
    } catch (err) {
      // No usable suggestion — leave the input empty, not an error banner.
    }

    try {
      const res = await fetch(`${API_URL}/api/arrangements?song_id=${encodeURIComponent(song.id)}`, {
        credentials: 'include',
      });
      const data = res.ok ? await res.json() : [];
      setExistingArrangements(Array.isArray(data) ? data : []);
    } catch (err) {
      setExistingArrangements([]);
    } finally {
      setArrangementsLoading(false);
    }
  };

  const handleChangeSong = () => {
    setSelectedSong(null);
    setExistingArrangements(null);
    setStartingNew(false);
    setSourceKeySuggestion(null);
    setSourceKeyInput('');
    setSourceKeyWasSuggested(false);
    setTranspositionOrigin(null);
    setSavedUnconfirmedOrigin(null);
    setConfirmKeyStatus('idle');
    setConfirmKeyError('');
  };

  const handleLoadArrangement = async (id) => {
    setParseError('');
    try {
      const res = await fetch(`${API_URL}/api/arrangements/${id}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || 'Failed to load arrangement');
        return;
      }
      setLoadedArrangementId(data.id);
      setTitleInput(data.title || '');
      setDefaultTeachingKeyInput(data.default_teaching_key || '');

      // Source Key: only a genuinely CONFIRMED transposition_origin skips the
      // fresh-suggestion fetch. An absent or unconfirmed one (including a
      // legacy value the migration carried forward from default_teaching_key)
      // always triggers a fresh fetch, so it can be compared against — not
      // just displayed as if it were the suggestion.
      const existingOrigin = data.body_json && data.body_json.transposition_origin;
      setTranspositionOrigin(existingOrigin || null);
      setConfirmKeyStatus('idle');
      setConfirmKeyError('');

      if (existingOrigin && existingOrigin.confirmed === true) {
        setSourceKeyInput(existingOrigin.tonic_spelling || '');
        setSourceKeySuggestion(null);
        setSourceKeyWasSuggested(false);
        setSavedUnconfirmedOrigin(null);
      } else {
        const savedCandidate = existingOrigin && existingOrigin.tonic_spelling ? existingOrigin : null;
        setSourceKeySuggestion(null);
        setSourceKeyWasSuggested(false);
        setSourceKeyInput(savedCandidate ? savedCandidate.tonic_spelling : '');
        setSavedUnconfirmedOrigin(savedCandidate);
        try {
          const keyRes = await fetch(`${API_URL}/api/arrangements/song-key-suggestion?song_id=${encodeURIComponent(data.song_id)}`, {
            credentials: 'include',
          });
          if (keyRes.ok) {
            const keyData = await keyRes.json();
            if (keyData.tonic_spelling) {
              // Compare by normalized value (tonic_pc + mode), never by spelling —
              // e.g. C♯ minor and D♭ minor are the same candidate.
              const sameKey =
                savedCandidate && savedCandidate.tonic_pc === keyData.tonic_pc && savedCandidate.mode === keyData.mode;
              setSourceKeySuggestion(keyData);
              if (sameKey) {
                setSavedUnconfirmedOrigin(null); // don't present a false choice between identical keys
              }
              setSourceKeyInput(keyData.tonic_spelling);
              setSourceKeyWasSuggested(true);
            }
            // else: no usable fresh suggestion — the savedCandidate default set above stands.
          }
          // non-ok response: the savedCandidate default set above stands, no error banner.
        } catch (err) {
          // No usable suggestion — the savedCandidate default set above stands (or stays empty).
        }
      }

      setLoadedProvenance({
        import_source_text: data.import_source_text,
        import_source_type: data.import_source_type,
        import_source_url: data.import_source_url,
      });
      setBodyJson(data.body_json);
      setPendingKeys(new Set());
      setAmbiguousKeys(new Set());
      setSaveStatus('idle');
      setSaveError('');
      setPublishState('idle');
      setPublishMessage('');
      setPublishedPdfUrl(null);
      setScreen('review');
    } catch (err) {
      setParseError('Failed to connect to server');
    }
  };

  const handleParse = async () => {
    setParseError('');
    if (!selectedSong) {
      setParseError('Select a song before parsing.');
      return;
    }
    if (!rawText.trim()) {
      setParseError('Paste some arrangement text first.');
      return;
    }
    setParsing(true);
    try {
      const res = await fetch(`${API_URL}/api/arrangements/parse-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ raw_text: rawText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || 'Failed to parse arrangement text');
        return;
      }
      setBodyJson(data.body_json);
      setOriginalRawText(rawText);
      setLoadedArrangementId(null);
      setLoadedProvenance({
        import_source_text: rawText,
        import_source_type: 'manual_paste',
        import_source_url: null,
      });
      setPendingKeys(new Set());
      setAmbiguousKeys(new Set());
      setSaveStatus('idle');
      setSaveError('');
      setScreen('review');
    } catch (err) {
      setParseError('Failed to connect to server');
    } finally {
      setParsing(false);
    }
  };

  // --- Canonical state mutations (Screen 2) ---

  const updateAnnotationText = (sectionId, newValue) => {
    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    section.content.text = newValue;
    setBodyJson(next);
  };

  const updateLyricText = (sectionId, lineIndex, newValue) => {
    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    section.content.lines[lineIndex].lyric = newValue;
    setBodyJson(next);
  };

  const commitChordPosition = (sectionId, lineIndex, chordIndex, newPosition) => {
    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    const line = section.content.lines[lineIndex];
    line.chords[chordIndex] = { ...line.chords[chordIndex], position: Math.max(0, newPosition) };
    setBodyJson(next);

    const key = `${sectionId}::${lineIndex}::${chordIndex}`;
    setAmbiguousKeys((prev) => {
      if (!prev.has(key)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(key);
      return nextSet;
    });
  };

  const rebaseLyricLine = (sectionId, lineIndex, oldValue, newValue) => {
    if (oldValue === newValue) return;

    let start = 0;
    const minLen = Math.min(oldValue.length, newValue.length);
    while (start < minLen && oldValue[start] === newValue[start]) start++;

    let oldEnd = oldValue.length;
    let newEnd = newValue.length;
    while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const delta = newEnd - oldEnd;

    const next = structuredClone(bodyJson);
    const section = next.sections.find((s) => s.id === sectionId);
    const line = section.content.lines[lineIndex];

    const newAmbiguous = new Set(ambiguousKeys);
    line.chords.forEach((c, idx) => {
      const key = `${sectionId}::${lineIndex}::${idx}`;
      if (c.position <= start) {
        // unchanged
      } else if (c.position >= oldEnd) {
        c.position += delta;
      } else {
        // anchor fell inside the edited span — leave position unchanged, flag it
        newAmbiguous.add(key);
      }
    });

    setBodyJson(next);
    setAmbiguousKeys(newAmbiguous);
  };

  const retokenizeRow = (sectionId, lineIndex, rowString) => {
    const section = bodyJson.sections.find((s) => s.id === sectionId);
    const oldChords = section.content.lines[lineIndex].chords;
    const tokens = tokenizeChordRowString(rowString);

    const newChords = tokens.map(({ position, symbol }) => {
      const oldMatch = oldChords.find((c) => c.position === position);
      if (oldMatch && oldMatch.chord.symbol === symbol) {
        return oldMatch;
      }
      return { position, chord: { symbol, root: null, quality: null, bass: null } };
    });

    const next = structuredClone(bodyJson);
    const nextSection = next.sections.find((s) => s.id === sectionId);
    nextSection.content.lines[lineIndex].chords = structuredClone(newChords);
    setBodyJson(next);

    setPendingKeys((prev) => {
      const nextSet = new Set(prev);
      const prefix = `${sectionId}::${lineIndex}::`;
      for (const k of Array.from(nextSet)) {
        if (k.startsWith(prefix)) nextSet.delete(k);
      }
      newChords.forEach((c, idx) => {
        const oldMatch = oldChords.find((o) => o.position === c.position);
        const isPending = !oldMatch || oldMatch.chord.symbol !== c.chord.symbol;
        if (isPending) nextSet.add(`${prefix}${idx}`);
      });
      return nextSet;
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');

    const isUpdate = loadedArrangementId != null;
    const url = isUpdate ? `${API_URL}/api/arrangements/${loadedArrangementId}` : `${API_URL}/api/arrangements`;
    const method = isUpdate ? 'PUT' : 'POST';
    // default_teaching_key is omitted (not sent as null/empty) when the input is
    // empty, so a routine save never silently clears an existing key.
    const defaultTeachingKeyField = defaultTeachingKeyInput
      ? { default_teaching_key: defaultTeachingKeyInput }
      : {};
    const payload = isUpdate
      ? { title: titleInput || null, body_json: bodyJson, ...defaultTeachingKeyField }
      : {
          song_id: selectedSong.id,
          title: titleInput || null,
          body_json: bodyJson,
          import_source_text: originalRawText,
          import_source_type: 'manual_paste',
          ...defaultTeachingKeyField,
        };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus('error');
        setSaveError(data.error || 'Failed to save arrangement');
        return;
      }
      if (isUpdate && data.id !== loadedArrangementId) {
        // Sanity check per 5.5.8 step 4 — a PUT must not silently create a new row.
        setSaveStatus('error');
        setSaveError('Save returned a different arrangement id than expected.');
        return;
      }
      setBodyJson(data.body_json);
      setLoadedArrangementId(data.id);
      setPendingKeys(new Set());
      setAmbiguousKeys(new Set());
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
      setSaveError('Failed to connect to server');
    }
  };

  const handleConfirmSourceKey = async () => {
    if (!loadedArrangementId) return; // button disabled until the Arrangement has been saved at least once
    setConfirmKeyStatus('confirming');
    setConfirmKeyError('');

    // Accepted the suggestion as-is -> 'song_data'; typed/edited it -> 'tutor_entered'.
    const source =
      sourceKeyWasSuggested && sourceKeySuggestion && sourceKeyInput === sourceKeySuggestion.tonic_spelling
        ? 'song_data'
        : 'tutor_entered';

    try {
      const res = await fetch(`${API_URL}/api/arrangements/${loadedArrangementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source_key_text: sourceKeyInput, source, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmKeyStatus('error');
        setConfirmKeyError(data.error || 'Failed to confirm Source Key');
        return; // sourceKeyInput is left exactly as the tutor typed it — never cleared
      }
      setTranspositionOrigin(data.body_json.transposition_origin);
      setConfirmKeyStatus('success');
    } catch (err) {
      setConfirmKeyStatus('error');
      setConfirmKeyError('Failed to connect to server');
    }
  };

  const handleStartOver = () => {
    setScreen('paste');
    setSelectedSong(null);
    setTitleInput('');
    setDefaultTeachingKeyInput('');
    setSourceKeySuggestion(null);
    setSourceKeyInput('');
    setSourceKeyWasSuggested(false);
    setTranspositionOrigin(null);
    setSavedUnconfirmedOrigin(null);
    setConfirmKeyStatus('idle');
    setConfirmKeyError('');
    setExistingArrangements(null);
    setArrangementsLoading(false);
    setStartingNew(false);
    setLoadedArrangementId(null);
    setLoadedProvenance({ import_source_text: null, import_source_type: null, import_source_url: null });
    setRawText('');
    setParseError('');
    setOriginalRawText('');
    setBodyJson(null);
    setPendingKeys(new Set());
    setAmbiguousKeys(new Set());
    setSaveStatus('idle');
    setSaveError('');
    setPublishState('idle');
    setPublishMessage('');
    setPublishedPdfUrl(null);
  };

  /**
   * Single "Publish PDF" action: POST .../publish, then (if that succeeds)
   * immediately POST .../resources/<id>/generate-pdf in the same click. No
   * retry state of its own - clicking again just re-runs the full sequence,
   * since both endpoints are already idempotent.
   */
  const handlePublishPdf = async () => {
    setPublishState('publishing');
    setPublishMessage('');
    setPublishedPdfUrl(null);

    let publishData;
    try {
      const res = await fetch(`${API_URL}/api/arrangements/${loadedArrangementId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      publishData = await res.json();
      if (!res.ok) {
        setPublishState('error');
        setPublishMessage(publishData.error || 'Failed to publish arrangement');
        return;
      }
    } catch (err) {
      setPublishState('error');
      setPublishMessage('Failed to connect to server');
      return;
    }

    setPublishState('generating');
    try {
      const res = await fetch(`${API_URL}/api/resources/${publishData.resource.id}/generate-pdf`, {
        method: 'POST',
        credentials: 'include',
      });
      const genData = await res.json();
      if (!res.ok) {
        // Partial success: the Arrangement is validly published, just no PDF yet.
        setPublishState('partial');
        setPublishMessage(genData.error || 'Failed to generate PDF');
        return;
      }
      setPublishState('success');
      setPublishedPdfUrl(`https://pub-e43364bf5aa34598832e4b2e860e074d.r2.dev/${genData.r2_object_key}`);
    } catch (err) {
      setPublishState('partial');
      setPublishMessage('Failed to connect to server');
    }
  };

  // --- Render ---

  if (screen === 'paste') {
    return (
      <div className="arrangement-builder-page">
        <div className="page-header">
          <h1>
            <FiMusic /> Arrangement Builder
          </h1>
          <p>Paste a chord/lyric sheet, then review it before saving.</p>
        </div>

        <div className="ab-section">
          <label className="ab-label">Song</label>
          {selectedSong ? (
            <div className="ab-selected-song">
              <span>
                {selectedSong.title} — {selectedSong.artist}
              </span>
              <button className="btn-secondary" onClick={handleChangeSong}>
                Change
              </button>
            </div>
          ) : (
            <div className="ab-song-picker">
              <div className="search-box">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search songs by title, artist, or ID..."
                  value={songQuery}
                  onChange={(e) => setSongQuery(e.target.value)}
                />
              </div>
              {filteredSongs.length > 0 && (
                <div className="ab-song-results">
                  {filteredSongs.map((s) => (
                    <button key={s.id} className="ab-song-result" onClick={() => handleSelectSong(s)}>
                      {s.title} — {s.artist}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedSong && arrangementsLoading && (
          <div className="ab-section">Checking for existing arrangements…</div>
        )}

        {selectedSong && !arrangementsLoading && existingArrangements && existingArrangements.length > 0 && !startingNew && (
          <div className="ab-section">
            <label className="ab-label">Existing arrangements for this song</label>
            <div className="ab-existing-list">
              {existingArrangements.map((a) => (
                <button key={a.id} className="ab-existing-item" onClick={() => handleLoadArrangement(a.id)}>
                  {a.title || '(untitled)'} — {a.status} — updated {a.updated_at}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setStartingNew(true)}>
              Start new Arrangement
            </button>
          </div>
        )}

        {(!selectedSong ||
          (existingArrangements !== null && (existingArrangements.length === 0 || startingNew))) && (
          <>
            <div className="ab-section">
              <label className="ab-label" htmlFor="ab-title-input">
                Arrangement title (optional)
              </label>
              <input
                id="ab-title-input"
                type="text"
                className="ab-title-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </div>

            <div className="ab-section">
              <label className="ab-label" htmlFor="ab-teaching-key-input">
                Default teaching key (optional)
              </label>
              <input
                id="ab-teaching-key-input"
                type="text"
                className="ab-teaching-key-input"
                value={defaultTeachingKeyInput}
                onChange={(e) => setDefaultTeachingKeyInput(e.target.value)}
                placeholder="e.g., C, Am, F#"
              />
            </div>

            <div className="ab-section">
              <label className="ab-label" htmlFor="ab-paste-textarea">
                Paste chord/lyric sheet
              </label>
              <textarea
                id="ab-paste-textarea"
                className="ab-paste-textarea"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={20}
                spellCheck={false}
              />
            </div>

            {parseError && <div className="error-banner">{parseError}</div>}

            <button className="btn-primary" onClick={handleParse} disabled={parsing}>
              {parsing ? 'Parsing…' : 'Parse & Review'}
            </button>
          </>
        )}
      </div>
    );
  }

  // screen === 'review'
  return (
    <div className="arrangement-builder-page">
      <span ref={measureRef} className="ab-char-measure">
        M
      </span>

      <div className="page-header">
        <h1>
          <FiMusic /> Review Arrangement
        </h1>
        <p>Drag chord tokens to reposition. Click empty chord-row space to retype a chord.</p>
      </div>

      {bodyJson.sections.map((section) => (
        <div key={section.id} className="ab-section-block">
          {section.type === 'annotation' ? (
            <input
              type="text"
              className="ab-annotation-input"
              value={section.content.text}
              onChange={(e) => updateAnnotationText(section.id, e.target.value)}
            />
          ) : (
            <>
              <h3 className="ab-section-title">{section.title || '(untitled)'}</h3>
              {section.content.lines.map((line, lineIndex) => (
                <ArrangementLine
                  key={lineIndex}
                  sectionId={section.id}
                  lineIndex={lineIndex}
                  lyric={line.lyric}
                  chords={line.chords}
                  charWidth={charWidth}
                  ambiguousKeys={ambiguousKeys}
                  onLyricChange={(v) => updateLyricText(section.id, lineIndex, v)}
                  onLyricRebase={(oldV, newV) => rebaseLyricLine(section.id, lineIndex, oldV, newV)}
                  onChordDrag={(chordIndex, newPos) =>
                    commitChordPosition(section.id, lineIndex, chordIndex, newPos)
                  }
                  onRetokenizeRow={(rowString) => retokenizeRow(section.id, lineIndex, rowString)}
                />
              ))}
            </>
          )}
        </div>
      ))}

      <div className="ab-section ab-source-key-section">
        <label className="ab-label" htmlFor="ab-source-key-input">
          Source Key
        </label>
        <input
          id="ab-source-key-input"
          type="text"
          className="ab-teaching-key-input"
          value={sourceKeyInput}
          onChange={(e) => {
            setSourceKeyInput(e.target.value);
            setSourceKeyWasSuggested(false);
          }}
          placeholder="e.g., Bb, F# minor"
        />
        <button
          className="btn-secondary"
          onClick={handleConfirmSourceKey}
          disabled={!loadedArrangementId || confirmKeyStatus === 'confirming' || !sourceKeyInput.trim()}
          title={!loadedArrangementId ? 'Save the Arrangement first, then confirm its Source Key' : undefined}
        >
          {confirmKeyStatus === 'confirming' ? 'Confirming…' : 'Confirm Source Key'}
        </button>
        {transpositionOrigin && transpositionOrigin.confirmed && (
          <span className="ab-hint">
            {' '}Confirmed: {transpositionOrigin.tonic_spelling}
            {transpositionOrigin.mode ? ` ${transpositionOrigin.mode}` : ''} ({transpositionOrigin.source})
          </span>
        )}
        {sourceKeySuggestion && savedUnconfirmedOrigin && (
          <div className="ab-key-candidates">
            <button
              type="button"
              className="ab-key-candidate-btn"
              onClick={() => {
                setSourceKeyInput(sourceKeySuggestion.tonic_spelling);
                setSourceKeyWasSuggested(true);
              }}
            >
              Song Data suggestion: {sourceKeySuggestion.tonic_spelling}
              {sourceKeySuggestion.mode ? ` ${sourceKeySuggestion.mode}` : ''} (from song data)
            </button>
            <button
              type="button"
              className="ab-key-candidate-btn"
              onClick={() => {
                setSourceKeyInput(savedUnconfirmedOrigin.tonic_spelling);
                setSourceKeyWasSuggested(false);
              }}
            >
              Previously saved value (unconfirmed): {savedUnconfirmedOrigin.tonic_spelling}
              {savedUnconfirmedOrigin.mode ? ` ${savedUnconfirmedOrigin.mode}` : ''}
            </button>
          </div>
        )}
        {!sourceKeySuggestion && savedUnconfirmedOrigin && (
          <span className="ab-hint">
            {' '}Previously saved value (unconfirmed): {savedUnconfirmedOrigin.tonic_spelling}
            {savedUnconfirmedOrigin.mode ? ` ${savedUnconfirmedOrigin.mode}` : ''}
          </span>
        )}
        {confirmKeyStatus === 'error' && <div className="error-banner">{confirmKeyError}</div>}
      </div>

      {saveStatus === 'error' && <div className="error-banner">{saveError}</div>}
      {saveStatus === 'success' && (
        <div className="success-banner">
          Arrangement saved.{' '}
          <button className="btn-secondary" onClick={handleStartOver}>
            New Arrangement
          </button>
        </div>
      )}

      {saveStatus !== 'success' && (
        <button className="btn-primary" onClick={handleSave} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? 'Saving…' : 'Save Arrangement'}
        </button>
      )}

      {loadedArrangementId != null && (
        <div className="ab-section ab-publish-section">
          <button
            className="btn-primary"
            onClick={handlePublishPdf}
            disabled={publishState === 'publishing' || publishState === 'generating'}
          >
            {publishState === 'publishing'
              ? 'Publishing…'
              : publishState === 'generating'
              ? 'Generating PDF…'
              : 'Publish PDF'}
          </button>

          {publishState === 'error' && <div className="error-banner">{publishMessage}</div>}

          {publishState === 'partial' && (
            <div className="warning-banner">
              Arrangement published — PDF generation failed: {publishMessage}
            </div>
          )}

          {publishState === 'success' && (
            <div className="success-banner">
              Published — PDF ready.{' '}
              <a href={publishedPdfUrl} target="_blank" rel="noopener noreferrer">
                Download PDF
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArrangementBuilder;
