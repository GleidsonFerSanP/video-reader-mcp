#!/usr/bin/env node

/**
 * Platform-specific build script for Video Reader MCP Extension
 *
 * Creates optimized builds for each platform with only necessary binaries
 * Usage: node scripts/build-platform.js [platform]
 * Platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64, win32-ia32
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const EXTENSION_DIR = path.resolve(__dirname, "..");
const MCP_SERVER_DIR = path.join(EXTENSION_DIR, "mcp-server");

// Platform mapping
const PLATFORM_TARGETS = {
  "darwin-arm64": {
    os: "darwin",
    arch: "arm64",
    ffmpeg: "@ffmpeg-installer/darwin-arm64",
    ffprobe: "@ffprobe-installer/darwin-arm64",
  },
  "darwin-x64": {
    os: "darwin",
    arch: "x64",
    ffmpeg: "@ffmpeg-installer/darwin-x64",
    ffprobe: "@ffprobe-installer/darwin-x64",
  },
  "linux-x64": {
    os: "linux",
    arch: "x64",
    ffmpeg: "@ffmpeg-installer/linux-x64",
    ffprobe: "@ffprobe-installer/linux-x64",
  },
  "linux-arm64": {
    os: "linux",
    arch: "arm64",
    ffmpeg: "@ffmpeg-installer/linux-arm64",
    ffprobe: "@ffprobe-installer/linux-arm64",
  },
  "win32-x64": {
    os: "win32",
    arch: "x64",
    ffmpeg: "@ffmpeg-installer/win32-x64",
    ffprobe: "@ffprobe-installer/win32-x64",
  },
  "win32-ia32": {
    os: "win32",
    arch: "ia32",
    ffmpeg: "@ffmpeg-installer/win32-ia32",
    ffprobe: "@ffprobe-installer/win32-ia32",
  },
};

function log(message) {
  console.log(`[build-platform] ${message}`);
}

function errorExit(message) {
  console.error(`[build-platform] ERROR: ${message}`);
  process.exit(1);
}

function buildForPlatform(targetPlatform) {
  const platformConfig = PLATFORM_TARGETS[targetPlatform];
  if (!platformConfig) {
    errorExit(
      `Unknown platform: ${targetPlatform}. Available: ${Object.keys(PLATFORM_TARGETS).join(", ")}`,
    );
  }

  log(`Building for platform: ${targetPlatform}`);
  log(`  OS: ${platformConfig.os}, Arch: ${platformConfig.arch}`);
  log("");

  // Step 1: Build the main MCP server
  log("Building main MCP server...");
  try {
    execSync("npm run build", { cwd: ROOT_DIR, stdio: "inherit" });
  } catch (e) {
    errorExit("Failed to build MCP server: " + e.message);
  }

  // Step 2: Create mcp-server directory
  log("Preparing mcp-server directory...");
  if (fs.existsSync(MCP_SERVER_DIR)) {
    fs.rmSync(MCP_SERVER_DIR, { recursive: true });
  }
  fs.mkdirSync(MCP_SERVER_DIR, { recursive: true });

  // Step 3: Copy compiled MCP server files
  log("Copying MCP server files...");
  const buildDir = path.join(ROOT_DIR, "build");
  const filesToCopy = [
    "index.js",
    "index.d.ts",
    "video-processor.js",
    "video-processor.d.ts",
    "types.js",
    "types.d.ts",
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

  // Step 4: Create platform-specific package.json
  log(`Creating mcp-server package.json for ${targetPlatform}...`);
  const serverPackageJson = {
    name: "video-reader-mcp-server",
    version: "1.0.0",
    description: `Bundled MCP server for video analysis (${targetPlatform})`,
    main: "index.js",
    type: "module",
    dependencies: {
      "@modelcontextprotocol/sdk": "^1.0.4",
      "@ffmpeg-installer/ffmpeg": "^1.1.0",
      "@ffprobe-installer/ffprobe": "^2.1.2",
      "fluent-ffmpeg": "^2.1.3",
      openai: "^4.76.0",
      sharp: "^0.33.5",
    },
    // Add platform-specific dependencies
    optionalDependencies: {
      [platformConfig.ffmpeg]: "^4.1.0",
      [platformConfig.ffprobe]: "^2.1.0",
    },
  };

  fs.writeFileSync(
    path.join(MCP_SERVER_DIR, "package.json"),
    JSON.stringify(serverPackageJson, null, 2),
  );

  // Step 5: Install MCP server dependencies (including platform-specific)
  log("Installing MCP server dependencies...");
  try {
    execSync("npm install --omit=dev --include=optional", {
      cwd: MCP_SERVER_DIR,
      stdio: "inherit",
    });
  } catch (e) {
    errorExit("Failed to install MCP server dependencies: " + e.message);
  }

  // Step 6: Update extension package.json with target platform
  log("Updating extension package.json...");
  const extensionPackagePath = path.join(EXTENSION_DIR, "package.json");
  const extensionPackage = JSON.parse(
    fs.readFileSync(extensionPackagePath, "utf8"),
  );

  // Add platform-specific metadata
  const originalName = extensionPackage.name.replace(/-[a-z0-9]+-[a-z0-9]+$/, "");
  extensionPackage.name = `${originalName}-${targetPlatform}`;
  extensionPackage.displayName = `Video Reader MCP (${targetPlatform})`;

  fs.writeFileSync(
    extensionPackagePath,
    JSON.stringify(extensionPackage, null, 2),
  );

  // Step 7: Build the extension
  log("Building extension TypeScript...");
  try {
    execSync("npx tsc", { cwd: EXTENSION_DIR, stdio: "inherit" });
  } catch (e) {
    errorExit("Failed to compile extension TypeScript: " + e.message);
  }

  log("");
  log(`✅ Build completed successfully for ${targetPlatform}!`);
  log("");
  log("Next steps:");
  log(`  1. Run "npm run package" to create .vsix file`);
  log("  2. The generated file will be platform-specific");
  log("");
}

function buildAll() {
  log("Building for ALL platforms...");
  log("");

  const platforms = Object.keys(PLATFORM_TARGETS);
  for (const platform of platforms) {
    try {
      buildForPlatform(platform);
      log(`✅ ${platform} completed`);
      log("---");
    } catch (e) {
      log(`❌ ${platform} failed: ${e.message}`);
    }
  }

  log("");
  log("🎉 All platform builds completed!");
}

// Main
const args = process.argv.slice(2);
const targetPlatform = args[0];

if (!targetPlatform || targetPlatform === "all") {
  buildAll();
} else {
  buildForPlatform(targetPlatform);
}
