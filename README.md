# Medium RSS Wrapper

Medium RSS Wrapper is a Node.js application that fetches RSS feeds from Medium profiles and formats the data in a simplified JSON structure. It includes caching to improve performance and reduce the number of requests made to Medium.

## Features

- Retrieves and parses RSS feeds from Medium profiles.
- Formats the feed items to include specific fields: title, link, pubDate, creator, categories, description, and content.
- Implements caching mechanism to store feed results for 15 minutes, reducing unnecessary network calls.

## Prerequisites

- Node.js (version 12 or higher)
- npm (Node package manager)

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/medium-rss-wrapper.git
   cd medium-rss-wrapper
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```

## Usage
**Start the server**
Run the application using the following command:

   ```bash
   node app.js
   ```

This will start the server at http://localhost:3000.

API Endpoint
Access RSS feeds through the following endpoint:

   ```angular2html
   GET /api/feed/:name
   ```
- :name: The Medium username whose RSS feed you want to fetch.
- Query parameter size: Limit the number of items returned (default is 5).

Example request:
   ```bash
   curl http://localhost:3000/api/feed/john.doe?size=1
   ```
## Configuration
- Caching: The service caches feed data for 15 minutes to improve performance.

## Notes
- Ensure compliance with Medium's terms of service when making requests.
- Configure the User-Agent in app.js appropriately to reflect your application's identity.

## Dependencies
- Express
- Axios
- xml2js
- node-cache

## License
This project is licensed under the MIT License. See LICENSE for more information.

## Author
Your Name - Jernej Klancic

## Contribution
Contributions are welcome! Feel free to submit issues, feature requests, or pull requests.

