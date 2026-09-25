# screenshotty-mcp

[Model Context Protocol](https://modelcontextprotocol.io/) server for the
[Screenshotty](https://screenshotty.link?utm_source=mcp) screenshot API. Lets Claude, Cursor,
Cline, and any other MCP client capture web pages — or render HTML — as images or PDFs,
and **see** the result, since images come back inline.

## Get an API key

Sign up at <https://screenshotty.link/sign-up?utm_source=mcp> (250 screenshots/month free,
no credit card) and copy a key from **Dashboard → API Keys**.

## Configure your client

### Claude Code

```bash
claude mcp add screenshotty --env SCREENSHOTTY_API_KEY=your_key -- npx -y screenshotty-mcp
```

### Claude Desktop / Cursor / Cline

```json
{
  "mcpServers": {
    "screenshotty": {
      "command": "npx",
      "args": ["-y", "screenshotty-mcp"],
      "env": {
        "SCREENSHOTTY_API_KEY": "your_key"
      }
    }
  }
}
```

Claude Desktop config lives at `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

## Tools

| Tool | What it does |
|------|--------------|
| `screenshot_url` | Screenshot a page (PNG, JPEG, WebP). Returns the hosted URL, plus the image inline when it is 2 MB or smaller. Options: viewport, full page, CSS selector, wait, ad blocking, cookie-banner blocking, light/dark mode, device scale factor. |
| `screenshot_html` | Render an HTML document (inline CSS/JS; public http(s) assets only) to PNG, JPEG, or WebP — social cards, charts, email previews. Returns the URL plus the image inline. |
| `generate_pdf` | Render a page (`url`) or an HTML document (`html`) to PDF. Returns the hosted PDF URL. |

Example prompts: *"Screenshot https://example.com on a 390px-wide viewport and tell me
what's broken on mobile"*, *"Save our pricing page as a PDF"*, *"Design a 1200×630 Open
Graph card for this blog post and render it"*.

## Environment variables

| Variable | Required | Default |
|----------|----------|---------|
| `SCREENSHOTTY_API_KEY` | yes | — |
| `SCREENSHOTTY_API_URL` | no | `https://api.screenshotty.link` |

## Development

```bash
npm install
npm run build
SCREENSHOTTY_API_KEY=your_key npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
