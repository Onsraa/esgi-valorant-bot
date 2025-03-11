const { EmbedBuilder } = require('discord.js');
const { PendingSession } = require('../database/models');
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

// Commande pour lister les annonces en attente
async function handlePendingList(message, args) {
    try {
        const pendingSessions = await PendingSession.getPending();

        if (!pendingSessions || pendingSessions.length === 0) {
            return message.reply('Aucune annonce en attente.');
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

        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces en attente:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

module.exports = {
    names: ['pendinglist'],

    async execute(client, message, args) {
        try {
            // Vérifier que l'utilisateur est un membre du staff
            if (!await isStaff(message.member)) {
                return message.reply('Vous n\'avez pas les permissions nécessaires pour effectuer cette action.');
            }

            // Déterminer quelle commande exécuter
            const command = message.content.split(/ +/)[0].slice(config.prefix.length).toLowerCase();

            switch (command) {
                case 'pendinglist':
                    await handlePendingList(message, args);
                    break;
            }
        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande staff (${command}):`, error);
            message.reply('Une erreur est survenue lors de l\'exécution de cette commande.');
        }
    }
};