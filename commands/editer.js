const { User } = require('../database/models');

module.exports = {
    names: ['editer', 'edit'],

    async execute(client, message, args) {
        try {
            // Envoyer un message pour demander les informations
            const promptMsg = await message.channel.send(
                'Veuillez remplir les informations suivantes pour compléter votre profil. Répondez à ce message avec:\n\n' +
                '`nom, prénom, classe, email`\n\n' +
                'Exemple: `Dupont, Jean-Pierre, ING4, jean.dupont@myges.fr`'
            );

            // Créer un filtre pour récupérer uniquement les réponses de l'auteur du message
            const filter = m => m.author.id === message.author.id;

            // Attendre la réponse de l'utilisateur (5 minutes max)
            const collected = await message.channel.awaitMessages({
                filter,
                max: 1,
                time: 300000,
                errors: ['time']
            }).catch(() => null);

            // Si aucune réponse n'a été reçue
            if (!collected || collected.size === 0) {
                await promptMsg.delete().catch(console.error);
                return message.reply('Temps d\'attente dépassé. Veuillez réessayer.');
            }

            // Récupérer la réponse
            const reply = collected.first();

            // Parser la réponse
            const profileData = reply.content.split(',').map(item => item.trim());

            // Vérifier que tous les champs sont présents
            if (profileData.length < 4) {
                await promptMsg.delete().catch(console.error);
                return message.reply('Format incorrect. Veuillez utiliser le format: `nom, prénom, classe, email`');
            }

            const [nom, prenom, classe, email] = profileData;

            // Mettre à jour le profil
            try {
                await User.updateProfile(message.author.id, nom, prenom, classe, email);
                await message.reply('Profil mis à jour avec succès!');
            } catch (error) {
                if (error.message.includes('email')) {
                    await message.reply(`Erreur: ${error.message}`);
                } else {
                    console.error('Erreur lors de la mise à jour du profil:', error);
                    await message.reply('Une erreur est survenue lors de la mise à jour du profil.');
                }
            }

            // Supprimer le message de prompt et la réponse
            await promptMsg.delete().catch(console.error);
            await reply.delete().catch(console.error);
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande editer:', error);
            message.reply('Une erreur est survenue lors de l\'édition du profil.');
        }
    }
};