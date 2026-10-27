const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // fits a base64 phone photo; shrink photos first with public/shrink-photo.js

// Health check — used by the platform to detect when the app is ready.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Tracker API — items persist to lib/data/items.json on EFS.
app.use('/api', require('./routes/api'));

// Serve the UI.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
