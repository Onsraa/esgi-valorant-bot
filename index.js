const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { User } = require('./database/models');
const { today } = require('./utils/formatters');
const { setupInteractions } = require('./interactions/setup');

// Créer une nouvelle instance de client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Collection pour stocker les commandes
client.commands = new Collection();

// Charger les commandes
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Enregistrer chaque commande dans la collection
    for (const commandName of command.names) {
        client.commands.set(commandName, command);
    }
}

// Événement quand le bot est prêt
client.once(Events.ClientReady, () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
});

// Événement à la réception d'un message
client.on(Events.MessageCreate, async message => {
    // Ignorer les messages de bot
    if (message.author.bot) return;

    // Gérer l'utilisateur dans la base de données
    try {
        const userId = message.author.id;
        const username = message.author.username;
        const currentDate = today();

        const user = await User.getById(userId);

        if (user) {
            // Mettre à jour l'activité de l'utilisateur
            await User.updateActivity(userId, username, currentDate);
        } else {
            // Ajouter un nouvel utilisateur
            await User.create(userId, username, currentDate);
            console.log(`Nouvel utilisateur ajouté: ${username} (${userId})`);
        }
    } catch (error) {
        console.error('Erreur lors de la gestion de l\'utilisateur:', error);
    }

    // Vérifier si le message commence par le préfixe
    if (!message.content.startsWith(config.prefix)) return;

    // Extraire les arguments et le nom de la commande
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Commande pour afficher le menu principal
    if (commandName === 'menu') {
        try {
            const { displayMainMenu } = require('./interactions/menu');
            await displayMainMenu(message);
            return;
        } catch (error) {
            console.error('Erreur lors de l\'affichage du menu principal:', error);
            message.reply('Une erreur est survenue lors de l\'affichage du menu principal.').catch(console.error);
            return;
        }
    }

    // Vérifier si la commande existe
    if (!client.commands.has(commandName)) return;

    const command = client.commands.get(commandName);

    // Exécuter la commande
    try {
        await command.execute(client, message, args);
    } catch (error) {
        console.error(`Erreur lors de l'exécution de la commande ${commandName}:`, error);
        message.reply('Une erreur est survenue lors de l\'exécution de cette commande.').catch(console.error);
    }
});

// Configurer les gestionnaires d'interactions
setupInteractions(client);

// Connexion du bot avec le token
client.login(config.token);