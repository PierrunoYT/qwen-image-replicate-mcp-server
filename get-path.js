#!/usr/bin/env node

/**
 * Comprehensive Path Helper for SeedDream 4.0 Replicate MCP Server
 *
 * Features:
 * - Get absolute path for MCP configuration
 * - Generate complete configuration examples
 * - Validate environment setup
 * - Check system requirements
 * - Provide deployment options
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { platform, arch, version } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color utilities
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(icon, message, color = 'white') {
  console.log(`${icon} ${colorize(message, color)}`);
}

function logSection(title) {
  console.log(`\n${colorize('='.repeat(60), 'cyan')}`);
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('='.repeat(60), 'cyan'));
}

class PathHelper {
  constructor() {
    this.buildPath = join(__dirname, 'build', 'index.js');
    this.packagePath = join(__dirname, 'package.json');
    this.configPath = join(__dirname, 'config', 'server.config.json');
    this.exampleConfigPath = join(__dirname, 'example-config.json');
  }

  async run() {
    logSection('SeedDream 4.0 Replicate MCP Server - Path Helper');
    
    this.checkSystemRequirements();
    this.validateEnvironment();
    this.showPaths();
    this.generateConfigurations();
    this.showDeploymentOptions();
    this.showTroubleshooting();
  }

  checkSystemRequirements() {
    logSection('System Requirements Check');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 16) {
      log('✅', `Node.js version: ${nodeVersion}`, 'green');
    } else {
      log('❌', `Node.js version: ${nodeVersion} (requires 16+)`, 'red');
    }
    
    // Check platform
    log('ℹ️', `Platform: ${platform()} ${arch()}`, 'blue');
    
    // Check package.json
    if (existsSync(this.packagePath)) {
      try {
        const pkg = JSON.parse(readFileSync(this.packagePath, 'utf8'));
        log('✅', `Package: ${pkg.name} v${pkg.version}`, 'green');
      } catch (error) {
        log('❌', 'Invalid package.json', 'red');
      }
    } else {
      log('❌', 'package.json not found', 'red');
    }
  }

  validateEnvironment() {
    logSection('Environment Validation');
    
    // Check build file
    if (existsSync(this.buildPath)) {
      log('✅', 'Build file exists', 'green');
    } else {
      log('❌', 'Build file not found', 'red');
      log('💡', 'Run: npm run build', 'yellow');
    }
    
    // Check configuration files
    if (existsSync(this.configPath)) {
      log('✅', 'Server configuration found', 'green');
    } else {
      log('⚠️', 'Server configuration not found (optional)', 'yellow');
    }
    
    if (existsSync(this.exampleConfigPath)) {
      log('✅', 'Example configuration found', 'green');
    } else {
      log('❌', 'Example configuration not found', 'red');
    }
    
    // Check environment variables
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      if (replicateToken.startsWith('r8_')) {
        log('✅', 'REPLICATE_API_TOKEN is set and valid format', 'green');
      } else {
        log('⚠️', 'REPLICATE_API_TOKEN format may be invalid', 'yellow');
      }
    } else {
      log('⚠️', 'REPLICATE_API_TOKEN not set', 'yellow');
    }
  }

  showPaths() {
    logSection('File Paths');
    
    log('📁', `Build path: ${this.buildPath}`, 'cyan');
    log('📄', `Package: ${this.packagePath}`, 'cyan');
    log('⚙️', `Config: ${this.configPath}`, 'cyan');
    log('📋', `Example: ${this.exampleConfigPath}`, 'cyan');
    
    if (!existsSync(this.buildPath)) {
      log('💡', 'Build the project first: npm run build', 'yellow');
      return;
    }
  }

  generateConfigurations() {
    logSection('MCP Configuration Examples');
    
    if (!existsSync(this.buildPath)) {
      log('❌', 'Cannot generate configurations - build file missing', 'red');
      return;
    }

    // Basic configuration
    const basicConfig = {
      mcpServers: {
        seedream: {
          command: "node",
          args: [this.buildPath],
          env: {
            REPLICATE_API_TOKEN: "r8_your_replicate_token_here"
          },
          disabled: false,
          alwaysAllow: []
        }
      }
    };

    // Development configuration
    const devConfig = {
      mcpServers: {
        seedream: {
          command: "node",
          args: [this.buildPath],
          env: {
            REPLICATE_API_TOKEN: "r8_your_replicate_token_here",
            NODE_ENV: "development",
            LOG_LEVEL: "debug"
          },
          disabled: false,
          alwaysAllow: []
        }
      }
    };

    // Production configuration
    const prodConfig = {
      mcpServers: {
        seedream: {
          command: "node",
          args: [this.buildPath],
          env: {
            REPLICATE_API_TOKEN: "r8_your_replicate_token_here",
            NODE_ENV: "production",
            LOG_LEVEL: "info",
            MAX_CONCURRENT_REQUESTS: "3"
          },
          disabled: false,
          alwaysAllow: ["generate_image"],
          timeout: 300000
        }
      }
    };

    console.log('\n' + colorize('Basic Configuration:', 'bright'));
    console.log(JSON.stringify(basicConfig, null, 2));

    console.log('\n' + colorize('Development Configuration:', 'bright'));
    console.log(JSON.stringify(devConfig, null, 2));

    console.log('\n' + colorize('Production Configuration:', 'bright'));
    console.log(JSON.stringify(prodConfig, null, 2));

    // Save configurations to files
    try {
      writeFileSync('mcp-config-basic.json', JSON.stringify(basicConfig, null, 2));
      writeFileSync('mcp-config-dev.json', JSON.stringify(devConfig, null, 2));
      writeFileSync('mcp-config-prod.json', JSON.stringify(prodConfig, null, 2));
      log('💾', 'Configuration files saved:', 'green');
      log('  ', '• mcp-config-basic.json', 'white');
      log('  ', '• mcp-config-dev.json', 'white');
      log('  ', '• mcp-config-prod.json', 'white');
    } catch (error) {
      log('❌', `Failed to save configuration files: ${error.message}`, 'red');
    }
  }

  showDeploymentOptions() {
    logSection('Deployment Options');
    
    log('🏠', 'Local Installation (Current):', 'bright');
    log('  ', `Path: ${this.buildPath}`, 'white');
    log('  ', 'Pros: Full control, custom configuration', 'green');
    log('  ', 'Cons: Manual updates, path-dependent', 'yellow');
    
    log('\n📦', 'NPX Deployment (Recommended):', 'bright');
    log('  ', 'Command: npx -y https://github.com/PierrunoYT/seedream-v4-replicate-mcp-server.git', 'white');
    log('  ', 'Pros: Auto-updates, universal, no local install', 'green');
    log('  ', 'Cons: Requires internet, less control', 'yellow');
    
    log('\n🐳', 'Docker Deployment:', 'bright');
    log('  ', 'Command: docker run -e REPLICATE_API_TOKEN=token seedream-replicate-mcp', 'white');
    log('  ', 'Pros: Isolated, consistent environment', 'green');
    log('  ', 'Cons: Docker overhead, more complex setup', 'yellow');
  }

  showTroubleshooting() {
    logSection('Troubleshooting Guide');
    
    log('🔧', 'Common Issues & Solutions:', 'bright');
    
    log('\n❓', 'Server not appearing in MCP client:', 'yellow');
    log('  ', '• Check absolute path is correct', 'white');
    log('  ', '• Verify build exists (npm run build)', 'white');
    log('  ', '• Restart MCP client after config changes', 'white');
    log('  ', '• Check file permissions', 'white');
    
    log('\n❓', 'API token errors:', 'yellow');
    log('  ', '• Get token from https://replicate.com/account', 'white');
    log('  ', '• Verify token starts with "r8_"', 'white');
    log('  ', '• Check token has sufficient credits', 'white');
    log('  ', '• Ensure token is in environment variables', 'white');
    
    log('\n❓', 'Generation timeouts:', 'yellow');
    log('  ', '• Increase timeout in configuration', 'white');
    log('  ', '• Check internet connection', 'white');
    log('  ', '• Try simpler prompts', 'white');
    log('  ', '• Verify Replicate service status', 'white');
    
    log('\n🆘', 'Getting Help:', 'bright');
    log('  ', '• GitHub Issues: https://github.com/PierrunoYT/seedream-v4-replicate-mcp-server/issues', 'white');
    log('  ', '• Run health check: npm run test:server --health-check', 'white');
    log('  ', '• Check logs in logs/ directory', 'white');
  }
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colorize('SeedDream 4.0 Replicate MCP Server - Path Helper', 'bright')}

Usage:
  node get-path.js [options]

Options:
  --help, -h     Show this help message
  --json         Output only JSON configuration
  --basic        Generate basic configuration only
  --save         Save configurations to files

Examples:
  node get-path.js
  node get-path.js --json
  node get-path.js --basic --save
`);
  process.exit(0);
}

// Run the path helper
const helper = new PathHelper();

if (args.includes('--json')) {
  // JSON-only output
  if (existsSync(helper.buildPath)) {
    const config = {
      mcpServers: {
        seedream: {
          command: "node",
          args: [helper.buildPath],
          env: {
            REPLICATE_API_TOKEN: "r8_your_replicate_token_here"
          }
        }
      }
    };
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.error('Build file not found. Run: npm run build');
    process.exit(1);
  }
} else {
  // Full interactive mode
  helper.run().catch(console.error);
}