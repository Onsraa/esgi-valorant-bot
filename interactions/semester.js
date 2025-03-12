const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { Semester, SessionHistory, User, SystemSettings } = require('../database/models');
const { isAdmin, isStaff } = require('../utils/auth');
const moment = require('moment');

/**
 * Gère les interactions liées aux semestres
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function handleSemesterInteraction(interaction) {
    const buttonId = interaction.customId;

    // Lister les semestres
    if (buttonId === 'semester_list') {
        await displaySemesterList(interaction);
        return;
    }

    // Voir les points de l'utilisateur pour un semestre
    if (buttonId === 'semester_points') {
        await selectSemesterForPoints(interaction, interaction.user.id);
        return;
    }

    // Voir le classement d'un semestre
    if (buttonId === 'semester_ranking') {
        await selectSemesterForRanking(interaction);
        return;
    }

    // Gestion des semestres (admin uniquement)
    if (buttonId === 'admin_semester_management') {
        await displaySemesterManagement(interaction);
        return;
    }

    // Créer un nouveau semestre
    if (buttonId === 'admin_create_semester') {
        await showCreateSemesterModal(interaction);
        return;
    }

    // Modifier un semestre existant
    if (buttonId === 'admin_edit_semester') {
        await selectSemesterForEdit(interaction);
        return;
    }

    // Définir le semestre actif
    if (buttonId === 'admin_set_active_semester') {
        await selectSemesterForActivation(interaction);
        return;
    }

    // Supprimer un semestre
    if (buttonId === 'admin_delete_semester') {
        await selectSemesterForDeletion(interaction);
        return;
    }

    // Configurer les paramètres système
    if (buttonId === 'admin_config_system') {
        await showSystemConfigModal(interaction);
        return;
    }

    // Retour au menu principal
    if (buttonId === 'semester_back') {
        const { displayMainMenu } = require('./menu');
        await displayMainMenu(interaction);
        return;
    }

    // Retour au menu de gestion des semestres
    if (buttonId === 'semester_back_management') {
        await displaySemesterManagement(interaction);
        return;
    }
}

/**
 * Gère la sélection d'un semestre
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 */
async function handleSemesterSelection(interaction) {
    const selectId = interaction.customId;
    const semesterId = interaction.values[0];

    // Afficher les points d'un utilisateur pour un semestre
    if (selectId === 'semester_points_selector') {
        await displayUserPoints(interaction, interaction.user.id, semesterId);
        return;
    }

    // Afficher les points d'un autre utilisateur pour un semestre (staff/admin uniquement)
    if (selectId === 'admin_user_points_selector') {
        // Le format est "userId:semesterId"
        const [userId, selectedSemesterId] = semesterId.split(':');
        await displayUserPoints(interaction, userId, selectedSemesterId);
        return;
    }

    // Afficher le classement d'un semestre
    if (selectId === 'semester_ranking_selector') {
        await displaySemesterRanking(interaction, semesterId);
        return;
    }

    // Modifier un semestre
    if (selectId === 'semester_edit_selector') {
        await showEditSemesterModal(interaction, semesterId);
        return;
    }

    // Activer un semestre
    if (selectId === 'semester_activate_selector') {
        await activateSemester(interaction, semesterId);
        return;
    }

    // Supprimer un semestre
    if (selectId === 'semester_delete_selector') {
        await deleteSemester(interaction, semesterId);
        return;
    }
}

/**
 * Affiche la liste des semestres
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displaySemesterList(interaction) {
    try {
        const semesters = await Semester.getAll();
        const activeSemester = await Semester.getActive();

        if (!semesters || semesters.length === 0) {
            await interaction.update({
                content: 'Aucun semestre configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Liste des semestres')
            .setColor(0x0099FF);

        semesters.forEach(semester => {
            const startDate = moment(semester.start_date).format('DD/MM/YYYY');
            const endDate = moment(semester.end_date).format('DD/MM/YYYY');
            const isActive = activeSemester && activeSemester.id === semester.id;

            embed.addFields({
                name: `${isActive ? '📌 ' : ''}${semester.name}`,
                value: `**ID**: ${semester.id}\n` +
                    `**Période**: ${startDate} au ${endDate}\n` +
                    `**Note max**: ${semester.note_max}\n` +
                    `${isActive ? '**SEMESTRE ACTIF**' : ''}`
            });
        });

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de la liste des semestres:', error);
        throw error;
    }
}

/**
 * Affiche un sélecteur pour choisir un semestre pour voir les points
 * @param {ButtonInteraction} interaction - L'interaction bouton
 * @param {string} userId - L'ID de l'utilisateur dont on veut voir les points
 */
async function selectSemesterForPoints(interaction, userId) {
    try {
        const semesters = await Semester.getAll();
        const activeSemester = await Semester.getActive();

        if (!semesters || semesters.length === 0) {
            await interaction.update({
                content: 'Aucun semestre configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        // Créer un sélecteur avec les semestres disponibles
        const options = semesters.map(semester => {
            const startDate = moment(semester.start_date).format('DD/MM/YYYY');
            const endDate = moment(semester.end_date).format('DD/MM/YYYY');
            const isActive = activeSemester && activeSemester.id === semester.id;

            return new StringSelectMenuOptionBuilder()
                .setLabel(`${semester.name}${isActive ? ' (actif)' : ''}`)
                .setDescription(`${startDate} au ${endDate}`)
                .setValue(semester.id.toString())
                .setDefault(isActive);
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('semester_points_selector')
                    .setPlaceholder('Sélectionner un semestre')
                    .addOptions(options)
            );

        const validateRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_points_${userId}`)
                    .setLabel('Voir mes points')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔍')
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            content: 'Sélectionnez un semestre pour voir vos points:',
            embeds: [],
            components: [row, validateRow, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de la sélection d\'un semestre pour les points:', error);
        throw error;
    }
}

/**
 * Affiche les points d'un utilisateur pour un semestre
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 * @param {string} userId - L'ID de l'utilisateur
 * @param {string} semesterId - L'ID du semestre
 */
async function displayUserPoints(interaction, userId, semesterId) {
    try {
        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);
        if (!semester) {
            await interaction.update({
                content: `Semestre ID ${semesterId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Récupérer les informations sur l'utilisateur
        const userRanking = await Semester.getUserRanking(userId, semesterId);
        const pointsDetails = await SessionHistory.getUserPointsByTypeAndSemester(userId, semesterId);
        const totalPoints = await SessionHistory.getUserTotalPointsBySemester(userId, semesterId);

        // Récupérer le nom d'utilisateur
        let username;
        try {
            const member = await interaction.guild.members.fetch(userId);
            username = member.user.username;
        } catch (error) {
            console.error('Impossible de récupérer le membre Discord:', error);
            username = userId;
        }

        const startDate = moment(semester.start_date).format('DD/MM/YYYY');
        const endDate = moment(semester.end_date).format('DD/MM/YYYY');

        const embed = new EmbedBuilder()
            .setTitle(`Points - ${semester.name}`)
            .setDescription(`Utilisateur: <@${userId}>\nPériode: ${startDate} au ${endDate}`)
            .setColor(0x0099FF);

        // Ajouter le détail des points par type de session
        if (pointsDetails && pointsDetails.length > 0) {
            const detailText = pointsDetails
                .map(({ nom, total_points }) => `**${nom}**: ${total_points} points`)
                .join('\n');

            embed.addFields({ name: 'Points par type de session', value: detailText });
        } else {
            embed.addFields({ name: 'Points par type de session', value: 'Aucune session enregistrée' });
        }

        // Ajouter le total des points
        embed.addFields({ name: 'Total des points', value: `${totalPoints || 0} points` });

        // Ajouter les informations de classement si disponibles
        if (userRanking) {
            embed.addFields({
                name: 'Classement',
                value: `Rang: ${userRanking.rank}\n` +
                    `Percentile: ${userRanking.percentile.toFixed(2)}%\n` +
                    `Note finale: ${userRanking.final_note}`
            });
        } else {
            embed.addFields({ name: 'Classement', value: 'Non classé pour ce semestre' });
        }

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des points:', error);
        throw error;
    }
}

/**
 * Affiche un sélecteur pour choisir un semestre pour voir le classement
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function selectSemesterForRanking(interaction) {
    try {
        const semesters = await Semester.getAll();
        const activeSemester = await Semester.getActive();

        if (!semesters || semesters.length === 0) {
            await interaction.update({
                content: 'Aucun semestre configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        // Créer un sélecteur avec les semestres disponibles
        const options = semesters.map(semester => {
            const startDate = moment(semester.start_date).format('DD/MM/YYYY');
            const endDate = moment(semester.end_date).format('DD/MM/YYYY');
            const isActive = activeSemester && activeSemester.id === semester.id;

            return new StringSelectMenuOptionBuilder()
                .setLabel(`${semester.name}${isActive ? ' (actif)' : ''}`)
                .setDescription(`${startDate} au ${endDate}`)
                .setValue(semester.id.toString())
                .setDefault(isActive);
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('semester_ranking_selector')
                    .setPlaceholder('Sélectionner un semestre')
                    .addOptions(options)
            );

        const validateRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_points_${userId}`)
                    .setLabel('Voir mes points')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔍')
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            content: 'Sélectionnez un semestre pour voir le classement:',
            embeds: [],
            components: [row, validateRow, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de la sélection d\'un semestre pour le classement:', error);
        throw error;
    }
}

/**
 * Affiche le classement d'un semestre
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 * @param {string} semesterId - L'ID du semestre
 */
async function displaySemesterRanking(interaction, semesterId) {
    try {
        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);
        if (!semester) {
            await interaction.update({
                content: `Semestre ID ${semesterId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Calculer le classement
        await Semester.calculateRankings(semesterId);

        // Récupérer le classement
        const rankings = await Semester.getRankings(semesterId, 20); // Limiter à 20 résultats

        if (!rankings || rankings.length === 0) {
            await interaction.update({
                content: `Aucun participant dans le classement du semestre "${semester.name}".`,
                embeds: [],
                components: []
            });
            return;
        }

        const startDate = moment(semester.start_date).format('DD/MM/YYYY');
        const endDate = moment(semester.end_date).format('DD/MM/YYYY');

        const embed = new EmbedBuilder()
            .setTitle(`Classement: ${semester.name}`)
            .setDescription(`Période: ${startDate} au ${endDate}\nNote maximale: ${semester.note_max}`)
            .setColor(0x0099FF);

        // Afficher les meilleurs
        let rankingText = '';
        rankings.forEach((rank, index) => {
            const userDisplay = rank.nom && rank.prenom
                ? `${rank.prenom} ${rank.nom.charAt(0)}.`
                : rank.username;

            rankingText += `${rank.rank}. **${userDisplay}** - ${rank.total_points} pts - Note: ${rank.final_note}\n`;

            // Ajouter par blocs de 10
            if ((index + 1) % 10 === 0 || index === rankings.length - 1) {
                embed.addFields({
                    name: index < 10 ? 'Top 10' : `Top ${index + 1}`,
                    value: rankingText
                });
                rankingText = '';
            }
        });

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage du classement:', error);
        throw error;
    }
}

/**
 * Affiche les options de gestion des semestres (admin uniquement)
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function displaySemesterManagement(interaction) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Gestion des semestres')
            .setDescription('Sélectionnez une action pour gérer les semestres:')
            .setColor(0xFF0000);

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_create_semester')
                    .setLabel('Créer un semestre')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('admin_edit_semester')
                    .setLabel('Modifier un semestre')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_set_active_semester')
                    .setLabel('Définir semestre actif')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📌'),
                new ButtonBuilder()
                    .setCustomId('admin_delete_semester')
                    .setLabel('Supprimer un semestre')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );

        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_config_system')
                    .setLabel('Configurer les paramètres')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back')
                    .setLabel('Retour au menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row1, row2, row3, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des options de gestion des semestres:', error);
        throw error;
    }
}

/**
 * Affiche un modal pour créer un nouveau semestre
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function showCreateSemesterModal(interaction) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        // Créer le modal
        const modal = new ModalBuilder()
            .setCustomId('add_semester_modal')
            .setTitle('Créer un nouveau semestre');

        // Ajouter les champs
        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Nom du semestre')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const startDateInput = new TextInputBuilder()
            .setCustomId('start_date')
            .setLabel('Date de début (DD/MM/YYYY)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('01/01/2025');

        const endDateInput = new TextInputBuilder()
            .setCustomId('end_date')
            .setLabel('Date de fin (DD/MM/YYYY)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('30/06/2025');

        const noteMaxInput = new TextInputBuilder()
            .setCustomId('note_max')
            .setLabel('Note maximale')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('4.0')
            .setValue('4.0');

        // Ajouter les champs au modal
        const nameRow = new ActionRowBuilder().addComponents(nameInput);
        const startDateRow = new ActionRowBuilder().addComponents(startDateInput);
        const endDateRow = new ActionRowBuilder().addComponents(endDateInput);
        const noteMaxRow = new ActionRowBuilder().addComponents(noteMaxInput);

        modal.addComponents(nameRow, startDateRow, endDateRow, noteMaxRow);

        // Afficher le modal
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal de création de semestre:', error);
        throw error;
    }
}

/**
 * Affiche un sélecteur pour choisir un semestre à modifier
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function selectSemesterForEdit(interaction) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        const semesters = await Semester.getAll();

        if (!semesters || semesters.length === 0) {
            await interaction.update({
                content: 'Aucun semestre configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        // Créer un sélecteur avec les semestres disponibles
        const options = semesters.map(semester => {
            const startDate = moment(semester.start_date).format('DD/MM/YYYY');
            const endDate = moment(semester.end_date).format('DD/MM/YYYY');

            return new StringSelectMenuOptionBuilder()
                .setLabel(semester.name)
                .setDescription(`${startDate} au ${endDate}`)
                .setValue(semester.id.toString());
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('semester_edit_selector')
                    .setPlaceholder('Sélectionner un semestre à modifier')
                    .addOptions(options)
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            content: 'Sélectionnez un semestre à modifier:',
            embeds: [],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de la sélection d\'un semestre à modifier:', error);
        throw error;
    }
}

/**
 * Affiche un modal pour modifier un semestre existant
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 * @param {string} semesterId - L'ID du semestre à modifier
 */
async function showEditSemesterModal(interaction, semesterId) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);

        if (!semester) {
            await interaction.update({
                content: `Semestre ID ${semesterId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Créer le modal
        const modal = new ModalBuilder()
            .setCustomId(`edit_semester_${semesterId}`)
            .setTitle(`Modifier: ${semester.name}`);

        // Ajouter les champs
        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Nom du semestre')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
            .setValue(semester.name);

        const startDateInput = new TextInputBuilder()
            .setCustomId('start_date')
            .setLabel('Date de début (DD/MM/YYYY)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(moment(semester.start_date).format('DD/MM/YYYY'));

        const endDateInput = new TextInputBuilder()
            .setCustomId('end_date')
            .setLabel('Date de fin (DD/MM/YYYY)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(moment(semester.end_date).format('DD/MM/YYYY'));

        const noteMaxInput = new TextInputBuilder()
            .setCustomId('note_max')
            .setLabel('Note maximale')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(semester.note_max.toString());

        // Ajouter les champs au modal
        const nameRow = new ActionRowBuilder().addComponents(nameInput);
        const startDateRow = new ActionRowBuilder().addComponents(startDateInput);
        const endDateRow = new ActionRowBuilder().addComponents(endDateInput);
        const noteMaxRow = new ActionRowBuilder().addComponents(noteMaxInput);

        modal.addComponents(nameRow, startDateRow, endDateRow, noteMaxRow);

        // Afficher le modal
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal de modification de semestre:', error);
        throw error;
    }
}

/**
 * Traite la soumission du formulaire de semestre
 * @param {ModalSubmitInteraction} interaction - L'interaction du formulaire modal
 */
async function handleSemesterSubmit(interaction) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        const modalId = interaction.customId;

        // Récupérer les valeurs du formulaire
        const name = interaction.fields.getTextInputValue('name');
        const startDate = interaction.fields.getTextInputValue('start_date');
        const endDate = interaction.fields.getTextInputValue('end_date');
        const noteMax = parseFloat(interaction.fields.getTextInputValue('note_max'));

        // Valider les entrées
        if (!moment(startDate, 'DD/MM/YYYY', true).isValid() || !moment(endDate, 'DD/MM/YYYY', true).isValid()) {
            await interaction.reply({
                content: 'Les dates doivent être au format DD/MM/YYYY.',
                ephemeral: true
            });
            return;
        }

        if (isNaN(noteMax)) {
            await interaction.reply({
                content: 'La note maximale doit être un nombre.',
                ephemeral: true
            });
            return;
        }

        // Créer ou modifier le semestre
        let result;
        let actionText;
        let semesterId;

        if (modalId === 'add_semester_modal') {
            // Créer un nouveau semestre
            result = await Semester.create(name, startDate, endDate, noteMax);
            actionText = 'créé';
            semesterId = result.id;
        } else {
            // Modifier un semestre existant
            semesterId = modalId.split('_')[2];
            await Semester.update(semesterId, name, startDate, endDate, noteMax);
            actionText = 'modifié';
        }

        // Créer un embed de confirmation
        const embed = new EmbedBuilder()
            .setTitle(`Semestre ${actionText}`)
            .setDescription(`Le semestre "${name}" a été ${actionText} avec succès.`)
            .setColor(0x00FF00)
            .addFields(
                { name: 'ID', value: semesterId.toString(), inline: true },
                { name: 'Période', value: `${startDate} au ${endDate}`, inline: true },
                { name: 'Note maximale', value: noteMax.toString(), inline: true }
            );

        // Boutons d'action
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_set_active_semester')
                    .setLabel('Définir comme actif')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📌'),
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
        console.error('Erreur lors de la soumission du formulaire de semestre:', error);

        await interaction.reply({
            content: `Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

/**
 * Affiche un sélecteur pour choisir un semestre à activer
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function selectSemesterForActivation(interaction) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        const semesters = await Semester.getAll();
        const activeSemester = await Semester.getActive();

        if (!semesters || semesters.length === 0) {
            await interaction.update({
                content: 'Aucun semestre configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        // Créer un sélecteur avec les semestres disponibles
        const options = semesters.map(semester => {
            const startDate = moment(semester.start_date).format('DD/MM/YYYY');
            const endDate = moment(semester.end_date).format('DD/MM/YYYY');
            const isActive = activeSemester && activeSemester.id === semester.id;

            return new StringSelectMenuOptionBuilder()
                .setLabel(`${semester.name}${isActive ? ' (actif)' : ''}`)
                .setDescription(`${startDate} au ${endDate}`)
                .setValue(semester.id.toString())
                .setDefault(isActive);
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('semester_activate_selector')
                    .setPlaceholder('Sélectionner un semestre à activer')
                    .addOptions(options)
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            content: 'Sélectionnez un semestre à définir comme actif:',
            embeds: [],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de la sélection d\'un semestre à activer:', error);
        throw error;
    }
}

/**
 * Active un semestre
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 * @param {string} semesterId - L'ID du semestre à activer
 */
async function activateSemester(interaction, semesterId) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);

        if (!semester) {
            await interaction.update({
                content: `Semestre ID ${semesterId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Activer le semestre
        await Semester.setActive(semesterId);

        // Créer un embed de confirmation
        const embed = new EmbedBuilder()
            .setTitle('Semestre activé')
            .setDescription(`Le semestre "${semester.name}" a été défini comme semestre actif.`)
            .setColor(0x00FF00);

        // Bouton de retour
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'activation du semestre:', error);
        throw error;
    }
}

/**
 * Affiche un sélecteur pour choisir un semestre à supprimer
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function selectSemesterForDeletion(interaction) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        const semesters = await Semester.getAll();

        if (!semesters || semesters.length === 0) {
            await interaction.update({
                content: 'Aucun semestre configuré.',
                embeds: [],
                components: []
            });
            return;
        }

        // Créer un sélecteur avec les semestres disponibles
        const options = semesters.map(semester => {
            const startDate = moment(semester.start_date).format('DD/MM/YYYY');
            const endDate = moment(semester.end_date).format('DD/MM/YYYY');

            return new StringSelectMenuOptionBuilder()
                .setLabel(semester.name)
                .setDescription(`${startDate} au ${endDate}`)
                .setValue(semester.id.toString());
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('semester_delete_selector')
                    .setPlaceholder('Sélectionner un semestre à supprimer')
                    .addOptions(options)
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('semester_back_management')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        await interaction.update({
            content: '⚠️ **ATTENTION**: Sélectionnez un semestre à supprimer. Cette action est irréversible!',
            embeds: [],
            components: [row, backButton]
        });
    } catch (error) {
        console.error('Erreur lors de la sélection d\'un semestre à supprimer:', error);
        throw error;
    }
}

/**
 * Supprime un semestre
 * @param {StringSelectMenuInteraction} interaction - L'interaction du sélecteur
 * @param {string} semesterId - L'ID du semestre à supprimer
 */
async function deleteSemester(interaction, semesterId) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);

        if (!semester) {
            await interaction.update({
                content: `Semestre ID ${semesterId} non trouvé.`,
                embeds: [],
                components: []
            });
            return;
        }

        try {
            // Supprimer le semestre
            await Semester.delete(semesterId);

            // Créer un embed de confirmation
            const embed = new EmbedBuilder()
                .setTitle('Semestre supprimé')
                .setDescription(`Le semestre "${semester.name}" a été supprimé avec succès.`)
                .setColor(0x00FF00);

            // Bouton de retour
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('semester_back_management')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                );

            await interaction.update({
                embeds: [embed],
                components: [row]
            });
        } catch (error) {
            // Si le semestre a des sessions associées, afficher un message d'erreur
            if (error.message.includes('sessions associées')) {
                await interaction.update({
                    content: `Erreur: ${error.message}`,
                    embeds: [],
                    components: []
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du semestre:', error);
        throw error;
    }
}

/**
 * Affiche un modal pour configurer les paramètres système
 * @param {ButtonInteraction} interaction - L'interaction bouton
 */
async function showSystemConfigModal(interaction) {
    try {
        // Vérifier que l'utilisateur est admin
        if (!(await isAdmin(interaction.user.id))) {
            await interaction.reply({
                content: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
                ephemeral: true
            });
            return;
        }

        // Récupérer les paramètres actuels
        const settings = await SystemSettings.getAll();

        // Créer le modal
        const modal = new ModalBuilder()
            .setCustomId('config_system_modal')
            .setTitle('Configurer les paramètres système');

        // Préparer les valeurs par défaut
        const noteMaxSetting = settings.find(s => s.key === 'NOTE_MAX');
        const thresholdsSetting = settings.find(s => s.key === 'PERCENTILE_THRESHOLDS');
        const notesSetting = settings.find(s => s.key === 'PERCENTILE_NOTES');

        // Ajouter les champs
        const noteMaxInput = new TextInputBuilder()
            .setCustomId('note_max')
            .setLabel('Note maximale (défaut: 4.0)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('4.0');

        const thresholdsInput = new TextInputBuilder()
            .setCustomId('thresholds')
            .setLabel('Seuils de percentiles (format JSON)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('[25, 50, 75, 100]');

        const notesInput = new TextInputBuilder()
            .setCustomId('notes')
            .setLabel('Notes par seuil (format JSON)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('[4, 3, 2, 1]');

        // Définir les valeurs actuelles
        if (noteMaxSetting) noteMaxInput.setValue(noteMaxSetting.value);
        if (thresholdsSetting) thresholdsInput.setValue(thresholdsSetting.value);
        if (notesSetting) notesInput.setValue(notesSetting.value);

        // Ajouter les champs au modal
        const noteMaxRow = new ActionRowBuilder().addComponents(noteMaxInput);
        const thresholdsRow = new ActionRowBuilder().addComponents(thresholdsInput);
        const notesRow = new ActionRowBuilder().addComponents(notesInput);

        modal.addComponents(noteMaxRow, thresholdsRow, notesRow);

        // Afficher le modal
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal de configuration système:', error);
        throw error;
    }
}

module.exports = {
    handleSemesterInteraction,
    handleSemesterSelection,
    handleSemesterSubmit
};