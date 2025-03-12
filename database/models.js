const {db, runQuery, getOne, getAll} = require('./db');
const {formatNom, formatPrenom, formatClasse, validateEmail} = require('../utils/formatters');
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
            SELECT sh.user_id,
                   SUM(sh.points_gained) as total_points,
                   st.nom                as session_type
            FROM session_history sh
                     JOIN session_types st ON sh.session_type_id = st.id
            WHERE sh.user_id = ?
              AND sh.semester_id = ?
              AND sh.validated = 1
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
            WHERE semester_id = ?
              AND validated = 1
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
                db.run('DELETE FROM semester_rankings WHERE semester_id = ?', [semesterId], function (err) {
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

                    db.run('COMMIT', function (err) {
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
            WHERE sr.semester_id = ?
              AND sr.user_id = ?
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

// Modèle pour les utilisateurs
const User = {
    // Obtenir un utilisateur par son ID Discord
    async getById(discordId) {
        return await getOne('SELECT * FROM utilisateurs WHERE discord_id = ?', [discordId]);
    },

    // Créer un nouvel utilisateur
    async create(discordId, username, currentDate) {
        return await runQuery(
            'INSERT INTO utilisateurs (discord_id, username, date_join, last_active) VALUES (?, ?, ?, ?)',
            [discordId, username, currentDate, currentDate]
        );
    },

    // Mettre à jour l'activité d'un utilisateur
    async updateActivity(discordId, username, currentDate) {
        return await runQuery(
            'UPDATE utilisateurs SET last_active = ?, username = ? WHERE discord_id = ?',
            [currentDate, username, discordId]
        );
    },

    // Mettre à jour le profil d'un utilisateur
    async updateProfile(discordId, nom, prenom, classe, email) {
        // Vérifier si l'email est valide
        if (!validateEmail(email)) {
            throw new Error("L'email doit contenir @myges");
        }

        // Formatter les données
        const nomFormatted = formatNom(nom);
        const prenomFormatted = formatPrenom(prenom);
        const classeFormatted = formatClasse(classe);

        return await runQuery(
            'UPDATE utilisateurs SET nom = ?, prenom = ?, classe = ?, email = ? WHERE discord_id = ?',
            [nomFormatted, prenomFormatted, classeFormatted, email, discordId]
        );
    },

    // Mettre à jour le rôle d'un utilisateur
    async updateRole(discordId, role) {
        if (!['user', 'staff', 'admin'].includes(role.toLowerCase())) {
            throw new Error("Le rôle doit être 'user', 'staff' ou 'admin'");
        }

        return await runQuery(
            'UPDATE utilisateurs SET role = ? WHERE discord_id = ?',
            [role.toLowerCase(), discordId]
        );
    },

    // Vérifier si le profil d'un utilisateur est complet
    isProfileComplete(user) {
        return user && user.nom && user.prenom && user.classe && user.email;
    }
};

const SessionType = {
    // Obtenir tous les types de sessions actifs
    async getAll() {
        return await getAll('SELECT * FROM session_types WHERE active = 1 ORDER BY nom');
    },

    // Obtenir tous les types de sessions (actifs et inactifs)
    async getAllWithInactive() {
        return await getAll('SELECT * FROM session_types ORDER BY active DESC, nom');
    },

    // Obtenir un type de session par son ID (même inactif)
    async getById(typeId) {
        return await getOne('SELECT * FROM session_types WHERE id = ?', [typeId]);
    },

    // Vérifier si un type de session est utilisé dans l'historique
    async isUsedInHistory(typeId) {
        const result = await getOne(
            'SELECT COUNT(*) as count FROM session_history WHERE session_type_id = ?',
            [typeId]
        );
        return result && result.count > 0;
    },

    // Créer un nouveau type de session
    async create(nom, description, points) {
        return await runQuery(
            'INSERT INTO session_types (nom, description, points) VALUES (?, ?, ?)',
            [nom, description || '', points]
        );
    },

    // Mettre à jour un type de session
    async update(typeId, nom, description, points) {
        return await runQuery(
            'UPDATE session_types SET nom = ?, description = ?, points = ? WHERE id = ?',
            [nom, description || '', points, typeId]
        );
    },

    // Supprimer (désactiver) un type de session
    async delete(typeId) {
        // Vérifier d'abord si le type de session est utilisé dans l'historique
        const isUsed = await SessionType.isUsedInHistory(typeId);

        if (isUsed) {
            // Si le type est utilisé, juste le désactiver
            return await runQuery(
                'UPDATE session_types SET active = 0 WHERE id = ?',
                [typeId]
            );
        } else {
            // Si le type n'est pas utilisé, le supprimer complètement
            return await runQuery(
                'DELETE FROM session_types WHERE id = ?',
                [typeId]
            );
        }
    }
};

// Modèle pour l'historique des sessions
const SessionHistory = {
    // Obtenir l'historique des sessions d'un utilisateur
    async getUserHistory(userId) {
        return await getAll(
            `SELECT h.id,
                    h.user_id,
                    h.session_type_id,
                    t.nom as session_name,
                    h.date,
                    h.count,
                    h.points_gained,
                    h.validated,
                    h.validated_by,
                    h.semester_id
             FROM session_history h
                      JOIN session_types t ON h.session_type_id = t.id
             WHERE h.user_id = ?
               AND h.validated = 1
             ORDER BY h.date DESC`,
            [userId]
        );
    },

    // Obtenir l'historique des sessions d'un utilisateur pour un semestre spécifique
    async getUserHistoryBySemester(userId, semesterId) {
        return await getAll(
            `SELECT h.id,
                    h.user_id,
                    h.session_type_id,
                    t.nom as session_name,
                    h.date,
                    h.count,
                    h.points_gained,
                    h.validated,
                    h.validated_by
             FROM session_history h
                      JOIN session_types t ON h.session_type_id = t.id
             WHERE h.user_id = ?
               AND h.semester_id = ?
               AND h.validated = 1
             ORDER BY h.date DESC`,
            [userId, semesterId]
        );
    },

    // Obtenir les points par type de session pour un utilisateur (inclut les types inactifs)
    async getUserPointsByType(userId) {
        return await getAll(
            `SELECT t.nom, SUM(h.points_gained) as total_points
             FROM session_history h
                      JOIN session_types t ON h.session_type_id = t.id
             WHERE h.user_id = ?
               AND h.validated = 1
             GROUP BY t.id
             ORDER BY total_points DESC`,
            [userId]
        );
    },

    // Obtenir les points par type de session pour un utilisateur et un semestre (inclut les types inactifs)
    async getUserPointsByTypeAndSemester(userId, semesterId) {
        return await getAll(
            `SELECT t.nom, SUM(h.points_gained) as total_points
             FROM session_history h
                      JOIN session_types t ON h.session_type_id = t.id
             WHERE h.user_id = ?
               AND h.semester_id = ?
               AND h.validated = 1
             GROUP BY t.id
             ORDER BY total_points DESC`,
            [userId, semesterId]
        );
    },

    // Obtenir le total des points pour un utilisateur et un semestre
    async getUserTotalPointsBySemester(userId, semesterId) {
        const result = await getOne(
            `SELECT SUM(points_gained) as total_points
             FROM session_history
             WHERE user_id = ?
               AND semester_id = ?
               AND validated = 1`,
            [userId, semesterId]
        );

        return result ? result.total_points || 0 : 0;
    }
};

// Modèle pour les sessions en attente
const PendingSession = {
    // Créer une nouvelle session en attente
    async create(userId, date, sessionCounts) {
        // Vérifier si l'utilisateur a un profil complet
        const user = await User.getById(userId);

        if (!User.isProfileComplete(user)) {
            throw new Error('Profil incomplet');
        }

        // Créer la session en attente
        const submittedAt = moment().format('YYYY-MM-DD HH:mm:ss');

        const result = await runQuery(
            'INSERT INTO pending_sessions (user_id, date, submitted_at, status) VALUES (?, ?, ?, ?)',
            [userId, date, submittedAt, 'pending']
        );

        const pendingId = result.id;

        // Ajouter les détails de session
        for (const [sessionTypeId, count] of sessionCounts) {
            if (count > 0) {
                await runQuery(
                    'INSERT INTO pending_session_details (pending_id, session_type_id, count) VALUES (?, ?, ?)',
                    [pendingId, sessionTypeId, count]
                );
            }
        }

        return pendingId;
    },

    // Obtenir une session en attente par ID
    async getById(pendingId) {
        const session = await getOne(
            'SELECT id, user_id, date, submitted_at, status FROM pending_sessions WHERE id = ?',
            [pendingId]
        );

        if (!session) return null;

        // Récupérer les détails
        const details = await getAll(
            `SELECT d.id, d.pending_id, d.session_type_id, t.nom as session_name, d.count
             FROM pending_session_details d
                      JOIN session_types t ON d.session_type_id = t.id
             WHERE d.pending_id = ?`,
            [pendingId]
        );

        session.details = details;
        return session;
    },

    // Obtenir toutes les sessions en attente
    async getPending() {
        const pendingSessions = await getAll(
            `SELECT id, user_id, date, submitted_at, status
             FROM pending_sessions
             WHERE status = 'pending'
             ORDER BY submitted_at DESC`
        );

        // Récupérer les détails pour chaque session
        for (const session of pendingSessions) {
            session.details = await getAll(
                `SELECT d.id, d.pending_id, d.session_type_id, t.nom as session_name, d.count
                 FROM pending_session_details d
                          JOIN session_types t ON d.session_type_id = t.id
                 WHERE d.pending_id = ?`,
                [session.id]
            );
        }

        return pendingSessions;
    },

    // Valider une session en attente
    async validate(pendingId, validatorId, approve) {
        // Commencer une transaction
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Mettre à jour le statut de la session en attente
                const status = approve ? 'approved' : 'rejected';
                db.run(
                    'UPDATE pending_sessions SET status = ? WHERE id = ?',
                    [status, pendingId],
                    async function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        if (approve) {
                            try {
                                // Récupérer la session en attente
                                const pendingSession = await PendingSession.getById(pendingId);

                                // Récupérer le semestre actuel pour associer les sessions
                                let currentSemester = await Semester.getActive();
                                const semesterId = currentSemester ? currentSemester.id : null;

                                // Vérifier si la table session_history a la colonne semester_id
                                const tableInfo = await getAll("PRAGMA table_info(session_history)");
                                const hasSemesterId = tableInfo.some(col => col.name === 'semester_id');

                                for (const detail of pendingSession.details) {
                                    // Récupérer le type de session pour connaître les points
                                    const sessionType = await SessionType.getById(detail.session_type_id);
                                    const pointsGained = sessionType.points * detail.count;

                                    // Ajouter à l'historique en tenant compte de la présence ou non de semester_id
                                    if (hasSemesterId) {
                                        await runQuery(
                                            `INSERT INTO session_history
                                             (user_id, session_type_id, date, count, points_gained, validated,
                                              validated_by, semester_id)
                                             VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
                                            [
                                                pendingSession.user_id,
                                                detail.session_type_id,
                                                pendingSession.date,
                                                detail.count,
                                                pointsGained,
                                                validatorId,
                                                semesterId
                                            ]
                                        );
                                    } else {
                                        await runQuery(
                                            `INSERT INTO session_history
                                             (user_id, session_type_id, date, count, points_gained, validated,
                                              validated_by)
                                             VALUES (?, ?, ?, ?, ?, 1, ?)`,
                                            [
                                                pendingSession.user_id,
                                                detail.session_type_id,
                                                pendingSession.date,
                                                detail.count,
                                                pointsGained,
                                                validatorId
                                            ]
                                        );
                                    }

                                    // Mettre à jour le score total de l'utilisateur
                                    await runQuery(
                                        'UPDATE utilisateurs SET score_total = score_total + ? WHERE discord_id = ?',
                                        [pointsGained, pendingSession.user_id]
                                    );
                                }

                                db.run('COMMIT', function (err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    resolve();
                                });
                            } catch (error) {
                                db.run('ROLLBACK');
                                reject(error);
                            }
                        } else {
                            db.run('COMMIT', function (err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }
                                resolve();
                            });
                        }
                    }
                );
            });
        });
    }
};

module.exports = {
    User,
    SessionType,
    PendingSession,
    SessionHistory,
    Semester,
    SystemSettings
};