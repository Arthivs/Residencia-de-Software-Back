// backend/scripts/setup-database.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function setupDatabase() {
  console.log('🔄 Configurando banco de dados PostgreSQL...\n');

  try {
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'create-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando script SQL...');
    
    // Dividir por comandos SQL
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);
    
    // Executar cada comando
    for (const [index, command] of commands.entries()) {
      console.log(`  [${index + 1}/${commands.length}] Executando comando...`);
      try {
        await pool.query(command);
      } catch (error) {
        // Ignorar erros de "já existe" para algumas tabelas
        if (!error.message.includes('already exists')) {
          console.warn(`  ⚠️  Aviso no comando ${index + 1}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Banco de dados configurado com sucesso!');
    
    // Verificar tabelas criadas
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tabelas criadas:');
    tablesResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });
    
    // Contar registros
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) FROM usuarios'),
      pool.query('SELECT COUNT(*) FROM tarefas'),
      pool.query('SELECT COUNT(*) FROM financeiro'),
      pool.query('SELECT COUNT(*) FROM acoes'),
    ]);
    
    console.log('\n📊 Registros iniciais:');
    console.log(`  👤 Usuários: ${counts[0].rows[0].count}`);
    console.log(`  📝 Tarefas: ${counts[1].rows[0].count}`);
    console.log(`  💰 Financeiro: ${counts[2].rows[0].count}`);
    console.log(`  🎯 Ações: ${counts[3].rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;