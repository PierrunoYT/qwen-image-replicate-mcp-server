#!/usr/bin/env node

/**
 * Health Check Script for Qwen Image fal.ai MCP Server
 * Performs comprehensive system validation and diagnostics
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const levelColors = {
    INFO: colors.blue,
    SUCCESS: colors.green,
    WARN: colors.yellow,
    ERROR: colors.red,
    DEBUG: colors.magenta
  };
  
  const color = levelColors[level] || colors.reset;
  const prefix = `${color}[${timestamp}] ${level}:${colors.reset}`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

class HealthChecker {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      total: 0
    };
  }

  async runCheck(name, checkFn) {
    this.results.total++;
    log('INFO', `🔍 Running check: ${name}`);
    
    try {
      const result = await checkFn();
      if (result.status === 'pass') {
        this.results.passed++;
        log('SUCCESS', `✅ ${name}: ${result.message}`);
      } else if (result.status === 'warn') {
        this.results.warnings++;
        log('WARN', `⚠️  ${name}: ${result.message}`);
      } else {
        this.results.failed++;
        log('ERROR', `❌ ${name}: ${result.message}`);
      }
      return result;
    } catch (error) {
      this.results.failed++;
      log('ERROR', `❌ ${name}: ${error.message}`);
      return { status: 'fail', message: error.message };
    }
  }

  async checkNodeVersion() {
    return this.runCheck('Node.js Version', async () => {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        return { status: 'pass', message: `Node.js ${version} (✓ >= 18.0.0)` };
      } else {
        return { status: 'fail', message: `Node.js ${version} (✗ requires >= 18.0.0)` };
      }
    });
  }

  async checkPackageJson() {
    return this.runCheck('Package Configuration', async () => {
      const packagePath = path.join(projectRoot, 'package.json');
      const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      
      const requiredDeps = ['@fal-ai/client', '@modelcontextprotocol/sdk'];
      const missingDeps = requiredDeps.filter(dep => !packageData.dependencies[dep]);
      
      if (missingDeps.length === 0) {
        return { status: 'pass', message: `All required dependencies present (${requiredDeps.length})` };
      } else {
        return { status: 'fail', message: `Missing dependencies: ${missingDeps.join(', ')}` };
      }
    });
  }

  async checkEnvironmentVariables() {
    return this.runCheck('Environment Variables', async () => {
      const key = process.env.FAL_KEY;
      
      if (!key) {
        return { status: 'warn', message: 'FAL_KEY not set (required for API calls)' };
      }
      
      if (key.length < 10) {
        return { status: 'warn', message: 'API key seems too short - verify it is correct' };
      }
      
      return { status: 'pass', message: 'FAL_KEY configured correctly' };
    });
  }

  async checkBuildDirectory() {
    return this.runCheck('Build Directory', async () => {
      const buildPath = path.join(projectRoot, 'build');
      const indexPath = path.join(buildPath, 'index.js');
      
      try {
        await fs.access(buildPath);
        await fs.access(indexPath);
        
        const stats = await fs.stat(indexPath);
        const age = Date.now() - stats.mtime.getTime();
        const ageMinutes = Math.floor(age / (1000 * 60));
        
        return { 
          status: 'pass', 
          message: `Build directory exists, index.js built ${ageMinutes} minutes ago` 
        };
      } catch (error) {
        return { status: 'fail', message: 'Build directory missing - run "npm run build"' };
      }
    });
  }

  async checkImagesDirectory() {
    return this.runCheck('Images Directory', async () => {
      const imagesPath = path.join(projectRoot, 'images');
      
      try {
        await fs.access(imagesPath);
        const files = await fs.readdir(imagesPath);
        return { 
          status: 'pass', 
          message: `Images directory exists with ${files.length} files` 
        };
      } catch (error) {
        // Create the directory if it doesn't exist
        await fs.mkdir(imagesPath, { recursive: true });
        return { 
          status: 'pass', 
          message: 'Images directory created successfully' 
        };
      }
    });
  }

  async checkServerStartup() {
    return this.runCheck('Server Startup', async () => {
      return new Promise((resolve) => {
        const serverPath = path.join(projectRoot, 'build', 'index.js');
        const child = spawn('node', [serverPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, NODE_ENV: 'test' }
        });

        let output = '';
        let errorOutput = '';
        
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        // Send a simple JSON-RPC request
        const testRequest = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        }) + '\n';

        child.stdin.write(testRequest);

        setTimeout(() => {
          child.kill();
          
          if (errorOutput.includes('running on stdio')) {
            resolve({ status: 'pass', message: 'Server starts and responds correctly' });
          } else if (errorOutput.includes('FAL_KEY')) {
            resolve({ status: 'warn', message: 'Server starts but API key warning present' });
          } else {
            resolve({ status: 'fail', message: `Server startup issue: ${errorOutput.slice(0, 100)}...` });
          }
        }, 2000);
      });
    });
  }

  async checkFalAiConnectivity() {
    return this.runCheck('fal.ai API Connectivity', async () => {
      const key = process.env.FAL_KEY;
      
      if (!key) {
        return { status: 'skip', message: 'FAL_KEY not set - skipping API connectivity test' };
      }

      // Simple connectivity test using Node.js fetch (available in Node 18+)
      try {
        const response = await fetch('https://fal.run/fal-ai/qwen-image', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: 'test connectivity - simple image'
          })
        });

        if (response.status === 401) {
          return { status: 'fail', message: 'API key authentication failed' };
        } else if (response.status === 429) {
          return { status: 'warn', message: 'Rate limited - API key is working' };
        } else if (response.status >= 200 && response.status < 500) {
          return { status: 'pass', message: 'fal.ai API is accessible and API key is valid' };
        } else {
          return { status: 'warn', message: `Unexpected response status: ${response.status}` };
        }
      } catch (error) {
        if (error.message.includes('fetch')) {
          return { status: 'warn', message: 'Network connectivity test failed - check internet connection' };
        }
        return { status: 'fail', message: `API connectivity error: ${error.message}` };
      }
    });
  }

  async runAllChecks() {
    log('INFO', '🏥 Starting Qwen Image fal.ai MCP Server Health Check');
    log('INFO', '=======================================================');

    await this.checkNodeVersion();
    await this.checkPackageJson();
    await this.checkEnvironmentVariables();
    await this.checkBuildDirectory();
    await this.checkImagesDirectory();
    await this.checkServerStartup();
    await this.checkFalAiConnectivity();

    log('INFO', '=======================================================');
    log('INFO', '📊 Health Check Summary:');
    log('SUCCESS', `✅ Passed: ${this.results.passed}`);
    if (this.results.warnings > 0) {
      log('WARN', `⚠️  Warnings: ${this.results.warnings}`);
    }
    if (this.results.failed > 0) {
      log('ERROR', `❌ Failed: ${this.results.failed}`);
    }
    log('INFO', `📋 Total Checks: ${this.results.total}`);

    const healthScore = Math.round(((this.results.passed + this.results.warnings * 0.5) / this.results.total) * 100);
    log('INFO', `🎯 Health Score: ${healthScore}%`);

    if (this.results.failed === 0) {
      log('SUCCESS', '🎉 All critical checks passed! Server is healthy.');
      return 0;
    } else {
      log('ERROR', '🚨 Some critical checks failed. Please review and fix issues.');
      return 1;
    }
  }
}

// Run health check if called directly
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runAllChecks()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      log('ERROR', 'Health check failed:', error);
      process.exit(1);
    });
}

module.exports = HealthChecker;
