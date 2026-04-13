# Troubleshooting - Video Reader MCP Extension

## Problemas Identificados e Corrigidos

### 1. ❌ Erro: Cannot find package 'openai'

**Sintoma:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'openai' imported from 
/Users/gleidsonfersanp/.vscode/extensions/gleidsonfersanp.video-reader-mcp-2.0.0/mcp-server/video-processor.js
```

**Causa:**
O script de build (`extension/scripts/build.js`) não incluía a dependência `openai` no `package.json` gerado para o servidor MCP bundled.

**Correção:**
✅ Adicionada linha `"openai": "^4.76.0"` nas dependências do `package.json` gerado.

**Arquivo corrigido:**
- `extension/scripts/build.js` (linha ~75)

---

### 2. ❌ Erro: Cannot find ffmpeg/ffprobe binaries

**Sintoma:**
- Extensão inicia mas falha ao processar vídeos
- Mensagens de erro sobre FFmpeg não encontrado

**Causa:**
Dependências opcionais do FFmpeg não sendo instaladas corretamente durante o bundle.

**Correção:**
✅ O script de build agora:
1. Instala todas as dependências (incluindo opcionais) no `mcp-server/`
2. Os binários específicos da plataforma são incluídos (`darwin-arm64`, `darwin-x64`, etc.)
3. O `.vscodeignore` garante que `mcp-server/**` é incluído no `.vsix`

**Verificação:**
```bash
# Testar se FFmpeg está acessível
cd extension/mcp-server
node -e "const ffmpeg = require('@ffmpeg-installer/ffmpeg'); console.log(ffmpeg.path);"
```

---

## Como Atualizar a Extensão

### Opção 1: Script Automático (Recomendado)

```bash
cd extension
./update-extension.sh
```

### Opção 2: Manual

1. **Desinstalar versão antiga:**
   ```bash
   code --uninstall-extension GleidsonFerSanP.video-reader-mcp
   ```

2. **Aguardar limpeza (2 segundos)**

3. **Instalar nova versão:**
   ```bash
   cd extension
   code --install-extension video-reader-mcp-2.0.0.vsix
   ```

4. **Reiniciar VS Code**

---

## Verificação Pós-Instalação

### 1. Verificar Status da Extensão

No VS Code:
- Abrir Command Palette (`Cmd+Shift+P`)
- Executar: `Video Reader MCP: Check MCP Server Status`

### 2. Verificar Logs

- Ver Output Panel: `View > Output`
- Selecionar: `GitHub Copilot Chat - MCP video-reader-mcp`

**Logs esperados (OK):**
```
[info] Starting server video-reader-mcp
[info] Connection state: Running
```

**Logs de erro (Problema):**
```
[warning] [server stderr] Error [ERR_MODULE_NOT_FOUND]: Cannot find package...
[info] Connection state: Error Process exited with code 1
```

### 3. Testar Funcionalidade

No GitHub Copilot Chat:

```
Analyze this video: /path/to/video.mp4
```

---

## Detalhes Técnicos

### Estrutura do Bundle

```
~/.vscode/extensions/gleidsonfersanp.video-reader-mcp-2.0.0/
├── extension.vsixmanifest
├── dist/
│   └── extension.js           # Extension host
└── mcp-server/
    ├── index.js               # MCP server entry
    ├── video-processor.js     # Video processing logic
    ├── types.js
    ├── package.json           # ✅ Agora inclui openai
    └── node_modules/
        ├── openai/            # ✅ SDK do OpenAI
        ├── @ffmpeg-installer/
        │   ├── ffmpeg/
        │   └── darwin-arm64/  # ✅ Binário do FFmpeg
        ├── @ffprobe-installer/
        │   └── darwin-arm64/  # ✅ Binário do FFprobe
        ├── fluent-ffmpeg/
        └── sharp/
```

### Dependências Críticas

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `openai` | ^4.76.0 | Transcrição de áudio (Whisper API) |
| `@ffmpeg-installer/ffmpeg` | ^1.1.0 | Extração de frames e áudio |
| `@ffprobe-installer/ffprobe` | ^2.1.2 | Análise de metadados do vídeo |
| `fluent-ffmpeg` | ^2.1.3 | Interface JavaScript para FFmpeg |
| `sharp` | ^0.33.5 | Otimização de imagens (JPEG) |

---

## Problemas Conhecidos

### Platform-specific binaries

Os binários do FFmpeg são específicos da plataforma. A extensão inclui:

- `darwin-arm64` - macOS Apple Silicon (M1/M2/M3)
- `darwin-x64` - macOS Intel
- `linux-x64` - Linux 64-bit
- `linux-arm64` - Linux ARM
- `win32-x64` - Windows 64-bit

Se você usar a extensão em uma plataforma diferente, pode precisar reinstalar as dependências localmente.

---

## Histórico de Correções

### v2.0.0 (2026-04-13)
- ✅ Corrigido: Dependência `openai` faltante
- ✅ Corrigido: FFmpeg/FFprobe binaries não incluídos
- ✅ Adicionado: Script de atualização automática
- ✅ Adicionado: Documentação de troubleshooting

---

## Precisa de Ajuda?

Se você continuar enfrentando problemas:

1. **Verificar logs completos:**
   ```bash
   code --verbose
   # Abrir Output: GitHub Copilot Chat - MCP
   ```

2. **Limpar cache:**
   ```bash
   rm -rf ~/.vscode/extensions/gleidsonfersanp.video-reader-mcp-*
   code --install-extension extension/video-reader-mcp-2.0.0.vsix
   ```

3. **Reportar issue:**
   - GitHub: https://github.com/GleidsonFerSanP/video-reader-mcp/issues
   - Incluir: logs completos, OS, arquitetura (`uname -a`)
