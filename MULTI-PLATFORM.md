# Multi-Platform Support - Video Reader MCP Extension

## 🌍 Suporte Multiplataforma

A extensão Video Reader MCP contém binários nativos (FFmpeg, FFprobe, Sharp) que são **específicos para cada sistema operacional e arquitetura**.

### ✅ Plataformas Suportadas

|Plataforma | Arquitetura | Status |
|-----------|-------------|--------|
| **macOS** | Apple Silicon (M1/M2/M3) | ✅ Suportado |
| **macOS** | Intel (x64) | ✅ Suportado |
| **Linux** | x64 | ✅ Suportado |
| **Linux** | ARM64 | ✅ Suportado |
| **Linux** | ARM | ✅ Su portado |
| **Linux** | ia32 | ✅ Suportado |
| **Windows** | x64 | ✅ Suportado |
| **Windows** | ia32 | ✅ Suportado |

---

## 📦 Como Funciona

### Build Atual (Específico de Plataforma)

O build padrão (`npm run build`) instala binários **apenas para a plataforma onde está sendo compilado**:

```bash
# Compilando no macOS ARM64
npm run build
# → Instala: darwin-arm64 binaries (~116MB)

# Pacote gerado: video-reader-mcp-2.0.0.vsix (~42MB)
# ✅ Funciona: macOS Apple Silicon
# ❌ Não funciona: Windows, Linux, macOS Intel
```

### Por Que Não Bundle Universal?

Tentamos criar um bundle universal com binários para todas as plataformas, mas:

1. **Tamanho**: ~280-350MB (8 plataformas × ~35-45MB cada)
2. **NPM restrições**: npm bloqueia instalação de binários de outras plataformas
3. **Complexidade**: Problemas de rede, timeouts, permissões
4. **Impraticável**: Usuário baixaria 280MB para usar apenas 40MB

---

## 🎯 Soluções Para Usar em Outras Plataformas

### Opção 1: Compilar na Plataforma Alvo (Recomendado)

Se você usa **Windows** ou **Linux**, compile a extensão nesse sistema:

```bash
# No seu Windows/Linux
git clone https://github.com/GleidsonFerSanP/video-reader-mcp.git
cd video-reader-mcp/extension
npm install
npm run build
npm run package

# Instalar
code --install-extension video-reader-mcp-2.0.0.vsix
```

### Opção 2: Builds Pre-compiled (CI/CD)

Configure GitHub Actions para gerar builds para cada plataforma:

```yaml
# .github/workflows/build-multi-platform.yml
name: Build Multi-Platform
on: [push]
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd extension && npm install && npm run build && npm run package
      - uses: actions/upload-artifact@v3
        with:
          name: vsix-${{ matrix.os }}
          path: extension/*.vsix
```

### Opção 3: Usar Build Específico por Plataforma

Use o script `build-platform.js` (fornecido):

```bash
cd extension

# Build para plataforma específica
node scripts/build-platform.js darwin-arm64
node scripts/build-platform.js linux-x64
node scripts/build-platform.js win32-x64

# Ou build todas
node scripts/build-platform.js all
```

---

## 🔍 Como Identificar Problemas de Plataforma

### Sintomas

Se você instalou a extensão e vê estes erros:

```
Error: Cannot find module '@ffmpeg-installer/win32-x64'
Error: ENOENT: no such file or directory, access '/path/to/ffmpeg'
Error: Platform not supported
```

**Causa**: A extensão foi compilada para outra plataforma.

### Verificar Plataforma da Extensão

```bash
# Extrair .vsix
unzip video-reader-mcp-2.0.0.vsix -d temp

# Verificar binários incluídos
ls temp/extension/mcp-server/node_modules/@ffmpeg-installer/
# Se ver apenas "darwin-arm64" → Compilado para macOS Apple Silicon
# Se ver apenas "win32-x64" → Compilado para Windows 64-bit
```

---

## 📝 Informações Técnicas

### Dependências Nativas

| Pacote | Binários por Plataforma | Tamanho Médio |
|--------|-------------------------|---------------|
| `@ffmpeg-installer/ffmpeg` | 8 plataformas | ~35-40MB cada |
| `@ffprobe-installer/ffprobe` | 8 plataformas | ~5-10MB cada |
| `sharp` | Pre-compiled | ~8-12MB cada |

### Por Que `optionalDependencies` Não Funciona

O npm instala `optionalDependencies` **apenas para a plataforma atual** por design:

```json
{
  " optionalDependencies": {
    "@ffmpeg-installer/darwin-arm64": "4.1.5",  // Só instala no macOS ARM
    "@ffmpeg-installer/linux-x64": "4.1.0"       // Só instala no Linux x64
  }
}
```

Mesmo com `--force` ou `--include=optional`, o npm ignora plataformas incompatíveis.

---

## 🚀 Roadmap

Planejamos melhorar o suporte multiplataforma:

- [ ] **CI/CD**: GitHub Actions para builds automáticos por plataforma
- [ ] **Marketplace**: Publicar versões específicas no VS Code Marketplace
- [ ] **Download on-demand**: Baixar binários na primeira execução (como VS Code faz)
- [ ] **Docker builds**: Containers para builds reproduzíveis

---

## 🤝 Contribuir

Se você tiver experiência com:
- Builds multiplataforma de extensões VS Code
- Packaging de binários nativos
- CI/CD para múltiplas plataformas

Pull requests são bem-vindos!

---

## 📚 Referências

- [VS Code Extension Platform-Specific](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#platformspecific-extensions)
- [npm optionalDependencies](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#optionaldependencies)
- [Sharp Install](https://sharp.pixelplumbing.com/install)
- [FFmpeg Binary Installers](https://github.com/kribblo/node-ffmpeg-installer)

---

## ⚡ Quick Reference

```bash
# Verificar sua plataforma
node -e "console.log(process.platform + '-' + process.arch)"
# Saída: darwin-arm64 | linux-x64 | win32-x64 | etc.

# Build para sua plataforma
cd extension && npm run build && npm run package

# Instalar
code --install-extension video-reader-mcp-2.0.0.vsix

# Reload VS Code
# Cmd+Shift+P → "Developer: Reload Window"
```

---

**Última atualização**: 2026-04-13  
**Versão da extensão**: 2.0.0  
**Build atual**: darwin-arm64 (macOS Apple Silicon)
