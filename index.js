// backend/index.js - VERSÃO COMPLETA COM DASHBOARD CORRIGIDO
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require("cors");
const pool = require("./db");
require('dotenv').config();

console.log('🚀 Iniciando servidor backend...');
console.log('========================================');

const app = express();
const server = http.createServer(app);

// Configurar WebSocket
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_jwt_temporario';

// ==================== CONFIGURAÇÕES ====================

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ==================== WEBSOCKET HANDLERS ====================

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('🟢 Novo cliente conectado:', socket.id);

  // Autenticar usuário via token
  socket.on('authenticate', async (token) => {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      connectedUsers.set(socket.id, user);
      socket.join(`user:${user.id}`);
      console.log(`✅ Usuário ${user.email} autenticado no socket, sala: user:${user.id}`);
      
      socket.emit('authenticated', { success: true, user });
      
      // Enviar evento de teste
      socket.emit('test_event', { 
        message: 'Conectado ao WebSocket com sucesso!',
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      console.error('❌ Erro de autenticação WebSocket:', error.message);
      socket.emit('auth_error', { message: 'Token inválido' });
    }
  });

  // Teste de conexão
  socket.on('test', (data) => {
    console.log('📨 Teste recebido:', data);
    socket.emit('test_response', { 
      status: 'ok', 
      message: 'WebSocket funcionando',
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`🔴 Usuário ${user.email} desconectado`);
    }
    connectedUsers.delete(socket.id);
    console.log('🔴 Cliente desconectado:', socket.id);
  });
});

// Função melhorada para emitir eventos
function emitToUser(userId, event, data) {
  const room = `user:${userId}`;
  console.log(`📤 Enviando evento '${event}' para sala: ${room}`, data);
  io.to(room).emit(event, data);
}

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: "Acesso negado. Token não fornecido." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado." });
    }
    
    req.user = user;
    next();
  });
}

// ==================== ROTAS DE DIAGNÓSTICO ====================

app.get("/api/status", async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW() as hora, version() as versao');
    
    const [users, tasks, finance, actions] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM usuarios'),
      pool.query('SELECT COUNT(*) FROM tarefas'),
      pool.query('SELECT COUNT(*) FROM financeiro'),
      pool.query('SELECT COUNT(*) FROM acoes')
    ]);

    res.json({
      status: "online",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: true,
        hora_servidor: dbResult.rows[0].hora,
        versao_postgres: dbResult.rows[0].versao,
        registros: {
          usuarios: parseInt(users.rows[0].count),
          tarefas: parseInt(tasks.rows[0].count),
          financeiro: parseInt(finance.rows[0].count),
          acoes: parseInt(actions.rows[0].count)
        }
      },
      websocket: {
        conectados: io.engine.clientsCount,
        status: "ativo"
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      database: { connected: false }
    });
  }
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================

app.post("/api/register", async (req, res) => {
  const { nome, email, password } = req.body;

  if (!nome || !email || !password) {
    return res.status(400).json({ message: "Nome, e-mail e senha são obrigatórios." });
  }

  try {
    const userExists = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "E-mail já cadastrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha) 
       VALUES ($1, $2, $3) RETURNING id, nome, email, criado_em`,
      [nome, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, nome: user.nome },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`📝 Novo usuário registrado: ${user.email}`);

    res.status(201).json({
      message: "Usuário criado com sucesso!",
      token,
      user: { id: user.id, nome: user.nome, email: user.email }
    });

  } catch (error) {
    console.error("❌ Erro no registro:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.senha);

    if (passwordMatch) {
      const token = jwt.sign(
        { id: user.id, email: user.email, nome: user.nome },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`✅ Login bem-sucedido: ${user.email}`);

      return res.json({
        message: "Login realizado com sucesso!",
        token,
        user: { 
          id: user.id, 
          nome: user.nome, 
          email: user.email,
          criado_em: user.criado_em
        }
      });
    } else {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }

  } catch (error) {
    console.error("❌ Erro no login:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// ==================== ROTAS DE TAREFAS ====================

app.get("/api/tarefas", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, 
              COALESCE(array_agg(DISTINCT c.nome) FILTER (WHERE c.nome IS NOT NULL), '{}') as categorias,
              COALESCE(array_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL), '{}') as responsaveis
       FROM tarefas t
       LEFT JOIN tarefa_categorias tc ON t.id = tc.tarefa_id
       LEFT JOIN categorias c ON tc.categoria_id = c.id
       LEFT JOIN tarefa_responsaveis tr ON t.id = tr.tarefa_id
       LEFT JOIN usuarios u ON tr.usuario_id = u.id
       WHERE t.usuario_id = $1
       GROUP BY t.id
       ORDER BY t.data_criacao DESC`,
      [req.user.id]
    );

    console.log(`📋 ${result.rows.length} tarefas para usuário ${req.user.id}`);

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar tarefas:", error);
    res.status(500).json({ message: "Erro ao buscar tarefas." });
  }
});

app.post("/api/tarefas", authenticateToken, async (req, res) => {
  const { titulo, descricao, data_prazo, prioridade, status, categorias = [], responsaveis = [] } = req.body;

  if (!titulo) {
    return res.status(400).json({ message: "Título é obrigatório." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tarefaResult = await client.query(
      `INSERT INTO tarefas (titulo, descricao, data_prazo, prioridade, status, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [titulo, descricao, data_prazo, prioridade || 'media', status || 'pendente', req.user.id]
    );

    const tarefa = tarefaResult.rows[0];

    for (const categoriaNome of categorias) {
      let categoriaResult = await client.query('SELECT id FROM categorias WHERE nome = $1', [categoriaNome]);
      let categoriaId;
      
      if (categoriaResult.rows.length === 0) {
        const newCat = await client.query('INSERT INTO categorias (nome) VALUES ($1) RETURNING id', [categoriaNome]);
        categoriaId = newCat.rows[0].id;
      } else {
        categoriaId = categoriaResult.rows[0].id;
      }

      await client.query('INSERT INTO tarefa_categorias (tarefa_id, categoria_id) VALUES ($1, $2)', [tarefa.id, categoriaId]);
    }

    for (const responsavelId of responsaveis) {
      await client.query('INSERT INTO tarefa_responsaveis (tarefa_id, usuario_id) VALUES ($1, $2)', [tarefa.id, responsavelId]);
    }

    await client.query('COMMIT');

    const tarefaCompleta = await pool.query(
      `SELECT t.*, 
              COALESCE(array_agg(DISTINCT c.nome) FILTER (WHERE c.nome IS NOT NULL), '{}') as categorias,
              COALESCE(array_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL), '{}') as responsaveis
       FROM tarefas t
       LEFT JOIN tarefa_categorias tc ON t.id = tc.tarefa_id
       LEFT JOIN categorias c ON tc.categoria_id = c.id
       LEFT JOIN tarefa_responsaveis tr ON t.id = tr.tarefa_id
       LEFT JOIN usuarios u ON tr.usuario_id = u.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [tarefa.id]
    );

    const tarefaFinal = tarefaCompleta.rows[0];

    // Emitir eventos WebSocket
    console.log(`🔔 Emitindo eventos para usuário ${req.user.id}`);
    emitToUser(req.user.id, 'tarefa:criada', tarefaFinal);
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'tarefas', timestamp: new Date().toISOString() });

    console.log(`✅ Tarefa criada: ${titulo} para usuário ${req.user.id}`);

    res.status(201).json(tarefaFinal);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Erro ao criar tarefa:", error);
    res.status(500).json({ message: "Erro ao criar tarefa." });
  } finally {
    client.release();
  }
});

app.put("/api/tarefas/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const campos = [];
    const valores = [];
    let i = 1;

    if (updates.titulo !== undefined) campos.push(`titulo = $${i++}`), valores.push(updates.titulo);
    if (updates.descricao !== undefined) campos.push(`descricao = $${i++}`), valores.push(updates.descricao);
    if (updates.data_prazo !== undefined) campos.push(`data_prazo = $${i++}`), valores.push(updates.data_prazo);
    if (updates.prioridade !== undefined) campos.push(`prioridade = $${i++}`), valores.push(updates.prioridade);
    if (updates.status !== undefined) campos.push(`status = $${i++}`), valores.push(updates.status);
    if (updates.progresso !== undefined) campos.push(`progresso = $${i++}`), valores.push(updates.progresso);

    if (campos.length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar." });
    }

    valores.push(id, req.user.id);
    
    const query = `
      UPDATE tarefas 
      SET ${campos.join(', ')}, atualizado_em = NOW()
      WHERE id = $${i} AND usuario_id = $${i + 1}
      RETURNING *
    `;

    const result = await pool.query(query, valores);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tarefa não encontrada." });
    }

    const tarefaAtualizada = result.rows[0];

    emitToUser(req.user.id, 'tarefa:atualizada', tarefaAtualizada);
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'tarefas' });

    console.log(`✏️  Tarefa atualizada ID ${id} para usuário ${req.user.id}`);

    res.json(tarefaAtualizada);
  } catch (error) {
    console.error("❌ Erro ao atualizar tarefa:", error);
    res.status(500).json({ message: "Erro ao atualizar tarefa." });
  }
});

app.delete("/api/tarefas/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM tarefas WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tarefa não encontrada." });
    }

    emitToUser(req.user.id, 'tarefa:excluida', { id });
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'tarefas' });

    console.log(`🗑️  Tarefa excluída ID ${id} para usuário ${req.user.id}`);

    res.json({ message: "Tarefa excluída com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao excluir tarefa:", error);
    res.status(500).json({ message: "Erro ao excluir tarefa." });
  }
});

// ==================== ROTAS DE FINANCEIRO ====================

app.get("/api/financeiro", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, 
              COALESCE(array_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL), '{}') as tags
       FROM financeiro f
       LEFT JOIN financeiro_tags ft ON f.id = ft.financeiro_id
       LEFT JOIN tags t ON ft.tag_id = t.id
       WHERE f.usuario_id = $1
       GROUP BY f.id
       ORDER BY f.data DESC`,
      [req.user.id]
    );

    console.log(`💰 ${result.rows.length} registros financeiros para usuário ${req.user.id}`);

    res.json(result.rows.map(r => ({
      ...r,
      valor: parseFloat(r.valor)
    })));
  } catch (error) {
    console.error("❌ Erro ao buscar registros financeiros:", error);
    res.status(500).json({ message: "Erro ao buscar dados financeiros." });
  }
});

app.post("/api/financeiro", authenticateToken, async (req, res) => {
  const { data, descricao, categoria, valor, tipo, forma_pagamento, comprovante, tags = [] } = req.body;

  if (!data || !descricao || !valor || !tipo) {
    return res.status(400).json({ message: "Data, descrição, valor e tipo são obrigatórios." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const financeiroResult = await client.query(
      `INSERT INTO financeiro (data, descricao, categoria, valor, tipo, forma_pagamento, comprovante, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data, descricao, categoria, valor, tipo, forma_pagamento, comprovante, req.user.id]
    );

    const registro = financeiroResult.rows[0];

    for (const tagNome of tags) {
      let tagResult = await client.query('SELECT id FROM tags WHERE nome = $1', [tagNome]);
      let tagId;
      
      if (tagResult.rows.length === 0) {
        const newTag = await client.query('INSERT INTO tags (nome) VALUES ($1) RETURNING id', [tagNome]);
        tagId = newTag.rows[0].id;
      } else {
        tagId = tagResult.rows[0].id;
      }

      await client.query('INSERT INTO financeiro_tags (financeiro_id, tag_id) VALUES ($1, $2)', [registro.id, tagId]);
    }

    await client.query('COMMIT');

    const registroCompleto = await pool.query(
      `SELECT f.*, 
              COALESCE(array_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL), '{}') as tags
       FROM financeiro f
       LEFT JOIN financeiro_tags ft ON f.id = ft.financeiro_id
       LEFT JOIN tags t ON ft.tag_id = t.id
       WHERE f.id = $1
       GROUP BY f.id`,
      [registro.id]
    );

    const registroFinal = {
      ...registroCompleto.rows[0],
      valor: parseFloat(registroCompleto.rows[0].valor)
    };

    emitToUser(req.user.id, 'financeiro:criado', registroFinal);
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'financeiro' });

    console.log(`💰 Registro financeiro criado: ${descricao} para usuário ${req.user.id}`);

    res.status(201).json(registroFinal);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Erro ao criar registro financeiro:", error);
    res.status(500).json({ message: "Erro ao criar registro financeiro." });
  } finally {
    client.release();
  }
});

app.delete("/api/financeiro/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM financeiro WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Registro financeiro não encontrado." });
    }

    emitToUser(req.user.id, 'financeiro:excluido', { id });
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'financeiro' });

    console.log(`🗑️  Registro financeiro excluído ID ${id} para usuário ${req.user.id}`);

    res.json({ message: "Registro financeiro excluído com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao excluir registro financeiro:", error);
    res.status(500).json({ message: "Erro ao excluir registro financeiro." });
  }
});

// ==================== ROTAS DE AÇÕES ====================

app.get("/api/acoes", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, 
              COALESCE(array_agg(DISTINCT af.url) FILTER (WHERE af.url IS NOT NULL), '{}') as fotos
       FROM acoes a
       LEFT JOIN acao_fotos af ON a.id = af.acao_id
       WHERE a.usuario_id = $1
       GROUP BY a.id
       ORDER BY a.data_criacao DESC`,
      [req.user.id]
    );

    console.log(`🏘️  ${result.rows.length} ações para usuário ${req.user.id}`);

    res.json(result.rows.map(a => ({
      ...a,
      lat: a.lat ? parseFloat(a.lat) : null,
      lng: a.lng ? parseFloat(a.lng) : null
    })));
  } catch (error) {
    console.error("❌ Erro ao buscar ações:", error);
    res.status(500).json({ message: "Erro ao buscar ações." });
  }
});

app.get("/api/acoes/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT a.*, 
              COALESCE(array_agg(DISTINCT af.url) FILTER (WHERE af.url IS NOT NULL), '{}') as fotos
       FROM acoes a
       LEFT JOIN acao_fotos af ON a.id = af.acao_id
       WHERE a.id = $1 AND a.usuario_id = $2
       GROUP BY a.id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ação não encontrada." });
    }

    const acao = result.rows[0];
    res.json({
      ...acao,
      lat: acao.lat ? parseFloat(acao.lat) : null,
      lng: acao.lng ? parseFloat(acao.lng) : null
    });
  } catch (error) {
    console.error("❌ Erro ao buscar ação:", error);
    res.status(500).json({ message: "Erro ao buscar ação." });
  }
});

app.post("/api/acoes", authenticateToken, async (req, res) => {
  const { titulo, tipo, descricao, data, bairro, cidade, estado, lat, lng, endereco, fotos = [], status } = req.body;

  if (!titulo || !data || !bairro) {
    return res.status(400).json({ message: "Título, data e bairro são obrigatórios." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const acaoResult = await client.query(
      `INSERT INTO acoes (titulo, tipo, descricao, data, bairro, cidade, estado, lat, lng, endereco, status, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [titulo, tipo, descricao, data, bairro, cidade, estado, lat || null, lng || null, endereco, status || 'planejada', req.user.id]
    );

    const acao = acaoResult.rows[0];

    for (const fotoUrl of fotos) {
      await client.query('INSERT INTO acao_fotos (acao_id, url) VALUES ($1, $2)', [acao.id, fotoUrl]);
    }

    await client.query('COMMIT');

    const acaoCompleta = await pool.query(
      `SELECT a.*, 
              COALESCE(array_agg(DISTINCT af.url) FILTER (WHERE af.url IS NOT NULL), '{}') as fotos
       FROM acoes a
       LEFT JOIN acao_fotos af ON a.id = af.acao_id
       WHERE a.id = $1
       GROUP BY a.id`,
      [acao.id]
    );

    const acaoFinal = acaoCompleta.rows[0];

    emitToUser(req.user.id, 'acao:criada', acaoFinal);
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'acoes' });

    console.log(`🏘️  Ação criada: ${titulo} no bairro ${bairro} para usuário ${req.user.id}`);

    res.status(201).json(acaoFinal);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Erro ao criar ação:", error);
    res.status(500).json({ message: "Erro ao criar ação." });
  } finally {
    client.release();
  }
});

app.put("/api/acoes/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { titulo, tipo, descricao, data, bairro, cidade, estado, lat, lng, endereco, fotos = [], status } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const checkResult = await client.query(
      'SELECT id FROM acoes WHERE id = $1 AND usuario_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Ação não encontrada." });
    }

    const acaoResult = await client.query(
      `UPDATE acoes 
       SET titulo = COALESCE($1, titulo),
           tipo = COALESCE($2, tipo),
           descricao = COALESCE($3, descricao),
           data = COALESCE($4, data),
           bairro = COALESCE($5, bairro),
           cidade = COALESCE($6, cidade),
           estado = COALESCE($7, estado),
           lat = COALESCE($8, lat),
           lng = COALESCE($9, lng),
           endereco = COALESCE($10, endereco),
           status = COALESCE($11, status),
           atualizado_em = NOW()
       WHERE id = $12 AND usuario_id = $13
       RETURNING *`,
      [titulo, tipo, descricao, data, bairro, cidade, estado, lat || null, lng || null, endereco, status, id, req.user.id]
    );

    const acao = acaoResult.rows[0];

    await client.query('DELETE FROM acao_fotos WHERE acao_id = $1', [id]);

    for (const fotoUrl of fotos) {
      await client.query('INSERT INTO acao_fotos (acao_id, url) VALUES ($1, $2)', [id, fotoUrl]);
    }

    await client.query('COMMIT');

    const acaoCompleta = await pool.query(
      `SELECT a.*, 
              COALESCE(array_agg(DISTINCT af.url) FILTER (WHERE af.url IS NOT NULL), '{}') as fotos
       FROM acoes a
       LEFT JOIN acao_fotos af ON a.id = af.acao_id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );

    const acaoFinal = acaoCompleta.rows[0];

    emitToUser(req.user.id, 'acao:atualizada', acaoFinal);
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'acoes' });

    console.log(`✏️  Ação atualizada ID ${id} para usuário ${req.user.id}`);

    res.json(acaoFinal);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Erro ao atualizar ação:", error);
    res.status(500).json({ message: "Erro ao atualizar ação." });
  } finally {
    client.release();
  }
});

app.delete("/api/acoes/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const checkResult = await client.query(
      'SELECT id, titulo FROM acoes WHERE id = $1 AND usuario_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Ação não encontrada." });
    }

    const acao = checkResult.rows[0];

    await client.query('DELETE FROM acao_fotos WHERE acao_id = $1', [id]);

    const result = await client.query(
      'DELETE FROM acoes WHERE id = $1 AND usuario_id = $2 RETURNING id, titulo',
      [id, req.user.id]
    );

    await client.query('COMMIT');

    const acaoExcluida = result.rows[0];

    console.log(`🔔 Emitindo eventos para exclusão da ação ${id}`);
    emitToUser(req.user.id, 'acao:excluida', { id, titulo: acaoExcluida.titulo });
    emitToUser(req.user.id, 'dashboard:atualizar', { tipo: 'acoes', action: 'deleted', id });

    console.log(`🗑️  Ação excluída ID ${id} (${acaoExcluida.titulo}) para usuário ${req.user.id}`);

    res.json({ 
      message: "Ação excluída com sucesso.",
      id,
      titulo: acaoExcluida.titulo
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Erro ao excluir ação:", error);
    res.status(500).json({ message: "Erro ao excluir ação." });
  } finally {
    client.release();
  }
});

// ==================== ROTA DE DASHBOARD CORRIGIDA ====================

app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    console.log(`📊 Gerando dashboard COMPLETO para usuário ${usuarioId}...`);

    // Buscar TODOS os dados de uma vez para evitar múltiplas queries
    const [
      tarefasResult,
      acoesResult,
      financeiroResult
    ] = await Promise.all([
      // Todas as tarefas
      pool.query(
        `SELECT t.*, 
                COALESCE(array_agg(DISTINCT c.nome) FILTER (WHERE c.nome IS NOT NULL), '{}') as categorias,
                COALESCE(array_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL), '{}') as responsaveis
         FROM tarefas t
         LEFT JOIN tarefa_categorias tc ON t.id = tc.tarefa_id
         LEFT JOIN categorias c ON tc.categoria_id = c.id
         LEFT JOIN tarefa_responsaveis tr ON t.id = tr.tarefa_id
         LEFT JOIN usuarios u ON tr.usuario_id = u.id
         WHERE t.usuario_id = $1
         GROUP BY t.id
         ORDER BY t.data_criacao DESC`,
        [usuarioId]
      ),
      // Todas as ações
      pool.query(
        `SELECT a.*, 
                COALESCE(array_agg(DISTINCT af.url) FILTER (WHERE af.url IS NOT NULL), '{}') as fotos
         FROM acoes a
         LEFT JOIN acao_fotos af ON a.id = af.acao_id
         WHERE a.usuario_id = $1
         GROUP BY a.id
         ORDER BY a.data_criacao DESC`,
        [usuarioId]
      ),
      // Todos os registros financeiros
      pool.query(
        `SELECT f.*, 
                COALESCE(array_agg(DISTINCT t.nome) FILTER (WHERE t.nome IS NOT NULL), '{}') as tags
         FROM financeiro f
         LEFT JOIN financeiro_tags ft ON f.id = ft.financeiro_id
         LEFT JOIN tags t ON ft.tag_id = t.id
         WHERE f.usuario_id = $1
         GROUP BY f.id
         ORDER BY f.data DESC`,
        [usuarioId]
      )
    ]);

    // Processar dados
    const tarefas = tarefasResult.rows || [];
    const acoes = acoesResult.rows || [];
    const financeiro = financeiroResult.rows || [];

    // 1. ESTATÍSTICAS DAS TAREFAS
    const totalTarefas = tarefas.length;
    const tarefasConcluidas = tarefas.filter(t => 
      (t.status || '').toLowerCase() === 'concluido' || 
      (t.status || '').toLowerCase() === 'concluida'
    ).length;
    const tarefasAndamento = tarefas.filter(t => 
      (t.status || '').toLowerCase() === 'andamento' || 
      (t.status || '').toLowerCase() === 'em_andamento'
    ).length;
    const tarefasPendentes = tarefas.filter(t => 
      (t.status || '').toLowerCase() === 'pendente'
    ).length;

    // Status Values para gráfico pizza
    const statusValues = [
      { 
        label: "A fazer", 
        valor: tarefasPendentes, 
        cor: "#2563EB",
        status: "pendente" 
      },
      { 
        label: "Em andamento", 
        valor: tarefasAndamento, 
        cor: "#F59E0B",
        status: "andamento" 
      },
      { 
        label: "Concluído", 
        valor: tarefasConcluidas, 
        cor: "#10B981",
        status: "concluido" 
      }
    ];

    // Calcular prazo médio
    let prazoMedio = 0;
    const tarefasConcluidasComData = tarefas.filter(t => {
      const status = (t.status || '').toLowerCase();
      return (status === 'concluido' || status === 'concluida') && 
             t.data_criacao && 
             t.data_conclusao;
    });

    if (tarefasConcluidasComData.length > 0) {
      const totalDias = tarefasConcluidasComData.reduce((sum, t) => {
        try {
          const criacao = new Date(t.data_criacao);
          const conclusao = new Date(t.data_conclusao);
          const dias = Math.max(Math.round((conclusao - criacao) / (1000 * 60 * 60 * 24)), 0);
          return sum + dias;
        } catch (e) {
          return sum;
        }
      }, 0);
      prazoMedio = Math.round(totalDias / tarefasConcluidasComData.length);
    }

    // 2. ESTATÍSTICAS DAS AÇÕES
    const totalAcoes = acoes.length;
    
    // Bairros atendidos
    const bairrosSet = new Set();
    acoes.forEach(a => {
      if (a.bairro && a.bairro.trim() !== '') {
        bairrosSet.add(a.bairro.trim());
      }
    });
    const bairrosAtendidos = bairrosSet.size;
    
    // Ações deste mês
    const agora = new Date();
    const mesAtual = agora.getMonth() + 1;
    const anoAtual = agora.getFullYear();
    const acoesEsteMes = acoes.filter(a => {
      try {
        if (!a.data) return false;
        const dataAcao = new Date(a.data);
        return dataAcao.getMonth() + 1 === mesAtual && 
               dataAcao.getFullYear() === anoAtual;
      } catch {
        return false;
      }
    }).length;

    // Tipos de ações
    const tipoMap = new Map();
    acoes.forEach(acao => {
      const tipo = acao.tipo || 'Outro';
      tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + 1);
    });
    
    const acoesPorTipo = Array.from(tipoMap.entries())
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    // 3. ESTATÍSTICAS FINANCEIRAS
    const totalGasto = financeiro
      .filter(f => (f.tipo || '').toLowerCase() === 'despesa')
      .reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
    
    const totalReceita = financeiro
      .filter(f => (f.tipo || '').toLowerCase() === 'receita')
      .reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
    
    const saldo = totalReceita - totalGasto;

    // Gastos por categoria
    const categoriaMap = new Map();
    financeiro
      .filter(f => (f.tipo || '').toLowerCase() === 'despesa')
      .forEach(f => {
        const categoria = f.categoria || 'Outros';
        const valorAtual = categoriaMap.get(categoria) || 0;
        categoriaMap.set(categoria, valorAtual + (parseFloat(f.valor) || 0));
      });
    
    const gastoPorCategoria = Array.from(categoriaMap.entries())
      .map(([categoria, valor]) => ({
        categoria,
        valor: Math.round(valor * 100) / 100
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    // 4. EVOLUÇÃO MENSAL (últimos 6 meses)
    const evolucaoMensal = [];
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(anoAtual, mesAtual - 1 - i, 1);
      const mesIndex = date.getMonth();
      const mesNome = nomesMeses[mesIndex];
      const ano = date.getFullYear();
      const mesNum = mesIndex + 1;
      
      const receitaMes = financeiro
        .filter(f => {
          if (!f.data) return false;
          try {
            const dataF = new Date(f.data);
            return dataF.getMonth() + 1 === mesNum && 
                   dataF.getFullYear() === ano && 
                   (f.tipo || '').toLowerCase() === 'receita';
          } catch {
            return false;
          }
        })
        .reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
      
      const despesaMes = financeiro
        .filter(f => {
          if (!f.data) return false;
          try {
            const dataF = new Date(f.data);
            return dataF.getMonth() + 1 === mesNum && 
                   dataF.getFullYear() === ano && 
                   (f.tipo || '').toLowerCase() === 'despesa';
          } catch {
            return false;
          }
        })
        .reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
      
      evolucaoMensal.push({
        mes: mesNome,
        receita: Math.round(receitaMes * 100) / 100,
        despesa: Math.round(despesaMes * 100) / 100
      });
    }

    // 5. TAREFAS POR RESPONSÁVEL
    const responsaveisMap = new Map();
    tarefas.forEach(t => {
      const responsaveis = t.responsaveis || [];
      if (Array.isArray(responsaveis)) {
        responsaveis.forEach(r => {
          if (r && r.trim() !== '') {
            responsaveisMap.set(r.trim(), (responsaveisMap.get(r.trim()) || 0) + 1);
          }
        });
      } else if (t.responsaveis && typeof t.responsaveis === 'string' && t.responsaveis.trim() !== '') {
        responsaveisMap.set(t.responsaveis.trim(), (responsaveisMap.get(t.responsaveis.trim()) || 0) + 1);
      }
    });
    
    const responsaveisArray = Array.from(responsaveisMap.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    // 6. DISTRIBUIÇÃO MENSAL DE TAREFAS (para gráfico de barras)
    const mesesDistribuicao = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'];
    const progressoTarefas = mesesDistribuicao.map((mes, index) => {
      const tarefasDoMes = tarefas.filter(t => {
        try {
          if (!t.data_criacao) return false;
          const data = new Date(t.data_criacao);
          return data.getMonth() === index;
        } catch {
          return false;
        }
      });
      return {
        mes,
        valor: tarefasDoMes.length
      };
    });

    // 7. ATIVIDADES RECENTES (últimas 6 atividades)
    const atividadesRecentes = [
      ...tarefas.slice(0, 3).map(t => ({ 
        tipo: 'tarefa', 
        titulo: t.titulo || 'Sem título', 
        descricao: t.status || 'Sem status',
        data: t.data_criacao,
        cor: '#3B82F6'
      })),
      ...acoes.slice(0, 3).map(a => ({ 
        tipo: 'acao', 
        titulo: a.titulo || 'Sem título', 
        descricao: a.bairro || 'Sem local',
        data: a.data_criacao,
        cor: '#10B981'
      })),
      ...financeiro.slice(0, 3).map(f => ({ 
        tipo: 'financeiro', 
        titulo: f.descricao || 'Sem descrição', 
        descricao: `R$ ${(parseFloat(f.valor) || 0).toFixed(2)}`,
        data: f.data_criacao,
        cor: '#8B5CF6'
      }))
    ]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 6);

    // Log para debug
    console.log(` Dashboard gerado para usuário ${usuarioId}:`, {
      totalTarefas,
      tarefasConcluidas,
      tarefasAndamento,
      tarefasPendentes,
      totalAcoes,
      bairrosAtendidos,
      acoesEsteMes,
      totalGasto,
      totalReceita,
      saldo
    });

    // RESPOSTA FINAL - FORMATO COMPATÍVEL COM FRONTEND
    res.json({
      tarefas: tarefas.slice(0, 5).map(t => ({
        id: t.id?.toString() || '',
        titulo: t.titulo || '',
        descricao: t.descricao,
        status: (t.status || 'pendente').toLowerCase(),
        responsavel: Array.isArray(t.responsaveis) && t.responsaveis.length > 0 ? t.responsaveis[0] : t.responsaveis || '',
        prioridade: (t.prioridade || 'media').toLowerCase(),
        dataCriacao: t.data_criacao,
        dataPrazo: t.data_prazo,
        dataConclusao: t.data_conclusao,
        progresso: t.progresso || 0,
        categorias: t.categorias || []
      })),
      
      acoes: acoes.slice(0, 5).map(a => ({
        id: a.id?.toString() || '',
        titulo: a.titulo || '',
        tipo: a.tipo || '',
        descricao: a.descricao,
        data: a.data || new Date().toISOString().split('T')[0],
        bairro: a.bairro || '',
        cidade: a.cidade || '',
        estado: a.estado || '',
        lat: parseFloat(a.lat) || 0,
        lng: parseFloat(a.lng) || 0,
        endereco: a.endereco,
        dataCriacao: a.data_criacao,
        fotos: a.fotos || [],
        status: (a.status || 'planejada').toLowerCase()
      })),
      
      financeiro: financeiro.slice(0, 5).map(f => ({
        id: f.id?.toString() || '',
        data: f.data || new Date().toISOString().split('T')[0],
        descricao: f.descricao || '',
        categoria: f.categoria || '',
        valor: parseFloat(f.valor) || 0,
        tipo: (f.tipo || 'despesa').toLowerCase(),
        formaPagamento: f.forma_pagamento || '',
        comprovante: f.comprovante,
        dataCriacao: f.data_criacao,
        tags: f.tags || []
      })),
      
      estatisticas: {
        // Para gráfico pizza
        statusValues,
        
        // Contagens básicas
        totalTarefas,
        tarefasConcluidas,
        tarefasAndamento,
        tarefasPendentes,
        
        // Porcentagens
        porcentagemConcluidas: totalTarefas > 0 ? 
          Math.round((tarefasConcluidas / totalTarefas) * 100) : 0,
        
        // Métricas de tempo
        prazoMedio,
        eficiencia: totalTarefas > 0 ? 
          Math.round((tarefasConcluidas / totalTarefas) * 100) : 0,
        
        // Ações
        totalAcoes,
        acoesPorTipo,
        bairrosAtendidos,
        acoesEsteMes,
        
        // Financeiro
        totalGasto: Math.round(totalGasto * 100) / 100,
        totalReceita: Math.round(totalReceita * 100) / 100,
        saldo: Math.round(saldo * 100) / 100,
        gastoPorCategoria,
        
        // Gráficos
        evolucaoMensal,
        responsaveis: responsaveisArray,
        progressoTarefas,
        
        // Outros
        atividadesRecentes,
        alertas: []
      }
    });

  } catch (error) {
    console.error("❌ Erro CRÍTICO ao buscar dados do dashboard:", error);
    res.status(500).json({ 
      message: "Erro ao buscar dados do dashboard.",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==================== ROTA DE TESTE WEB SOCKET ====================

app.post("/api/test-ws", authenticateToken, async (req, res) => {
  try {
    console.log(`🧪 Teste WebSocket para usuário ${req.user.id}`);
    
    emitToUser(req.user.id, 'test_event', { 
      message: 'Teste de WebSocket', 
      timestamp: new Date().toISOString(),
      user: req.user.id
    });
    
    emitToUser(req.user.id, 'dashboard:atualizar', { 
      tipo: 'teste',
      message: 'Atualização manual via teste'
    });
    
    res.json({ 
      success: true, 
      message: 'Eventos WebSocket emitidos',
      userId: req.user.id
    });
  } catch (error) {
    console.error("❌ Erro no teste WebSocket:", error);
    res.status(500).json({ 
      success: false,
      message: "Erro ao emitir eventos WebSocket." 
    });
  }
});

// ==================== ROTA DE HEALTH CHECK ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "API PostgreSQL com WebSocket",
    database: "PostgreSQL",
    websocket: {
      connected: io.engine.clientsCount,
      status: "ativo"
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== ROTA 404 ====================

app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    path: req.path,
    method: req.method
  });
});

// ==================== INICIAR SERVIDOR ====================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('========================================');
  console.log(`   Backend PostgreSQL rodando em http://localhost:${PORT}`);
  console.log(`    WebSocket disponível em ws://localhost:${PORT}`);
  console.log('    Endpoints disponíveis:');
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Status: http://localhost:${PORT}/api/status`);
  console.log(`   Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`   Ações: http://localhost:${PORT}/api/acoes`);
  console.log(`   Tarefas: http://localhost:${PORT}/api/tarefas`);
  console.log(`   Financeiro: http://localhost:${PORT}/api/financeiro`);
  console.log(`   Teste WS: http://localhost:${PORT}/api/test-ws (POST)`);
  console.log('   Banco de dados: PostgreSQL');
  console.log('========================================\n');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Rejeição não tratada:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exceção não capturada:', error);
});