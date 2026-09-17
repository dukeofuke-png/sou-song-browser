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
