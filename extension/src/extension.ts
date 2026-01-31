import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Extension ID and name constants
const EXTENSION_ID = 'video-reader-mcp';
const EXTENSION_NAME = 'Video Reader MCP';
const MCP_SERVER_ID = 'video-reader-mcp';

// Output channel for logging
let outputChannel: vscode.OutputChannel;

/**
 * Gets the path to the bundled MCP server
 */
function getMcpServerPath(context: vscode.ExtensionContext): string {
    return path.join(context.extensionPath, 'mcp-server', 'index.js');
}

/**
 * Gets the path to the Copilot Chat MCP servers configuration file
 */
function getMcpServersConfigPath(): string {
    const platform = os.platform();
    let configDir: string;

    if (platform === 'darwin') {
        // macOS
        configDir = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'github.copilot-chat');
    } else if (platform === 'win32') {
        // Windows
        configDir = path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'github.copilot-chat');
    } else {
        // Linux
        configDir = path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'github.copilot-chat');
    }

    return path.join(configDir, 'mcpServers.json');
}

/**
 * Ensures the configuration directory exists
 */
function ensureConfigDir(configPath: string): void {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Reads the current MCP servers configuration
 */
function readMcpServersConfig(configPath: string): Record<string, any> {
    try {
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        outputChannel.appendLine(`Error reading MCP config: ${error}`);
    }
    return { servers: {} };
}

/**
 * Writes the MCP servers configuration
 */
function writeMcpServersConfig(configPath: string, config: Record<string, any>): void {
    ensureConfigDir(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Configures the MCP server in Copilot Chat configuration
 */
async function configureMcpServer(context: vscode.ExtensionContext): Promise<boolean> {
    const mcpServerPath = getMcpServerPath(context);
    const configPath = getMcpServersConfigPath();

    // Verify MCP server exists
    if (!fs.existsSync(mcpServerPath)) {
        outputChannel.appendLine(`MCP server not found at: ${mcpServerPath}`);
        vscode.window.showErrorMessage(`${EXTENSION_NAME}: MCP server not found. Please reinstall the extension.`);
        return false;
    }

    try {
        const config = readMcpServersConfig(configPath);
        
        // Initialize servers object if not exists
        if (!config.servers) {
            config.servers = {};
        }

        // Add or update video-reader-mcp server configuration
        config.servers[MCP_SERVER_ID] = {
            command: 'node',
            args: [mcpServerPath],
            env: {}
        };

        writeMcpServersConfig(configPath, config);
        
        outputChannel.appendLine(`MCP server configured successfully at: ${configPath}`);
        outputChannel.appendLine(`Server path: ${mcpServerPath}`);
        
        return true;
    } catch (error) {
        outputChannel.appendLine(`Error configuring MCP server: ${error}`);
        vscode.window.showErrorMessage(`${EXTENSION_NAME}: Failed to configure MCP server. Check output for details.`);
        return false;
    }
}

/**
 * Removes the MCP server configuration
 */
function removeMcpServerConfig(): void {
    const configPath = getMcpServersConfigPath();
    
    try {
        const config = readMcpServersConfig(configPath);
        
        if (config.servers && config.servers[MCP_SERVER_ID]) {
            delete config.servers[MCP_SERVER_ID];
            writeMcpServersConfig(configPath, config);
            outputChannel.appendLine('MCP server configuration removed');
        }
    } catch (error) {
        outputChannel.appendLine(`Error removing MCP config: ${error}`);
    }
}

/**
 * Shows the status of the MCP server
 */
async function showStatus(context: vscode.ExtensionContext): Promise<void> {
    const mcpServerPath = getMcpServerPath(context);
    const configPath = getMcpServersConfigPath();
    
    const serverExists = fs.existsSync(mcpServerPath);
    const config = readMcpServersConfig(configPath);
    const isConfigured = config.servers && config.servers[MCP_SERVER_ID];
    
    const statusMessage = [
        `${EXTENSION_NAME} Status:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Server File: ${serverExists ? '✅ Found' : '❌ Not found'}`,
        `Server Path: ${mcpServerPath}`,
        `Configuration: ${isConfigured ? '✅ Configured' : '❌ Not configured'}`,
        `Config Path: ${configPath}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        '',
        'Available Tools:',
        '• get_video_overview - Get video metadata and frame references',
        '• get_frame - Extract a single frame at timestamp',
        '• get_frames_batch - Extract multiple frames',
        '• extract_audio - Extract audio track',
        '• get_video_metadata - Get technical video specs',
        '• estimate_analysis_cost - Estimate token cost for analysis',
        '• analyze_video_full - Full video analysis (use sparingly)'
    ].join('\n');
    
    outputChannel.appendLine(statusMessage);
    outputChannel.show();
    
    const quickStatus = serverExists && isConfigured 
        ? `${EXTENSION_NAME}: ✅ Active and configured`
        : `${EXTENSION_NAME}: ⚠️ Issues detected - check output`;
    
    vscode.window.showInformationMessage(quickStatus);
}

/**
 * Opens the documentation
 */
async function openDocumentation(): Promise<void> {
    const docUrl = 'https://github.com/GleidsonFerSanP/video-reader-mcp#readme';
    await vscode.env.openExternal(vscode.Uri.parse(docUrl));
}

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Create output channel
    outputChannel = vscode.window.createOutputChannel(EXTENSION_NAME);
    context.subscriptions.push(outputChannel);
    
    outputChannel.appendLine(`${EXTENSION_NAME} is activating...`);
    
    // Register MCP Server Definition Provider (VS Code 1.99+ API)
    try {
        if (typeof vscode.lm?.registerMcpServerDefinitionProvider === 'function') {
            const mcpServerPath = getMcpServerPath(context);
            
            const provider = vscode.lm.registerMcpServerDefinitionProvider(MCP_SERVER_ID, {
                provideMcpServerDefinitions(): vscode.McpServerDefinition[] {
                    outputChannel.appendLine('Providing MCP server definition...');
                    return [
                        new vscode.McpStdioServerDefinition(
                            MCP_SERVER_ID,
                            'node',
                            [mcpServerPath]
                        )
                    ];
                }
            });
            
            context.subscriptions.push(provider);
            outputChannel.appendLine('MCP Server Definition Provider registered successfully');
        } else {
            outputChannel.appendLine('vscode.lm.registerMcpServerDefinitionProvider not available - using fallback configuration');
        }
    } catch (error) {
        outputChannel.appendLine(`Error registering MCP provider: ${error}`);
    }
    
    // Auto-configure on activation if enabled
    const config = vscode.workspace.getConfiguration('videoReaderMcp');
    const autoStart = config.get<boolean>('autoStart', true);
    
    if (autoStart) {
        const success = await configureMcpServer(context);
        if (success) {
            outputChannel.appendLine('Auto-configuration completed successfully');
        }
    }
    
    // Register commands
    const commands = [
        vscode.commands.registerCommand('video-reader-mcp.configure', async () => {
            const success = await configureMcpServer(context);
            if (success) {
                vscode.window.showInformationMessage(`${EXTENSION_NAME}: Configuration updated successfully. Restart VS Code to apply changes.`);
            }
        }),
        
        vscode.commands.registerCommand('video-reader-mcp.restart', async () => {
            outputChannel.appendLine('Restarting MCP server configuration...');
            const success = await configureMcpServer(context);
            if (success) {
                vscode.window.showInformationMessage(`${EXTENSION_NAME}: Server restarted. You may need to restart VS Code for changes to take effect.`);
            }
        }),
        
        vscode.commands.registerCommand('video-reader-mcp.status', async () => {
            await showStatus(context);
        }),
        
        vscode.commands.registerCommand('video-reader-mcp.viewDocs', async () => {
            await openDocumentation();
        }),
        
        vscode.commands.registerCommand('video-reader-mcp.disable', async () => {
            removeMcpServerConfig();
            vscode.window.showInformationMessage(`${EXTENSION_NAME}: Server disabled. Restart VS Code to apply changes.`);
        })
    ];
    
    context.subscriptions.push(...commands);
    
    outputChannel.appendLine(`${EXTENSION_NAME} activated successfully!`);
    outputChannel.appendLine(`Extension path: ${context.extensionPath}`);
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    if (outputChannel) {
        outputChannel.appendLine(`${EXTENSION_NAME} deactivated`);
    }
}
