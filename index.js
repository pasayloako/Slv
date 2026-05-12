const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for external resources (Tailwind, Lucide, Google Fonts)
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// API endpoint for share submissions (proxy to external API)
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval } = req.body;

  // Validate required fields
  if (!cookie || !url || !amount || !interval) {
    return res.status(400).json({
      status: 400,
      error: 'Missing required fields: cookie, url, amount, interval'
    });
  }

  // Validate amount and interval
  if (amount < 1 || interval < 1) {
    return res.status(400).json({
      status: 400,
      error: 'Amount and interval must be at least 1'
    });
  }

  // Validate URL
  if (!url.includes('facebook.com') && !url.includes('fb.com')) {
    return res.status(400).json({
      status: 400,
      error: 'Invalid Facebook URL'
    });
  }

  try {
    // Forward request to the external API
    const externalApiUrl = 'https://serverselov1.onrender.com/api/submit';
    
    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cookie,
        url,
        amount: parseInt(amount),
        interval: parseInt(interval)
      })
    });

    const data = await response.json();

    // Forward the response from external API
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error calling external API:', error);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        status: 503,
        error: 'External share service is unavailable. Please try again later.'
      });
    }
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(504).json({
        status: 504,
        error: 'Request timeout. The share service is taking too long to respond.'
      });
    }
    
    res.status(500).json({
      status: 500,
      error: 'Internal server error. Please try again.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 500,
    error: 'Something went wrong on the server'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from ${path.join(__dirname, 'public')}`);
  console.log(`🌐 API endpoint available at http://localhost:${PORT}/api/submit`);
});
