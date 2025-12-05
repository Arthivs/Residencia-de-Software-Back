// services/openaiService.js
const { OpenAI } = require('openai');
require('dotenv').config();

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Chat geral
  async chat(messages, systemPrompt = null) {
    try {
      const chatMessages = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 500,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Erro OpenAI:', error);
      throw new Error('Falha ao processar com IA');
    }
  }

  // Análise específica para dashboard
  async analyzeDashboardData(data, userQuestion = null) {
    const systemPrompt = `Você é um assistente especializado em análise de dashboards e relatórios. 
    Seja conciso, objetivo e forneça insights acionáveis.
    Use markdown para formatação quando apropriado.
    Se os dados estiverem incompletos, pergunte por informações adicionais.`;

    const userPrompt = userQuestion 
      ? `Com base nos seguintes dados do dashboard, responda: "${userQuestion}"
      
      Dados disponíveis:
      ${JSON.stringify(data, null, 2)}`
      : `Forneça um resumo geral e insights principais destes dados de dashboard:
      
      ${JSON.stringify(data, null, 2)}`;

    return this.chat([
      { role: 'user', content: userPrompt }
    ], systemPrompt);
  }

  // Análise de tarefas
  async analyzeTasks(tasks, userQuestion = null) {
    const systemPrompt = `Você é um especialista em gestão de tarefas e produtividade.
    Analise tarefas e forneça recomendações para melhorar eficiência.`;

    const userPrompt = userQuestion 
      ? `Com base nestas tarefas, responda: "${userQuestion}"
      
      Tarefas: ${JSON.stringify(tasks, null, 2)}`
      : `Analise estas tarefas e forneça insights sobre priorização e progresso:
      
      ${JSON.stringify(tasks, null, 2)}`;

    return this.chat([
      { role: 'user', content: userPrompt }
    ], systemPrompt);
  }

  // Análise financeira
  async analyzeFinancialData(financialData, userQuestion = null) {
    const systemPrompt = `Você é um analista financeiro especializado.
    Forneça análises claras sobre receitas, despesas e tendências.`;

    const userPrompt = userQuestion 
      ? `Com base nestes dados financeiros, responda: "${userQuestion}"
      
      Dados: ${JSON.stringify(financialData, null, 2)}`
      : `Analise estes dados financeiros e forneça um resumo com insights:
      
      ${JSON.stringify(financialData, null, 2)}`;

    return this.chat([
      { role: 'user', content: userPrompt }
    ], systemPrompt);
  }
}

module.exports = new OpenAIService();