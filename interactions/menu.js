const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isAdmin, isStaff } = require('../utils/auth');

/**
 * Affiche le menu principal interactif
 * @param {Message|ButtonInteraction} source - Message ou interaction source
 */
async function displayMainMenu(source) {
    try {
        const isMessage = !source.isButton;

        // Pour les boutons, différer la mise à jour SEULEMENT si ce n'est pas déjà fait
        if (!isMessage && !source.deferred && !source.replied) {
            await source.deferUpdate().catch(console.error);
        }

        const userId = isMessage ? source.author.id : source.user.id;

        // Vérifier les rôles de l'utilisateur
        const isUserAdmin = await isAdmin(userId);
        const isUserStaff = await isStaff(userId);

        // Créer l'embed du menu principal
        const embed = new EmbedBuilder()
            .setTitle('🎮 Valorant Association - Menu Principal')
            .setDescription('Bienvenue dans l\'interface de gestion de l\'Association Valorant!\nSélectionnez une action ci-dessous:')
            .setColor(0xFD4556) // Couleur rouge de Valorant
            .setFooter({ text: 'Association Valorant' });

        // Créer la rangée de boutons pour les utilisateurs
        const userRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_view')
                    .setLabel('Mon Profil')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId('profile_edit')
                    .setLabel('Éditer Profil')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId('sessions_announce')
                    .setLabel('Annoncer Sessions')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📝')
            );

        // Créer la rangée de boutons pour les infos générales
        const infoRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sessions_list')
                    .setLabel('Types de Sessions')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId('semester_list')
                    .setLabel('Semestres')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🗓️'),
                new ButtonBuilder()
                    .setCustomId('semester_points')
                    .setLabel('Mes Points')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏆'),
                new ButtonBuilder()
                    .setCustomId('semester_ranking')
                    .setLabel('Classement')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🥇')
            );

        // Composants à envoyer
        const components = [userRow, infoRow];

        // Ajouter des boutons pour le staff si l'utilisateur est staff
        if (isUserStaff) {
            const staffRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_pending_list')
                        .setLabel('Annonces en Attente')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⏳'),
                    new ButtonBuilder()
                        .setCustomId('admin_view_user')
                        .setLabel('Voir Profil Utilisateur')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔍')
                );

            components.push(staffRow);
        }

        // Ajouter des boutons pour l'admin si l'utilisateur est admin
        if (isUserAdmin) {
            const adminRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_session_management')
                        .setLabel('Gérer Sessions')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⚙️'),
                    new ButtonBuilder()
                        .setCustomId('admin_semester_management')
                        .setLabel('Gérer Semestres')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('📅'),
                    new ButtonBuilder()
                        .setCustomId('admin_role_management')
                        .setLabel('Gérer Rôles')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('👑')
                );

            components.push(adminRow);
        }

        // Envoyer ou modifier le message selon la source
        if (isMessage) {
            return await source.channel.send({
                embeds: [embed],
                components: components
            });
        } else {
            return await source.editReply({
                embeds: [embed],
                components: components
            });
        }
    } catch (error) {
        console.error('Erreur lors de l\'affichage du menu principal:', error);

        if (!isMessage && source.deferred) {
            await source.editReply({
                content: 'Une erreur est survenue lors de l\'affichage du menu principal.',
                components: []
            }).catch(console.error);
        }

        throw error;
    }
}

module.exports = {
    displayMainMenu
};