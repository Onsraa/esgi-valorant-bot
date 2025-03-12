const { db, runQuery, getOne, getAll } = require('../db');
const { parseDate, formatDate } = require('../utils/formatters');
const moment = require('moment');

// Modèle pour les semestres
const Semester = {
    // Obtenir tous les semestres
    async getAll() {
        return await getAll('SELECT * FROM semesters ORDER BY start_date DESC');
    },

    // Obtenir un semestre par son ID
    async getById(id) {
        return await getOne('SELECT * FROM semesters WHERE id = ?', [id]);
    },

    // Obtenir le semestre actif
    async getActive() {
        const activeSemester = await getOne('SELECT * FROM semesters WHERE is_active = 1');

        // Si aucun semestre n'est explicitement marqué comme actif,
        // on cherche un semestre qui contient la date actuelle
        if (!activeSemester) {
            const currentDate = moment().format('YYYY-MM-DD');
            return await getOne(
                'SELECT * FROM semesters WHERE date(start_date) <= date(?) AND date(end_date) >= date(?)',
                [currentDate, currentDate]
            );
        }

        return activeSemester;
    },

    // Créer un nouveau semestre
    async create(name, startDate, endDate, noteMax = 4) {
        // Vérifier que les dates sont valides
        const start = moment(startDate, 'DD/MM/YYYY');
        const end = moment(endDate, 'DD/MM/YYYY');

        if (!start.isValid() || !end.isValid()) {
            throw new Error('Les dates doivent être au format DD/MM/YYYY');
        }

        if (end.isBefore(start)) {
            throw new Error('La date de fin doit être après la date de début');
        }

        const formattedStart = start.format('YYYY-MM-DD');
        const formattedEnd = end.format('YYYY-MM-DD');
        const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

        return await runQuery(
            'INSERT INTO semesters (name, start_date, end_date, created_at, note_max) VALUES (?, ?, ?, ?, ?)',
            [name, formattedStart, formattedEnd, createdAt, noteMax]
        );
    },

    // Mettre à jour un semestre
    async update(id, name, startDate, endDate, noteMax) {
        // Vérifier que les dates sont valides
        const start = moment(startDate, 'DD/MM/YYYY');
        const end = moment(endDate, 'DD/MM/YYYY');

        if (!start.isValid() || !end.isValid()) {
            throw new Error('Les dates doivent être au format DD/MM/YYYY');
        }

        if (end.isBefore(start)) {
            throw new Error('La date de fin doit être après la date de début');
        }

        const formattedStart = start.format('YYYY-MM-DD');
        const formattedEnd = end.format('YYYY-MM-DD');

        return await runQuery(
            'UPDATE semesters SET name = ?, start_date = ?, end_date = ?, note_max = ? WHERE id = ?',
            [name, formattedStart, formattedEnd, noteMax, id]
        );
    },

    // Définir un semestre comme actif
    async setActive(id) {
        // Désactiver tous les semestres
        await runQuery('UPDATE semesters SET is_active = 0');

        // Activer le semestre spécifié
        return await runQuery('UPDATE semesters SET is_active = 1 WHERE id = ?', [id]);
    },

    // Supprimer un semestre
    async delete(id) {
        // Vérifier si le semestre a des sessions associées
        const sessionsCount = await getOne(
            'SELECT COUNT(*) as count FROM session_history WHERE semester_id = ?',
            [id]
        );

        if (sessionsCount && sessionsCount.count > 0) {
            throw new Error('Ce semestre a des sessions associées et ne peut pas être supprimé');
        }

        return await runQuery('DELETE FROM semesters WHERE id = ?', [id]);
    },

    // Obtenir les points d'un utilisateur pour un semestre spécifique
    async getUserPoints(userId, semesterId) {
        return await getAll(`
            SELECT sh.user_id, SUM(sh.points_gained) as total_points,
                   st.nom as session_type
            FROM session_history sh
                     JOIN session_types st ON sh.session_type_id = st.id
            WHERE sh.user_id = ? AND sh.semester_id = ? AND sh.validated = 1
            GROUP BY st.id
        `, [userId, semesterId]);
    },

    // Calculer les classements pour un semestre
    async calculateRankings(semesterId) {
        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);
        if (!semester) {
            throw new Error('Semestre non trouvé');
        }

        // Récupérer les paramètres de notation
        const settings = await SystemSettings.getAll();
        const noteMax = parseFloat(settings.find(s => s.key === 'NOTE_MAX')?.value || semester.note_max);
        const thresholds = JSON.parse(settings.find(s => s.key === 'PERCENTILE_THRESHOLDS')?.value || '[25, 50, 75, 100]');
        const notes = JSON.parse(settings.find(s => s.key === 'PERCENTILE_NOTES')?.value || '[4, 3, 2, 1]');

        // Récupérer tous les utilisateurs ayant des points dans ce semestre
        const userPoints = await getAll(`
            SELECT user_id, SUM(points_gained) as total_points
            FROM session_history
            WHERE semester_id = ? AND validated = 1
            GROUP BY user_id
            ORDER BY total_points DESC
        `, [semesterId]);

        if (!userPoints || userPoints.length === 0) {
            return [];
        }

        // Calculer le total des utilisateurs et assigner les rangs
        const totalUsers = userPoints.length;

        // Commencer une transaction
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Supprimer les classements existants pour ce semestre
                db.run('DELETE FROM semester_rankings WHERE semester_id = ?', [semesterId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    // Insérer les nouveaux classements
                    const stmt = db.prepare(`
                        INSERT INTO semester_rankings (semester_id, user_id, total_points, rank, percentile, final_note)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);

                    userPoints.forEach((user, index) => {
                        const rank = index + 1;
                        const percentile = (rank / totalUsers) * 100;

                        // Déterminer la note finale basée sur le percentile
                        let finalNote = notes[0]; // Note par défaut pour le meilleur percentile
                        for (let i = 0; i < thresholds.length; i++) {
                            if (percentile <= thresholds[i]) {
                                finalNote = notes[i];
                                break;
                            }
                        }

                        stmt.run(
                            semesterId,
                            user.user_id,
                            user.total_points,
                            rank,
                            percentile,
                            finalNote
                        );
                    });

                    stmt.finalize();

                    db.run('COMMIT', function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        resolve(userPoints.length);
                    });
                });
            });
        });
    },

    // Obtenir le classement d'un semestre
    async getRankings(semesterId, limit = 100) {
        return await getAll(`
            SELECT sr.*, u.username, u.nom, u.prenom
            FROM semester_rankings sr
                     JOIN utilisateurs u ON sr.user_id = u.discord_id
            WHERE sr.semester_id = ?
            ORDER BY sr.rank ASC
            LIMIT ?
        `, [semesterId, limit]);
    },

    // Obtenir le classement d'un utilisateur pour un semestre
    async getUserRanking(userId, semesterId) {
        return await getOne(`
            SELECT sr.*, u.username, u.nom, u.prenom
            FROM semester_rankings sr
                     JOIN utilisateurs u ON sr.user_id = u.discord_id
            WHERE sr.semester_id = ? AND sr.user_id = ?
        `, [semesterId, userId]);
    }
};

// Modèle pour les paramètres système
const SystemSettings = {
    // Obtenir tous les paramètres
    async getAll() {
        return await getAll('SELECT * FROM system_settings');
    },

    // Obtenir un paramètre par sa clé
    async getByKey(key) {
        return await getOne('SELECT * FROM system_settings WHERE key = ?', [key]);
    },

    // Mettre à jour un paramètre
    async update(key, value, description = null) {
        const setting = await SystemSettings.getByKey(key);

        if (setting) {
            if (description) {
                return await runQuery(
                    'UPDATE system_settings SET value = ?, description = ? WHERE key = ?',
                    [value, description, key]
                );
            } else {
                return await runQuery(
                    'UPDATE system_settings SET value = ? WHERE key = ?',
                    [value, key]
                );
            }
        } else {
            return await runQuery(
                'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
                [key, value, description || '']
            );
        }
    }
};

module.exports = {
    Semester,
    SystemSettings
};