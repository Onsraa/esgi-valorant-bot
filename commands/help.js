const { EmbedBuilder } = require('discord.js');
const { isAdmin, isStaff } = require('../utils/auth');
const config = require('../config');

module.exports = {
    names: ['help', 'aide'],

    async execute(client, message, args) {
        try {
            const isUserAdmin = await isAdmin(message.author.id);
            const isUserStaff = await isStaff(message.author.id);

            const embed = new EmbedBuilder()
                .setTitle('Commandes disponibles')
                .setColor(0x0099FF);

            // Commandes pour tous les utilisateurs
            embed.addFields({
                name: 'Commandes utilisateur',
                value: '`!profil` - Afficher votre profil\n' +
                    '`!editer` - Éditer votre profil\n' +
                    '`!annoncer` - Annoncer des sessions\n' +
                    '`!help` - Afficher cette aide\n' +
                    '`!sessionlist` - Lister les types de sessions\n' +
                    '`!listsemesters` - Lister les semestres\n' +
                    '`!semesterpoints` - Voir vos points pour un semestre\n' +
                    '`!semesterranking` - Voir le classement d\'un semestre'
            });

            // Commandes pour le staff
            if (isUserStaff) {
                embed.addFields({
                    name: 'Commandes staff',
                    value: '`!profil @utilisateur` - Afficher le profil d\'un utilisateur\n' +
                        '`!pendinglist` - Lister les annonces en attente\n' +
                        '`!semesterpoints @utilisateur [id]` - Voir les points d\'un utilisateur pour un semestre'
                });
            }

            // Commandes pour les admins
            if (isUserAdmin) {
                embed.addFields({
                    name: 'Commandes administrateur - Sessions',
                    value: '`!addsession <nom> <points> [description]` - Ajouter un type de session\n' +
                        '`!updatesession <id> <nom> <points> [description]` - Modifier un type de session\n' +
                        '`!deletesession <id>` - Supprimer un type de session\n' +
                        '`!setrole <@utilisateur ou ID> <user|staff|admin>` - Définir le rôle d\'un utilisateur'
                });

                embed.addFields({
                    name: 'Commandes administrateur - Semestres',
                    value: '`!createsemester <nom> <date_debut> <date_fin> [note_max]` - Créer un semestre\n' +
                        '`!updatesemester <id> <nom> <date_debut> <date_fin> [note_max]` - Modifier un semestre\n' +
                        '`!setactivesemester <id>` - Définir le semestre actif\n' +
                        '`!deletesemester <id>` - Supprimer un semestre\n' +
                        '`!configsystem <key> <value> [description]` - Configurer les paramètres système'
                });
            }

            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande help:', error);
            message.reply('Une erreur est survenue lors de l\'affichage de l\'aide.');
        }
    }
};