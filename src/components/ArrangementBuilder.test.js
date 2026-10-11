import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArrangementBuilder from './ArrangementBuilder';

/**
 * Focused RTL coverage for the Key Model Phase 1 Source Key suggest-then-
 * confirm UI added to ArrangementBuilder.js. Mocks fetch for the full
 * song-select -> paste -> parse -> save -> confirm-key flow. Browser
 * automation was unavailable this session (same connectOverCDP issue as
 * prior sessions in this repo) — this RTL suite is the actual verification
 * method for the frontend piece of this slice.
 */

const MOCK_SONG = { id: 'song_a', title: 'Test Song', artist: 'Test Artist' };

const PARSED_BODY = {
  schema_version: 2,
  sections: [{ id: 'sec_1', type: 'lyrics_chords', content: { lines: [{ lyric: 'la la la', chords: [{ position: 0, chord: { symbol: 'D' } }] }] } }],
};

function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

let mockPutArrangementResponse = null;

function installFetchMock() {
  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url);
    const method = (options.method || 'GET').toUpperCase();

    if (u.endsWith('/api/songs')) return jsonResponse(200, [MOCK_SONG]);
    if (u.includes('/api/arrangements?song_id=song_a')) return jsonResponse(200, []); // no existing arrangements
    if (u.includes('/api/arrangements/song-key-suggestion?song_id=song_a')) {
      return jsonResponse(200, { tonic_spelling: 'Bb', tonic_pc: 10, mode: null });
    }
    if (u.endsWith('/api/arrangements/parse-preview') && method === 'POST') {
      return jsonResponse(200, { body_json: PARSED_BODY });
    }
    if (u.endsWith('/api/arrangements') && method === 'POST') {
      return jsonResponse(201, {
        id: 42, song_id: 'song_a', title: 'Test Song', status: 'draft',
        default_teaching_key: null, body_json: PARSED_BODY,
        import_source_text: null, import_source_type: 'manual_paste', import_source_url: null,
      });
    }
    if (u.endsWith('/api/arrangements/42') && method === 'PUT') {
      if (mockPutArrangementResponse) return jsonResponse(mockPutArrangementResponse.status, mockPutArrangementResponse.body);
      return jsonResponse(200, {
        id: 42, song_id: 'song_a', title: 'Test Song', status: 'draft',
        body_json: { ...PARSED_BODY, transposition_origin: { tonic_pc: 10, tonic_spelling: 'Bb', mode: null, source: 'song_data', confirmed: true } },
      });
    }
    return jsonResponse(404, { error: `Unhandled mock URL: ${u}` });
  });
}

beforeEach(() => {
  mockPutArrangementResponse = null;
  installFetchMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Navigate: select song -> paste -> Parse & Review (Source Key suggestion becomes visible on the review screen) -> Save. Leaves the component on the review screen with a saved arrangement (id 42). */
async function renderSavedArrangement() {
  render(<ArrangementBuilder />);

  const searchInput = await screen.findByPlaceholderText('Search songs by title, artist, or ID...');
  userEvent.type(searchInput, 'Test Song');
  fireEvent.click(await screen.findByText('Test Song — Test Artist'));

  const pasteArea = await screen.findByLabelText('Paste chord/lyric sheet');
  fireEvent.change(pasteArea, { target: { value: '[Verse 1]\nD\nla la la' } });
  fireEvent.click(screen.getByText('Parse & Review'));

  // Suggestion pre-populated once fetched, visible on the review screen.
  await waitFor(() => expect(screen.getByDisplayValue('Bb')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Save Arrangement'));
  await screen.findByText('Arrangement saved.');
}

test('Source Key suggestion pre-populates the input (visible on the review screen) once fetched', async () => {
  render(<ArrangementBuilder />);
  const searchInput = await screen.findByPlaceholderText('Search songs by title, artist, or ID...');
  userEvent.type(searchInput, 'Test Song');
  fireEvent.click(await screen.findByText('Test Song — Test Artist'));

  const pasteArea = await screen.findByLabelText('Paste chord/lyric sheet');
  fireEvent.change(pasteArea, { target: { value: '[Verse 1]\nD\nla la la' } });
  fireEvent.click(screen.getByText('Parse & Review'));

  await waitFor(() => expect(screen.getByDisplayValue('Bb')).toBeInTheDocument());
});

test('confirming the suggestion as-is persists source: "song_data"', async () => {
  await renderSavedArrangement();

  const confirmButton = screen.getByText('Confirm Source Key');
  expect(confirmButton).not.toBeDisabled();
  fireEvent.click(confirmButton);

  await waitFor(() => expect(screen.getByText(/Confirmed: Bb \(song_data\)/)).toBeInTheDocument());

  const putCall = global.fetch.mock.calls.find(([url, opts]) => String(url).endsWith('/api/arrangements/42') && opts.method === 'PUT');
  expect(putCall).toBeDefined();
  const sentBody = JSON.parse(putCall[1].body);
  expect(sentBody).toEqual({ source_key_text: 'Bb', source: 'song_data', confirmed: true });
});

test('editing the suggested key before confirming persists source: "tutor_entered"', async () => {
  await renderSavedArrangement();

  const keyInput = screen.getByDisplayValue('Bb');
  fireEvent.change(keyInput, { target: { value: 'F# minor' } });
  fireEvent.click(screen.getByText('Confirm Source Key'));

  await waitFor(() => {
    const putCall = global.fetch.mock.calls.find(([url, opts]) => String(url).endsWith('/api/arrangements/42') && opts.method === 'PUT');
    expect(putCall).toBeDefined();
  });
  const putCall = global.fetch.mock.calls.find(([url, opts]) => String(url).endsWith('/api/arrangements/42') && opts.method === 'PUT');
  const sentBody = JSON.parse(putCall[1].body);
  expect(sentBody).toEqual({ source_key_text: 'F# minor', source: 'tutor_entered', confirmed: true });
});

test('an unparseable manual entry is rejected by the backend; entered text and error are both shown, input never cleared', async () => {
  await renderSavedArrangement();

  mockPutArrangementResponse = { status: 400, body: { error: "source_key_text '1999' could not be parsed as a musical key" } };

  const keyInput = screen.getByDisplayValue('Bb');
  fireEvent.change(keyInput, { target: { value: '1999' } });
  fireEvent.click(screen.getByText('Confirm Source Key'));

  await waitFor(() => expect(screen.getByText(/could not be parsed as a musical key/)).toBeInTheDocument());
  expect(screen.getByDisplayValue('1999')).toBeInTheDocument(); // never cleared on failure
});

test('the Confirm Source Key button is disabled before the Arrangement has ever been saved', async () => {
  render(<ArrangementBuilder />);
  const searchInput = await screen.findByPlaceholderText('Search songs by title, artist, or ID...');
  userEvent.type(searchInput, 'Test Song');
  fireEvent.click(await screen.findByText('Test Song — Test Artist'));

  const pasteArea = await screen.findByLabelText('Paste chord/lyric sheet');
  fireEvent.change(pasteArea, { target: { value: '[Verse 1]\nD\nla la la' } });
  fireEvent.click(screen.getByText('Parse & Review'));

  await waitFor(() => expect(screen.getByDisplayValue('Bb')).toBeInTheDocument());
  expect(screen.getByText('Confirm Source Key')).toBeDisabled(); // no loadedArrangementId yet — not saved
});

/**
 * Coverage for the follow-up fix: reopening an existing Arrangement whose
 * stored transposition_origin is unconfirmed must always fetch a fresh
 * song-data suggestion and compare it (by tonic_pc + mode, not spelling)
 * against the stored value — showing both candidates when they genuinely
 * disagree, collapsing to one when they don't, and never fetching at all
 * once a value is actually confirmed.
 */

function installReopenFetchMock({ existingOrigin, suggestion, suggestionOk = true, printKeyPreviewResponse, resourcesListResponse, publishResponse, generatePdfResponse }) {
  const arrangementRow = {
    id: 100,
    song_id: 'song_a',
    title: 'Existing Arr',
    status: 'draft',
    default_teaching_key: 'D',
    body_json: {
      schema_version: 2,
      sections: [{ id: 'sec_1', type: 'lyrics_chords', content: { lines: [{ lyric: 'la la la', chords: [{ position: 0, chord: { symbol: 'D', root: 'D', quality: 'major', bass: null, root_pc: 2, bass_pc: null } }] }] } }],
      ...(existingOrigin ? { transposition_origin: existingOrigin } : {}),
    },
    import_source_text: null,
    import_source_type: 'manual_paste',
    import_source_url: null,
  };

  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url);
    const method = (options.method || 'GET').toUpperCase();

    if (u.endsWith('/api/songs')) return jsonResponse(200, [MOCK_SONG]);
    if (u.includes('/api/arrangements?song_id=song_a')) {
      return jsonResponse(200, [{ id: 100, title: 'Existing Arr', status: 'draft', updated_at: '2026-09-15' }]);
    }
    if (u.includes('/api/arrangements/song-key-suggestion?song_id=song_a')) {
      if (!suggestionOk) return jsonResponse(404, { error: 'no suggestion' });
      return jsonResponse(200, suggestion);
    }
    if (u.endsWith('/api/arrangements/100') && method === 'GET') {
      return jsonResponse(200, arrangementRow);
    }
    if (u.endsWith('/api/arrangements/100') && method === 'PUT') {
      const sent = JSON.parse(options.body);
      const mode = sent.source_key_text === 'C♯' ? 'minor' : null; // mirrors what the real backend's parseKeyString would derive
      return jsonResponse(200, {
        ...arrangementRow,
        body_json: {
          ...arrangementRow.body_json,
          transposition_origin: { tonic_pc: null, tonic_spelling: sent.source_key_text, mode, source: sent.source, confirmed: true },
        },
      });
    }
    if (u.endsWith('/api/arrangements/100/print-key-preview') && method === 'POST') {
      return jsonResponse(
        200,
        printKeyPreviewResponse || { canonical_print_key: 'D major', action: 'create', existing_resource_id: null, has_pdf: false }
      );
    }
    if (u.endsWith('/api/arrangements/100/resources') && method === 'GET') {
      return jsonResponse(200, resourcesListResponse || []);
    }
    if (u.endsWith('/api/arrangements/100/publish') && method === 'POST') {
      return jsonResponse(200, publishResponse || { arrangement: { status: 'published' }, resource: { id: 55, print_key: 'D major' } });
    }
    if (u.endsWith('/api/resources/55/generate-pdf') && method === 'POST') {
      return jsonResponse(200, generatePdfResponse || { r2_object_key: 'resource_55.pdf' });
    }
    return jsonResponse(404, { error: `Unhandled mock URL: ${u}` });
  });
}


/** Select the song, open the existing Arrangement, wait for the review screen's Source Key section to render. */
async function openExistingArrangement() {
  render(<ArrangementBuilder />);
  const searchInput = await screen.findByPlaceholderText('Search songs by title, artist, or ID...');
  userEvent.type(searchInput, 'Test Song');
  fireEvent.click(await screen.findByText('Test Song — Test Artist'));
  const openButton = await screen.findByText(/Existing Arr — draft — updated/);
  const suggestionCallsBeforeLoad = global.fetch.mock.calls.filter(([url]) => String(url).includes('/song-key-suggestion')).length;
  fireEvent.click(openButton);
  await waitFor(() => expect(screen.getByLabelText('Source Key')).toBeInTheDocument());
  return suggestionCallsBeforeLoad;
}

test('unconfirmed stored value + disagreeing fresh suggestion: both candidates shown, song-data suggestion is the active default', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 2, tonic_spelling: 'D', mode: null, source: 'legacy_default_teaching_key', confirmed: false },
    suggestion: { tonic_spelling: 'C♯', tonic_pc: 1, mode: 'minor' },
  });

  await openExistingArrangement();

  expect(screen.getByDisplayValue('C♯')).toBeInTheDocument();
  expect(screen.getByText(/Song Data suggestion: C♯ minor \(from song data\)/)).toBeInTheDocument();
  expect(screen.getByText(/Previously saved value \(unconfirmed\): D/)).toBeInTheDocument();
});

test('unconfirmed stored value + fresh suggestion normalize to the same key (tonic_pc + mode): collapses to a single candidate', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 2, tonic_spelling: 'D', mode: null, source: 'legacy_default_teaching_key', confirmed: false },
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: null },
  });

  await openExistingArrangement();

  expect(screen.getByDisplayValue('D')).toBeInTheDocument();
  expect(screen.queryByText(/Song Data suggestion/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Previously saved value/)).not.toBeInTheDocument();
});

test('no stored transposition_origin at all: unchanged single fresh-suggestion behaviour', async () => {
  installReopenFetchMock({
    existingOrigin: undefined,
    suggestion: { tonic_spelling: 'Bb', tonic_pc: 10, mode: null },
  });

  await openExistingArrangement();

  expect(screen.getByDisplayValue('Bb')).toBeInTheDocument();
  expect(screen.queryByText(/Song Data suggestion/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Previously saved value/)).not.toBeInTheDocument();
});

test('already-confirmed transposition_origin: no fresh fetch on load, confirmed value shown as before', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 1, tonic_spelling: 'C♯', mode: 'minor', source: 'tutor_entered', confirmed: true },
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: null }, // would disagree, but must never be fetched
  });

  const suggestionCallsBeforeLoad = await openExistingArrangement();
  const suggestionCallsAfterLoad = global.fetch.mock.calls.filter(([url]) => String(url).includes('/song-key-suggestion')).length;

  expect(suggestionCallsAfterLoad).toBe(suggestionCallsBeforeLoad); // no additional fetch triggered by loading a confirmed value
  expect(screen.getByDisplayValue('C♯')).toBeInTheDocument();
  expect(screen.getByText(/Confirmed: C♯ minor \(tutor_entered\)/)).toBeInTheDocument();
  expect(screen.queryByText(/Song Data suggestion/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Previously saved value/)).not.toBeInTheDocument();
});

test('two-candidate scenario: accepting the default (song-data) suggestion still persists source: "song_data"', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 2, tonic_spelling: 'D', mode: null, source: 'legacy_default_teaching_key', confirmed: false },
    suggestion: { tonic_spelling: 'C♯', tonic_pc: 1, mode: 'minor' },
  });
  await openExistingArrangement();

  fireEvent.click(screen.getByText('Confirm Source Key'));
  await waitFor(() => expect(screen.getByText(/Confirmed: C♯ minor \(song_data\)/)).toBeInTheDocument());

  const putCall = global.fetch.mock.calls.find(([url, opts]) => String(url).endsWith('/api/arrangements/100') && opts.method === 'PUT');
  expect(JSON.parse(putCall[1].body)).toEqual({ source_key_text: 'C♯', source: 'song_data', confirmed: true });
});

test('two-candidate scenario: explicitly picking the previously-saved value persists source: "tutor_entered"', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 2, tonic_spelling: 'D', mode: null, source: 'legacy_default_teaching_key', confirmed: false },
    suggestion: { tonic_spelling: 'C♯', tonic_pc: 1, mode: 'minor' },
  });
  await openExistingArrangement();

  fireEvent.click(screen.getByText(/Previously saved value \(unconfirmed\): D/));
  expect(screen.getByDisplayValue('D')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Confirm Source Key'));

  await waitFor(() => {
    const putCall = global.fetch.mock.calls.find(([url, opts]) => String(url).endsWith('/api/arrangements/100') && opts.method === 'PUT');
    expect(putCall).toBeDefined();
  });
  const putCall = global.fetch.mock.calls.find(([url, opts]) => String(url).endsWith('/api/arrangements/100') && opts.method === 'PUT');
  expect(JSON.parse(putCall[1].body)).toEqual({ source_key_text: 'D', source: 'tutor_entered', confirmed: true });
});

test('loading a two-candidate screen and not confirming makes no PUT request at all', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 2, tonic_spelling: 'D', mode: null, source: 'legacy_default_teaching_key', confirmed: false },
    suggestion: { tonic_spelling: 'C♯', tonic_pc: 1, mode: 'minor' },
  });

  await openExistingArrangement();

  const putCalls = global.fetch.mock.calls.filter(([url, opts]) => String(url).endsWith('/api/arrangements/100') && (opts.method || 'GET').toUpperCase() === 'PUT');
  expect(putCalls).toHaveLength(0); // viewing alone writes nothing
});

/**
 * Print Key (Slice 3, 19 Sep 2026) — Print Key input prefill, debounced
 * print-key-preview, the Resources list, and the publish request now
 * carrying { print_key }. default_teaching_key input is confirmed removed
 * from the paste screen entirely.
 */

const CONFIRMED_D_MAJOR = { tonic_pc: 2, tonic_spelling: 'D', mode: 'major', source: 'tutor_entered', confirmed: true };

test('the paste screen no longer has a Default teaching key input', async () => {
  installFetchMock();
  render(<ArrangementBuilder />);
  const searchInput = await screen.findByPlaceholderText('Search songs by title, artist, or ID...');
  userEvent.type(searchInput, 'Test Song');
  fireEvent.click(await screen.findByText('Test Song — Test Artist'));
  await screen.findByLabelText('Paste chord/lyric sheet');
  expect(screen.queryByLabelText(/Default teaching key/)).not.toBeInTheDocument();
});

test('Print Key input is prefilled from a confirmed transposition_origin, and print-key-preview reports "create"', async () => {
  installReopenFetchMock({
    existingOrigin: CONFIRMED_D_MAJOR,
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: 'major' },
  });

  await openExistingArrangement();

  expect(screen.getByLabelText('Print Key')).toHaveValue('D major');
  await waitFor(() => expect(screen.getByText(/Will CREATE a new print at D major/)).toBeInTheDocument());
});

test('Print Key input stays empty when transposition_origin is unconfirmed (no prefill)', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 2, tonic_spelling: 'D', mode: null, source: 'legacy_default_teaching_key', confirmed: false },
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: null },
  });

  await openExistingArrangement();

  expect(screen.getByLabelText('Print Key')).toHaveValue('');
});

test('Publish button is disabled while Print Key is empty', async () => {
  installReopenFetchMock({
    existingOrigin: { tonic_pc: 2, tonic_spelling: 'D', mode: null, source: 'legacy_default_teaching_key', confirmed: false },
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: null },
  });

  await openExistingArrangement();

  expect(screen.getByText('Publish PDF')).toBeDisabled();
});

test('print-key-preview reports "update" with existing_resource_id/has_pdf once a Resource already exists for that key', async () => {
  installReopenFetchMock({
    existingOrigin: CONFIRMED_D_MAJOR,
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: 'major' },
    printKeyPreviewResponse: { canonical_print_key: 'D major', action: 'update', existing_resource_id: 7, has_pdf: true },
  });

  await openExistingArrangement();

  await waitFor(() =>
    expect(screen.getByText(/Will UPDATE the existing print at D major \(PDF generated\)/)).toBeInTheDocument()
  );
});

test('Existing prints list renders has_pdf as "PDF generated" / "No PDF yet"', async () => {
  installReopenFetchMock({
    existingOrigin: CONFIRMED_D_MAJOR,
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: 'major' },
    resourcesListResponse: [
      { resource_id: 1, print_key: 'D major', updated_at: '2026-09-15', has_pdf: true },
      { resource_id: 2, print_key: 'E major', updated_at: '2026-09-16', has_pdf: false },
    ],
  });

  await openExistingArrangement();

  await waitFor(() => expect(screen.getByText(/D major — updated 2026-09-15 — PDF generated/)).toBeInTheDocument());
  expect(screen.getByText(/E major — updated 2026-09-16 — No PDF yet/)).toBeInTheDocument();
});

test('clicking Publish sends print_key in the request body, then refreshes the preview and resources list on success', async () => {
  installReopenFetchMock({
    existingOrigin: CONFIRMED_D_MAJOR,
    suggestion: { tonic_spelling: 'D', tonic_pc: 2, mode: 'major' },
    publishResponse: { arrangement: { status: 'published' }, resource: { id: 55, print_key: 'D major' } },
    generatePdfResponse: { r2_object_key: 'resource_55.pdf' },
  });

  await openExistingArrangement();
  await waitFor(() => expect(screen.getByText(/Will CREATE a new print at D major/)).toBeInTheDocument());

  fireEvent.click(screen.getByText('Publish PDF'));

  await waitFor(() => expect(screen.getByText('Published — PDF ready.')).toBeInTheDocument());

  const publishCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/api/arrangements/100/publish'));
  expect(publishCall).toBeDefined();
  expect(JSON.parse(publishCall[1].body)).toEqual({ print_key: 'D major' });

  // Preview re-fetched after publish (this session's mock always answers the
  // same "create" response, but the point verified here is that the call
  // actually happens again post-publish, not just once on load).
  const previewCalls = global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/api/arrangements/100/print-key-preview'));
  expect(previewCalls.length).toBeGreaterThan(1);
  const resourcesCalls = global.fetch.mock.calls.filter(
    ([url, opts]) => String(url).endsWith('/api/arrangements/100/resources') && (opts.method || 'GET').toUpperCase() === 'GET'
  );
  expect(resourcesCalls.length).toBeGreaterThan(1);
});
