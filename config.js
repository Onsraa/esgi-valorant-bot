require('dotenv').config();

module.exports = {
    // Configuration du bot
    token: process.env.TOKEN,
    prefix: '!',

    // IDs des rôles
    adminRoleId: process.env.ADMIN_ROLE_ID,
    staffRoleId: process.env.STAFF_ROLE_ID,

    // Configuration de la base de données
    database: {
        filename: './valorant_asso.db'
    },

    // Autres configurations
    defaultSessionTypes: [
        {
            name: 'Partie normale',
            description: 'Partie non classée avec au moins un autre membre',
            points: 1
        },
        {
            name: 'Partie classée',
            description: 'Partie classée avec au moins un autre membre',
            points: 1
        },
        {
            name: 'Partie personnalisée',
            description: 'Partie personnalisée organisée par le staff',
            points: 2
        },
        {
            name: 'Session coaching',
            description: 'Session de coaching organisée par le staff',
            points: 3
        }
    ]
};