// routes/assistant.js
const express = require('express');
const router = express.Router();
const openaiService = require('../services/openaiService');

// Middleware de autenticação (ajuste conforme seu sistema)
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  // TODO: Verificar token com seu sistema de autenticação
  next();
};

// Chat com IA
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, context = [], dataType, data } = req.body;

    let response;

    if (dataType && data) {
      // Análise específica baseada em tipo de dados
      switch (dataType) {
        case 'dashboard':
          response = await openaiService.analyzeDashboardData(data, message);
          break;
        case 'tasks':
          response = await openaiService.analyzeTasks(data, message);
          break;
        case 'finance':
          response = await openaiService.analyzeFinancialData(data, message);
          break;
        default:
          response = await openaiService.chat([
            ...context.map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.content
            })),
            { role: 'user', content: message }
          ]);
      }
    } else {
      // Chat geral
      const messages = [
        ...context.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: message }
      ];

      response = await openaiService.chat(messages);
    }

    res.json({
      success: true,
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro no endpoint /assistant/chat:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar solicitação'
    });
  }
});

// Rota de saúde da IA
router.get('/health', (req, res) => {
  res.json({
    service: 'OpenAI Assistant',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;