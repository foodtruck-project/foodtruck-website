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
            element.style.color = 'black'; 
    }
}

function clearForm(form) {
    form.reset();
}

function formatDateTimeBR(isoDateString) {
    if (!isoDateString) return 'N/A';
    const date = new Date(isoDateString);
    return date.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo' 
    });
}

function isUserAdmin(userRole) {
    return userRole === 'admin';
}