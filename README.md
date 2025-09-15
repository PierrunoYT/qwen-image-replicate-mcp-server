# Qwen Image Replicate MCP Server

A Model Context Protocol (MCP) server that provides image generation capabilities using Alibaba's Qwen Image model via the Replicate platform.

## Features

Qwen Image is an advanced text-to-image foundation model that excels at:

- **Complex text rendering** with accurate text layout in generated images
- **Precise image editing** capabilities
- **High-quality image generation** from detailed text prompts
- **Multiple image sizes and aspect ratios** support
- **Advanced guidance controls** for fine-tuning results

## Available Tools

### `generate_image`
Generate high-quality images from text prompts using Qwen Image via Replicate.

**Parameters:**
- `prompt` (required): Text description of the image to generate (supports detailed prompts)
- `image_size` (optional): Image size/aspect ratio - one of: `1024x1024`, `720x1280`, `1280x720`, `768x1024`, `1024x768` (default: `1024x768`)
- `num_inference_steps` (optional): Number of inference steps, higher = better quality but slower (1-500, default: 50)
- `seed` (optional): Random seed for reproducible results (0-2147483647)
- `guidance_scale` (optional): CFG scale - how closely to follow the prompt (1-20, default: 4)
- `negative_prompt` (optional): Specify what should NOT be in the image (default: "")

## Installation

### Prerequisites

1. **Replicate API Key**: Get your API key from [Replicate](https://replicate.com/account)
   - Sign up for an account at https://replicate.com/
   - Navigate to your account settings and copy your API token
   - Keep this key secure as you'll need it for configuration

2. **Node.js**: Ensure you have Node.js installed (version 18 or higher)

### Quick Setup (Recommended)

The easiest way to use this server is through npx, which automatically downloads and runs the latest version:

#### For Claude Desktop App

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "qwen-image": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/PierrunoYT/qwen-image-fal-mcp-server.git"
      ],
      "env": {
        "REPLICATE_API_TOKEN": "your_replicate_token_here"
      }
    }
  }
}
```

#### For Kilo Code MCP Settings

Add to your MCP settings file at:
`C:\Users\[username]\AppData\Roaming\Code\User\globalStorage\kilocode.kilo-code\settings\mcp_settings.json`

```json
{
  "mcpServers": {
    "qwen-image": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/PierrunoYT/qwen-image-fal-mcp-server.git"
      ],
      "env": {
        "REPLICATE_API_TOKEN": "your_replicate_token_here"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

### Benefits of npx Configuration

✅ **Universal Access**: Works on any machine with Node.js
✅ **No Local Installation**: npx downloads and runs automatically
✅ **Always Latest Version**: Pulls from GitHub repository
✅ **Cross-Platform**: Windows, macOS, Linux compatible
✅ **Settings Sync**: Works everywhere you use your MCP client

### Manual Installation (Alternative)

If you prefer to install locally:

1. **Clone the repository**
   ```bash
   git clone https://github.com/PierrunoYT/qwen-image-fal-mcp-server.git
   cd qwen-image-fal-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the server**
   ```bash
   npm run build
   ```

4. **Use absolute path in configuration**
   ```json
   {
     "mcpServers": {
       "qwen-image": {
         "command": "node",
         "args": ["/absolute/path/to/qwen-image-fal-mcp-server/build/index.js"],
         "env": {
           "REPLICATE_API_TOKEN": "your_replicate_token_here"
         }
       }
     }
   }
   ```

**Helper script to get the absolute path:**
```bash
npm run get-path
```

## Usage Examples

Once configured, you can use the server through your MCP client:

### Basic Image Generation
```
Generate an image of a serene mountain landscape at sunset with a lake reflection
```

### Complex Text Rendering
```
Create a vintage poster with the text "Welcome to AI Art" in ornate lettering, art deco style
```

### Specific Image Size
```
Generate a portrait-oriented image of a futuristic cityscape (1024x768)
```

### High-Quality Generation
```
Generate a photorealistic portrait with 50 inference steps and guidance scale 7.5
```

### Advanced Parameters
```
Create a detailed fantasy landscape with negative prompt "blurry, low quality" and seed 12345 for reproducibility
```

## API Response Format

The server returns detailed information about generated images:

```
✅ Successfully generated 1 image(s) using Qwen Image:

📝 **Generation Details:**
• Prompt: "a serene mountain landscape at sunset"
• Image Size: 1024x768
• Inference Steps: 50
• Guidance Scale: 4
• Seed Used: 1234567890
• Generation Time: 4500ms

🖼️ **Generated Images (1 total, 1 downloaded):**
• Image 1: ./images/qwen_image_mountain_landscape_0_2024-01-15T10-30-45.webp (https://replicate.delivery/...)

💾 Images have been downloaded to the local 'images' directory.
```

## Development

### Local Testing
```bash
# Test the server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node build/index.js
```

### Watch Mode
```bash
npm run watch
```

### Run Test Server
```bash
npm run test:server
```

### Health Check
```bash
npm run health-check
```

### Inspector Tool
```bash
npm run inspector
```

## Environment Variables

### Required
- `REPLICATE_API_TOKEN`: Your Replicate API key (required for image generation)

### Optional
- `NODE_ENV`: Environment mode (`development`, `production`, `test`) - default: `production`
- `LOG_LEVEL`: Logging level (`error`, `warn`, `info`, `debug`) - default: `info`
- `MAX_CONCURRENT_REQUESTS`: Maximum concurrent requests (1-10) - default: 3
- `REQUEST_TIMEOUT`: Request timeout in milliseconds (30000-600000) - default: 300000

## Troubleshooting

### Common Issues

1. **"REPLICATE_API_TOKEN environment variable is required"**
   - The server will continue running and show this helpful error message
   - Ensure your Replicate API key is properly set in the MCP configuration
   - Verify the key is valid and has sufficient credits
   - **Note**: The server no longer crashes when the API key is missing

2. **"Server not showing up in Claude"**
   - If using npx configuration, ensure you have Node.js installed (v18+)
   - For manual installation, check that the absolute path is correct
   - Restart Claude Desktop after configuration changes
   - Verify the JSON configuration syntax is valid

3. **"Generation failed"**
   - Check your Replicate account has sufficient credits
   - Verify your API key has the necessary permissions
   - Try with a simpler prompt to test connectivity
   - Check if the image size and parameters are valid

4. **"npx command not found"**
   - Ensure Node.js is properly installed
   - Try running `node --version` and `npm --version` to verify installation

### Server Stability Improvements

✅ **Robust Error Handling**: Server continues running even without API key
✅ **Graceful Shutdown**: Proper handling of SIGINT and SIGTERM signals
✅ **User-Friendly Messages**: Clear error messages with setup instructions
✅ **No More Crashes**: Eliminated `process.exit()` calls that caused connection drops
✅ **Local Image Storage**: Downloads generated images for offline access

### Debug Logging

The server outputs debug information to stderr, which can help diagnose issues:
- Generation progress updates
- Error messages with helpful instructions
- API call details
- Graceful shutdown notifications

### Performance Tips

- Lower `num_inference_steps` for faster generation (try 20-25)
- Cache results using the `seed` parameter for reproducibility

## Pricing

Image generation costs are determined by Replicate's pricing structure. Check [Replicate Pricing](https://replicate.com/pricing) for current rates.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues related to:
- **This MCP server**: Open an issue in this repository
- **Replicate API**: Contact Replicate support
- **Qwen Image model**: Refer to Replicate documentation

## Changelog

### v1.1.0 (Latest)
- **🚀 Switched to Replicate**: Migrated from fal.ai to Replicate for image generation.
- **🔧 Updated Dependencies**: Replaced `@fal-ai/client` with `replicate`.
- **⚙️ Simplified Parameters**: Removed fal.ai-specific parameters like `sync_mode`, `acceleration`, `output_format`, etc.
- **📝 Updated Documentation**: All documentation now reflects Replicate usage.

### v1.0.0
- **🎨 Qwen Image Integration**: Full implementation of Qwen Image model via fal.ai
- **🔧 Fixed connection drops**: Removed `process.exit()` calls that caused server crashes
- **🛡️ Improved error handling**: Server continues running even without API key
- **🌍 Added portability**: npx configuration works on any machine
- **📦 Enhanced stability**: Graceful shutdown handlers and null safety checks
- **💬 Better user experience**: Clear error messages with setup instructions
- **🔄 Auto-updating**: npx pulls latest version from GitHub automatically
- **📁 Local image storage**: Downloads generated images to local directory
- **🎯 Advanced parameters**: Support for all Qwen Image parameters including LoRAs
- **⚡ Performance optimization**: Configurable acceleration levels
- **🛡️ Safety features**: Built-in content safety checking

### v0.1.1
- Initial fal.ai integration
- Basic image generation functionality

### v0.1.0
- Initial release with placeholder implementation

## Additional Resources

- [Qwen Image Model on Replicate](https://replicate.com/qwen/qwen-image)
- [Replicate API Documentation](https://replicate.com/docs)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
