const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

// Si aucun ID n'est fourni, afficher un message d'aide
if (process.argv.length < 3) {
    console.log('Usage: node setup-admin.js <votre_ID_discord>');
    process.exit(1);
}

// Récupérer l'ID Discord passé en paramètre
const discordId = process.argv[2];

// Connexion à la base de données
const db = new sqlite3.Database(config.database.filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err.message);
        process.exit(1);
    }
    console.log('Connecté à la base de données SQLite');
});

// Vérifier si l'utilisateur existe déjà
db.get('SELECT * FROM utilisateurs WHERE discord_id = ?', [discordId], (err, row) => {
    if (err) {
        console.error('Erreur lors de la vérification de l\'utilisateur :', err.message);
        db.close();
        process.exit(1);
    }

    if (row) {
        // L'utilisateur existe, mettre à jour son rôle
        db.run(
            'UPDATE utilisateurs SET role = ? WHERE discord_id = ?',
            ['admin', discordId],
            function(err) {
                if (err) {
                    console.error('Erreur lors de la mise à jour du rôle :', err.message);
                } else {
                    console.log(`L'utilisateur ${discordId} a maintenant le rôle administrateur!`);
                }
                db.close();
            }
        );
    } else {
        // L'utilisateur n'existe pas, l'ajouter avec le rôle admin
        const currentDate = new Date().toLocaleDateString('fr-FR');
        db.run(
            'INSERT INTO utilisateurs (discord_id, username, date_join, last_active, role, score_total) VALUES (?, ?, ?, ?, ?, ?)',
            [discordId, 'Admin', currentDate, currentDate, 'admin', 0],
            function(err) {
                if (err) {
                    console.error('Erreur lors de l\'ajout de l\'utilisateur :', err.message);
                } else {
                    console.log(`Nouvel utilisateur ${discordId} créé avec le rôle administrateur!`);
                }
                db.close();
            }
        );
    }
});