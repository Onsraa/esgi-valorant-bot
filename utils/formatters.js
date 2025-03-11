const moment = require('moment');

// Fonction pour formater le nom en majuscules
function formatNom(nom) {
    return nom.toUpperCase();
}

// Fonction pour formater le prénom (première lettre majuscule pour chaque mot)
function formatPrenom(prenom) {
    return prenom
        .split(' ')
        .map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

// Fonction pour formater la classe
function formatClasse(classe) {
    return classe.toUpperCase();
}

// Fonction pour valider l'email
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@myges(\.[a-zA-Z0-9-]+)*$/;
    return emailRegex.test(email);
}

// Fonction pour formater la date (DD/MM/YYYY)
function formatDate(date) {
    return moment(date).format('DD/MM/YYYY');
}

// Fonction pour obtenir la date du jour au format DD/MM/YYYY
function today() {
    return moment().format('DD/MM/YYYY');
}

// Fonction pour valider une date au format DD/MM/YYYY
function isValidDate(dateStr) {
    return moment(dateStr, 'DD/MM/YYYY', true).isValid();
}

// Fonction pour parseDate une date au format DD/MM/YYYY vers un objet Date
function parseDate(dateStr) {
    return moment(dateStr, 'DD/MM/YYYY').toDate();
}

module.exports = {
    formatNom,
    formatPrenom,
    formatClasse,
    validateEmail,
    formatDate,
    today,
    isValidDate,
    parseDate
};