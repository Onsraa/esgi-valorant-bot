const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

// Connexion à la base de données
const db = new sqlite3.Database(config.database.filename, (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err.message);
        process.exit(1);
    }
    console.log('Connecté à la base de données SQLite pour mise à jour');

    // Ajouter la colonne semester_id à la table session_history
    db.run("ALTER TABLE session_history ADD COLUMN semester_id INTEGER DEFAULT NULL", function(err) {
        if (err) {
            // Si l'erreur indique que la colonne existe déjà, ce n'est pas grave
            if (err.message.includes('duplicate column')) {
                console.log('La colonne semester_id existe déjà');
            } else {
                console.error('Erreur lors de l\'ajout de la colonne semester_id:', err);
            }
        } else {
            console.log('Colonne semester_id ajoutée avec succès à la table session_history!');
        }

        // Créer les tables semester si nécessaire
        createSemesterTables();
    });
});

// Créer les tables de semestres si elles n'existent pas
function createSemesterTables() {
    console.log('Création des tables liées aux semestres...');

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
            console.log('Table semesters créée avec succès');
        }

        // Table des paramètres système
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
                console.log('Table system_settings créée avec succès');
            }

            // Table des classements de semestre
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
                    console.log('Table semester_rankings créée avec succès');
                }

                // Insérer les paramètres système par défaut
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

                // Insérer chaque paramètre s'il n'existe pas déjà
                let settingsInserted = 0;
                initialSettings.forEach(setting => {
                    db.get('SELECT * FROM system_settings WHERE key = ?', [setting.key], (err, row) => {
                        if (err) {
                            console.error(`Erreur lors de la vérification du paramètre ${setting.key}:`, err);
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
                                    checkCompletion();
                                }
                            );
                        } else {
                            console.log(`Le paramètre ${setting.key} existe déjà`);
                            checkCompletion();
                        }
                    });
                });

                function checkCompletion() {
                    settingsInserted++;
                    if (settingsInserted >= initialSettings.length) {
                        console.log('Tous les paramètres système ont été vérifiés');

                        // Créer un semestre par défaut si aucun n'existe
                        createDefaultSemesterIfNeeded();
                    }
                }
            });
        });
    });
}

// Créer un semestre par défaut si nécessaire
function createDefaultSemesterIfNeeded() {
    db.get('SELECT COUNT(*) as count FROM semesters', [], (err, row) => {
        if (err) {
            console.error('Erreur lors de la vérification des semestres:', err);
            closeDatabase();
            return;
        }

        if (row && row.count === 0) {
            // Aucun semestre, créer un semestre par défaut
            const now = new Date();
            const startDate = `${now.getFullYear()}-01-01`;
            const endDate = `${now.getFullYear()}-12-31`;
            const createdAt = now.toISOString();

            db.run(
                'INSERT INTO semesters (name, start_date, end_date, created_at, is_active, note_max) VALUES (?, ?, ?, ?, ?, ?)',
                [`Année ${now.getFullYear()}`, startDate, endDate, createdAt, 1, 4.0],
                function(err) {
                    if (err) {
                        console.error('Erreur lors de la création du semestre par défaut:', err);
                    } else {
                        console.log(`Semestre par défaut "Année ${now.getFullYear()}" créé avec succès`);
                    }
                    closeDatabase();
                }
            );
        } else {
            console.log('Semestres déjà configurés, aucun semestre par défaut nécessaire');
            closeDatabase();
        }
    });
}

// Fermer la base de données
function closeDatabase() {
    db.close(() => {
        console.log('Mise à jour de la base de données terminée!');
        process.exit(0);
    });
}