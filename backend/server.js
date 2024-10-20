// server/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Cache Schema
const CacheSchema = new mongoose.Schema({
  query: String,
  results: Object,
  timestamp: { type: Date, default: Date.now },
  expiresAt: Date
});

const Cache = mongoose.model('Cache', CacheSchema);

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Helper functions for external API results
async function getStackOverflowResults(query) {
  const response = await axios.get(`https://api.stackexchange.com/2.3/search/advanced`, {
    params: {
      q: query,
      site: 'stackoverflow',
      order: 'desc',
      sort: 'votes',
      filter: 'withbody',
    }
  });
  return response.data.items;
}

async function getRedditResults(query) {
  const response = await axios.get(`https://www.reddit.com/search.json`, {
    params: {
      q: query,
      sort: 'relevance',
      limit: 10
    },
    headers: {
      'User-Agent': 'KnowledgeBaseApp/1.0.0'
    }
  });
  return response.data.data.children;
}

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    let { query } = req.body;
    
    // Ensure the query is a string and normalize it
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Invalid search query' });
    }

    query = query.trim().toLowerCase(); // Normalize query to lowercase

    // Check cache for existing results
    const cachedResults = await Cache.findOne({ query, expiresAt: { $gt: new Date() } });

    if (cachedResults) {
      console.log(`Cache hit for query: "${query}"`);
      return res.json(cachedResults.results);
    }

    console.log(`Cache miss for query: "${query}". Fetching new data...`);

    // Fetch new results if not in cache
    const [stackOverflowResults, redditResults] = await Promise.all([
      getStackOverflowResults(query),
      getRedditResults(query)
    ]);

    const combinedResults = {
      stackoverflow: stackOverflowResults,
      reddit: redditResults
    };

    // Save new search results to cache (expires in 1 hour)
    const cacheEntry = new Cache({
      query,
      results: combinedResults,
      expiresAt: new Date(Date.now() + 3600000) // Cache expiration set to 1 hour
    });
    await cacheEntry.save();

    res.json(combinedResults);
  } catch (error) {
    console.error('Error fetching search results:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email endpoint
app.post('/api/email-results', async (req, res) => {
  try {
    const { email, results, query } = req.body;

    if (!results || !results.stackoverflow || !results.reddit) {
      return res.status(400).json({ error: 'Invalid results format' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Knowledge Base Search Results: ${query}`,
      html: generateEmailTemplate(results, query)
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Generate HTML template for email
function generateEmailTemplate(results, query) {
  const stackOverflowResults = Array.isArray(results.stackoverflow) ? results.stackoverflow : [];
  const redditResults = Array.isArray(results.reddit) ? results.reddit : [];

  return `
    <h2>Search Results for: ${query}</h2>
    <div>
      <h3>Stack Overflow Results:</h3>
      ${stackOverflowResults.map(item => `
        <div>
          <h4><a href="${item.link}">${item.title}</a></h4>
          <p>Score: ${item.score}</p>
        </div>
      `).join('')}

      <h3>Reddit Results:</h3>
      ${redditResults.map(item => `
        <div>
          <h4><a href="https://reddit.com${item.data.permalink}">${item.data.title}</a></h4>
          <p>Score: ${item.data.score}</p>
        </div>
      `).join('')}
    </div>
  `;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
