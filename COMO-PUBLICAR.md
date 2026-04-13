# 🚀 Como Publicar a Extensão no VS Code Marketplace

## ✅ Extensão Instalada Localmente

A extensão **Video Reader MCP v2.0.0** já está instalada e funcionando no seu VS Code.

Para compartilhar com outros usuários, você precisa publicá-la no VS Code Marketplace.

---

## 📝 Passo a Passo para Publicar

### 1. Obter Personal Access Token (PAT)

O VS Code Marketplace usa Azure DevOps para autenticação. Você precisa criar um PAT:

#### a) Acessar Azure DevOps
Abra: https://dev.azure.com/GleidsonFerSanP/_usersSettings/tokens

**OU** se for primeira vez: https://dev.azure.com/ e faça login

#### b) Criar Novo Token
1. Clique em **"+ New Token"**
2. Configure:
   - **Name**: `VSCode Marketplace Publisher`
   - **Organization**: `All accessible organizations`
   - **Expiration**: `90 days` (ou personalizado)
   - **Scopes**: 
     - Expanda **"Marketplace"**
     - Marque: ✅ **Manage**

3. Clique em **"Create"**
4. **IMPORTANTE**: Copie o token imediatamente (não será mostrado novamente!)

---

### 2. Configurar o Token

Você tem 3 opções:

#### Opção A: Variável de Ambiente Permanente (Recomendado)

```bash
# Adicionar ao seu ~/.zshrc
echo 'export VSCE_PAT="seu-token-aqui"' >> ~/.zshrc
source ~/.zshrc

# Verificar
echo $VSCE_PAT
```

#### Opção B: Variável de Ambiente da Sessão

```bash
export VSCE_PAT="seu-token-aqui"
```

#### Opção C: Passar Diretamente no Comando

```bash
cd extension
vsce publish -p "seu-token-aqui"
```

---

### 3. Publicar a Extensão

#### Usando o Script Automático (Recomendado)

```bash
cd /Users/gleidsonfersanp/workspace/AI/mcp-video-reader/extension
./publish.sh
```

O script irá:
1. ✅ Verificar se o token está configurado
2. ✅ Fazer build da extensão
3. ✅ Empacotar (criar .vsix)
4. ✅ Publicar no Marketplace

#### Manualmente

```bash
cd /Users/gleidsonfersanp/workspace/AI/mcp-video-reader/extension

# Build e package
npm run build
npm run package

# Publicar
vsce publish
```

---

### 4. Verificar Publicação

Após publicar, aguarde **5-15 minutos** e acesse:

https://marketplace.visualstudio.com/items?itemName=GleidsonFerSanP.video-reader-mcp

A extensão estará disponível para instalação via:
```bash
code --install-extension GleidsonFerSanP.video-reader-mcp
```

Ou no VS Code:
- Extensions → Search: "Video Reader MCP"

---

## ⚠️ Troubleshooting

### Erro 401 (Unauthorized)
- **Causa**: Token inválido ou expirado
- **Solução**: Gere um novo token e configure novamente

### Erro 403 (Forbidden)
- **Causa**: Token sem permissões corretas
- **Solução**: Verifique se marcou "Marketplace → Manage" ao criar token

### Extension already exists with version 2.0.0
- **Causa**: Versão já publicada
- **Solução**: Incremente a versão no `package.json` antes de publicar

### Publisher 'GleidsonFerSanP' not found
- **Causa**: Publisher não registrado
- **Solução**: Crie um publisher em https://marketplace.visualstudio.com/manage

---

## 📊 Estatísticas da Extensão

Após publicar, você pode acompanhar:
- Downloads
- Avaliações
- Tendências

Em: https://marketplace.visualstudio.com/manage/publishers/GleidsonFerSanP

---

## 🔄 Publicando Atualizações

Para publicar novas versões:

```bash
cd extension

# Opção 1: Incrementar automaticamente
vsce publish patch  # 2.0.0 → 2.0.1
vsce publish minor  # 2.0.0 → 2.1.0
vsce publish major  # 2.0.0 → 3.0.0

# Opção 2: Versão específica
vsce publish 2.1.0
```

---

## 📦 Alternativa: Distribuição Manual

Se não quiser publicar no Marketplace agora, você pode:

### Compartilhar o .vsix diretamente

```bash
# O arquivo está em:
/Users/gleidsonfersanp/workspace/AI/mcp-video-reader/extension/video-reader-mcp-2.0.0.vsix

# Outros podem instalar assim:
code --install-extension video-reader-mcp-2.0.0.vsix
```

### Publicar no GitHub Releases

```bash
gh release create v2.0.0 video-reader-mcp-2.0.0.vsix --title "v2.0.0" --notes "- Fixed openai dependency
- Platform-specific builds
- Full documentation"
```

---

## 🎯 Quick Start

Se você já tem o token configurado:

```bash
cd /Users/gleidsonfersanp/workspace/AI/mcp-video-reader/extension
./publish.sh
```

Se não tem o token ainda:

1. Obtenha token em: https://dev.azure.com/GleidsonFerSanP/_usersSettings/tokens
2. Configure: `export VSCE_PAT="seu-token"`
3. Execute: `./publish.sh`

---

**Status Atual**:
- ✅ Extensão v2.0.0 construída
- ✅ Extensão instalada localmente
- ✅ Pacote .vsix criado (42MB)
- ⏳ Aguardando token para publicação no Marketplace
