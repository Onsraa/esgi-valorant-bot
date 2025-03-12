const { EmbedBuilder } = require('discord.js');
const { Semester, SystemSettings } = require('../database/models');
const { isAdmin } = require('../utils/auth');
const config = require('../config');
const moment = require('moment');

// Commande pour créer un semestre
async function handleCreateSemester(message, args) {
    // Récupérer la commande complète
    const fullCommand = message.content.slice(config.prefix.length).trim();

    // Extraire les arguments manuellement en tenant compte des guillemets
    const regex = /createsemester\s+(?:"([^"]+)"|([^\s]+))\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d+(?:\.\d+)?))?/i;
    const match = fullCommand.match(regex);

    if (!match) {
        return message.reply('Usage: `!createsemester "<nom>" <date_debut> <date_fin> [note_max]`\n' +
            'Les dates doivent être au format DD/MM/YYYY');
    }

    // Extraire les groupes capturés
    const nom = match[1] || match[2]; // Le nom peut être avec ou sans guillemets
    const dateDebut = match[3];
    const dateFin = match[4];
    const noteMax = match[5] ? parseFloat(match[5]) : 4.0;

    if (isNaN(noteMax)) {
        return message.reply('La note maximale doit être un nombre.');
    }

    try {
        const result = await Semester.create(nom, dateDebut, dateFin, noteMax);
        message.reply(`Semestre "${nom}" créé avec succès. ID: ${result.id}`);
    } catch (error) {
        console.error('Erreur lors de la création du semestre:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour mettre à jour un semestre
async function handleUpdateSemester(message, args) {
    // Récupérer la commande complète
    const fullCommand = message.content.slice(config.prefix.length).trim();

    // Extraire les arguments manuellement en tenant compte des guillemets
    const regex = /updatesemester\s+(\d+)\s+(?:"([^"]+)"|([^\s]+))\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d+(?:\.\d+)?))?/i;
    const match = fullCommand.match(regex);

    if (!match) {
        return message.reply('Usage: `!updatesemester <id> "<nom>" <date_debut> <date_fin> [note_max]`\n' +
            'Les dates doivent être au format DD/MM/YYYY');
    }

    // Extraire les groupes capturés
    const id = parseInt(match[1]);
    if (isNaN(id)) {
        return message.reply('L\'ID doit être un nombre entier.');
    }

    const nom = match[2] || match[3]; // Le nom peut être avec ou sans guillemets
    const dateDebut = match[4];
    const dateFin = match[5];
    const noteMax = match[6] ? parseFloat(match[6]) : 4.0;

    if (isNaN(noteMax)) {
        return message.reply('La note maximale doit être un nombre.');
    }

    try {
        await Semester.update(id, nom, dateDebut, dateFin, noteMax);
        message.reply(`Semestre ID ${id} mis à jour avec succès.`);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du semestre:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour définir un semestre comme actif
async function handleSetActiveSemester(message, args) {
    if (args.length < 1) {
        return message.reply('Usage: `!setactivesemester <id>`');
    }

    const id = parseInt(args[0]);
    if (isNaN(id)) {
        return message.reply('L\'ID doit être un nombre entier.');
    }

    try {
        await Semester.setActive(id);
        message.reply(`Semestre ID ${id} défini comme semestre actif.`);
    } catch (error) {
        console.error('Erreur lors de la définition du semestre actif:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour supprimer un semestre
async function handleDeleteSemester(message, args) {
    if (args.length < 1) {
        return message.reply('Usage: `!deletesemester <id>`');
    }

    const id = parseInt(args[0]);
    if (isNaN(id)) {
        return message.reply('L\'ID doit être un nombre entier.');
    }

    try {
        await Semester.delete(id);
        message.reply(`Semestre ID ${id} supprimé avec succès.`);
    } catch (error) {
        console.error('Erreur lors de la suppression du semestre:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour lister les semestres
async function handleListSemesters(message, args) {
    try {
        const semesters = await Semester.getAll();
        const activeSemester = await Semester.getActive();

        if (!semesters || semesters.length === 0) {
            return message.reply('Aucun semestre configuré.');
        }

        const embed = new EmbedBuilder()
            .setTitle('Liste des semestres')
            .setColor(0x0099FF);

        semesters.forEach(semester => {
            const startDate = moment(semester.start_date).format('DD/MM/YYYY');
            const endDate = moment(semester.end_date).format('DD/MM/YYYY');
            const isActive = activeSemester && activeSemester.id === semester.id;

            embed.addFields({
                name: `${isActive ? '📌 ' : ''}ID: ${semester.id} - ${semester.name}`,
                value: `**Période**: ${startDate} au ${endDate}\n` +
                    `**Note max**: ${semester.note_max}\n` +
                    `${isActive ? '**SEMESTRE ACTIF**' : ''}`
            });
        });

        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur lors de la récupération des semestres:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour voir le classement d'un semestre
async function handleSemesterRanking(message, args) {
    try {
        let semesterId;

        if (args.length >= 1) {
            semesterId = parseInt(args[0]);
            if (isNaN(semesterId)) {
                return message.reply('L\'ID du semestre doit être un nombre entier.');
            }
        } else {
            // Utiliser le semestre actif
            const activeSemester = await Semester.getActive();
            if (!activeSemester) {
                return message.reply('Aucun semestre actif. Veuillez spécifier un ID de semestre.');
            }
            semesterId = activeSemester.id;
        }

        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);
        if (!semester) {
            return message.reply(`Semestre ID ${semesterId} non trouvé.`);
        }

        // Calculer le classement
        await Semester.calculateRankings(semesterId);

        // Récupérer le classement
        const rankings = await Semester.getRankings(semesterId, 20); // Limiter à 20 résultats

        if (!rankings || rankings.length === 0) {
            return message.reply(`Aucun participant dans le classement du semestre "${semester.name}".`);
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

        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur lors de la récupération du classement:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour configure les paramètres de système
async function handleConfigSystem(message, args) {
    if (args.length < 2) {
        return message.reply('Usage: `!configsystem <key> <value> [description]`\n' +
            'Clés disponibles: NOTE_MAX, PERCENTILE_THRESHOLDS, PERCENTILE_NOTES');
    }

    const key = args[0].toUpperCase();
    const value = args[1];
    const description = args.length > 2 ? args.slice(2).join(' ') : null;

    // Validation basique des valeurs
    if (key === 'NOTE_MAX') {
        if (isNaN(parseFloat(value))) {
            return message.reply('La valeur de NOTE_MAX doit être un nombre.');
        }
    } else if (key === 'PERCENTILE_THRESHOLDS' || key === 'PERCENTILE_NOTES') {
        try {
            const arr = JSON.parse(value);
            if (!Array.isArray(arr)) {
                return message.reply(`La valeur de ${key} doit être un tableau JSON (ex: [25,50,75,100]).`);
            }
        } catch (e) {
            return message.reply(`Format JSON invalide pour ${key}. Exemple correct: [25,50,75,100]`);
        }
    }

    try {
        await SystemSettings.update(key, value, description);
        message.reply(`Paramètre système "${key}" mis à jour avec succès.`);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du paramètre système:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

// Commande pour voir les points d'un semestre
async function handleSemesterPoints(message, args) {
    try {
        let semesterId;
        let userId = message.author.id;

        // Parcourir les arguments
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            // Si l'argument ressemble à un ID Discord (mention ou ID brut)
            if (arg.match(/^<@!?\d+>$/) || arg.match(/^\d+$/)) {
                // Si l'utilisateur est staff, lui permettre de consulter les points d'un autre utilisateur
                if (await isAdmin(message.author.id)) {
                    userId = arg.replace(/[<@!>]/g, '');
                }
            } else if (!isNaN(parseInt(arg))) {
                // Si c'est un nombre, on suppose que c'est l'ID du semestre
                semesterId = parseInt(arg);
            }
        }

        // Si aucun semestre n'est spécifié, utiliser le semestre actif
        if (!semesterId) {
            const activeSemester = await Semester.getActive();
            if (!activeSemester) {
                return message.reply('Aucun semestre actif. Veuillez spécifier un ID de semestre.');
            }
            semesterId = activeSemester.id;
        }

        // Récupérer le semestre
        const semester = await Semester.getById(semesterId);
        if (!semester) {
            return message.reply(`Semestre ID ${semesterId} non trouvé.`);
        }

        // Récupérer les informations sur l'utilisateur
        const userRanking = await Semester.getUserRanking(userId, semesterId);
        const pointsDetails = await SessionHistory.getUserPointsByTypeAndSemester(userId, semesterId);
        const totalPoints = await SessionHistory.getUserTotalPointsBySemester(userId, semesterId);

        // Récupérer le nom d'utilisateur
        let username;
        try {
            const member = await message.guild.members.fetch(userId);
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

        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur lors de la récupération des points:', error);
        message.reply(`Erreur: ${error.message}`);
    }
}

module.exports = {
    names: [
        'createsemester',
        'updatesemester',
        'setactivesemester',
        'deletesemester',
        'listsemesters',
        'semesterranking',
        'configsystem',
        'semesterpoints'
    ],

    async execute(client, message, args) {
        try {
            // Déterminer quelle commande exécuter
            const command = message.content.split(/ +/)[0].slice(config.prefix.length).toLowerCase();

            // Commandes accessibles à tous
            if (command === 'listsemesters') {
                await handleListSemesters(message, args);
                return;
            } else if (command === 'semesterpoints') {
                await handleSemesterPoints(message, args);
                return;
            } else if (command === 'semesterranking') {
                await handleSemesterRanking(message, args);
                return;
            }

            // Vérifier que l'utilisateur est un administrateur pour les autres commandes
            if (!await isAdmin(message.author.id)) {
                return message.reply('Vous n\'avez pas les permissions nécessaires pour effectuer cette action.');
            }

            switch (command) {
                case 'createsemester':
                    await handleCreateSemester(message, args);
                    break;
                case 'updatesemester':
                    await handleUpdateSemester(message, args);
                    break;
                case 'setactivesemester':
                    await handleSetActiveSemester(message, args);
                    break;
                case 'deletesemester':
                    await handleDeleteSemester(message, args);
                    break;
                case 'configsystem':
                    await handleConfigSystem(message, args);
                    break;
            }
        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande semester (${command}):`, error);
            message.reply('Une erreur est survenue lors de l\'exécution de cette commande.');
        }
    }
};