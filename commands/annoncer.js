const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User, SessionType, PendingSession } = require('../database/models');
const { today } = require('../utils/formatters');
const config = require('../config');

module.exports = {
    names: ['annoncer', 'announce'],

    async execute(client, message, args) {
        try {
            // Récupérer l'utilisateur
            const user = await User.getById(message.author.id);

            if (!user) {
                return message.reply('Vous n\'êtes pas enregistré dans la base de données.');
            }

            // Vérifier si l'utilisateur a complété son profil
            if (!User.isProfileComplete(user)) {
                return message.reply('Vous devez compléter votre profil avec la commande `!editer` avant de pouvoir annoncer des sessions.');
            }

            // Récupérer les types de sessions
            const sessionTypes = await SessionType.getAll();

            if (!sessionTypes || sessionTypes.length === 0) {
                return message.reply('Aucun type de session n\'est configuré.');
            }

            // Créer l'embed avec la date du jour
            const todayDate = today();

            const embed = new EmbedBuilder()
                .setTitle('Annonce de sessions')
                .setDescription(`Date: **${todayDate}**\n\nIndiquez le nombre de sessions que vous avez effectuées en utilisant les boutons ci-dessous:`)
                .setColor(0xFFD700)
                .setFooter({ text: 'Utilisez les boutons pour modifier les valeurs, puis validez' });

            // Initialiser les compteurs pour chaque type de session
            const sessionCounts = Array(sessionTypes.length).fill(0);

            // Ajouter les champs pour chaque type de session
            sessionTypes.forEach((sessionType, index) => {
                embed.addFields({
                    name: sessionType.nom,
                    value: '0 session(s)',
                    inline: true
                });
            });

            // Créer les boutons pour chaque type de session
            const actionRows = [];

            sessionTypes.forEach((sessionType, index) => {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`dec_${index}`)
                            .setLabel('-')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`inc_${index}`)
                            .setLabel('+')
                            .setStyle(ButtonStyle.Primary)
                    );

                actionRows.push(row);
            });

            // Ajouter une rangée avec un bouton de validation
            const validateRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('validate')
                        .setLabel('Valider')
                        .setStyle(ButtonStyle.Success)
                );

            actionRows.push(validateRow);

            // Envoyer l'embed avec les boutons
            const announcementMsg = await message.channel.send({
                embeds: [embed],
                components: actionRows
            });

            // Créer un collecteur pour les interactions de boutons
            const filter = i => {
                // Vérifier que l'interaction provient de l'auteur du message
                return i.user.id === message.author.id && i.message.id === announcementMsg.id;
            };

            // Collecter les interactions pendant 5 minutes
            const collector = announcementMsg.createMessageComponentCollector({
                filter,
                time: 300000
            });

            collector.on('collect', async interaction => {
                // Extraire l'ID personnalisé du bouton
                const customId = interaction.customId;

                if (customId === 'validate') {
                    // Créer une session en attente
                    const sessionTypeCounts = [];

                    sessionCounts.forEach((count, index) => {
                        if (count > 0) {
                            sessionTypeCounts.push([sessionTypes[index].id, count]);
                        }
                    });

                    if (sessionTypeCounts.length === 0) {
                        // Modifier le message pour indiquer une erreur
                        await interaction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Erreur')
                                    .setDescription('Vous devez annoncer au moins une session.')
                                    .setColor(0xFF0000)
                            ],
                            components: []
                        });

                        // Supprimer le message après 3 secondes
                        setTimeout(() => {
                            announcementMsg.delete().catch(console.error);
                        }, 3000);

                        return;
                    }

                    try {
                        // Créer la session en attente
                        const pendingId = await PendingSession.create(message.author.id, todayDate, sessionTypeCounts);

                        // Modifier le message pour indiquer le succès
                        await interaction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Annonce soumise')
                                    .setDescription(`Votre annonce de sessions a été soumise avec succès.\nID: ${pendingId}\n\nUn membre du staff validera votre annonce prochainement.`)
                                    .setColor(0x00FF00)
                            ],
                            components: []
                        });

                        // Notifier les staff et admins
                        const notificationEmbed = new EmbedBuilder()
                            .setTitle('Nouvelle annonce à valider')
                            .setDescription(`Utilisateur: <@${message.author.id}>\nID: ${pendingId}\nDate: ${todayDate}`)
                            .setColor(0x0099FF);

                        // Ajouter les sessions annoncées
                        sessionCounts.forEach((count, index) => {
                            if (count > 0) {
                                notificationEmbed.addFields({
                                    name: sessionTypes[index].nom,
                                    value: `${count} session(s)`,
                                    inline: true
                                });
                            }
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
                        await message.channel.send({
                            content: `<@&${config.adminRoleId}> <@&${config.staffRoleId}> Nouvelle annonce de sessions à valider!`,
                            embeds: [notificationEmbed],
                            components: [validationRow]
                        });
                    } catch (error) {
                        console.error('Erreur lors de la création de la session en attente:', error);

                        // Vérifier si l'erreur est due à un profil incomplet
                        if (error.message.includes('Profil incomplet')) {
                            await interaction.update({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('Erreur')
                                        .setDescription('Vous devez compléter votre profil avant de pouvoir annoncer des sessions.')
                                        .setColor(0xFF0000)
                                ],
                                components: []
                            });
                        } else {
                            await interaction.update({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('Erreur')
                                        .setDescription(`Une erreur est survenue: ${error.message}`)
                                        .setColor(0xFF0000)
                                ],
                                components: []
                            });
                        }
                    }

                    // Arrêter le collecteur
                    collector.stop();
                } else if (customId.startsWith('inc_') || customId.startsWith('dec_')) {
                    // Extraire l'index du type de session
                    const index = parseInt(customId.split('_')[1]);

                    // Incrémenter ou décrémenter le compteur
                    if (customId.startsWith('inc_')) {
                        sessionCounts[index]++;
                    } else if (sessionCounts[index] > 0) {
                        sessionCounts[index]--;
                    }

                    // Mettre à jour l'embed
                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]);

                    // Mettre à jour les valeurs des champs
                    sessionTypes.forEach((sessionType, i) => {
                        updatedEmbed.data.fields[i].value = `${sessionCounts[i]} session(s)`;
                    });

                    // Envoyer la mise à jour
                    await interaction.update({ embeds: [updatedEmbed] });
                }
            });

            collector.on('end', collected => {
                // Si aucune interaction n'a été collectée, supprimer le message
                if (collected.size === 0) {
                    announcementMsg.delete().catch(console.error);
                }
            });
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande annoncer:', error);
            message.reply('Une erreur est survenue lors de l\'annonce des sessions.');
        }
    }
};