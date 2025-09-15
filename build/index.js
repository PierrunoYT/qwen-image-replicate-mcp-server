#!/usr/bin/env node
/**
 * Qwen Image fal.ai MCP Server
 *
 * This MCP server provides image generation capabilities using Qwen Image model
 * via the fal.ai platform. Qwen Image is an advanced text-to-image model that excels at:
 *
 * - Complex text rendering and precise image editing
 * - High-quality image generation from text prompts
 * - Multiple image sizes and aspect ratios
 * - Advanced guidance and inference controls
 * - Safety checking and content filtering
 * - Multiple output formats (PNG, JPEG)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import * as fal from "@fal-ai/client";
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
// Get fal.ai API key from environment variable
const FAL_KEY = process.env.FAL_KEY;
const NODE_ENV = process.env.NODE_ENV || 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3');
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '300000');
// Enhanced logging
function log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = logLevels[LOG_LEVEL] || 2;
    const messageLevel = logLevels[level] || 0;
    if (messageLevel <= currentLevel) {
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        if (data) {
            console.error(`${prefix} ${message}`, data);
        }
        else {
            console.error(`${prefix} ${message}`);
        }
    }
}
if (!FAL_KEY) {
    log('error', "FAL_KEY environment variable is required");
    log('info', "Please set your fal.ai API key: export FAL_KEY=your_fal_key_here");
    log('info', "Get your key from: https://fal.ai/dashboard/keys");
    // Server continues running, no process.exit()
}
else {
    // Configure fal.ai client
    fal.config({
        credentials: FAL_KEY,
    });
    log('info', "fal.ai client initialized successfully");
    log('debug', "Configuration", {
        nodeEnv: NODE_ENV,
        logLevel: LOG_LEVEL,
        maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
        requestTimeout: REQUEST_TIMEOUT
    });
}
// Valid image sizes for Qwen Image
const VALID_IMAGE_SIZES = [
    "square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3",
    "landscape_16_9", "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"
];
// Valid output formats
const VALID_OUTPUT_FORMATS = ["jpeg", "png"];
// Valid acceleration levels
const VALID_ACCELERATION_LEVELS = ["none", "regular", "high"];
/**
 * Download an image from a URL and save it locally
 */
async function downloadImage(url, filename) {
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
                fs.unlink(filePath, () => { }); // Delete the file on error
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
function generateImageFilename(prompt, index, timestamp) {
    // Create a safe filename from the prompt
    const safePrompt = prompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
    const timeStr = timestamp || new Date().toISOString().replace(/[:.]/g, '-');
    return `qwen_image_${safePrompt}_${index}_${timeStr}.jpg`;
}
/**
 * Create an MCP server with image generation capabilities
 */
const server = new Server({
    name: "qwen-image-fal-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
/**
 * Handler that lists available tools for image generation
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "generate_image",
                description: "Generate images using Qwen Image model via fal.ai. Supports complex text rendering, precise image editing, and high-quality image generation from text prompts.",
                inputSchema: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "The text prompt used to generate the image. Be descriptive for best results."
                        },
                        image_size: {
                            type: "string",
                            enum: VALID_IMAGE_SIZES,
                            description: "The size of the generated image.",
                            default: "landscape_4_3"
                        },
                        num_inference_steps: {
                            type: "integer",
                            description: "The number of inference steps to perform. More steps generally produce higher quality images but take longer.",
                            minimum: 2,
                            maximum: 250,
                            default: 30
                        },
                        seed: {
                            type: "integer",
                            description: "Random seed for reproducible results. Same seed with same prompt will produce the same image."
                        },
                        guidance_scale: {
                            type: "number",
                            description: "CFG scale - how closely the model should follow the prompt. Higher values stick closer to prompt.",
                            minimum: 0,
                            maximum: 20,
                            default: 2.5
                        },
                        sync_mode: {
                            type: "boolean",
                            description: "If true, waits for image generation to complete before returning. Increases latency but provides direct response.",
                            default: false
                        },
                        num_images: {
                            type: "integer",
                            description: "Number of images to generate.",
                            minimum: 1,
                            maximum: 4,
                            default: 1
                        },
                        enable_safety_checker: {
                            type: "boolean",
                            description: "Enable safety checker to filter inappropriate content.",
                            default: true
                        },
                        output_format: {
                            type: "string",
                            enum: VALID_OUTPUT_FORMATS,
                            description: "Output image format.",
                            default: "png"
                        },
                        negative_prompt: {
                            type: "string",
                            description: "Negative prompt to specify what should not be in the image.",
                            default: ""
                        },
                        acceleration: {
                            type: "string",
                            enum: VALID_ACCELERATION_LEVELS,
                            description: "Acceleration level for faster generation. 'regular' balances speed and quality, 'high' recommended for images without text.",
                            default: "none"
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
                if (!FAL_KEY) {
                    return {
                        content: [{
                                type: "text",
                                text: "Error: FAL_KEY environment variable is not set. Please configure your fal.ai API key."
                            }],
                        isError: true
                    };
                }
                const params = (request.params.arguments || {});
                if (!params.prompt || typeof params.prompt !== 'string') {
                    throw new Error("Prompt is required and must be a string");
                }
                // Validate image_size if provided
                if (params.image_size && !VALID_IMAGE_SIZES.includes(params.image_size)) {
                    throw new Error(`Invalid image_size. Must be one of: ${VALID_IMAGE_SIZES.join(', ')}`);
                }
                // Validate output_format if provided
                if (params.output_format && !VALID_OUTPUT_FORMATS.includes(params.output_format)) {
                    throw new Error(`Invalid output_format. Must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`);
                }
                // Validate acceleration if provided
                if (params.acceleration && !VALID_ACCELERATION_LEVELS.includes(params.acceleration)) {
                    throw new Error(`Invalid acceleration. Must be one of: ${VALID_ACCELERATION_LEVELS.join(', ')}`);
                }
                // Validate numeric parameters
                if (params.num_inference_steps && (params.num_inference_steps < 2 || params.num_inference_steps > 250)) {
                    throw new Error("num_inference_steps must be between 2 and 250");
                }
                if (params.guidance_scale && (params.guidance_scale < 0 || params.guidance_scale > 20)) {
                    throw new Error("guidance_scale must be between 0 and 20");
                }
                if (params.num_images && (params.num_images < 1 || params.num_images > 4)) {
                    throw new Error("num_images must be between 1 and 4");
                }
                // Prepare the input payload for fal.ai
                const input = {
                    prompt: params.prompt,
                    image_size: params.image_size || "landscape_4_3",
                    num_inference_steps: params.num_inference_steps || 30,
                    guidance_scale: params.guidance_scale || 2.5,
                    sync_mode: params.sync_mode || false,
                    num_images: params.num_images || 1,
                    enable_safety_checker: params.enable_safety_checker !== false,
                    output_format: params.output_format || "png",
                    negative_prompt: params.negative_prompt || "",
                    acceleration: params.acceleration || "none"
                };
                // Add seed if provided
                if (params.seed !== undefined) {
                    input.seed = params.seed;
                }
                log('info', `Generating image(s) with prompt: "${params.prompt}"`);
                log('debug', 'Generation parameters', input);
                const startTime = Date.now();
                try {
                    // Call the Qwen Image model on fal.ai with timeout
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT);
                    });
                    const generationPromise = fal.subscribe("fal-ai/qwen-image", {
                        input,
                        logs: true,
                        onQueueUpdate: (update) => {
                            if (update.status === "IN_PROGRESS") {
                                update.logs?.map((logEntry) => logEntry.message).forEach((message) => {
                                    log('debug', `Generation progress: ${message}`);
                                });
                            }
                        },
                    });
                    const result = await Promise.race([generationPromise, timeoutPromise]);
                    const output = result.data;
                    const generationTime = Date.now() - startTime;
                    log('info', `Image(s) generated successfully in ${generationTime}ms`);
                    if (!output || !output.images || output.images.length === 0) {
                        throw new Error("No images were generated - empty response from fal.ai");
                    }
                    // Download images locally
                    log('debug', `Downloading ${output.images.length} image(s) locally...`);
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const downloadedImages = [];
                    for (let i = 0; i < output.images.length; i++) {
                        const image = output.images[i];
                        if (!image.url || typeof image.url !== 'string' || !image.url.startsWith('http')) {
                            log('warn', `Invalid image URL at index ${i}: ${image.url}`);
                            continue;
                        }
                        try {
                            const filename = generateImageFilename(params.prompt, i, timestamp);
                            const localPath = await downloadImage(image.url, filename);
                            downloadedImages.push({
                                url: image.url,
                                localPath,
                                index: i,
                                width: image.width,
                                height: image.height
                            });
                            log('info', `Image ${i + 1} downloaded successfully: ${filename}`);
                        }
                        catch (downloadError) {
                            log('warn', `Failed to download image ${i + 1}: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
                            downloadedImages.push({
                                url: image.url,
                                localPath: '',
                                index: i,
                                width: image.width,
                                height: image.height
                            });
                        }
                    }
                    // Format response
                    const imageDetails = downloadedImages.map(img => {
                        if (img.localPath) {
                            return `• Image ${img.index + 1} (${img.width}x${img.height}): ${img.localPath} (${img.url})`;
                        }
                        else {
                            return `• Image ${img.index + 1} (${img.width}x${img.height}): Download failed - ${img.url}`;
                        }
                    }).join('\n');
                    const successfulDownloads = downloadedImages.filter(img => img.localPath).length;
                    const nsfwWarning = output.has_nsfw_concepts && output.has_nsfw_concepts.some(Boolean) ?
                        '\n⚠️ **Content Warning**: Some generated images may contain NSFW content.' : '';
                    return {
                        content: [
                            {
                                type: "text",
                                text: `✅ Successfully generated ${output.images.length} image(s) using Qwen Image:

📝 **Generation Details:**
• Prompt: "${output.prompt}"
• Image Size: ${input.image_size}
• Inference Steps: ${input.num_inference_steps}
• Guidance Scale: ${input.guidance_scale}
• Seed Used: ${output.seed}
• Output Format: ${input.output_format}
• Acceleration: ${input.acceleration}
• Safety Checker: ${input.enable_safety_checker ? 'Enabled' : 'Disabled'}
• Generation Time: ${generationTime}ms
• Request ID: ${result.requestId}

🖼️ **Generated Images (${output.images.length} total, ${successfulDownloads} downloaded):**
${imageDetails}

💾 ${successfulDownloads > 0 ? 'Images have been downloaded to the local \'images\' directory.' : 'Images are available at the URLs above.'}${nsfwWarning}`
                            }
                        ]
                    };
                }
                catch (apiError) {
                    const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
                    log('error', `fal.ai API error: ${errorMessage}`);
                    // Provide helpful error messages based on common issues
                    let helpfulMessage = '';
                    if (errorMessage.includes('timeout')) {
                        helpfulMessage = '\n💡 **Tip:** Try a simpler prompt or increase the timeout setting.';
                    }
                    else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
                        helpfulMessage = '\n💡 **Tip:** Check your FAL_KEY is valid and has sufficient credits.';
                    }
                    else if (errorMessage.includes('rate limit')) {
                        helpfulMessage = '\n💡 **Tip:** You\'ve hit the rate limit. Please wait a moment before trying again.';
                    }
                    else if (errorMessage.includes('validation')) {
                        helpfulMessage = '\n💡 **Tip:** Check your input parameters are within valid ranges.';
                    }
                    throw new Error(`Failed to generate image(s): ${errorMessage}${helpfulMessage}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                log('error', `Image generation failed: ${errorMessage}`);
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ **Error generating image(s):**

${errorMessage}

🔧 **Troubleshooting:**
• Verify your FAL_KEY is set and valid
• Check your internet connection
• Ensure your fal.ai account has sufficient credits
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
    log('info', "Qwen Image fal.ai MCP server running on stdio");
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
