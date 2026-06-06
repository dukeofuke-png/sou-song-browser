const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins (Vercel + local dev)
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Materials base path (Google Drive)
const MATERIALS_BASE = path.join(
  process.env.HOME,
  'Library/CloudStorage/GoogleDrive-info.schoolofuke@gmail.com/My Drive/School of Uke Lesson Content/Lesson Content Tutor Access Only - School of Uke /Song Sheets PDF ONLY - School of Uke'
);

// Serve materials folder as static files
app.use('/materials', express.static(MATERIALS_BASE));

// Webhook verification endpoint (GET)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my_verify_token_12345';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook message endpoint (POST)
app.post('/webhook', (req, res) => {
  console.log('📨 Received webhook:', JSON.stringify(req.body, null, 2));
  
  // TODO: Add message handling logic here
  
  res.status(200).send('EVENT_RECEIVED');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', materialsPath: MATERIALS_BASE });
});

// NEW: Serve songs JSON (read-only)
const SONGS_JSON_PATH = path.join(__dirname, '..', 'songs_app_export_merged.json');
let songsCache = null;
let songsMtime = null;

app.get('/songs', (req, res) => {
  try {
    const stats = fs.statSync(SONGS_JSON_PATH);
    // Reload if cache empty or file modified
    if (!songsCache || !songsMtime || stats.mtimeMs !== songsMtime) {
      const raw = fs.readFileSync(SONGS_JSON_PATH, 'utf8');
      songsCache = JSON.parse(raw);
      songsMtime = stats.mtimeMs;
      console.log(`🔄 Loaded songs JSON (${Array.isArray(songsCache) ? songsCache.length : 'object'} items)`);
    }
    res.json(songsCache);
  } catch (e) {
    console.error('⚠️ Failed to read songs JSON:', e.message);
    res.status(500).json({ error: 'Songs data unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`📄 Materials server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${MATERIALS_BASE}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`\n🔗 Example URL: http://localhost:${PORT}/materials/7%20Days%20-%20Craig%20David%20(2000)%20Key%20Em/7%20Days%20-%20Craig%20David%20(2000)%20Key%20Em.pdf`);
  console.log('ℹ️ To share terminal output here: copy the command + its output and paste in a code block.');
});
