import React, { useCallback, useEffect, useState } from 'react';
import { FiGrid } from 'react-icons/fi';
import ChordDiagram from './ChordDiagram';
import './ChordFinder.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * ChordFinder — WP-5 (Song Canvas MVP plan): look up any chord, see every shape in D1 order
 * with diagrams and the default marked in place, name a typed shape, and (admin) set or clear
 * a chord's default shape. Uses the theory engine API (/api/theory, WP-4).
 *
 * Design: SONG_CANVAS_V1_EXPERIENCE.md §4.2 rules 1, 6, 7, 8 and §5.4.
 * - The list order never changes; the default (admin-set, else the first) is marked in place.
 * - Today the only login is the admin's, so the set/clear buttons show for anyone logged in.
 *   When tutor accounts arrive (WP-33), show them to the admin role only (the backend will
 *   enforce it too).
 *
 * Provisional (working rule a, 13 Oct 2026):
 * - the instrument list mirrors the backend's profiles; only high-G is switched on, so the
 *   others are look-up only;
 * - defaults are set and cleared with no capo (a default belongs to the shape chord); with a
 *   capo the buttons are hidden and a note says why;
 * - the precise (inversion) name shows on a click, the plain name always.
 */

const PROFILES = [
  { id: 'gcea-high-g', label: 'Ukulele GCEA (high-G)', active: true },
  { id: 'gcea-low-g', label: 'Ukulele GCEA (low-G) — look-up only', active: false },
  { id: 'dgbe-baritone', label: 'Baritone DGBE — look-up only', active: false },
];
const CAPOS = [0, 1, 2, 3, 4, 5, 6, 7];

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}/api/theory${path}`, { credentials: 'include', ...options });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('You are not logged in (or your session has ended). Log in again and retry.');
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

const qs = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();

function omissionText(shape) {
  if (!shape.omitted || !shape.omitted.length) return null;
  return `no ${shape.omitted.join(', no ')}`;
}

function ShapeCard({ shape, chordName, leftHanded, canEdit, busy, onMakeDefault, onClearDefault, defaultSource }) {
  const omitted = omissionText(shape);
  return (
    <li className={`cf-shape ${shape.isDefault ? 'is-default' : ''}`} data-testid="shape-card" data-frets={shape.fretString}>
      <ChordDiagram frets={shape.frets} leftHanded={leftHanded} label={`${chordName} ${shape.fretString}`} />
      <div className="cf-frets">{shape.fretString}</div>
      <div className="cf-badges">
        {shape.isDefault && (
          <span className="cf-badge cf-badge-default">
            Default{defaultSource === 'admin' ? ' (set by admin)' : ' (first in list)'}
          </span>
        )}
        {omitted && <span className="cf-badge">{omitted}</span>}
        {shape.muted > 0 && <span className="cf-badge">muted string</span>}
        {shape.playsAs && <span className="cf-badge" title={shape.note || ''}>plays as {shape.playsAs}</span>}
      </div>
      {canEdit && !shape.isDefault && (
        <button type="button" className="cf-btn" disabled={busy} onClick={() => onMakeDefault(shape)}>Make default</button>
      )}
      {canEdit && shape.isDefault && defaultSource === 'admin' && (
        <button type="button" className="cf-btn cf-btn-quiet" disabled={busy} onClick={onClearDefault}>Clear admin default</button>
      )}
    </li>
  );
}

function NameReading({ reading, leftHanded }) {
  const [showPrecise, setShowPrecise] = useState(false);
  return (
    <li className="cf-reading" data-testid="name-reading">
      <ChordDiagram frets={reading.frets} leftHanded={leftHanded} label={`shape ${reading.fretString}`} />
      <div className="cf-reading-body">
        <div className="cf-frets">{reading.fretString}</div>
        {!reading.playable && (
          <p className="cf-warning">Unplayable: {reading.problems.join('; ')}</p>
        )}
        {reading.recognised ? (
          <>
            <button type="button" className="cf-name" onClick={() => setShowPrecise((v) => !v)} title="Show the precise (inversion) name">
              {reading.label}
            </button>
            {showPrecise && (
              <ul className="cf-precise">
                {reading.names.map((n) => (
                  <li key={n.precise}>
                    {n.precise}
                    {!n.complete && <span className="cf-muted"> (no {n.omitted.join(', no ')})</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="cf-muted">{reading.reason}</p>
        )}
      </div>
    </li>
  );
}

function ChordFinder() {
  const [chord, setChord] = useState('');
  const [profile, setProfile] = useState('gcea-high-g');
  const [capo, setCapo] = useState(0);
  const [leftHanded, setLeftHanded] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [typed, setTyped] = useState('');
  const [naming, setNaming] = useState(null);
  const [nameError, setNameError] = useState('');

  const [defaults, setDefaults] = useState([]);
  const [defaultsError, setDefaultsError] = useState('');

  const profileInfo = PROFILES.find((p) => p.id === profile);
  const canEdit = !!(profileInfo && profileInfo.active && Number(capo) === 0);

  const loadDefaults = useCallback(async () => {
    try {
      setDefaultsError('');
      const body = await api(`/default-shapes?${qs({ profile })}`);
      setDefaults(body.defaults || []);
    } catch (err) {
      setDefaultsError(err.message);
    }
  }, [profile]);

  useEffect(() => { loadDefaults(); }, [loadDefaults]);

  const lookUp = useCallback(async (name) => {
    const wanted = (name ?? chord).trim();
    if (!wanted) return;
    setBusy(true);
    setError('');
    try {
      setResult(await api(`/shapes?${qs({ chord: wanted, profile, capo })}`));
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [chord, profile, capo]);

  // Re-run the current look-up when the instrument or capo changes.
  useEffect(() => {
    if (result && result.chord) lookUp(result.chord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, capo]);

  const makeDefault = async (shape) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = await api('/default-shapes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, chord: result.chord, frets: shape.fretString }),
      });
      setNotice(`${body.default.chord_display} now defaults to ${shape.fretString}.`);
      await Promise.all([lookUp(result.chord), loadDefaults()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const clearDefault = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = await api(`/default-shapes?${qs({ profile, chord: result.chord })}`, { method: 'DELETE' });
      setNotice(body.cleared ? `${result.chord}'s admin default is cleared; its default is the first shape again.` : 'There was no admin default to clear.');
      await Promise.all([lookUp(result.chord), loadDefaults()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nameIt = async (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    setNameError('');
    try {
      setNaming(await api(`/name?${qs({ frets: typed.trim(), profile, capo })}`));
    } catch (err) {
      setNaming(null);
      setNameError(err.message);
    }
  };

  const submit = (e) => { e.preventDefault(); lookUp(); };
  const openChord = (name) => { setChord(name); lookUp(name); };

  return (
    <div className="chord-finder-page">
      <div className="page-header">
        <h1><FiGrid /> Chord Finder</h1>
        <p>Every shape for a chord, in order from the nut. The default is marked in place.</p>
      </div>

      <div className="cf-controls">
        <label>
          Instrument
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label>
          Capo
          <select value={capo} onChange={(e) => setCapo(Number(e.target.value))}>
            {CAPOS.map((c) => <option key={c} value={c}>{c === 0 ? 'None' : c}</option>)}
          </select>
        </label>
        <label className="cf-check">
          <input type="checkbox" checked={leftHanded} onChange={(e) => setLeftHanded(e.target.checked)} />
          Left-handed
        </label>
      </div>

      <section className="cf-section">
        <form onSubmit={submit} className="cf-form">
          <label htmlFor="cf-chord">Chord</label>
          <input id="cf-chord" value={chord} onChange={(e) => setChord(e.target.value)} placeholder="e.g. Em, Bbm, Fmaj7, D/F#" maxLength={20} />
          <button type="submit" className="cf-btn" disabled={busy || !chord.trim()}>Show shapes</button>
        </form>

        {error && <p className="cf-error" role="alert">{error}</p>}
        {notice && <p className="cf-notice" role="status">{notice}</p>}

        {result && !result.recognised && (
          <p className="cf-error" role="alert">“{result.chord}” can't be read: {result.reason}</p>
        )}

        {result && result.recognised && (
          <>
            <h2 className="cf-result-title">
              {result.chord}{result.capo ? ` (capo ${result.capo}: shapes as played)` : ''}
              <span className="cf-count"> — {result.shapes.length} shapes</span>
            </h2>
            {result.adminDefaultNotInList && (
              <p className="cf-warning" role="alert">
                The admin default {result.adminDefault.frets} is no longer one of this chord's shapes, so the first shape is used. Choose a new default or clear it.
              </p>
            )}
            {!canEdit && profileInfo && profileInfo.active && (
              <p className="cf-muted">Defaults are set with no capo: a default belongs to the shape you play.</p>
            )}
            {result.shapes.length === 0 ? (
              <p className="cf-muted">No playable shapes on this instrument.</p>
            ) : (
              <ul className="cf-shapes">
                {result.shapes.map((s) => (
                  <ShapeCard
                    key={s.fretString}
                    shape={s}
                    chordName={result.chord}
                    leftHanded={leftHanded}
                    canEdit={canEdit}
                    busy={busy}
                    defaultSource={result.defaultSource}
                    onMakeDefault={makeDefault}
                    onClearDefault={clearDefault}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="cf-section">
        <h2>Name a shape</h2>
        <form onSubmit={nameIt} className="cf-form">
          <label htmlFor="cf-typed">Frets (4th string to 1st)</label>
          <input id="cf-typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. 3111, x-10-9-8" maxLength={20} />
          <button type="submit" className="cf-btn" disabled={!typed.trim()}>Name it</button>
        </form>
        {nameError && <p className="cf-error" role="alert">{nameError}</p>}
        {naming && naming.ambiguous && (
          <p className="cf-warning">“{naming.input}” can be read more than one way. Choose a reading, or type it with separators (e.g. x-2-11-1).</p>
        )}
        {naming && (
          <ul className="cf-readings">
            {naming.readings.map((r) => <NameReading key={r.fretString} reading={r} leftHanded={leftHanded} />)}
          </ul>
        )}
      </section>

      <section className="cf-section">
        <h2>Admin default shapes</h2>
        {defaultsError && <p className="cf-error" role="alert">{defaultsError}</p>}
        {!defaultsError && defaults.length === 0 && <p className="cf-muted">No admin defaults for this instrument.</p>}
        {defaults.length > 0 && (
          <table className="cf-defaults">
            <thead>
              <tr><th>Chord</th><th>Default shape</th><th>Last set</th><th /></tr>
            </thead>
            <tbody>
              {defaults.map((d) => (
                <tr key={d.chord_key} data-testid="default-row">
                  <td>{d.chord_display}</td>
                  <td>
                    {d.frets}
                    {(!d.resolves || !d.inList) && <span className="cf-badge cf-badge-warn"> needs attention</span>}
                  </td>
                  <td>{d.updated_at}</td>
                  <td><button type="button" className="cf-btn cf-btn-quiet" onClick={() => openChord(d.chord_display)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default ChordFinder;
