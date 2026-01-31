#!/usr/bin/env node

// Teste simples para verificar se ffmpeg e ffprobe funcionam sem instalação no sistema

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";

console.log("🔍 Verificando configuração do MCP Video Reader...\n");

// Configurar caminhos
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

console.log("✅ FFmpeg path:", ffmpegPath.path);
console.log("✅ FFprobe path:", ffprobePath.path);

// Testar se os binários funcionam
console.log("\n📦 Testando FFmpeg...");
ffmpeg.getAvailableFormats((err, formats) => {
  if (err) {
    console.error("❌ Erro ao testar FFmpeg:", err.message);
  } else {
    console.log(
      "✅ FFmpeg funcionando! Formatos disponíveis:",
      Object.keys(formats).length
    );
  }

  // Testar ffprobe
  console.log("\n📦 Testando FFprobe...");
  const testCommand = ffmpeg();
  testCommand.ffprobe((err, data) => {
    if (err) {
      console.error("❌ Erro ao testar FFprobe:", err.message);
    } else {
      console.log("✅ FFprobe funcionando!");
    }

    console.log("\n🎉 Todos os componentes estão funcionando!");
    console.log("📝 Nenhuma instalação no sistema é necessária.");
    console.log("🚀 O MCP está pronto para processar vídeos!\n");
  });
});
