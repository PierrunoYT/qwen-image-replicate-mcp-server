#!/usr/bin/env node

/**
 * Qwen Image Replicate MCP Server
 * 
 * This MCP server provides image generation capabilities using Qwen Image model
 * via the Replicate platform. Qwen Image is an advanced text-to-image model that excels at:
 * 
 * - Complex text rendering and precise image editing
 * - High-quality image generation from text prompts
 * - Multiple image sizes and aspect ratios
 * - Advanced guidance and inference controls
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Replicate from "replicate";
import { writeFile } from "fs/promises";
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

// Get Replicate API key from environment variable
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const NODE_ENV = process.env.NODE_ENV || 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3');
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '300000');

const replicate = new Replicate();

// Enhanced logging
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
  const currentLevel = logLevels[LOG_LEVEL as keyof typeof logLevels] || 2;
  const messageLevel = logLevels[level as keyof typeof logLevels] || 0;
  
  if (messageLevel <= currentLevel) {
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (data) {
      console.error(`${prefix} ${message}`, data);
    } else {
      console.error(`${prefix} ${message}`);
    }
  }
}

if (!REPLICATE_API_TOKEN) {
  log('error', "REPLICATE_API_TOKEN environment variable is required");
  log('info', "Please set your Replicate API key: export REPLICATE_API_TOKEN=your_replicate_token_here");
  log('info', "Get your key from: https://replicate.com/account");
  // Server continues running, no process.exit()
} else {
  log('info', "Replicate client initialized successfully");
  log('debug', "Configuration", {
    nodeEnv: NODE_ENV,
    logLevel: LOG_LEVEL,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
    requestTimeout: REQUEST_TIMEOUT
  });
}

// Valid image sizes for Qwen Image on Replicate
const VALID_IMAGE_SIZES = [
  "1024x1024", "720x1280", "1280x720", "768x1024", "1024x768"
] as const;
type ImageSize = typeof VALID_IMAGE_SIZES[number];

/**
 * Interface for Qwen Image generation parameters
 */
interface QwenImageParams {
  prompt: string;
  image_size?: ImageSize;
  num_inference_steps?: number;
  seed?: number;
  guidance_scale?: number;
  negative_prompt?: string;
}

/**
 * Download an image from a URL and save it locally
 */
async function downloadImage(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    // Create images directory if it doesn't exist
    const imagesDir = path.join(process.cwd(), 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const filePath = path.join(imagesDir, filename);
    const file = fs.createWriteStream(filePath);
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
      
      file.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate a unique filename for an image
 */
function generateImageFilename(prompt: string, index: number, timestamp?: string): string {
  // Create a safe filename from the prompt
  const safePrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const timeStr = timestamp || new Date().toISOString().replace(/[:.]/g, '-');
  return `qwen_image_${safePrompt}_${index}_${timeStr}.webp`;
}

/**
 * Create an MCP server with image generation capabilities
 */
const server = new Server(
  {
    name: "qwen-image-replicate-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handler that lists available tools for image generation
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_image",
        description: "Generate images using Qwen Image model via Replicate. Supports complex text rendering, precise image editing, and high-quality image generation from text prompts.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The text prompt used to generate the image. Be descriptive for best results."
            },
            image_size: {
              type: "string",
              enum: [...VALID_IMAGE_SIZES],
              description: "The size of the generated image.",
              default: "1024x768"
            },
            num_inference_steps: {
              type: "integer",
              description: "The number of inference steps to perform. More steps generally produce higher quality images but take longer.",
              minimum: 1,
              maximum: 500,
              default: 50
            },
            seed: {
              type: "integer",
              description: "Random seed for reproducible results. Same seed with same prompt will produce the same image."
            },
            guidance_scale: {
              type: "number",
              description: "CFG scale - how closely the model should follow the prompt. Higher values stick closer to prompt.",
              minimum: 1,
              maximum: 20,
              default: 4
            },
            negative_prompt: {
              type: "string",
              description: "Negative prompt to specify what should not be in the image.",
              default: ""
            }
          },
          required: ["prompt"]
        }
      }
    ]
  };
});

/**
 * Handler for tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "generate_image": {
      try {
        if (!REPLICATE_API_TOKEN) {
          return {
            content: [{
              type: "text",
              text: "Error: REPLICATE_API_TOKEN environment variable is not set. Please configure your Replicate API key."
            }],
            isError: true
          };
        }

        const params = (request.params.arguments || {}) as unknown as QwenImageParams;
        
        if (!params.prompt || typeof params.prompt !== 'string') {
          throw new Error("Prompt is required and must be a string");
        }

        // Validate image_size if provided
        if (params.image_size && !VALID_IMAGE_SIZES.includes(params.image_size)) {
          throw new Error(`Invalid image_size. Must be one of: ${VALID_IMAGE_SIZES.join(', ')}`);
        }

        // Validate numeric parameters
        if (params.num_inference_steps && (params.num_inference_steps < 1 || params.num_inference_steps > 500)) {
          throw new Error("num_inference_steps must be between 1 and 500");
        }

        if (params.guidance_scale && (params.guidance_scale < 1 || params.guidance_scale > 20)) {
          throw new Error("guidance_scale must be between 1 and 20");
        }

        // Prepare the input payload for Replicate
        const input: any = {
          prompt: params.prompt,
          image_size: params.image_size || "1024x768",
          num_inference_steps: params.num_inference_steps || 50,
          guidance_scale: params.guidance_scale || 4,
          negative_prompt: params.negative_prompt || ""
        };

        // Add seed if provided
        if (params.seed !== undefined) {
          input.seed = params.seed;
        }

        log('info', `Generating image(s) with prompt: "${params.prompt}"`);
        log('debug', 'Generation parameters', input);
        
        const startTime = Date.now();
        
        try {
          // Call the Qwen Image model on Replicate
          const output = await replicate.run("qwen/qwen-image", { input });
          
          const generationTime = Date.now() - startTime;
          log('info', `Image(s) generated successfully in ${generationTime}ms`);

          if (!output || !Array.isArray(output) || output.length === 0) {
            throw new Error("No images were generated - empty response from Replicate");
          }

          // Download images locally
          log('debug', `Downloading ${output.length} image(s) locally...`);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const downloadedImages: { url: string; localPath: string; index: number; }[] = [];
          
          for (let i = 0; i < output.length; i++) {
            const imageUrl = output[i];
            if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
              log('warn', `Invalid image URL at index ${i}: ${imageUrl}`);
              continue;
            }

            try {
              const filename = generateImageFilename(params.prompt, i, timestamp);
              const localPath = await downloadImage(imageUrl, filename);
              downloadedImages.push({ 
                url: imageUrl, 
                localPath, 
                index: i, 
              });
              log('info', `Image ${i + 1} downloaded successfully: ${filename}`);
            } catch (downloadError) {
              log('warn', `Failed to download image ${i + 1}: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
              downloadedImages.push({ 
                url: imageUrl, 
                localPath: '', 
                index: i, 
              });
            }
          }

          // Format response
          const imageDetails = downloadedImages.map(img => {
            if (img.localPath) {
              return `• Image ${img.index + 1}: ${img.localPath} (${img.url})`;
            } else {
              return `• Image ${img.index + 1}: Download failed - ${img.url}`;
            }
          }).join('\n');

          const successfulDownloads = downloadedImages.filter(img => img.localPath).length;

          return {
            content: [
              {
                type: "text",
                text: `✅ Successfully generated ${output.length} image(s) using Qwen Image:

📝 **Generation Details:**
• Prompt: "${input.prompt}"
• Image Size: ${input.image_size}
• Inference Steps: ${input.num_inference_steps}
• Guidance Scale: ${input.guidance_scale}
• Seed Used: ${input.seed || 'Random'}
• Generation Time: ${generationTime}ms

🖼️ **Generated Images (${output.length} total, ${successfulDownloads} downloaded):**
${imageDetails}

💾 ${successfulDownloads > 0 ? 'Images have been downloaded to the local \'images\' directory.' : 'Images are available at the URLs above.'}`
              }
            ]
          };

        } catch (apiError) {
          const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
          log('error', `Replicate API error: ${errorMessage}`);
          
          // Provide helpful error messages based on common issues
          let helpfulMessage = '';
          if (errorMessage.includes('timeout')) {
            helpfulMessage = '\n💡 **Tip:** Try a simpler prompt or increase the timeout setting.';
          } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
            helpfulMessage = '\n💡 **Tip:** Check your REPLICATE_API_TOKEN is valid and has sufficient credits.';
          } else if (errorMessage.includes('rate limit')) {
            helpfulMessage = '\n💡 **Tip:** You\'ve hit the rate limit. Please wait a moment before trying again.';
          } else if (errorMessage.includes('validation')) {
            helpfulMessage = '\n💡 **Tip:** Check your input parameters are within valid ranges.';
          }
          
          throw new Error(`Failed to generate image(s): ${errorMessage}${helpfulMessage}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        log('error', `Image generation failed: ${errorMessage}`);
        
        return {
          content: [
            {
              type: "text",
              text: `❌ **Error generating image(s):**

${errorMessage}

🔧 **Troubleshooting:**
• Verify your REPLICATE_API_TOKEN is set and valid
• Check your internet connection
• Ensure your Replicate account has sufficient credits
• Verify input parameters are within valid ranges
• Try a simpler prompt if the error persists

📞 **Need help?** Visit: https://github.com/PierrunoYT/qwen-image-fal-mcp-server/issues`
            }
          ],
          isError: true
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

/**
 * Start the server using stdio transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('info', "Qwen Image Replicate MCP server running on stdio");
  log('debug', "Server ready to accept requests");
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection at:', { promise, reason });
  process.exit(1);
});

main().catch((error) => {
  log('error', "Server startup error:", error);
  process.exit(1);
});
