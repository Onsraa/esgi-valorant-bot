const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { User, SessionHistory } = require('../database/models');
const { isStaff } = require('../utils/auth');

/**
 * Gère les interactions liées au profil utilisateur
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function handleProfileInteraction(interaction) {
    const buttonId = interaction.customId;

    // Affichage du profil
    if (buttonId === 'profile_view') {
        // Différer la réponse seulement pour l'affichage du profil
        await interaction.deferUpdate().catch(console.error);
        await displayProfile(interaction, interaction.user.id);
        return;
    }

    // Édition du profil - NE PAS différer pour les modals
    if (buttonId === 'profile_edit') {
        await showProfileEditModal(interaction);
        return;
    }

    // Voir le profil d'un autre utilisateur (staff/admin uniquement)
    if (buttonId === 'admin_view_user') {
        // Différer la réponse pour cette action
        await interaction.deferUpdate().catch(console.error);

        // Vérifier si l'utilisateur est staff
        if (!(await isStaff(interaction.user.id))) {
            await interaction.editReply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        // Créer un sélecteur pour choisir un utilisateur
        await displayUserSelector(interaction);
        return;
    }

    // Retour au menu principal
    if (buttonId === 'profile_back') {
        // Différer la réponse pour le retour au menu
        await interaction.deferUpdate().catch(console.error);
        const { displayMainMenu } = require('./menu');
        await displayMainMenu(interaction);
        return;
    }
}

/**
 * Gère la sélection d'un utilisateur pour voir son profil
 * @param {SelectMenuInteraction} interaction - L'interaction du menu de sélection
 */
async function handleProfileSelection(interaction) {
    // Différer la réponse immédiatement
    await interaction.deferUpdate().catch(console.error);

    const userId = interaction.values[0];
    await displayProfile(interaction, userId);
}

/**
 * Affiche le profil d'un utilisateur
 * @param {ButtonInteraction|SelectMenuInteraction} interaction - L'interaction
 * @param {string} userId - L'ID de l'utilisateur à afficher
 */
async function displayProfile(interaction, userId) {
    try {
        // Récupérer l'utilisateur
        const user = await User.getById(userId);

        if (!user) {
            await interaction.editReply({
                content: 'Utilisateur non trouvé dans la base de données.',
                embeds: [],
                components: []
            });
            return;
        }

        // Récupérer le membre Discord pour afficher son nom
        let username = user.username;
        try {
            const member = await interaction.guild.members.fetch(userId);
            username = member.user.username;
        } catch (error) {
            console.error('Impossible de récupérer le membre Discord:', error);
        }

        // Créer l'embed du profil
        const embed = new EmbedBuilder()
            .setTitle(`Profil de ${username}`)
            .setColor(0x0099FF);

        // Si l'utilisateur a un avatar, l'ajouter à l'embed
        try {
            const member = await interaction.guild.members.fetch(userId);
            embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        } catch (error) {
            // Ne pas afficher d'avatar si non disponible
        }

        // Informations de base
        if (User.isProfileComplete(user)) {
            embed.addFields(
                { name: 'Nom', value: user.nom, inline: true },
                { name: 'Prénom', value: user.prenom, inline: true },
                { name: 'Classe', value: user.classe, inline: true },
                { name: 'Email', value: user.email }
            );
        } else {
            embed.setDescription('**Profil incomplet**\nUtilisez le bouton "Éditer Profil" pour compléter votre profil.');
        }

        // Score total
        embed.addFields({ name: 'Score total', value: user.score_total.toString() });

        // Points par type de session
        const pointsByType = await SessionHistory.getUserPointsByType(userId);

        if (pointsByType && pointsByType.length > 0) {
            const pointsText = pointsByType
                .map(({ nom, total_points }) => `**${nom}**: ${total_points} points`)
                .join('\n');

            embed.addFields({ name: 'Points par type de session', value: pointsText });
        } else {
            embed.addFields({ name: 'Points par type de session', value: 'Aucune session enregistrée' });
        }

        // Date d'inscription et dernière activité
        embed.addFields(
            { name: 'Date d\'inscription', value: user.date_join, inline: true },
            { name: 'Dernière activité', value: user.last_active, inline: true }
        );

        // Rôle
        const roleText = {
            'admin': 'Administrateur',
            'staff': 'Staff',
            'user': 'Membre'
        }[user.role] || 'Membre';

        embed.addFields({ name: 'Rôle', value: roleText, inline: true });

        // Boutons de navigation
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        // Ajouter un bouton d'édition si c'est le profil de l'utilisateur actuel
        if (userId === interaction.user.id) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_edit')
                    .setLabel('Éditer profil')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️')
            );
        }

        // Toujours utiliser editReply
        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage du profil:', error);
        await interaction.editReply({
            content: 'Une erreur est survenue lors de l\'affichage du profil.',
            components: []
        }).catch(console.error);
    }
}

/**
 * Affiche un sélecteur pour choisir un utilisateur (staff/admin uniquement)
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displayUserSelector(interaction) {
    try {
        // Récupérer tous les utilisateurs de la base de données
        const allUsers = await User.getAllUsers();

        // Limiter à 25 options maximum (limite de Discord)
        const options = allUsers.slice(0, 25).map(user => ({
            label: user.username,
            description: `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Profil incomplet',
            value: user.discord_id
        }));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('profile_selector')
                    .setPlaceholder('Sélectionner un utilisateur')
                    .addOptions(options)
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.editReply({
            content: 'Veuillez sélectionner un utilisateur:',
            embeds: [],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage du sélecteur d\'utilisateurs:', error);
        await interaction.editReply({
            content: 'Une erreur est survenue lors de la récupération des utilisateurs.',
            components: []
        }).catch(console.error);
    }
}

/**
 * Affiche un modal pour éditer le profil
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function showProfileEditModal(interaction) {
    try {
        // Récupérer le profil actuel de l'utilisateur
        const user = await User.getById(interaction.user.id);

        // Créer le modal
        const modal = new ModalBuilder()
            .setCustomId('edit_profile_modal')
            .setTitle('Éditer votre profil');

        // Ajouter les champs
        const nomInput = new TextInputBuilder()
            .setCustomId('nom')
            .setLabel('Nom')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50);

        const prenomInput = new TextInputBuilder()
            .setCustomId('prenom')
            .setLabel('Prénom')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50);

        const classeInput = new TextInputBuilder()
            .setCustomId('classe')
            .setLabel('Classe (ex: ING4)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(20);

        const emailInput = new TextInputBuilder()
            .setCustomId('email')
            .setLabel('Email (doit contenir @myges)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        // Si l'utilisateur a déjà un profil, pré-remplir les champs
        if (user) {
            if (user.nom) nomInput.setValue(user.nom);
            if (user.prenom) prenomInput.setValue(user.prenom);
            if (user.classe) classeInput.setValue(user.classe);
            if (user.email) emailInput.setValue(user.email);
        }

        // Ajouter les champs au modal
        const nomRow = new ActionRowBuilder().addComponents(nomInput);
        const prenomRow = new ActionRowBuilder().addComponents(prenomInput);
        const classeRow = new ActionRowBuilder().addComponents(classeInput);
        const emailRow = new ActionRowBuilder().addComponents(emailInput);

        modal.addComponents(nomRow, prenomRow, classeRow, emailRow);

        // Afficher le modal
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal d\'édition de profil:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Une erreur est survenue lors de l\'affichage du formulaire d\'édition.',
                ephemeral: true
            }).catch(console.error);
        }
    }
}

/**
 * Traite la soumission du formulaire de profil
 * @param {ModalSubmitInteraction} interaction - L'interaction du formulaire modal
 */
async function handleProfileSubmit(interaction) {
    // Pour les modals, on utilise deferReply car c'est une nouvelle interaction
    await interaction.deferReply({ ephemeral: true }).catch(console.error);

    try {
        // Récupérer les valeurs du formulaire
        const nom = interaction.fields.getTextInputValue('nom');
        const prenom = interaction.fields.getTextInputValue('prenom');
        const classe = interaction.fields.getTextInputValue('classe');
        const email = interaction.fields.getTextInputValue('email');

        // Mettre à jour le profil
        try {
            await User.updateProfile(interaction.user.id, nom, prenom, classe, email);

            // Créer un embed de confirmation
            const embed = new EmbedBuilder()
                .setTitle('Profil mis à jour')
                .setDescription('Votre profil a été mis à jour avec succès!')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Nom', value: nom, inline: true },
                    { name: 'Prénom', value: prenom, inline: true },
                    { name: 'Classe', value: classe, inline: true },
                    { name: 'Email', value: email }
                );

            // Bouton de retour
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('profile_view')
                        .setLabel('Voir mon profil')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👤'),
                    new ButtonBuilder()
                        .setCustomId('profile_back')
                        .setLabel('Retour au menu')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                );

            await interaction.editReply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        } catch (error) {
            // Si l'erreur concerne l'email, afficher un message spécifique
            if (error.message.includes('email')) {
                await interaction.editReply({
                    content: `Erreur: ${error.message}`,
                    ephemeral: true
                });
            } else {
                console.error('Erreur lors de la mise à jour du profil:', error);
                await interaction.editReply({
                    content: 'Une erreur est survenue lors de la mise à jour du profil.',
                    ephemeral: true
                });
            }
        }
    } catch (error) {
        console.error('Erreur lors du traitement du formulaire de profil:', error);
        await interaction.editReply({
            content: 'Une erreur est survenue lors du traitement du formulaire.',
            ephemeral: true
        }).catch(console.error);
    }
}

// Ajouter cette fonction au modèle User pour récupérer tous les utilisateurs
User.getAllUsers = async function() {
    const { getAll } = require('../database/db');
    return await getAll('SELECT * FROM utilisateurs ORDER BY username');
};

module.exports = {
    handleProfileInteraction,
    handleProfileSelection,
    handleProfileSubmit,
    displayUserSelector
};