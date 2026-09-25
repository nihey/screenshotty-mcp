#!/usr/bin/env node
/**
 * Screenshotty MCP Server
 *
 * Model Context Protocol server for capturing screenshots and PDFs of web pages
 * via the Screenshotty API (https://screenshotty.link). Screenshots are also
 * returned inline as image content so the assistant can look at the page.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = (process.env.SCREENSHOTTY_API_URL || "https://api.screenshotty.link").replace(/\/$/, "");
const API_KEY = process.env.SCREENSHOTTY_API_KEY;
const VERSION = "1.0.1";

/** Inline images above this size are returned as a link only, to keep context small. */
const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;

const FORMATS = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
} as const;

type FormatName = keyof typeof FORMATS;

interface CaptureParams {
  url: string;
  format: FormatName;
  viewport_width?: number;
  viewport_height?: number;
  full_page?: boolean;
  selector?: string;
  wait_ms?: number;
  adblock?: boolean;
  block_cookie_banner?: boolean;
  light_mode?: "default" | "light" | "dark";
  device_scale_factor?: number;
  printed?: boolean;
}

/** POST /api/v1/screenshot with response_type=json → { url, html }. */
async function capture(params: CaptureParams): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      "SCREENSHOTTY_API_KEY is not set. Get a free key (250 screenshots/month) at https://screenshotty.link/sign-up?utm_source=mcp",
    );
  }

  const response = await fetch(`${API_URL}/api/v1/screenshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({ ...params, format: FORMATS[params.format], response_type: "json" }),
  });

  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
  if (!response.ok) {
    throw new Error(data.error || data.message || `Screenshotty API returned ${response.status}`);
  }
  if (!data.url) {
    throw new Error("Screenshotty API returned no file URL");
  }
  return data.url;
}

/** Download a rendered image for inline display; null when too large or unavailable. */
async function fetchInlineImage(url: string, mimeType: string) {
  const response = await fetch(url);
  if (!response.ok) { return null; }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_INLINE_IMAGE_BYTES) { return null; }
  return { type: "image" as const, data: bytes.toString("base64"), mimeType };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const server = new McpServer({ name: "screenshotty", version: VERSION });

const pageOptions = {
  url: z.string().url().describe("Page to capture (http:// or https://)"),
  viewport_width: z.number().int().min(320).max(3840).optional().describe("Viewport width in pixels. Default 1920"),
  viewport_height: z.number().int().min(320).max(3840).optional().describe("Viewport height in pixels. Default 1080"),
  wait_ms: z.number().int().min(0).max(10000).optional().describe("Extra wait before capturing, in ms"),
  adblock: z.boolean().optional().describe("Block ads"),
  block_cookie_banner: z.boolean().optional().describe("Hide cookie consent banners"),
  light_mode: z.enum(["default", "light", "dark"]).optional().describe("Force light or dark color scheme"),
};

server.registerTool(
  "screenshot_url",
  {
    title: "Screenshot a web page",
    description:
      "Capture a screenshot of a web page. Returns the hosted image URL and, for images up to 2 MB, the image itself so you can see the page.",
    inputSchema: {
      ...pageOptions,
      format: z.enum(["png", "jpeg", "webp"]).optional().describe("Image format. Default png"),
      full_page: z.boolean().optional().describe("Capture the whole scrollable page. Default true"),
      selector: z.string().optional().describe("CSS selector of a single element to capture"),
      device_scale_factor: z.number().int().min(1).max(3).optional().describe("1 = standard, 2 = retina, 3 = high-dpi"),
    },
  },
  async (args) => {
    try {
      const format = args.format ?? "png";
      const fileUrl = await capture({ ...args, format });
      const image = await fetchInlineImage(fileUrl, FORMATS[format]).catch(() => null);
      return {
        content: [
          { type: "text" as const, text: `Screenshot of ${args.url}: ${fileUrl}` },
          ...(image ? [image] : []),
        ],
      };
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "generate_pdf",
  {
    title: "Convert a web page to PDF",
    description: "Render a web page to a PDF document. Returns the hosted PDF URL.",
    inputSchema: {
      ...pageOptions,
      printed: z.boolean().optional().describe("Use the page's print stylesheet. Default true"),
    },
  },
  async (args) => {
    try {
      const fileUrl = await capture({ ...args, format: "pdf", printed: args.printed ?? true, full_page: true });
      return { content: [{ type: "text" as const, text: `PDF of ${args.url}: ${fileUrl}` }] };
    } catch (error) {
      return errorResult(error);
    }
  },
);

async function main() {
  await server.connect(new StdioServerTransport());
  console.error("Screenshotty MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
