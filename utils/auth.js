const { User } = require('../database/models');

// Vérifier si l'utilisateur est un administrateur (par la BDD)
async function isAdmin(userId) {
    try {
        const user = await User.getById(userId);
        return user && user.role === 'admin';
    } catch (error) {
        console.error('Erreur lors de la vérification du rôle admin:', error);
        return false;
    }
}

// Vérifier si l'utilisateur est un membre du staff (par la BDD)
async function isStaff(userId) {
    try {
        const user = await User.getById(userId);
        return user && (user.role === 'staff' || user.role === 'admin');
    } catch (error) {
        console.error('Erreur lors de la vérification du rôle staff:', error);
        return false;
    }
}

module.exports = {
    isAdmin,
    isStaff
};