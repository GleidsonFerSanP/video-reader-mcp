#!/bin/bash
set -e

# Script para atualizar a extensão Video Reader MCP
# Corrige o problema de dependências faltantes (openai, ffmpeg, ffprobe)

echo "🔧 Atualizando extensão Video Reader MCP..."
echo ""

# Passo 1: Desinstalar versão antiga
echo "📦 Desinstalando versão antiga..."
code --uninstall-extension GleidsonFerSanP.video-reader-mcp || true
echo ""

# Passo 2: Aguardar um momento
echo "⏳ Aguardando limpeza..."
sleep 2
echo ""

# Passo 3: Instalar nova versão
echo "✅ Instalando versão corrigida..."
code --install-extension video-reader-mcp-2.0.0.vsix
echo ""

echo "🎉 Extensão atualizada com sucesso!"
echo ""
echo "ℹ️  Próximos passos:"
echo "   1. Feche e reabra o VS Code"
echo "   2. Teste a extensão com GitHub Copilot"
echo ""
echo "✨ Correções aplicadas:"
echo "   • Adicionada dependência 'openai' faltante"
echo "   • FFmpeg e FFprobe incluídos corretamente"
echo "   • Todos os binários da plataforma bundled"
echo ""
