require('dotenv').config();
const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const NodeCache = require('node-cache');
const cors = require('cors');

// Read configuration once
const port = process.env.PORT || 3000;
const mediumBaseUrl = process.env.MEDIUM_BASE_URL || 'https://medium.com';
const userAgent = process.env.USER_AGENT || 'medium-rss-wrapper/1.0 (klancic.me; klancic@hotmail.com)';
// Comma-separated list of origins, or '*' to allow any origin
const allowedOrigins = !process.env.ALLOWED_ORIGIN || process.env.ALLOWED_ORIGIN.trim() === '*'
    ? '*'
    : process.env.ALLOWED_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean);
// Cache TTL in seconds, 0 means never expire. Defaults to 30 minutes (1800 seconds)
const parsedCacheTtl = Number(process.env.API_CACHE_TTL);
const cacheTtl = process.env.API_CACHE_TTL && Number.isInteger(parsedCacheTtl) && parsedCacheTtl >= 0
    ? parsedCacheTtl
    : 1800;

const DEFAULT_SIZE = 5;
const MAX_SIZE = 20;

const cache = new NodeCache({ stdTTL: cacheTtl });

const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

const logError = (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${error}`);
};

// Utility function to fetch and parse the RSS feed
const fetchFeed = async (feedUrl) => {
    const response = await axios.get(feedUrl, {
        timeout: 10000,
        headers: {
            'User-Agent': userAgent
        }
    });
    const parsedFeed = await xml2js.parseStringPromise(response.data, { mergeAttrs: true });
    const channel = parsedFeed?.rss?.channel?.[0];
    if (!channel) {
        throw new Error('Unexpected feed format');
    }
    return channel.item || [];
};

// setup express service
const app = express();
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET']
}));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Retrieve feeds for user
app.get('/api/feed/:name', async (req, res) => {
    const mediumName = req.params.name;
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(mediumName)) {
        return res.status(400).json({ error: 'Invalid username' });
    }

    // Default to 5 items if 'size' is not specified
    let size = DEFAULT_SIZE;
    if (req.query.size !== undefined) {
        size = /^\d+$/.test(req.query.size) ? parseInt(req.query.size, 10) : NaN;
        if (!(size >= 1 && size <= MAX_SIZE)) {
            return res.status(400).json({ error: `Invalid size, must be between 1 and ${MAX_SIZE}` });
        }
    }

    const sendItems = (items) => {
        if (cacheTtl > 0) {
            res.set('Cache-Control', `public, max-age=${cacheTtl}`);
        }
        res.json(items.slice(0, size));
    };

    const cachedData = cache.get(mediumName);
    if (cachedData) {
        logMessage(`Serving from cache: [${mediumName}]`);
        return sendItems(cachedData);
    }

    const feedUrl = `${mediumBaseUrl}/feed/@${mediumName}`;
    logMessage(`Fetching feeds: [${mediumName}, ${feedUrl}]`);

    try {
        const items = (await fetchFeed(feedUrl)).map(item => ({
            title: item.title?.[0] || null,
            link: item.link?.[0] || null,
            pubDate: item.pubDate?.[0] || null,
            creator: item['dc:creator']?.[0] || null,
            categories: item.category ? item.category.map(cat => cat._ || cat) : [],
            content: item['content:encoded']?.[0] || null
        }));

        // Cache the full list of formatted items, only successful responses are cached
        cache.set(mediumName, items);

        sendItems(items);
    } catch (error) {
        logError(`Error processing feed [${mediumName}]: ${error}`);
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Feed not found' });
        }
        res.status(502).json({ error: 'Failed to fetch or parse RSS feed' });
    }
});

const server = app.listen(port, () => {
    logMessage(`Server listening on port ${port}`);
});

process.on('SIGTERM', () => {
    logMessage('SIGTERM received, shutting down');
    server.close(() => process.exit(0));
});
