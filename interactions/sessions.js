const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { User, SessionType, PendingSession } = require('../database/models');
const { today } = require('../utils/formatters');
const { isStaff, isAdmin } = require('../utils/auth');
const { sessionData } = require('../utils/sharedData');
const config = require('../config');

/**
 * Gère les interactions liées aux sessions
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function handleSessionsInteraction(interaction) {
    const buttonId = interaction.customId;

    // Valider les sessions
    if (buttonId === 'sessions_submit') {
        await handleSessionSubmit(interaction);
        return;
    }

    // Annoncer des sessions
    if (buttonId === 'sessions_announce') {
        await startSessionAnnouncement(interaction);
        return;
    }

    // Afficher la liste des types de sessions
    if (buttonId === 'sessions_list') {
        await displaySessionTypes(interaction);
        return;
    }

    // Gérer les annonces en attente (staff/admin uniquement)
    if (buttonId === 'admin_pending_list') {
        await displayPendingSessions(interaction);
        return;
    }

    // Retour au menu principal
    if (buttonId === 'sessions_back') {
        const { displayMainMenu } = require('./menu');
        await displayMainMenu(interaction);
        return;
    }
}
/**
 * Affiche la liste des types de sessions
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displaySessionTypes(interaction) {
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

        const embed = new EmbedBuilder()
            .setTitle('Types de sessions')
            .setColor(0x0099FF);

        sessionTypes.forEach(sessionType => {
            embed.addFields({
                name: `${sessionType.nom} (${sessionType.points} points)`,
                value: sessionType.description || 'Pas de description'
            });
        });

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sessions_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des types de sessions:', error);
        throw error;
    }
}

/**
 * Démarre le processus d'annonce de sessions
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function startSessionAnnouncement(interaction) {
    try {
        // Récupérer l'utilisateur
        const user = await User.getById(interaction.user.id);

        if (!user) {
            await interaction.update({
                content: 'Vous n\'êtes pas enregistré dans la base de données.',
                embeds: [],
                components: []
            });
            return;
        }

        // Vérifier si l'utilisateur a complété son profil
        if (!User.isProfileComplete(user)) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('profile_edit')
                        .setLabel('Éditer profil')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('sessions_back')
                        .setLabel('Retour au menu')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                );

            await interaction.update({
                content: 'Vous devez compléter votre profil avant de pouvoir annoncer des sessions.',
                embeds: [],
                components: [row]
            });
            return;
        }

        // Récupérer les types de sessions
        const sessionTypes = await SessionType.getAll();

        if (!sessionTypes || sessionTypes.length === 0) {
            await interaction.update({
                content: 'Aucun type de session n\'est configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        // Date du jour
        const todayDate = today();

        // Créer l'embed d'annonce
        const embed = new EmbedBuilder()
            .setTitle('Annonce de sessions')
            .setDescription(`Date: **${todayDate}**\n\nSélectionnez le type et le nombre de sessions que vous avez effectuées:`)
            .setColor(0xFFD700);

        // Créer le sélecteur de type de session
        const options = sessionTypes.map(type => (
            new StringSelectMenuOptionBuilder()
                .setLabel(type.nom)
                .setDescription(`${type.description || type.nom} (${type.points} points)`)
                .setValue(type.id.toString())
        ));

        const typeSelector = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('session_type_selector')
                    .setPlaceholder('Sélectionner un type de session')
                    .addOptions(options)
            );

        // Créer les boutons d'annulation et de validation
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sessions_back')
                    .setLabel('Annuler')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        // Initialiser ou réinitialiser les compteurs pour cet utilisateur
        const userCounts = new Map();
        sessionTypes.forEach(type => userCounts.set(type.id.toString(), 0));
        sessionData.set(interaction.user.id, userCounts);

        await interaction.update({
            embeds: [embed],
            components: [typeSelector, actionRow]
        });
    } catch (error) {
        console.error('Erreur lors du démarrage de l\'annonce de sessions:', error);
        throw error;
    }
}

/**
 * Gère la sélection d'un type de session
 * @param {SelectMenuInteraction} interaction - L'interaction de sélection
 */
async function handleSessionTypeSelection(interaction) {
    try {
        const selectedTypeId = interaction.values[0];

        // Récupérer les données de session de l'utilisateur
        if (!sessionData || !sessionData.has(interaction.user.id)) {
            // Redémarrer le processus si les données sont perdues
            await startSessionAnnouncement(interaction);
            return;
        }

        const userCounts = sessionData.get(interaction.user.id);
        const sessionTypes = await SessionType.getAll();
        const selectedType = sessionTypes.find(type => type.id.toString() === selectedTypeId);

        if (!selectedType) {
            await interaction.update({
                content: 'Type de session non trouvé. Veuillez réessayer.',
                components: []
            });
            return;
        }

        // Incrémenter le compteur pour ce type de session
        const currentCount = userCounts.get(selectedTypeId) || 0;
        userCounts.set(selectedTypeId, currentCount + 1);

        // Date du jour
        const todayDate = today();

        // Mettre à jour l'embed avec les sessions sélectionnées
        const embed = new EmbedBuilder()
            .setTitle('Annonce de sessions')
            .setDescription(`Date: **${todayDate}**\n\nSélectionnez d'autres sessions ou validez votre annonce:`)
            .setColor(0xFFD700);

        // Ajouter les sessions sélectionnées à l'embed
        let hasSessions = false;
        for (const [typeId, count] of userCounts.entries()) {
            if (count > 0) {
                const sessionType = sessionTypes.find(type => type.id.toString() === typeId);
                embed.addFields({
                    name: sessionType.nom,
                    value: `${count} session(s) - ${count * sessionType.points} points`,
                    inline: true
                });
                hasSessions = true;
            }
        }

        // Créer le sélecteur de type de session
        const options = sessionTypes.map(type => (
            new StringSelectMenuOptionBuilder()
                .setLabel(type.nom)
                .setDescription(`${type.description || type.nom} (${type.points} points)`)
                .setValue(type.id.toString())
        ));

        const typeSelector = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('session_type_selector')
                    .setPlaceholder('Ajouter une autre session')
                    .addOptions(options)
            );

        // Boutons d'action
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sessions_back')
                    .setLabel('Annuler')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        // Ajouter le bouton de validation si des sessions ont été sélectionnées
        if (hasSessions) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('sessions_submit')
                    .setLabel('Valider')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );
        }

        await interaction.update({
            embeds: [embed],
            components: [typeSelector, actionRow]
        });
    } catch (error) {
        console.error('Erreur lors de la sélection d\'un type de session:', error);
        throw error;
    }
}

/**
 * Traite la soumission d'une annonce de sessions
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function handleSessionSubmit(interaction) {
    try {
        // Différer la réponse pour éviter les timeouts
        await interaction.deferUpdate();

        // Vérifier que les données de session existent
        if (!sessionData || !sessionData.has(interaction.user.id)) {
            await interaction.editReply({
                content: 'Les données de session ont été perdues. Veuillez réessayer.',
                embeds: [],
                components: []
            });
            return;
        }

        const userCounts = sessionData.get(interaction.user.id);
        const todayDate = today();

        // Convertir les données pour la création de la session en attente
        const sessionTypeCounts = [];
        for (const [typeId, count] of userCounts.entries()) {
            if (count > 0) {
                sessionTypeCounts.push([parseInt(typeId), count]);
            }
        }

        if (sessionTypeCounts.length === 0) {
            await interaction.editReply({
                content: 'Vous devez annoncer au moins une session.',
                embeds: [],
                components: []
            });
            return;
        }

        // Créer la session en attente
        const pendingId = await PendingSession.create(interaction.user.id, todayDate, sessionTypeCounts);

        // Supprimer les données temporaires
        sessionData.delete(interaction.user.id);

        // Créer un embed de confirmation
        const successEmbed = new EmbedBuilder()
            .setTitle('Annonce soumise')
            .setDescription(`Votre annonce de sessions a été soumise avec succès.\nID: ${pendingId}\n\nUn membre du staff validera votre annonce prochainement.`)
            .setColor(0x00FF00);

        // Récupérer les types de sessions pour afficher le détail
        const sessionTypes = await SessionType.getAll();
        sessionTypeCounts.forEach(([typeId, count]) => {
            const sessionType = sessionTypes.find(type => type.id === typeId);
            successEmbed.addFields({
                name: sessionType.nom,
                value: `${count} session(s) - ${count * sessionType.points} points`,
                inline: true
            });
        });

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sessions_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.editReply({
            embeds: [successEmbed],
            components: [row]
        });

        // Notifier les staff et admins
        const notificationEmbed = new EmbedBuilder()
            .setTitle('Nouvelle annonce à valider')
            .setDescription(`Utilisateur: <@${interaction.user.id}>\nID: ${pendingId}\nDate: ${todayDate}`)
            .setColor(0x0099FF);

        // Ajouter les sessions annoncées
        sessionTypeCounts.forEach(([typeId, count]) => {
            const sessionType = sessionTypes.find(type => type.id === typeId);
            notificationEmbed.addFields({
                name: sessionType.nom,
                value: `${count} session(s)`,
                inline: true
            });
        });

        // Créer les boutons de validation/rejet
        const validationRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_${pendingId}`)
                    .setLabel('Approuver')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_${pendingId}`)
                    .setLabel('Rejeter')
                    .setStyle(ButtonStyle.Danger)
            );

        // Envoyer la notification
        await interaction.channel.send({
            content: `<@&${config.adminRoleId}> <@&${config.staffRoleId}> Nouvelle annonce de sessions à valider!`,
            embeds: [notificationEmbed],
            components: [validationRow]
        });
    } catch (error) {
        console.error('Erreur lors de la soumission de l\'annonce de sessions:', error);

        // Vérifier si l'erreur est due à un profil incomplet
        if (error.message.includes('Profil incomplet')) {
            await interaction.editReply({
                content: 'Vous devez compléter votre profil avant de pouvoir annoncer des sessions.',
                embeds: [],
                components: []
            });
        } else {
            await interaction.editReply({
                content: `Une erreur est survenue: ${error.message}`,
                embeds: [],
                components: []
            });
        }
    }
}

/**
 * Affiche la liste des annonces en attente
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displayPendingSessions(interaction) {
    try {
        // Vérifier que l'utilisateur est staff
        if (!(await isStaff(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        const pendingSessions = await PendingSession.getPending();

        if (!pendingSessions || pendingSessions.length === 0) {
            await interaction.update({
                content: 'Aucune annonce en attente.',
                embeds: [],
                components: []
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Annonces en attente')
            .setColor(0x0099FF);

        for (const session of pendingSessions) {
            let details = '';

            for (const detail of session.details) {
                details += `**${detail.session_name}**: ${detail.count} session(s)\n`;
            }

            embed.addFields({
                name: `ID: ${session.id} - <@${session.user_id}> - ${session.date}`,
                value: details
            });
        }

        // Ajouter des boutons pour chaque session
        const components = [];

        // Afficher maximum 5 sessions avec leurs boutons
        const displayedSessions = pendingSessions.slice(0, 5);

        for (const session of displayedSessions) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_${session.id}`)
                        .setLabel(`Approuver #${session.id}`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_${session.id}`)
                        .setLabel(`Rejeter #${session.id}`)
                        .setStyle(ButtonStyle.Danger)
                );

            components.push(row);
        }

        // Ajouter un bouton de retour
        const backRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sessions_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        components.push(backRow);

        await interaction.update({
            embeds: [embed],
            components: components
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des annonces en attente:', error);
        throw error;
    }
}

/**
 * Gère la validation ou le rejet d'une annonce
 * @param {Client} client - Le client Discord
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function handleValidationInteraction(client, interaction) {
    try {
        // Vérifier que l'utilisateur est staff ou admin
        if (!(await isStaff(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        // Extraire les informations de l'interaction
        const customId = interaction.customId;
        const approve = customId.startsWith('approve_');
        const pendingId = parseInt(customId.substring(approve ? 8 : 7));

        // Différer la réponse pour avoir le temps de traiter
        await interaction.deferUpdate();

        // Récupérer la session en attente
        const pendingSession = await PendingSession.getById(pendingId);

        if (!pendingSession) {
            await interaction.editReply({
                content: 'Cette annonce n\'existe plus ou a déjà été traitée.',
                components: []
            });
            return;
        }

        // Valider ou rejeter la session
        await PendingSession.validate(pendingId, interaction.user.id, approve);

        // Notifier l'utilisateur
        try {
            const user = await client.users.fetch(pendingSession.user_id);

            const status = approve ? 'approuvée' : 'rejetée';
            const color = approve ? 0x00FF00 : 0xFF0000;

            const dmEmbed = new EmbedBuilder()
                .setTitle(`Annonce ${status}`)
                .setDescription(`Votre annonce de sessions du ${pendingSession.date} a été ${status}.`)
                .setColor(color);

            if (approve) {
                // Calculer le total des points gagnés
                let totalPoints = 0;

                for (const detail of pendingSession.details) {
                    const sessionType = await SessionType.getById(detail.session_type_id);
                    const points = sessionType.points * detail.count;

                    totalPoints += points;

                    dmEmbed.addFields({
                        name: detail.session_name,
                        value: `${detail.count} session(s) × ${sessionType.points} points = ${points} points`
                    });
                }

                dmEmbed.addFields({ name: 'Total', value: `${totalPoints} points` });
            }

            await user.send({ embeds: [dmEmbed] }).catch(err => {
                console.error(`Impossible d'envoyer un DM à l'utilisateur ${pendingSession.user_id}:`, err);
            });
        } catch (error) {
            console.error(`Erreur lors de la notification de l'utilisateur ${pendingSession.user_id}:`, error);
        }

        // Mettre à jour le message original
        const replyEmbed = new EmbedBuilder()
            .setTitle(approve ? 'Annonce approuvée' : 'Annonce rejetée')
            .setDescription(`L'annonce ID ${pendingId} a été ${approve ? 'approuvée' : 'rejetée'} par <@${interaction.user.id}>`)
            .setColor(approve ? 0x00FF00 : 0xFF0000);

        // Bouton pour retourner à la liste des annonces en attente
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_pending_list')
                    .setLabel('Retour aux annonces')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.editReply({
            embeds: [replyEmbed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors du traitement de l\'interaction de validation:', error);

        // Essayer de répondre à l'interaction
        try {
            if (interaction.deferred) {
                await interaction.editReply({ content: `Erreur: ${error.message}` });
            } else {
                await interaction.reply({ content: `Erreur: ${error.message}`, ephemeral: true });
            }
        } catch (replyError) {
            console.error('Erreur lors de la réponse à l\'interaction:', replyError);
        }
    }
}

module.exports = {
    handleSessionsInteraction,
    handleSessionTypeSelection,
    handleSessionSubmit,
    handleValidationInteraction
};