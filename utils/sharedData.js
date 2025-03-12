/**
 * Stockage partagé pour les données temporaires entre les interactions
 * Permet d'éviter les erreurs "Cannot read properties of undefined (reading 'set')"
 */

// Map pour stocker les données de session par utilisateur
const sessionData = new Map();

// Map pour stocker d'autres données temporaires si nécessaire
const tempData = new Map();

module.exports = {
    sessionData,
    tempData
};