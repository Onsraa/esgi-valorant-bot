const { Events } = require('discord.js');
const menuHandler = require('./menu');
const profileHandler = require('./profile');
const sessionsHandler = require('./sessions');
const semesterHandler = require('./semester');
const adminHandler = require('./admin');

/**
 * Configure les gestionnaires d'interactions pour le client Discord
 * @param {Client} client - Le client Discord
 */
function setupInteractions(client) {
    client.on(Events.InteractionCreate, async interaction => {
        try {
            // Log pour débogage
            if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
                console.log(`Interaction reçue: ${interaction.customId}`);
            }

            // Gérer les interactions de boutons
            if (interaction.isButton()) {
                // Pas besoin de deferUpdate/deferReply ici, car chaque gestionnaire spécifique le fera
                const buttonId = interaction.customId;

                // Menu principal
                if (buttonId === 'main_menu') {
                    await menuHandler.displayMainMenu(interaction);
                    return;
                }

                // Profil utilisateur
                if (buttonId.startsWith('profile_')) {
                    await profileHandler.handleProfileInteraction(interaction);
                    return;
                }

                // Gestion des sessions
                if (buttonId.startsWith('sessions_')) {
                    await sessionsHandler.handleSessionsInteraction(interaction);
                    return;
                }

                // Gestion des semestres
                if (buttonId.startsWith('semester_')) {
                    await semesterHandler.handleSemesterInteraction(interaction);
                    return;
                }

                // Commandes d'administration
                if (buttonId.startsWith('admin_')) {
                    // Log spécifique pour les boutons admin
                    console.log(`Traitement du bouton admin: ${buttonId}`);

                    // Cas spécifiques
                    if (buttonId === 'admin_semester_management') {
                        await semesterHandler.handleSemesterInteraction(interaction);
                        return;
                    }

                    if (buttonId === 'admin_session_management') {
                        await adminHandler.handleAdminInteraction(interaction);
                        return;
                    }

                    if (buttonId === 'admin_role_management') {
                        await adminHandler.handleAdminInteraction(interaction);
                        return;
                    }

                    if (buttonId === 'admin_view_user') {
                        await profileHandler.handleProfileInteraction(interaction);
                        return;
                    }

                    if (buttonId === 'admin_pending_list') {
                        await sessionsHandler.handleSessionsInteraction(interaction);
                        return;
                    }

                    // Pour les autres boutons admin
                    await adminHandler.handleAdminInteraction(interaction);
                    return;
                }

                // Valider/Rejeter les annonces en attente
                if (buttonId.startsWith('approve_') || buttonId.startsWith('reject_')) {
                    await sessionsHandler.handleValidationInteraction(client, interaction);
                    return;
                }

                // Définir le rôle d'un utilisateur
                if (buttonId.startsWith('set_role_')) {
                    await adminHandler.updateUserRole(interaction);
                    return;
                }

                // Voir les points d'un utilisateur (bouton explicite)
                if (buttonId.startsWith('view_points_')) {
                    await interaction.deferUpdate().catch(console.error);
                    const userId = buttonId.split('_').pop();

                    try {
                        // Récupérer le semestre actif
                        const activeSemester = await semesterHandler.getActiveSemester();

                        if (!activeSemester) {
                            await interaction.editReply({
                                content: 'Aucun semestre actif n\'est configuré.',
                                components: []
                            });
                            return;
                        }

                        // Afficher les points de l'utilisateur pour le semestre actif
                        await semesterHandler.displayUserPoints(interaction, userId, activeSemester.id);
                    } catch (error) {
                        console.error('Erreur lors de l\'affichage des points:', error);
                        await interaction.editReply({
                            content: 'Une erreur est survenue lors de l\'affichage des points.',
                            components: []
                        });
                    }
                    return;
                }
            }

            // Gérer les sélecteurs
            if (interaction.isStringSelectMenu()) {
                // Pas besoin de deferUpdate/deferReply ici, car chaque gestionnaire spécifique le fera
                const selectId = interaction.customId;

                console.log(`Sélecteur activé: ${selectId}`);

                if (selectId === 'profile_selector') {
                    await profileHandler.handleProfileSelection(interaction);
                    return;
                }

                if (selectId === 'session_type_selector') {
                    await sessionsHandler.handleSessionTypeSelection(interaction);
                    return;
                }

                if (selectId === 'role_user_selector') {
                    await adminHandler.displayRoleOptions(interaction);
                    return;
                }

                // Handle semester selectors
                if (selectId.startsWith('semester_')) {
                    await semesterHandler.handleSemesterSelection(interaction);
                    return;
                }

                // Handle session type selectors for admin
                if (selectId === 'session_type_edit_selector') {
                    await adminHandler.showEditSessionTypeModal(interaction);
                    return;
                }

                if (selectId === 'session_type_delete_selector') {
                    await adminHandler.deleteSessionType(interaction);
                    return;
                }
            }

            // Gérer les formulaires modaux
            if (interaction.isModalSubmit()) {
                const modalId = interaction.customId;

                console.log(`Modal soumis: ${modalId}`);

                if (modalId === 'edit_profile_modal') {
                    await profileHandler.handleProfileSubmit(interaction);
                    return;
                }

                if (modalId === 'add_semester_modal' || modalId.startsWith('edit_semester_')) {
                    await semesterHandler.handleSemesterSubmit(interaction);
                    return;
                }

                if (modalId === 'admin_create_session_type' || modalId.startsWith('admin_edit_session_type_')) {
                    await adminHandler.handleAdminSubmit(interaction);
                    return;
                }

                if (modalId === 'config_system_modal') {
                    await adminHandler.handleAdminSubmit(interaction);
                    return;
                }
            }
        } catch (error) {
            console.error('Erreur lors du traitement de l\'interaction:', error);

            // Répondre avec une erreur si l'interaction n'a pas encore reçu de réponse
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: 'Une erreur est survenue lors du traitement de cette interaction.',
                        components: []
                    }).catch(console.error);
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: 'Une erreur est survenue lors du traitement de cette interaction.',
                        ephemeral: true
                    }).catch(console.error);
                }
            } catch (replyError) {
                console.error('Erreur lors de la réponse à l\'erreur:', replyError);
            }
        }
    });
}

module.exports = {
    setupInteractions
};