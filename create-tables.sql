-- backend/create-tables.sql
-- Criação do banco de dados PostgreSQL

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de tarefas
CREATE TABLE IF NOT EXISTS tarefas (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    data_prazo DATE,
    prioridade VARCHAR(20) DEFAULT 'media',
    status VARCHAR(20) DEFAULT 'pendente',
    progresso INTEGER DEFAULT 0,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL
);

-- Tabela de relacionamento tarefa-categoria
CREATE TABLE IF NOT EXISTS tarefa_categorias (
    tarefa_id INTEGER REFERENCES tarefas(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
    PRIMARY KEY (tarefa_id, categoria_id)
);

-- Tabela de relacionamento tarefa-responsável
CREATE TABLE IF NOT EXISTS tarefa_responsaveis (
    tarefa_id INTEGER REFERENCES tarefas(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (tarefa_id, usuario_id)
);

-- Tabela de registros financeiros
CREATE TABLE IF NOT EXISTS financeiro (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    descricao VARCHAR(200) NOT NULL,
    categoria VARCHAR(50),
    valor DECIMAL(10,2) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    forma_pagamento VARCHAR(50),
    comprovante TEXT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de tags
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL
);

-- Tabela de relacionamento financeiro-tag
CREATE TABLE IF NOT EXISTS financeiro_tags (
    financeiro_id INTEGER REFERENCES financeiro(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (financeiro_id, tag_id)
);

-- Tabela de ações
CREATE TABLE IF NOT EXISTS acoes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    tipo VARCHAR(50),
    descricao TEXT,
    data DATE NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado CHAR(2) NOT NULL,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    endereco TEXT,
    status VARCHAR(20) DEFAULT 'planejada',
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de fotos das ações
CREATE TABLE IF NOT EXISTS acao_fotos (
    id SERIAL PRIMARY KEY,
    acao_id INTEGER REFERENCES acoes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    upload_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_tarefas_usuario ON tarefas(usuario_id);
CREATE INDEX idx_tarefas_status ON tarefas(status);
CREATE INDEX idx_financeiro_usuario ON financeiro(usuario_id);
CREATE INDEX idx_financeiro_data ON financeiro(data);
CREATE INDEX idx_acoes_usuario ON acoes(usuario_id);
CREATE INDEX idx_acoes_bairro ON acoes(bairro);
CREATE INDEX idx_acoes_data ON acoes(data);

-- Inserir categorias padrão
INSERT INTO categorias (nome) VALUES 
    ('Desenvolvimento'),
    ('Design'),
    ('Marketing'),
    ('Vendas'),
    ('Suporte'),
    ('Administrativo'),
    ('Recursos Humanos')
ON CONFLICT (nome) DO NOTHING;

-- Inserir tags padrão
INSERT INTO tags (nome) VALUES 
    ('urgente'),
    ('importante'),
    ('pessoal'),
    ('profissional'),
    ('mensal'),
    ('anual'),
    ('imposto'),
    ('investimento')
ON CONFLICT (nome) DO NOTHING;

-- Criar usuário de teste (senha: 123456)
INSERT INTO usuarios (nome, email, senha) VALUES 
    ('Usuário Teste', 'teste@exemplo.com', '$2b$10$YourHashedPasswordHere')
ON CONFLICT (email) DO NOTHING;

-- Inserir dados de exemplo
INSERT INTO tarefas (titulo, descricao, data_prazo, prioridade, status, progresso, usuario_id) VALUES
    ('Configurar PostgreSQL', 'Migrar banco de dados SQLite para PostgreSQL', '2024-01-30', 'alta', 'andamento', 60, 1),
    ('Desenvolver Dashboard', 'Criar dashboard com gráficos e estatísticas', '2024-02-15', 'media', 'pendente', 0, 1),
    ('Testar API', 'Realizar testes de integração da API', '2024-01-25', 'alta', 'concluido', 100, 1);

INSERT INTO financeiro (data, descricao, categoria, valor, tipo, forma_pagamento, usuario_id) VALUES
    ('2024-01-20', 'Salário Janeiro', 'Receita', 5000.00, 'receita', 'Transferência', 1),
    ('2024-01-15', 'Aluguel', 'Moradia', 1500.00, 'despesa', 'Débito Automático', 1),
    ('2024-01-10', 'Supermercado', 'Alimentação', 450.50, 'despesa', 'Cartão de Crédito', 1);

INSERT INTO acoes (titulo, tipo, descricao, data, bairro, cidade, estado, lat, lng, status, usuario_id) VALUES
    ('Campanha de Vacinação', 'Saúde', 'Vacinação contra gripe', '2024-01-18', 'Centro', 'São Paulo', 'SP', -23.5505, -46.6333, 'concluida', 1),
    ('Distribuição de Cestas', 'Assistência Social', 'Cestas básicas para famílias', '2024-01-22', 'Vila Nova', 'São Paulo', 'SP', -23.5432, -46.6421, 'em_andamento', 1);