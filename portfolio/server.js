const express = require('express');
const path = require('path');

const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // fits a base64 phone photo; shrink photos first with public/shrink-photo.js

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api', contactRoutes);
app.use('/admin', adminRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Portfolio starter listening on port ${PORT}`);
});
