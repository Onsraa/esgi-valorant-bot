const sqlite3 = require('sqlite3').verbose();
const config = require('../config');
const path = require('path');
const moment = require('moment');

// Initialisation de la base de données
const db = new sqlite3.Database(config.database.filename, (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err.message);
    } else {
        console.log('Connecté à la base de données SQLite');
        initializeDatabase();
    }
});

// Fonction pour initialiser la base de données
function initializeDatabase() {
    // Table des utilisateurs
    db.run(`
        CREATE TABLE IF NOT EXISTS utilisateurs (
                                                    discord_id TEXT PRIMARY KEY,
                                                    username TEXT NOT NULL,
                                                    nom TEXT,
                                                    prenom TEXT,
                                                    classe TEXT,
                                                    email TEXT,
                                                    date_join TEXT NOT NULL,
                                                    last_active TEXT NOT NULL,
                                                    score_total INTEGER DEFAULT 0,
                                                    role TEXT DEFAULT 'user'
        )
    `);

    // Table des types de sessions
    db.run(`
        CREATE TABLE IF NOT EXISTS session_types (
                                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                     nom TEXT NOT NULL UNIQUE,
                                                     description TEXT,
                                                     points INTEGER NOT NULL,
                                                     active BOOLEAN DEFAULT 1
        )
    `);

    // Table des historiques de sessions
    db.run(`
        CREATE TABLE IF NOT EXISTS session_history (
                                                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                       user_id TEXT NOT NULL,
                                                       session_type_id INTEGER NOT NULL,
                                                       date TEXT NOT NULL,
                                                       count INTEGER NOT NULL,
                                                       points_gained INTEGER NOT NULL,
                                                       validated BOOLEAN DEFAULT 0,
                                                       validated_by TEXT,
                                                       semester_id INTEGER DEFAULT NULL,
                                                       FOREIGN KEY (user_id) REFERENCES utilisateurs(discord_id),
                                                       FOREIGN KEY (session_type_id) REFERENCES session_types(id)
        )
    `);

    // Table des sessions en attente
    db.run(`
        CREATE TABLE IF NOT EXISTS pending_sessions (
                                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                        user_id TEXT NOT NULL,
                                                        date TEXT NOT NULL,
                                                        submitted_at TEXT NOT NULL,
                                                        status TEXT DEFAULT 'pending',
                                                        FOREIGN KEY (user_id) REFERENCES utilisateurs(discord_id)
        )
    `);

    // Table des détails de sessions en attente
    db.run(`
        CREATE TABLE IF NOT EXISTS pending_session_details (
                                                               id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                               pending_id INTEGER NOT NULL,
                                                               session_type_id INTEGER NOT NULL,
                                                               count INTEGER NOT NULL,
                                                               FOREIGN KEY (pending_id) REFERENCES pending_sessions(id),
                                                               FOREIGN KEY (session_type_id) REFERENCES session_types(id)
        )
    `);

    // Tables pour les semestres
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
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    )
  `);

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
  `);

    // Vérifier si des types de sessions existent déjà
    db.get('SELECT COUNT(*) as count FROM session_types', [], (err, row) => {
        if (err) {
            console.error('Erreur lors de la vérification des types de sessions :', err.message);
            return;
        }

        // Si aucun type de session n'existe, en ajouter des par défaut
        if (row.count === 0) {
            const defaultTypes = config.defaultSessionTypes;

            defaultTypes.forEach(type => {
                db.run(
                    'INSERT INTO session_types (nom, description, points) VALUES (?, ?, ?)',
                    [type.name, type.description, type.points],
                    function(err) {
                        if (err) {
                            console.error('Erreur lors de l\'insertion d\'un type de session :', err.message);
                        } else {
                            console.log(`Type de session ajouté : ${type.name}`);
                        }
                    }
                );
            });
        }
    });

    // Vérifier si les paramètres système existent déjà
    db.get('SELECT COUNT(*) as count FROM system_settings', [], (err, row) => {
        if (err) {
            // La table n'existe peut-être pas encore, ce n'est pas grave
            return;
        }

        // Si aucun paramètre n'existe, ajouter les paramètres par défaut
        if (row && row.count === 0) {
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

            initialSettings.forEach(setting => {
                db.run(
                    'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
                    [setting.key, setting.value, setting.description],
                    function(err) {
                        if (err) {
                            console.error(`Erreur lors de l'insertion du paramètre ${setting.key} :`, err.message);
                        } else {
                            console.log(`Paramètre système ajouté : ${setting.key}`);
                        }
                    }
                );
            });
        }
    });
}

// Fonction pour exécuter une requête en Promise
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

// Fonction pour obtenir une seule ligne en Promise
function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Fonction pour obtenir plusieurs lignes en Promise
function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

module.exports = {
    db,
    runQuery,
    getOne,
    getAll
};