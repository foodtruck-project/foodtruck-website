// foodtruck-website/assets/js/utils.js

/**
 * Exibe uma mensagem em um elemento HTML com uma cor específica.
 * @param {HTMLElement} element - O elemento HTML onde a mensagem será exibida.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo da mensagem ('success', 'error', 'warning', 'default').
 */
function displayMessage(element, message, type) {
    element.innerText = message;
    switch (type) {
        case 'success':
            element.style.color = 'green';
            break;
        case 'error':
            element.style.color = 'red';
            break;
        case 'warning':
            element.style.color = 'orange';
            break;
        default:
            element.style.color = 'black'; // Cor padrão
    }
}

/**
 * Limpa todos os campos de um formulário.
 * @param {HTMLFormElement} form - O formulário a ser limpo.
 */
function clearForm(form) {
    form.reset();
}

/**
 * Formata uma string de data ISO para o formato local brasileiro (DD/MM/AAAA HH:MM).
 * @param {string} isoDateString - A string de data ISO (ex: "2025-06-10T11:01:07.937046").
 * @returns {string} A data formatada.
 */
function formatDateTimeBR(isoDateString) {
    if (!isoDateString) return 'N/A';
    const date = new Date(isoDateString);
    return date.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo' // Fuso horário de Florianópolis
    });
}

/**
 * Verifica se o usuário tem uma role de administrador.
 * @param {string} userRole - A role do usuário (ex: 'admin', 'attendant').
 * @returns {boolean} True se o usuário for admin.
 */
function isUserAdmin(userRole) {
    return userRole === 'admin';
}
