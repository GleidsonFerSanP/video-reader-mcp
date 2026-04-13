#!/bin/bash
# Quick publish - Cole seu token Azure DevOps aqui e execute

# COLE SEU TOKEN AQUI (entre as aspas):
TOKEN=""

if [ -z "$TOKEN" ]; then
    echo "❌ Erro: Token não configurado!"
    echo ""
    echo "Edite este arquivo e cole seu token na linha 5:"
    echo "TOKEN=\"seu-token-aqui\""
    echo ""
    echo "Para obter o token:"
    echo "https://dev.azure.com/GleidsonFerSanP/_usersSettings/tokens"
    echo ""
    echo "Ou use o script interativo: ./publish.sh"
    exit 1
fi

# Publicar com o token
export VSCE_PAT="$TOKEN"
cd "$(dirname "$0")"
./publish.sh
