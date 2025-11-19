const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for React dev server
app.use(cors());

// Materials base path (Google Drive)
const MATERIALS_BASE = path.join(
  process.env.HOME,
  'Library/CloudStorage/GoogleDrive-info.schoolofuke@gmail.com/My Drive/School of Uke Lesson Content/Lesson Content Tutor Access Only - School of Uke /Song Sheets PDF ONLY - School of Uke'
);

// Serve materials folder as static files
app.use('/materials', express.static(MATERIALS_BASE));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', materialsPath: MATERIALS_BASE });
});

app.listen(PORT, () => {
  console.log(`📄 Materials server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${MATERIALS_BASE}`);
  console.log(`\n🔗 Example URL: http://localhost:${PORT}/materials/7%20Days%20-%20Craig%20David%20(2000)%20Key%20Em/7%20Days%20-%20Craig%20David%20(2000)%20Key%20Em.pdf`);
});
