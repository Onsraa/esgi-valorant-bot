const { EmbedBuilder } = require('discord.js');
const { PendingSession, SessionType } = require('../database/models');
const { isStaff } = require('../utils/auth');
const config = require('../config');

// Traitement des interactions de validation des annonces
async function handleValidation(client, interaction) {
    try {
        // Vérifier que l'utilisateur est staff ou admin en utilisant la base de données
        if (!await isStaff(interaction.user.id)) {
            return interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
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
            return interaction.editReply({
                content: 'Cette annonce n\'existe plus ou a déjà été traitée.',
                components: []
            });
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

        await interaction.editReply({
            embeds: [replyEmbed],
            components: []
        });
    } catch (error) {
        console.error('Erreur lors du traitement de l\'interaction de validation:', error);

        // Essayer de répondre à l'interaction
        try {
            if (interaction.deferred) {
                await interaction.editReply({ content: `Erreur: ${error.message}` });
            } else {
                await interaction.reply({
                    content: `Erreur: ${error.message}`,
                    ephemeral: true
                });
            }
        } catch (replyError) {
            console.error('Erreur lors de la réponse à l\'interaction:', replyError);
        }
    }
}

module.exports = handleValidation;