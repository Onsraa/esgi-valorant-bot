const { EmbedBuilder } = require('discord.js');
const { SessionType, User } = require('../database/models');
const config = require('../config');

// Vérifier si l'utilisateur a un rôle spécifique
async function hasRole(member, roleId) {
    return member.roles.cache.has(roleId);
}

// Vérifier si l'utilisateur est un administrateur
async function isAdmin(member) {
    return await hasRole(member, config.adminRoleId);
}

// Commande pour ajouter un type de session
async function handleAddSessionType(message, args) {
    if (args.length < 2) {
        return message.reply('Usage: `!addsession <nom> <points> [description]`');
    }

    const nom = args[0];
    const points = parseInt(args[1]);

    if (isNaN(points)) {
        return message.reply('Le nombre de points doit être un nombre entier.');
    }

    const description = args.length > 2 ? args.slice(2).join(' ') : '';

    try {
        const result = await SessionType.create(nom, description, points);
        message.reply(`Type de session ajouté avec succès. ID: ${result.id}`);
    } catch (error) {
        console.error('Erreur lors de l\'ajout du type de session:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour mettre à jour un type de session
async function handleUpdateSessionType(message, args) {
    if (args.length < 3) {
        return message.reply('Usage: `!updatesession <id> <nom> <points> [description]`');
    }

    const id = parseInt(args[0]);
    if (isNaN(id)) {
        return message.reply('L\'ID doit être un nombre entier.');
    }

    const nom = args[1];
    const points = parseInt(args[2]);

    if (isNaN(points)) {
        return message.reply('Le nombre de points doit être un nombre entier.');
    }

    const description = args.length > 3 ? args.slice(3).join(' ') : '';

    try {
        await SessionType.update(id, nom, description, points);
        message.reply('Type de session mis à jour avec succès.');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du type de session:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour supprimer un type de session
async function handleDeleteSessionType(message, args) {
    if (args.length < 1) {
        return message.reply('Usage: `!deletesession <id>`');
    }

    const id = parseInt(args[0]);
    if (isNaN(id)) {
        return message.reply('L\'ID doit être un nombre entier.');
    }

    try {
        await SessionType.delete(id);
        message.reply('Type de session supprimé avec succès.');
    } catch (error) {
        console.error('Erreur lors de la suppression du type de session:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour lister les types de sessions
async function handleSessionList(message, args) {
    try {
        const sessionTypes = await SessionType.getAll();

        if (!sessionTypes || sessionTypes.length === 0) {
            return message.reply('Aucun type de session configuré.');
        }

        const embed = new EmbedBuilder()
            .setTitle('Types de sessions')
            .setColor(0x0099FF);

        sessionTypes.forEach(sessionType => {
            embed.addFields({
                name: `ID: ${sessionType.id} - ${sessionType.nom}`,
                value: `**Points**: ${sessionType.points}\n**Description**: ${sessionType.description || 'Pas de description'}`
            });
        });

        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur lors de la récupération des types de sessions:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour définir le rôle d'un utilisateur
async function handleSetRole(message, args) {
    if (args.length < 2) {
        return message.reply('Usage: `!setrole <@utilisateur ou ID> <user|staff|admin>`');
    }

    // Extraire l'ID de l'utilisateur
    const targetId = args[0].replace(/[<@!>]/g, '');
    const role = args[1].toLowerCase();

    if (!['user', 'staff', 'admin'].includes(role)) {
        return message.reply('Le rôle doit être \'user\', \'staff\' ou \'admin\'.');
    }

    try {
        await User.updateRole(targetId, role);
        message.reply(`Rôle de <@${targetId}> mis à jour à '${role}'.`);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du rôle:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

module.exports = {
    names: ['addsession', 'updatesession', 'deletesession', 'sessionlist', 'setrole'],

    async execute(client, message, args) {
        try {
            // Déterminer quelle commande exécuter
            const command = message.content.split(/ +/)[0].slice(config.prefix.length).toLowerCase();

            // Permettre à tous d'accéder à sessionlist
            if (command === 'sessionlist') {
                await handleSessionList(message, args);
                return;
            }

            // Vérifier que l'utilisateur est un administrateur pour les autres commandes
            if (!await isAdmin(message.member)) {
                return message.reply('Vous n\'avez pas les permissions nécessaires pour effectuer cette action.');
            }

            switch (command) {
                case 'addsession':
                    await handleAddSessionType(message, args);
                    break;
                case 'updatesession':
                    await handleUpdateSessionType(message, args);
                    break;
                case 'deletesession':
                    await handleDeleteSessionType(message, args);
                    break;
                case 'setrole':
                    await handleSetRole(message, args);
                    break;
            }
        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande admin (${command}):`, error);
            message.reply('Une erreur est survenue lors de l\'exécution de cette commande.');
        }
    }
};