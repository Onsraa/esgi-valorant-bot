const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { SessionType, User } = require('../database/models');
const { isAdmin } = require('../utils/auth');

/**
 * Gère les interactions liées aux fonctionnalités administratives
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function handleAdminInteraction(interaction) {
    const buttonId = interaction.customId;

    // Vérifier que l'utilisateur est admin
    if (!(await isAdmin(interaction.user.id)) && !buttonId.startsWith('admin_view_user_back')) {
        await interaction.reply({
            content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
            ephemeral: true
        });
        return;
    }

    // Gestion des types de sessions
    if (buttonId === 'admin_session_management') {
        await displaySessionManagement(interaction);
        return;
    }

    // Créer un nouveau type de session
    if (buttonId === 'admin_create_session_type') {
        await showCreateSessionTypeModal(interaction);
        return;
    }

    // Modifier un type de session
    if (buttonId === 'admin_edit_session_type') {
        await displaySessionTypeSelector(interaction, 'edit');
        return;
    }

    // Supprimer un type de session
    if (buttonId === 'admin_delete_session_type') {
        await displaySessionTypeSelector(interaction, 'delete');
        return;
    }

    // Gestion des rôles
    if (buttonId === 'admin_role_management') {
        await displayRoleManagement(interaction);
        return;
    }

    // Définir le rôle d'un utilisateur
    if (buttonId === 'admin_set_role') {
        await displayUserSelectorForRole(interaction);
        return;
    }

    // Retour au menu principal
    if (buttonId === 'admin_back') {
        const { displayMainMenu } = require('./menu');
        await displayMainMenu(interaction);
        return;
    }

    // Retour au menu de gestion des sessions
    if (buttonId === 'admin_back_session_management') {
        await displaySessionManagement(interaction);
        return;
    }

    // Retour au menu de gestion des rôles
    if (buttonId === 'admin_back_role_management') {
        await displayRoleManagement(interaction);
        return;
    }
}

/**
 * Gère les soumissions de formulaires administratifs
 * @param {ModalSubmitInteraction} interaction - L'interaction de soumission de formulaire
 */
async function handleAdminSubmit(interaction) {
    const modalId = interaction.customId;

    // Vérifier que l'utilisateur est admin
    if (!(await isAdmin(interaction.user.id))) {
        await interaction.reply({
            content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
            ephemeral: true
        });
        return;
    }

    // Création d'un type de session
    if (modalId === 'admin_create_session_type') {
        await createSessionType(interaction);
        return;
    }

    // Modification d'un type de session
    if (modalId.startsWith('admin_edit_session_type_')) {
        await updateSessionType(interaction);
        return;
    }

    // Configuration du système
    if (modalId === 'config_system_modal') {
        await updateSystemConfig(interaction);
        return;
    }
}

/**
 * Affiche les options de gestion des types de sessions
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displaySessionManagement(interaction) {
    try {
        const embed = new EmbedBuilder()
            .setTitle('Gestion des types de sessions')
            .setDescription('Sélectionnez une action:')
            .setColor(0xFF0000);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_create_session_type')
                    .setLabel('Créer un type de session')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('admin_edit_session_type')
                    .setLabel('Modifier un type de session')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId('admin_delete_session_type')
                    .setLabel('Supprimer un type de session')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des options de gestion des types de sessions:', error);
        throw error;
    }
}

/**
 * Affiche un modal pour créer un nouveau type de session
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function showCreateSessionTypeModal(interaction) {
    try {
        // Créer le modal
        const modal = new ModalBuilder()
            .setCustomId('admin_create_session_type')
            .setTitle('Créer un type de session');

        // Ajouter les champs
        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Nom du type de session')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000);

        const pointsInput = new TextInputBuilder()
            .setCustomId('points')
            .setLabel('Points par session')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Nombre entier positif');

        // Ajouter les champs au modal
        const nameRow = new ActionRowBuilder().addComponents(nameInput);
        const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
        const pointsRow = new ActionRowBuilder().addComponents(pointsInput);

        modal.addComponents(nameRow, descriptionRow, pointsRow);

        // Afficher le modal
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal de création de type de session:', error);
        throw error;
    }
}

/**
 * Crée un nouveau type de session
 * @param {ModalSubmitInteraction} interaction - L'interaction de soumission de formulaire
 */
async function createSessionType(interaction) {
    try {
        // Récupérer les valeurs du formulaire
        const nom = interaction.fields.getTextInputValue('name');
        const description = interaction.fields.getTextInputValue('description');
        const pointsStr = interaction.fields.getTextInputValue('points');

        // Vérifier que les points sont un nombre entier
        const points = parseInt(pointsStr);
        if (isNaN(points) || points <= 0) {
            await interaction.reply({
                content: 'Le nombre de points doit être un entier positif.',
                ephemeral: true
            });
            return;
        }

        // Créer le type de session
        const result = await SessionType.create(nom, description, points);

        // Créer un embed de confirmation
        const embed = new EmbedBuilder()
            .setTitle('Type de session créé')
            .setDescription(`Le type de session "${nom}" a été créé avec succès.`)
            .setColor(0x00FF00)
            .addFields(
                { name: 'ID', value: result.id.toString(), inline: true },
                { name: 'Points', value: points.toString(), inline: true }
            );

        if (description) {
            embed.addFields({ name: 'Description', value: description });
        }

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back_session_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('Erreur lors de la création du type de session:', error);

        await interaction.reply({
            content: `Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

/**
 * Affiche un sélecteur pour choisir un type de session
 * @param {ButtonInteraction} interaction - L'interaction bouton
 * @param {string} action - L'action à effectuer (edit ou delete)
 */
async function displaySessionTypeSelector(interaction, action) {
    try {
        // Récupérer les types de sessions
        const sessionTypes = await SessionType.getAll();

        if (!sessionTypes || sessionTypes.length === 0) {
            await interaction.update({
                content: 'Aucun type de session configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        // Créer un sélecteur avec les types de sessions disponibles
        const options = sessionTypes.map(type => (
            new StringSelectMenuOptionBuilder()
                .setLabel(type.nom)
                .setDescription(`${type.points} points${type.description ? ` - ${type.description.substring(0, 50)}${type.description.length > 50 ? '...' : ''}` : ''}`)
                .setValue(type.id.toString())
        ));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`session_type_${action}_selector`)
                    .setPlaceholder(`Sélectionner un type de session à ${action === 'edit' ? 'modifier' : 'supprimer'}`)
                    .addOptions(options)
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back_session_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            content: `Sélectionnez un type de session à ${action === 'edit' ? 'modifier' : 'supprimer'}:`,
            embeds: [],
            components: [row, backButton]
        });
    } catch (error) {
        console.error(`Erreur lors de l'affichage du sélecteur de type de session pour ${action}:`, error);
        throw error;
    }
}

/**
 * Affiche un modal pour modifier un type de session
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 */
async function showEditSessionTypeModal(interaction) {
    try {
        const sessionTypeId = interaction.values[0];

        // Récupérer le type de session
        const sessionType = await SessionType.getById(sessionTypeId);

        if (!sessionType) {
            await interaction.update({
                content: `Type de session ID ${sessionTypeId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Créer le modal
        const modal = new ModalBuilder()
            .setCustomId(`admin_edit_session_type_${sessionTypeId}`)
            .setTitle(`Modifier: ${sessionType.nom}`);

        // Ajouter les champs
        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Nom du type de session')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
            .setValue(sessionType.nom);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
            .setValue(sessionType.description || '');

        const pointsInput = new TextInputBuilder()
            .setCustomId('points')
            .setLabel('Points par session')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(sessionType.points.toString());

        // Ajouter les champs au modal
        const nameRow = new ActionRowBuilder().addComponents(nameInput);
        const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
        const pointsRow = new ActionRowBuilder().addComponents(pointsInput);

        modal.addComponents(nameRow, descriptionRow, pointsRow);

        // Afficher le modal
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal de modification de type de session:', error);
        throw error;
    }
}

/**
 * Met à jour un type de session
 * @param {ModalSubmitInteraction} interaction - L'interaction de soumission de formulaire
 */
async function updateSessionType(interaction) {
    try {
        const modalId = interaction.customId;
        const sessionTypeId = modalId.split('_').pop();

        // Récupérer les valeurs du formulaire
        const nom = interaction.fields.getTextInputValue('name');
        const description = interaction.fields.getTextInputValue('description');
        const pointsStr = interaction.fields.getTextInputValue('points');

        // Vérifier que les points sont un nombre entier
        const points = parseInt(pointsStr);
        if (isNaN(points) || points <= 0) {
            await interaction.reply({
                content: 'Le nombre de points doit être un entier positif.',
                ephemeral: true
            });
            return;
        }

        // Mettre à jour le type de session
        await SessionType.update(sessionTypeId, nom, description, points);

        // Créer un embed de confirmation
        const embed = new EmbedBuilder()
            .setTitle('Type de session mis à jour')
            .setDescription(`Le type de session "${nom}" a été mis à jour avec succès.`)
            .setColor(0x00FF00)
            .addFields(
                { name: 'ID', value: sessionTypeId, inline: true },
                { name: 'Points', value: points.toString(), inline: true }
            );

        if (description) {
            embed.addFields({ name: 'Description', value: description });
        }

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back_session_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du type de session:', error);

        await interaction.reply({
            content: `Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

/**
 * Supprime un type de session
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 */
async function deleteSessionType(interaction) {
    try {
        const sessionTypeId = interaction.values[0];

        // Récupérer le type de session
        const sessionType = await SessionType.getById(sessionTypeId);

        if (!sessionType) {
            await interaction.update({
                content: `Type de session ID ${sessionTypeId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Supprimer le type de session
        await SessionType.delete(sessionTypeId);

        // Créer un embed de confirmation
        const embed = new EmbedBuilder()
            .setTitle('Type de session supprimé')
            .setDescription(`Le type de session "${sessionType.nom}" a été supprimé avec succès.`)
            .setColor(0x00FF00);

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back_session_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du type de session:', error);

        await interaction.update({
            content: `Erreur: ${error.message}`,
            embeds: [],
            components: []
        });
    }
}

/**
 * Affiche les options de gestion des rôles
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displayRoleManagement(interaction) {
    try {
        const embed = new EmbedBuilder()
            .setTitle('Gestion des rôles utilisateurs')
            .setDescription('Sélectionnez une action:')
            .setColor(0xFF0000);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_set_role')
                    .setLabel('Définir le rôle d\'un utilisateur')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👑')
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des options de gestion des rôles:', error);
        throw error;
    }
}

/**
 * Affiche un sélecteur pour choisir un utilisateur à modifier
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displayUserSelectorForRole(interaction) {
    try {
        // Récupérer tous les utilisateurs de la base de données
        const allUsers = await User.getAllUsers();

        // Limiter à 25 options maximum (limite de Discord)
        const options = allUsers.slice(0, 25).map(user => ({
            label: user.username,
            description: `Rôle actuel: ${getRoleDisplayName(user.role)}${user.nom && user.prenom ? ` - ${user.prenom} ${user.nom}` : ''}`,
            value: user.discord_id
        }));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('role_user_selector')
                    .setPlaceholder('Sélectionner un utilisateur')
                    .addOptions(options)
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back_role_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            content: 'Sélectionnez un utilisateur pour modifier son rôle:',
            embeds: [],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage du sélecteur d\'utilisateurs pour rôle:', error);
        throw error;
    }
}

/**
 * Affiche les options de rôle pour un utilisateur
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 */
async function displayRoleOptions(interaction) {
    try {
        const userId = interaction.values[0];

        // Récupérer l'utilisateur
        const user = await User.getById(userId);

        if (!user) {
            await interaction.update({
                content: `Utilisateur ID ${userId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Récupérer le membre Discord
        let username = user.username;
        try {
            const member = await interaction.guild.members.fetch(userId);
            username = member.user.username;
        } catch (error) {
            console.error('Impossible de récupérer le membre Discord:', error);
        }

        // Créer l'embed
        const embed = new EmbedBuilder()
            .setTitle(`Modifier le rôle de ${username}`)
            .setDescription(`Sélectionnez le nouveau rôle pour <@${userId}>`)
            .setColor(0x0099FF)
            .addFields(
                { name: 'Rôle actuel', value: getRoleDisplayName(user.role) }
            );

        // Options de rôle
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`set_role_${userId}_user`)
                    .setLabel('Membre')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId(`set_role_${userId}_staff`)
                    .setLabel('Staff')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🛠️'),
                new ButtonBuilder()
                    .setCustomId(`set_role_${userId}_admin`)
                    .setLabel('Administrateur')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('👑')
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back_role_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des options de rôle:', error);
        throw error;
    }
}

/**
 * Met à jour le rôle d'un utilisateur
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function updateUserRole(interaction) {
    try {
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const role = parts[3];

        // Récupérer l'utilisateur
        const user = await User.getById(userId);

        if (!user) {
            await interaction.update({
                content: `Utilisateur ID ${userId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Mettre à jour le rôle
        await User.updateRole(userId, role);

        // Créer un embed de confirmation
        const embed = new EmbedBuilder()
            .setTitle('Rôle mis à jour')
            .setDescription(`Le rôle de <@${userId}> a été mis à jour à "${getRoleDisplayName(role)}".`)
            .setColor(0x00FF00);

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back_role_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du rôle:', error);

        await interaction.update({
            content: `Erreur: ${error.message}`,
            embeds: [],
            components: []
        });
    }
}

/**
 * Met à jour les paramètres système
 * @param {ModalSubmitInteraction} interaction - L'interaction de soumission de formulaire
 */
async function updateSystemConfig(interaction) {
    try {
        const { SystemSettings } = require('../database/models');

        // Récupérer les valeurs du formulaire
        const noteMaxStr = interaction.fields.getTextInputValue('note_max');
        const thresholdsStr = interaction.fields.getTextInputValue('thresholds');
        const notesStr = interaction.fields.getTextInputValue('notes');

        // Mettre à jour les paramètres si fournis
        if (noteMaxStr) {
            const noteMax = parseFloat(noteMaxStr);
            if (isNaN(noteMax)) {
                await interaction.reply({
                    content: 'La note maximale doit être un nombre.',
                    ephemeral: true
                });
                return;
            }

            await SystemSettings.update('NOTE_MAX', noteMax.toString(), 'Note maximale pour un semestre');
        }

        if (thresholdsStr) {
            // Vérifier que la valeur est un tableau JSON valide
            try {
                const thresholds = JSON.parse(thresholdsStr);
                if (!Array.isArray(thresholds)) {
                    await interaction.reply({
                        content: 'Les seuils de percentiles doivent être un tableau JSON (ex: [25,50,75,100]).',
                        ephemeral: true
                    });
                    return;
                }

                await SystemSettings.update('PERCENTILE_THRESHOLDS', thresholdsStr, 'Seuils de percentiles pour l\'attribution des notes (en pourcentage)');
            } catch (e) {
                await interaction.reply({
                    content: 'Format JSON invalide pour les seuils de percentiles. Exemple correct: [25,50,75,100]',
                    ephemeral: true
                });
                return;
            }
        }

        if (notesStr) {
            // Vérifier que la valeur est un tableau JSON valide
            try {
                const notes = JSON.parse(notesStr);
                if (!Array.isArray(notes)) {
                    await interaction.reply({
                        content: 'Les notes par seuil doivent être un tableau JSON (ex: [4,3,2,1]).',
                        ephemeral: true
                    });
                    return;
                }

                await SystemSettings.update('PERCENTILE_NOTES', notesStr, 'Notes attribuées pour chaque seuil de percentile');
            } catch (e) {
                await interaction.reply({
                    content: 'Format JSON invalide pour les notes par seuil. Exemple correct: [4,3,2,1]',
                    ephemeral: true
                });
                return;
            }
        }

        // Créer un embed de confirmation
        const embed = new EmbedBuilder()
            .setTitle('Paramètres système mis à jour')
            .setDescription('Les paramètres système ont été mis à jour avec succès.')
            .setColor(0x00FF00);

        if (noteMaxStr) {
            embed.addFields({ name: 'Note maximale', value: noteMaxStr });
        }

        if (thresholdsStr) {
            embed.addFields({ name: 'Seuils de percentiles', value: thresholdsStr });
        }

        if (notesStr) {
            embed.addFields({ name: 'Notes par seuil', value: notesStr });
        }

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des paramètres système:', error);

        await interaction.reply({
            content: `Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

/**
 * Retourne le nom d'affichage d'un rôle
 * @param {string} role - Le code du rôle (user, staff, admin)
 * @returns {string} Le nom d'affichage du rôle
 */
function getRoleDisplayName(role) {
    const roleNames = {
        'user': 'Membre',
        'staff': 'Staff',
        'admin': 'Administrateur'
    };

    return roleNames[role] || 'Membre';
}

module.exports = {
    handleAdminInteraction,
    handleAdminSubmit,
    showEditSessionTypeModal,
    deleteSessionType,
    displayRoleOptions,
    updateUserRole
};