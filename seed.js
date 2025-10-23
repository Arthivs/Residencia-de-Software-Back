// seed.js
const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");
const bcrypt = require('bcrypt');
const { parse } = require('date-fns'); // Adicionado para converter DD/MM/YYYY para Date

// Conexão com o Postgres
const pool = new Pool({
  user: "postgres",       // seu usuário do Postgres
  host: "localhost",
  database: "postgres",   // ou o banco que você criou
  password: "987654321",  // ⚠️ Sua senha do Postgres (Ajustar se diferente)
  port: 5432,
});

// =========================================================================
// 1. CRIAR TABELAS
// =========================================================================

async function criarTabelas() {
  const queryUsuarios = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE IF NOT EXISTS usuarios_fake (
      id_usuario UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nome_completo TEXT,
      idade TEXT,
      sexo TEXT,
      email TEXT UNIQUE,
      senha TEXT,
      celular TEXT,
      endereco TEXT,
      escolaridade TEXT,
      assessor TEXT,
      assunto TEXT,
      observacao TEXT,
      cidade TEXT,
      bairro TEXT,
      data_criacao TIMESTAMPTZ,
      tag_equipe TEXT,
      tag TEXT,
      latitude NUMERIC,
      longitude NUMERIC
    );
  `;
  // Tabela de Registros Financeiros
  const queryFinanceiro = `
    CREATE TABLE IF NOT EXISTS registros_financeiros (
      id_registro UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      id_usuario UUID NOT NULL REFERENCES usuarios_fake(id_usuario),
      data_registro DATE NOT NULL,
      valor_assessoria_juridica NUMERIC(10, 2) DEFAULT 0.00,
      valor_combustivel NUMERIC(10, 2) DEFAULT 0.00,
      despesas_credito NUMERIC(10, 2) DEFAULT 0.00,
      valor_locacao_imovel NUMERIC(10, 2) DEFAULT 0.00,
      valor_assessoria_comunicacao NUMERIC(10, 2) DEFAULT 0.00,
      despesas_debito NUMERIC(10, 2) DEFAULT 0.00,
      outras_despesas NUMERIC(10, 2) DEFAULT 0.00,
      descricao_outras_despesas TEXT,
      total_previsto NUMERIC(10, 2) NOT NULL,
      data_criacao TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  // Tabela de Gestão de Tarefas (Kanban)
  const queryTarefas = `
    CREATE TABLE IF NOT EXISTS gestao_tarefas (
      id_tarefa UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      id_usuario_criador UUID NOT NULL REFERENCES usuarios_fake(id_usuario),
      titulo TEXT NOT NULL,
      descricao TEXT,
      data_vencimento DATE,
      data_inicio DATE,
      data_conclusao DATE,
      prioridade TEXT DEFAULT 'Média',
      status_kanban TEXT DEFAULT 'A Fazer',
      data_criacao TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await pool.query(queryUsuarios);
  await pool.query(queryFinanceiro);
  await pool.query(queryTarefas);
  
  console.log("Tabelas 'usuarios_fake', 'registros_financeiros' e 'gestao_tarefas' criadas/verificadas ✅");
}


// =========================================================================
// 2. INSERIR DADOS
// =========================================================================

// Guarda o ID do usuário de teste para usar nas inserções de dados financeiros e tarefas
let userIdTeste = null; 

// Inserir dados fake na tabela de Usuários
async function inserirDadosUsuarios(qtd = 20) {
  const saltRounds = 10;
  const senhaTeste = '123456';
  const senhaHash = await bcrypt.hash(senhaTeste, saltRounds);

  for (let i = 0; i < qtd; i++) {
    const nome_completo = faker.person.fullName();
    const idade = faker.number.int({ min: 18, max: 70 }).toString();
    const sexo = faker.helpers.arrayElement(["Masculino", "Feminino", "Outro"]);
    
    // Usar um e-mail de teste para o primeiro registro
    const email = i === 0 ? "teste@exemplo.com" : faker.internet.email();
    const senha = i === 0 ? senhaHash : await bcrypt.hash(faker.internet.password(), saltRounds);
    
    const celular = faker.phone.number();
    const endereco = faker.location.streetAddress();
    const escolaridade = faker.helpers.arrayElement(["Ensino Fundamental", "Ensino Médio", "Superior"]);
    const assessor = faker.person.fullName();
    const assunto = faker.lorem.words(3);
    const observacao = faker.lorem.sentence();
    const cidade = faker.location.city();
    const bairro = faker.location.city();
    const data_criacao = faker.date.recent({ days: 30 });
    const tag_equipe = faker.helpers.arrayElement(["Equipe A", "Equipe B", "Equipe C"]);
    const tag = faker.helpers.arrayElement(["Prioridade Alta", "Normal", "Baixa"]);
    const latitude = faker.location.latitude();
    const longitude = faker.location.longitude();

    const result = await pool.query(
      `INSERT INTO usuarios_fake 
      (nome_completo, idade, sexo, email, senha, celular, endereco, escolaridade, assessor, assunto, observacao, cidade, bairro, data_criacao, tag_equipe, tag, latitude, longitude)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id_usuario`,
      [nome_completo, idade, sexo, email, senha, celular, endereco, escolaridade, assessor, assunto, observacao, cidade, bairro, data_criacao, tag_equipe, tag, latitude, longitude]
    );

    if (i === 0) {
        userIdTeste = result.rows[0].id_usuario;
    }
 }
  console.log(`${qtd} registros de usuários inseridos com sucesso (1 com email teste@exemplo.com e senha 123456)`);
}

// Inserir dados fake na tabela de Registros Financeiros
async function inserirDadosFinanceiros(qtd = 10) {
    if (!userIdTeste) {
        console.error("ID do usuário de teste não encontrado. Pulando inserção financeira.");
        return;
    }

    for (let i = 0; i < qtd; i++) {
        const data_registro = faker.date.past({ years: 0 }); // Data recente
        const v_juridica = faker.number.float({ min: 50, max: 500, precision: 0.01 });
        const v_combustivel = faker.number.float({ min: 20, max: 300, precision: 0.01 });
        const d_credito = faker.number.float({ min: 100, max: 1000, precision: 0.01 });
        const v_locacao = faker.number.float({ min: 0, max: 2000, precision: 0.01 });
        const v_comunicacao = faker.number.float({ min: 50, max: 400, precision: 0.01 });
        const d_debito = faker.number.float({ min: 50, max: 600, precision: 0.01 });
        const outras = faker.number.float({ min: 0, max: 500, precision: 0.01 });
        const total = (v_juridica + v_combustivel + d_credito + v_locacao + v_comunicacao + d_debito + outras).toFixed(2);
        
        const descricao_outras = outras > 0 ? faker.lorem.words(5) : null;
        
        await pool.query(
          `INSERT INTO registros_financeiros 
          (id_usuario, data_registro, valor_assessoria_juridica, valor_combustivel, despesas_credito, valor_locacao_imovel, valor_assessoria_comunicacao, despesas_debito, outras_despesas, descricao_outras_despesas, total_previsto)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [userIdTeste, data_registro, v_juridica, v_combustivel, d_credito, v_locacao, v_comunicacao, d_debito, outras, descricao_outras, total]
        );
    }
    console.log(`${qtd} registros financeiros inseridos para o usuário de teste.`);
}

// Inserir dados fake na tabela de Gestão de Tarefas (Kanban)
async function inserirDadosTarefas(qtd = 15) {
    if (!userIdTeste) {
        console.error("ID do usuário de teste não encontrado. Pulando inserção de tarefas.");
        return;
    }

    const status_options = ['A Fazer', 'Em Progresso', 'Concluído', 'Bloqueado'];
    const prioridade_options = ['Alta', 'Média', 'Baixa'];

    for (let i = 0; i < qtd; i++) {
        const status = faker.helpers.arrayElement(status_options);
        const prioridade = faker.helpers.arrayElement(prioridade_options);

        // Gera a data no formato DD/MM/YYYY (como no front-end) e depois converte para DATE
        const data_vencimento_str = faker.date.future({ years: 0 }).toLocaleDateString('pt-BR');
        const data_vencimento = parse(data_vencimento_str, 'dd/MM/yyyy', new Date());

        const data_inicio = faker.date.past({ days: 30 });
        const data_conclusao = status === 'Concluído' ? faker.date.recent({ days: 5 }) : null;

        await pool.query(
          `INSERT INTO gestao_tarefas 
          (id_usuario_criador, titulo, descricao, data_vencimento, data_inicio, data_conclusao, prioridade, status_kanban)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [userIdTeste, faker.lorem.words(3), faker.lorem.sentence(), data_vencimento, data_inicio, data_conclusao, prioridade, status]
        );
    }
    console.log(`${qtd} tarefas (Kanban) inseridas para o usuário de teste.`);
}


// =========================================================================
// 3. FUNÇÃO PRINCIPAL
// =========================================================================

async function main() {
  try {
    // Dropa as tabelas para recriar
    await pool.query('DROP TABLE IF EXISTS gestao_tarefas;');
    await pool.query('DROP TABLE IF EXISTS registros_financeiros;');
    await pool.query('DROP TABLE IF EXISTS usuarios_fake;');
    console.log("Tabelas antigas deletadas.");

    await criarTabelas();
    await inserirDadosUsuarios(5); // insere 5 usuários (o primeiro é o de teste)
    await inserirDadosFinanceiros(10);
    await inserirDadosTarefas(15);
  } catch (err) {
    console.error("Erro ao popular banco:", err);
  } finally {
    pool.end();
  }
}

main();