#!/usr/bin/env node

/**
 * Build script for Video Reader MCP Extension
 * 
 * This script:
 * 1. Compiles the extension TypeScript
 * 2. Bundles the MCP server into the extension
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const EXTENSION_DIR = path.resolve(__dirname, '..');
const MCP_SERVER_DIR = path.join(EXTENSION_DIR, 'mcp-server');

function log(message) {
    console.log(`[build] ${message}`);
}

function errorExit(message) {
    console.error(`[build] ERROR: ${message}`);
    process.exit(1);
}

function build() {
    log('Starting build process...');
    log(`ROOT_DIR: ${ROOT_DIR}`);
    log(`EXTENSION_DIR: ${EXTENSION_DIR}`);

    // Step 1: Build the main MCP server
    log('Building main MCP server...');
    try {
        execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (e) {
        errorExit('Failed to build MCP server: ' + e.message);
    }

    // Step 2: Create mcp-server directory
    log('Preparing mcp-server directory...');
    if (fs.existsSync(MCP_SERVER_DIR)) {
        fs.rmSync(MCP_SERVER_DIR, { recursive: true });
    }
    fs.mkdirSync(MCP_SERVER_DIR, { recursive: true });

    // Step 3: Copy compiled MCP server files
    log('Copying MCP server files...');
    const buildDir = path.join(ROOT_DIR, 'build');
    const filesToCopy = [
        'index.js',
        'index.d.ts',
        'video-processor.js',
        'video-processor.d.ts',
        'types.js',
        'types.d.ts'
    ];

    for (const file of filesToCopy) {
        const src = path.join(buildDir, file);
        const dest = path.join(MCP_SERVER_DIR, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            log(`  Copied ${file}`);
        } else {
            log(`  Warning: ${file} not found, skipping`);
        }
    }

    // Step 4: Create package.json for the bundled server
    log('Creating mcp-server package.json...');
    const serverPackageJson = {
        name: "video-reader-mcp-server",
        version: "1.0.0",
        description: "Bundled MCP server for video analysis",
        main: "index.js",
        type: "module",
        dependencies: {
            "@modelcontextprotocol/sdk": "^1.0.4",
            "@ffmpeg-installer/ffmpeg": "^1.1.0",
            "@ffprobe-installer/ffprobe": "^2.1.2",
            "fluent-ffmpeg": "^2.1.3",
            "sharp": "^0.33.5"
        }
    };

    fs.writeFileSync(
        path.join(MCP_SERVER_DIR, 'package.json'),
        JSON.stringify(serverPackageJson, null, 2)
    );

    // Step 5: Install MCP server dependencies
    log('Installing MCP server dependencies...');
    try {
        execSync('npm install --omit=dev', { cwd: MCP_SERVER_DIR, stdio: 'inherit' });
    } catch (e) {
        errorExit('Failed to install MCP server dependencies: ' + e.message);
    }

    // Step 6: Build the extension
    log('Building extension TypeScript...');
    try {
        execSync('npx tsc', { cwd: EXTENSION_DIR, stdio: 'inherit' });
    } catch (e) {
        errorExit('Failed to compile extension TypeScript: ' + e.message);
    }

    log('Build completed successfully!');
    log('');
    log('Next steps:');
    log('  1. Press F5 in VS Code to test the extension');
    log('  2. Run "npm run package" to create a .vsix file');
}

build();
