// src/services/api.ts - PRONTO PARA SEU BACKEND
class ApiService {
  private baseURL: string;
  private token: string | null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  // Método genérico para requests
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // TAREFAS
  async getTarefas(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    return this.request(`/tarefas${query}`);
  }

  async createTarefa(tarefa: any) {
    return this.request('/tarefas', {
      method: 'POST',
      body: JSON.stringify(tarefa),
    });
  }

  async updateTarefa(id: string, updates: any) {
    return this.request(`/tarefas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTarefa(id: string) {
    return this.request(`/tarefas/${id}`, {
      method: 'DELETE',
    });
  }

  // AÇÕES
  async getAcoes(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    return this.request(`/acoes${query}`);
  }

  async createAcao(acao: any) {
    return this.request('/acoes', {
      method: 'POST',
      body: JSON.stringify(acao),
    });
  }

  async deleteAcao(id: string) {
    return this.request(`/acoes/${id}`, {
      method: 'DELETE',
    });
  }

  // FINANCEIRO
  async getFinanceiro(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    return this.request(`/financeiro${query}`);
  }

  async createRegistroFinanceiro(registro: any) {
    return this.request('/financeiro', {
      method: 'POST',
      body: JSON.stringify(registro),
    });
  }

  async deleteRegistroFinanceiro(id: string) {
    return this.request(`/financeiro/${id}`, {
      method: 'DELETE',
    });
  }

  // DASHBOARD
  async getDashboardData() {
    return this.request('/dashboard');
  }

  async getMetricas() {
    return this.request('/dashboard/metricas');
  }

  // UPLOAD
  async uploadFile(file: File, type: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.request('/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });
  }
}

export const apiService = new ApiService(import.meta.env.VITE_API_URL || 'http://localhost:3001/api');