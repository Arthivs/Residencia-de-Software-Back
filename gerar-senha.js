const bcrypt = require('bcrypt');

async function gerarHash() {
  const senha = '123456';
  const hash = await bcrypt.hash(senha, 10);
  console.log('Hash para senha "123456":');
  console.log(hash);
  
  // Exemplo de hash válido:
  // $2b$10$N9qo8uLOickgx2ZMRZoMye.AzC5SqB3eHfWzE5Z4kHvLJ9V2rWYbS
}

gerarHash();