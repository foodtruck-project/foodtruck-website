// assets/js/common.js
// Contém variáveis e funções que são usadas em múltiplas páginas.

// Definição da URL base do seu backend.
// IMPORTANTE: Ajuste esta porta se o seu backend rodar em outra porta (ex: 5000)
const API_BASE_URL = 'http://foodtruck.docker.localhost/';
//const API_BASE_URL = 'http://localhost:8000/'; // Se estiver rodando localmente
//const API_BASE_URL = 'http://89.117.33.177/';

// Anexa a variável ao objeto global 'window'
window.API_BASE_URL = API_BASE_URL;