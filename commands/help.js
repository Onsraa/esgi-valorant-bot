const { EmbedBuilder } = require('discord.js');
const config = require('../config');

// Vérifier si l'utilisateur a un rôle spécifique
async function hasRole(member, roleId) {
    return member.roles.cache.has(roleId);
}

// Vérifier si l'utilisateur est un administrateur
async function isAdmin(member) {
    return await hasRole(member, config.adminRoleId);
}

// Vérifier si l'utilisateur est un membre du staff
async function isStaff(member) {
    return await hasRole(member, config.staffRoleId) || await isAdmin(member);
}

module.exports = {
    names: ['help', 'aide'],

    async execute(client, message, args) {
        try {
            const isUserAdmin = await isAdmin(message.member);
            const isUserStaff = await isStaff(message.member);

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
                    '`!sessionlist` - Lister les types de sessions'
            });

            // Commandes pour le staff
            if (isUserStaff) {
                embed.addFields({
                    name: 'Commandes staff',
                    value: '`!profil @utilisateur` - Afficher le profil d\'un utilisateur\n' +
                        '`!pendinglist` - Lister les annonces en attente'
                });
            }

            // Commandes pour les admins
            if (isUserAdmin) {
                embed.addFields({
                    name: 'Commandes administrateur',
                    value: '`!addsession <nom> <points> [description]` - Ajouter un type de session\n' +
                        '`!updatesession <id> <nom> <points> [description]` - Modifier un type de session\n' +
                        '`!deletesession <id>` - Supprimer un type de session\n' +
                        '`!setrole <@utilisateur ou ID> <user|staff|admin>` - Définir le rôle d\'un utilisateur'
                });
            }

            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande help:', error);
            message.reply('Une erreur est survenue lors de l\'affichage de l\'aide.');
        }
    }
};