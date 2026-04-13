#!/bin/bash
set -e

# Script para publicar a extensão Video Reader MCP no VS Code Marketplace
# Requer: Personal Access Token (PAT) do Azure DevOps

echo "📦 Publicando Video Reader MCP Extension no Marketplace..."
echo ""

# Verificar se token está configurado
if [ -z "$VSCE_PAT" ]; then
    echo "❌ Token VSCE_PAT não configurado!"
    echo ""
    echo "Para publicar no VS Code Marketplace, você precisa de um Personal Access Token (PAT)."
    echo ""
    echo "📝 Como obter um PAT:"
    echo "1. Acesse: https://dev.azure.com/GleidsonFerSanP/_usersSettings/tokens"
    echo "2. Clique em 'New Token'"
    echo "3. Configure:"
    echo "   - Name: VSCode Marketplace Publisher"
    echo "   - Organization: All accessible organizations"
    echo "   - Expiration: 90 days (ou mais)"
    echo "   - Scopes: Marketplace → Manage"
    echo "4. Clique em 'Create' e copie o token"
    echo ""
    echo "💾 Para usar o token:"
    echo ""
    echo "Opção 1 - Variável de ambiente (sessão atual):"
    echo "  export VSCE_PAT='seu-token-aqui'"
    echo "  ./publish.sh"
    echo ""
    echo "Opção 2 - Passar diretamente:"
    echo "  vsce publish -p 'seu-token-aqui'"
    echo ""
    echo "Opção 3 - Salvar permanentemente (~/.zshrc ou ~/.bashrc):"
    echo "  echo 'export VSCE_PAT=\"seu-token-aqui\"' >> ~/.zshrc"
    echo "  source ~/.zshrc"
    echo ""
    exit 1
fi

# Token configurado, prosseguir com publicação
echo "✅ Token VSCE_PAT encontrado"
echo ""

# Passo 1: Build e empacotamento
echo "🔨 Building extension..."
npm run build
echo ""

echo "📦 Packaging extension..."
npm run package
echo ""

# Passo 2: Publicar
echo "🚀 Publishing to VS Code Marketplace..."
echo "   Publisher: GleidsonFerSanP"
echo "   Extension: video-reader-mcp"
echo "   Version: 2.0.0"
echo ""

vsce publish

echo ""
echo "🎉 Extensão publicada com sucesso!"
echo ""
echo "📍 Acesse em:"
echo "   https://marketplace.visualstudio.com/items?itemName=GleidsonFerSanP.video-reader-mcp"
echo ""
echo "⏱️  Aguarde ~5-15 minutos para a extensão aparecer no Marketplace"
echo ""
