const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

// Connexion à la base de données
const db = new sqlite3.Database(config.database.filename, (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err.message);
        process.exit(1);
    } else {
        console.log('Connecté à la base de données SQLite pour mise à jour');
        updateDatabase();
    }
});

// Fonction pour mettre à jour la base de données
function updateDatabase() {
    console.log('Début de la mise à jour de la base de données...');

    // Vérifier si la colonne semester_id existe dans session_history
    db.get("PRAGMA table_info(session_history)", [], (err, rows) => {
        if (err) {
            console.error('Erreur lors de la vérification de la structure de la table:', err);
            closeAndExit();
            return;
        }

        // Vérifier l'existence de la colonne semester_id
        const hasSemesterId = rows && rows.some(row => row.name === 'semester_id');

        if (!hasSemesterId) {
            console.log('Ajout de la colonne semester_id à la table session_history...');

            // Ajouter la colonne semester_id
            db.run("ALTER TABLE session_history ADD COLUMN semester_id INTEGER DEFAULT NULL", function(err) {
                if (err) {
                    console.error('Erreur lors de l\'ajout de la colonne semester_id:', err);
                } else {
                    console.log('Colonne semester_id ajoutée avec succès!');
                }

                // Continuer avec d'autres mises à jour...
                createSemesterTables();
            });
        } else {
            console.log('La colonne semester_id existe déjà dans la table session_history');
            // Continuer avec d'autres mises à jour...
            createSemesterTables();
        }
    });
}

// Créer les tables de semestres si elles n'existent pas
function createSemesterTables() {
    console.log('Vérification des tables de semestres...');

    // Table des semestres
    db.run(`
        CREATE TABLE IF NOT EXISTS semesters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 0,
            created_at TEXT NOT NULL,
            note_max REAL DEFAULT 4
        )
    `, function(err) {
        if (err) {
            console.error('Erreur lors de la création de la table semesters:', err);
        } else {
            console.log('Table semesters vérifiée/créée avec succès');
        }

        createSystemSettingsTable();
    });
}

// Créer la table system_settings si elle n'existe pas
function createSystemSettingsTable() {
    console.log('Vérification de la table system_settings...');

    db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT
        )
    `, function(err) {
        if (err) {
            console.error('Erreur lors de la création de la table system_settings:', err);
        } else {
            console.log('Table system_settings vérifiée/créée avec succès');
        }

        createSemesterRankingsTable();
    });
}

// Créer la table semester_rankings si elle n'existe pas
function createSemesterRankingsTable() {
    console.log('Vérification de la table semester_rankings...');

    db.run(`
        CREATE TABLE IF NOT EXISTS semester_rankings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            semester_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            total_points INTEGER NOT NULL,
            rank INTEGER NOT NULL,
            percentile REAL NOT NULL,
            final_note REAL NOT NULL,
            FOREIGN KEY (semester_id) REFERENCES semesters(id),
            FOREIGN KEY (user_id) REFERENCES utilisateurs(discord_id),
            UNIQUE(semester_id, user_id)
        )
    `, function(err) {
        if (err) {
            console.error('Erreur lors de la création de la table semester_rankings:', err);
        } else {
            console.log('Table semester_rankings vérifiée/créée avec succès');
        }

        addBaseSettings();
    });
}

// Ajouter les paramètres système de base s'ils n'existent pas déjà
function addBaseSettings() {
    console.log('Vérification des paramètres système de base...');

    const initialSettings = [
        {
            key: 'NOTE_MAX',
            value: '4',
            description: 'Note maximale pour un semestre'
        },
        {
            key: 'PERCENTILE_THRESHOLDS',
            value: JSON.stringify([25, 50, 75, 100]),
            description: 'Seuils de percentiles pour l\'attribution des notes (en pourcentage)'
        },
        {
            key: 'PERCENTILE_NOTES',
            value: JSON.stringify([4, 3, 2, 1]),
            description: 'Notes attribuées pour chaque seuil de percentile'
        }
    ];

    // Vérifier chaque paramètre et l'ajouter s'il n'existe pas
    let settingsChecked = 0;

    initialSettings.forEach(setting => {
        db.get('SELECT * FROM system_settings WHERE key = ?', [setting.key], (err, row) => {
            if (err) {
                console.error(`Erreur lors de la vérification du paramètre ${setting.key}:`, err);
                settingsChecked++;
                checkCompletion();
            } else if (!row) {
                // Le paramètre n'existe pas, l'ajouter
                db.run(
                    'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
                    [setting.key, setting.value, setting.description],
                    function(err) {
                        if (err) {
                            console.error(`Erreur lors de l'insertion du paramètre ${setting.key}:`, err);
                        } else {
                            console.log(`Paramètre système ajouté: ${setting.key}`);
                        }
                        settingsChecked++;
                        checkCompletion();
                    }
                );
            } else {
                console.log(`Le paramètre ${setting.key} existe déjà`);
                settingsChecked++;
                checkCompletion();
            }
        });
    });

    // Vérifier si tous les paramètres ont été traités
    function checkCompletion() {
        if (settingsChecked === initialSettings.length) {
            console.log('Tous les paramètres système ont été vérifiés');
            closeAndExit();
        }
    }
}

// Fermer la connexion et quitter
function closeAndExit() {
    console.log('Fermeture de la connexion à la base de données...');
    db.close(() => {
        console.log('Mise à jour de la base de données terminée avec succès!');
        process.exit(0);
    });
}