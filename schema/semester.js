// Schéma pour les migrations de la base de données liées aux semestres
const semesterSchema = `
    CREATE TABLE IF NOT EXISTS semesters (
                                             id INTEGER PRIMARY KEY AUTOINCREMENT,
                                             name TEXT NOT NULL,
                                             start_date TEXT NOT NULL,
                                             end_date TEXT NOT NULL,
                                             is_active BOOLEAN DEFAULT 0,
                                             created_at TEXT NOT NULL,
                                             note_max REAL DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS system_settings (
                                                   key TEXT PRIMARY KEY,
                                                   value TEXT NOT NULL,
                                                   description TEXT
    );

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
        );

-- Ajouter une colonne semester_id à la table session_history si elle n'existe pas déjà
    ALTER TABLE session_history ADD COLUMN semester_id INTEGER DEFAULT NULL;
`;

// Données initiales pour les paramètres système
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

module.exports = {
    semesterSchema,
    initialSettings
};