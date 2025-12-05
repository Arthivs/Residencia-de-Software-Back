#!/bin/bash
# setup.sh

echo "🚀 Iniciando setup do projeto..."

# Verificar se PostgreSQL está rodando
echo "📊 Verificando PostgreSQL..."
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL não está rodando!"
    echo "Iniciando PostgreSQL..."
    sudo systemctl start postgresql
    sleep 3
fi

# Criar banco se não existir
echo "🗄️  Criando banco de dados..."
sudo -u postgres psql -c "CREATE DATABASE projeto_residencia;" 2>/dev/null || echo "Banco já existe ou erro."

# Executar script SQL
echo "📝 Executando script SQL..."
psql -h localhost -U postgres -d projeto_residencia -f create-tables.sql

echo "✅ Setup concluído!"
echo "🔧 Inicie o servidor: npm run dev"