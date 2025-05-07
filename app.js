const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const NodeCache = require('node-cache');
const cors = require('cors');

// setup express service
const app = express();
const allowedOrigins = ['http://localhost:4200', 'https://klancic.me'];
// Use the cors middleware
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST']
}));
// Use the port provided by the host or default to 3000
const port = process.env.PORT || 3000;
// Cache items for 15 minutes (900 seconds)
const cache = new NodeCache({ stdTTL: 900 });

app.listen(port, () => {
    logMessage(`Server listening on port ${port}`);
});

// Utility function to fetch and parse the RSS feed
const fetchFeed = async (feedUrl) => {
    try {
        const response = await axios.get(feedUrl, {
            headers: {
                'User-Agent': 'medium-rss-wrapper/1.0 (klancic.me; klancic@hotmail.com)' // Example User-Agent string
            }
        });
        const parsedFeed = await xml2js.parseStringPromise(response.data, { mergeAttrs: true });
        const items = parsedFeed.rss.channel[0].item || [];
        return items;
    } catch (error) {
        logError(`Error fetching feed: ${error}`);
        throw error;
    }
};

const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

const logError = (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${error}`);
}

// Retrieve feeds for user
app.get('/api/feed/:name', async (req, res) => {
    const mediumName = req.params.name;
    // Default to 5 items if 'size' is not specified
    const size = parseInt(req.query.size) || 5;

    const feedUrl = `https://medium.com/feed/@${mediumName}`;
    logMessage(`Fetching feeds: [${mediumName}, ${feedUrl}]`);

    const cacheKey = `${mediumName}:${size}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        logMessage('Serving from cache');
        return res.json(cachedData);
    }

    try {
        const items = await fetchFeed(feedUrl);
        const limitedItems = items.slice(0, size).map(item => ({
            title: item.title?.[0] || null,
            link: item.link?.[0] || null,
            pubDate: item.pubDate?.[0] || null,
            creator: item['dc:creator']?.[0] || null,
            categories: item.category ? item.category.map(cat => cat._ || cat) : [],
            content: item['content:encoded']?.[0] || null
        }));

        // Cache the formatted items
        cache.set(cacheKey, limitedItems);

        res.json(limitedItems); // Send the formatted items as JSON response
    } catch (error) {
        logError(`Error processing feed: ${error}`);
        res.status(500).json({ error: 'Failed to fetch or parse RSS feed' });
    }
});