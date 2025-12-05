const bcrypt = require('bcrypt');

async function gerarHash() {
  const senha = '123456';
  const hash = await bcrypt.hash(senha, 10);
  
  console.log('=== HASH CORRETO PARA "123456" ===');
  console.log('Senha:', senha);
  console.log('Hash:', hash);
  console.log('===================================');
  
  // Testar o hash
  const test = await bcrypt.compare(senha, hash);
  console.log('Teste de comparação:', test ? '✅ OK' : '❌ FALHOU');
  
  return hash;
}

gerarHash().catch(console.error);