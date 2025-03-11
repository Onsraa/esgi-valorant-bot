const { db, runQuery, getOne, getAll } = require('./db');
const { formatNom, formatPrenom, formatClasse, validateEmail } = require('../utils/formatters');
const moment = require('moment');

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

// Modèle pour les types de sessions
const SessionType = {
    // Obtenir tous les types de sessions actifs
    async getAll() {
        return await getAll('SELECT * FROM session_types WHERE active = 1');
    },

    // Obtenir un type de session par son ID
    async getById(typeId) {
        return await getOne('SELECT * FROM session_types WHERE id = ?', [typeId]);
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
        return await runQuery(
            'UPDATE session_types SET active = 0 WHERE id = ?',
            [typeId]
        );
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
                    async function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        if (approve) {
                            try {
                                // Récupérer la session en attente
                                const pendingSession = await PendingSession.getById(pendingId);

                                for (const detail of pendingSession.details) {
                                    // Récupérer le type de session pour connaître les points
                                    const sessionType = await SessionType.getById(detail.session_type_id);
                                    const pointsGained = sessionType.points * detail.count;

                                    // Ajouter à l'historique
                                    await runQuery(
                                        `INSERT INTO session_history 
                     (user_id, session_type_id, date, count, points_gained, validated, validated_by) 
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

                                    // Mettre à jour le score total de l'utilisateur
                                    await runQuery(
                                        'UPDATE utilisateurs SET score_total = score_total + ? WHERE discord_id = ?',
                                        [pointsGained, pendingSession.user_id]
                                    );
                                }

                                db.run('COMMIT', function(err) {
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
                            db.run('COMMIT', function(err) {
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

// Modèle pour l'historique des sessions
const SessionHistory = {
    // Obtenir l'historique des sessions d'un utilisateur
    async getUserHistory(userId) {
        return await getAll(
            `SELECT h.id, h.user_id, h.session_type_id, t.nom as session_name, h.date, 
              h.count, h.points_gained, h.validated, h.validated_by
       FROM session_history h
       JOIN session_types t ON h.session_type_id = t.id
       WHERE h.user_id = ? AND h.validated = 1
       ORDER BY h.date DESC`,
            [userId]
        );
    },

    // Obtenir les points par type de session pour un utilisateur
    async getUserPointsByType(userId) {
        return await getAll(
            `SELECT t.nom, SUM(h.points_gained) as total_points
       FROM session_history h
       JOIN session_types t ON h.session_type_id = t.id
       WHERE h.user_id = ? AND h.validated = 1
       GROUP BY t.id
       ORDER BY total_points DESC`,
            [userId]
        );
    }
};

module.exports = {
    User,
    SessionType,
    PendingSession,
    SessionHistory
};