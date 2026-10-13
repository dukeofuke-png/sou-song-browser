import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChordFinder from './ChordFinder';
import fixtures from './__fixtures__/theoryApi.json';

/**
 * Mocked /api/theory responses are generated from the real backend engine
 * (materials-server services/theory, WP-4) — see __fixtures__/theoryApi.json.
 */
function jsonResponse(status, body) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

let calls;
function installFetchMock(overrides = {}) {
  calls = [];
  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url);
    const method = (options.method || 'GET').toUpperCase();
    calls.push({ url: u, method, options });
    for (const [match, response] of Object.entries(overrides)) {
      if (u.includes(match) && (!response.method || response.method === method)) return jsonResponse(response.status, response.body);
    }
    if (u.includes('/api/theory/default-shapes') && method === 'GET') return jsonResponse(200, fixtures.defaults);
    if (u.includes('/api/theory/shapes?chord=Em')) return jsonResponse(200, fixtures.emShapes);
    if (u.includes('/api/theory/shapes?chord=C&') || u.endsWith('/api/theory/shapes?chord=C')) return jsonResponse(200, fixtures.cShapes);
    if (u.includes('/api/theory/shapes?chord=Cxyz')) return jsonResponse(200, fixtures.unknown);
    if (u.includes('/api/theory/name?frets=3111')) return jsonResponse(200, fixtures.name3111);
    if (u.includes('/api/theory/name?frets=x2111')) return jsonResponse(200, fixtures.namex2111);
    if (u.includes('/api/theory/default-shapes') && method === 'PUT') return jsonResponse(200, { default: { chord_display: 'Em', frets: '0,4,0,2' } });
    if (u.includes('/api/theory/default-shapes') && method === 'DELETE') return jsonResponse(200, { cleared: true });
    return jsonResponse(404, { error: 'not mocked' });
  });
}

async function lookUp(chord) {
  await userEvent.clear(screen.getByLabelText('Chord'));
  await userEvent.type(screen.getByLabelText('Chord'), chord);
  await userEvent.click(screen.getByRole('button', { name: 'Show shapes' }));
}

beforeEach(() => installFetchMock());

describe('ChordFinder', () => {
  test('shows every shape in the order the engine gives, with the admin default marked in place', async () => {
    render(<ChordFinder />);
    await lookUp('Em');
    const cards = await screen.findAllByTestId('shape-card');
    expect(cards.map((c) => c.getAttribute('data-frets'))).toEqual(fixtures.emShapes.shapes.map((s) => s.fretString));
    expect(cards[0].getAttribute('data-frets')).toBe('0402'); // first in list, not the default
    const marked = cards.filter((c) => c.classList.contains('is-default'));
    expect(marked.map((c) => c.getAttribute('data-frets'))).toEqual(['0432']);
    expect(within(marked[0]).getByText('Default (set by admin)')).toBeInTheDocument();
    expect(within(marked[0]).getByRole('button', { name: 'Clear admin default' })).toBeInTheDocument();
  });

  test('with no admin default, the first shape is marked "first in list"', async () => {
    render(<ChordFinder />);
    await lookUp('C');
    const cards = await screen.findAllByTestId('shape-card');
    expect(within(cards[0]).getByText('Default (first in list)')).toBeInTheDocument();
    expect(within(cards[1]).getByText('muted string')).toBeInTheDocument();
  });

  test('Make default sends the chord and frets, then reloads the shapes and the defaults list', async () => {
    render(<ChordFinder />);
    await lookUp('Em');
    const cards = await screen.findAllByTestId('shape-card');
    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Make default' }));
    const put = calls.find((c) => c.method === 'PUT');
    expect(JSON.parse(put.options.body)).toEqual({ profile: 'gcea-high-g', chord: 'Em', frets: '0402' });
    expect(put.options.headers['Content-Type']).toBe('application/json');
    expect(put.options.credentials).toBe('include');
    expect(await screen.findByRole('status')).toHaveTextContent('Em now defaults to 0402.');
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/default-shapes') && c.method === 'GET').length).toBeGreaterThanOrEqual(2));
  });

  test('Clear admin default sends DELETE for that chord', async () => {
    render(<ChordFinder />);
    await lookUp('Em');
    await userEvent.click(await screen.findByRole('button', { name: 'Clear admin default' }));
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del.url).toContain('/api/theory/default-shapes?profile=gcea-high-g&chord=Em');
    expect(await screen.findByRole('status')).toHaveTextContent('cleared');
  });

  test('a refused change shows the backend\'s reason', async () => {
    installFetchMock({ '/api/theory/default-shapes': { method: 'PUT', status: 400, body: { error: '0,4,0,2 is not one of the engine\'s shapes for Em' } } });
    render(<ChordFinder />);
    await lookUp('Em');
    const cards = await screen.findAllByTestId('shape-card');
    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Make default' }));
    expect(await screen.findByText(/not one of the engine's shapes/)).toBeInTheDocument();
  });

  test('with a capo, defaults can\'t be changed and a note says why', async () => {
    render(<ChordFinder />);
    await userEvent.selectOptions(screen.getByLabelText('Capo'), '2');
    await lookUp('Em');
    await screen.findAllByTestId('shape-card');
    expect(screen.queryByRole('button', { name: 'Make default' })).toBeNull();
    expect(screen.getByText(/Defaults are set with no capo/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('capo=2'))).toBe(true);
  });

  test('look-up-only instruments hide the default buttons', async () => {
    render(<ChordFinder />);
    await userEvent.selectOptions(screen.getByLabelText('Instrument'), 'gcea-low-g');
    await lookUp('Em');
    await screen.findAllByTestId('shape-card');
    expect(screen.queryByRole('button', { name: 'Make default' })).toBeNull();
    expect(calls.some((c) => c.url.includes('profile=gcea-low-g'))).toBe(true);
  });

  test('an unreadable chord says why', async () => {
    render(<ChordFinder />);
    await lookUp('Cxyz');
    expect(await screen.findByRole('alert')).toHaveTextContent(/can't be read: unknown chord type/);
  });

  test('a stale admin default is flagged', async () => {
    installFetchMock({ '/api/theory/shapes?chord=Em': { status: 200, body: { ...fixtures.emShapes, adminDefaultNotInList: true, defaultSource: 'first', adminDefault: { frets: '9,9,9,9', chord: 'Em' } } } });
    render(<ChordFinder />);
    await lookUp('Em');
    expect(await screen.findByText(/9,9,9,9 is no longer one of this chord's shapes/)).toBeInTheDocument();
  });

  test('not logged in → a clear message', async () => {
    installFetchMock({ '/api/theory/shapes': { status: 401, body: { error: 'Authentication required' } } });
    render(<ChordFinder />);
    await lookUp('Em');
    expect(await screen.findByText(/not logged in/)).toBeInTheDocument();
  });

  test('name a shape: 3111 → Bbm, precise Bbm/Db on click', async () => {
    render(<ChordFinder />);
    await userEvent.type(screen.getByLabelText('Frets (4th string to 1st)'), '3111');
    await userEvent.click(screen.getByRole('button', { name: 'Name it' }));
    const name = await screen.findByRole('button', { name: 'Bbm' });
    expect(screen.queryByText('Bbm/Db')).toBeNull();
    await userEvent.click(name);
    expect(screen.getByText('Bbm/Db')).toBeInTheDocument();
  });

  test('name a shape: x2111 shows both readings, each marked unplayable', async () => {
    render(<ChordFinder />);
    await userEvent.type(screen.getByLabelText('Frets (4th string to 1st)'), 'x2111');
    await userEvent.click(screen.getByRole('button', { name: 'Name it' }));
    const readings = await screen.findAllByTestId('name-reading');
    expect(readings).toHaveLength(2);
    expect(screen.getByText(/can be read more than one way/)).toBeInTheDocument();
    expect(screen.getAllByText(/Unplayable: a stretch of 10 frets/)).toHaveLength(2);
  });

  test('the admin defaults list loads, and Open looks the chord up', async () => {
    render(<ChordFinder />);
    const rows = await screen.findAllByTestId('default-row');
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Ab', 'Em', 'Fmaj7']);
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Open' }));
    expect(await screen.findAllByTestId('shape-card')).toHaveLength(fixtures.emShapes.shapes.length);
  });
});
