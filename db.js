// backend/db.js - Configuração PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

console.log('🚀 Iniciando configuração PostgreSQL...');
console.log('========================================');

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'projeto_residencia',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres', // ← MUDOU AQUI TAMBÉM!
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

console.log('📊 Configuração do banco:');
console.log(`   🔗 Host: ${poolConfig.host}:${poolConfig.port}`);
console.log(`   🗄️  Banco: ${poolConfig.database}`);
console.log(`   👤 Usuário: ${poolConfig.user}`);
console.log(`   🔐 Senha: ${poolConfig.password ? '***' + poolConfig.password.slice(-3) : 'não definida'}`);
console.log('========================================');

const pool = new Pool(poolConfig);

// Função para testar conexão
async function testarConexao() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conexão ao PostgreSQL estabelecida com sucesso!');
    
    // Testar consulta básica
    const resultado = await client.query('SELECT NOW() as hora_servidor, version() as versao');
    console.log(`   ⏰ Hora do servidor: ${resultado.rows[0].hora_servidor}`);
    console.log(`   🐘 PostgreSQL ${resultado.rows[0].versao.split(' ')[1]}`);
    
    // Verificar tabelas
    const tabelas = await client.query(`
      SELECT COUNT(*) as total 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`   📋 ${tabelas.rows[0].total} tabelas no banco`);
    
    // Verificar dados de exemplo
    const usuarios = await client.query('SELECT COUNT(*) as total FROM usuarios');
    const tarefas = await client.query('SELECT COUNT(*) as total FROM tarefas');
    console.log(`   👥 ${usuarios.rows[0].total} usuário(s) cadastrado(s)`);
    console.log(`   📝 ${tarefas.rows[0].total} tarefa(s) cadastrada(s)`);
    
    return true;
  } catch (error) {
    console.error('❌ ERRO na conexão PostgreSQL:', error.message);
    console.log('\n🔧 Verifique:');
    console.log('1. PostgreSQL está rodando? (services.msc)');
    console.log('2. Banco "projeto_residencia" existe?');
    console.log('3. Usuário/senha corretos no .env');
    console.log('4. Teste manual: psql -U postgres');
    return false;
  } finally {
    if (client) client.release();
  }
}

// Testar conexão ao iniciar
testarConexao().then(success => {
  if (success) {
    console.log('✅ PostgreSQL configurado e conectado!');
  } else {
    console.log('⚠️  Servidor iniciará, mas APIs de banco falharão');
  }
  console.log('========================================\n');
});

module.exports = pool;