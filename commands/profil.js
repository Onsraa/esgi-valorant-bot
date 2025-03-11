const { EmbedBuilder } = require('discord.js');
const { User, SessionHistory } = require('../database/models');
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
    names: ['profil', 'profile'], // Aliases de la commande

    async execute(client, message, args) {
        try {
            // Déterminer l'ID de l'utilisateur à afficher
            let targetId;

            // Si un argument est fourni et que l'utilisateur est staff, chercher cet utilisateur
            if (args.length > 0 && await isStaff(message.member)) {
                // Extraire l'ID de la mention ou utiliser l'argument comme ID
                targetId = args[0].replace(/[<@!>]/g, '');
            } else {
                // Sinon, afficher le profil de l'auteur du message
                targetId = message.author.id;
            }

            // Récupérer l'utilisateur
            const user = await User.getById(targetId);

            if (!user) {
                return message.reply('Utilisateur non trouvé dans la base de données.');
            }

            // Récupérer le membre Discord pour afficher son nom
            let username = user.username;
            try {
                const member = await message.guild.members.fetch(targetId);
                username = member.user.username;
            } catch (error) {
                console.error('Impossible de récupérer le membre Discord:', error);
            }

            // Créer l'embed
            const embed = new EmbedBuilder()
                .setTitle(`Profil de ${username}`)
                .setColor(0x0099FF);

            // Informations de base
            if (User.isProfileComplete(user)) {
                embed.addFields(
                    { name: 'Nom', value: user.nom, inline: true },
                    { name: 'Prénom', value: user.prenom, inline: true },
                    { name: 'Classe', value: user.classe, inline: true },
                    { name: 'Email', value: user.email }
                );
            } else {
                embed.setDescription('**Profil incomplet**\nUtilisez la commande `!editer` pour compléter votre profil.');
            }

            // Score total
            embed.addFields({ name: 'Score total', value: user.score_total.toString() });

            // Points par type de session
            const pointsByType = await SessionHistory.getUserPointsByType(targetId);

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

            // Envoyer l'embed
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande profil:', error);
            message.reply('Une erreur est survenue lors de l\'affichage du profil.');
        }
    }
};