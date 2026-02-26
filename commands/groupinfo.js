/**
 * The absolute full Group Info command.
 * Features: Safe media handling, deep metadata, bot admin check, 
 * member stats, group settings, and disappearing messages.
 */
async function groupInfoCommand(sock, chatId, msg) {
    // 1. Guard check: Only run in groups to prevent crashes in private chats
    if (!chatId.endsWith('@g.us')) {
        return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups!' }, { quoted: msg });
    }

    try {
        // 2. Fetch the metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        
        // 3. Process Dates
        const creationDate = groupMetadata.creation 
            ? new Date(groupMetadata.creation * 1000).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }) 
            : 'Unknown';

        // 4. Process Roles and Admins
        const superAdmins = participants.filter(p => p.admin === 'superadmin');
        const regularAdmins = participants.filter(p => p.admin === 'admin');
        const allAdmins = [...superAdmins, ...regularAdmins];
        
        const owner = groupMetadata.owner || superAdmins[0]?.id || chatId.split('-')[0] + '@s.whatsapp.net';

        // 5. Check if the Bot is an Admin
        // Baileys stores the bot's ID like "1234567890:1@s.whatsapp.net", so we strip the device ID (":1")
        const botNumber = sock.user.id.split(':')[0]; 
        const botJid = `${botNumber}@s.whatsapp.net`;
        const isBotAdmin = allAdmins.some(admin => admin.id === botJid) ? '✅ Yes' : '❌ No';

        // 6. Process Group Settings
        const canSendMessages = groupMetadata.announce ? '🔒 Admins Only' : '🔓 Everyone';
        const canEditInfo = groupMetadata.restrict ? '🔒 Admins Only' : '🔓 Everyone';
        const isCommunity = groupMetadata.isCommunity ? '✅ Yes' : '❌ No';
        const ephemeral = groupMetadata.ephemeralDuration ? `⏳ ${groupMetadata.ephemeralDuration / 86400} Days` : '❌ Off';

        // 7. Build the Information Text
        const text = `
┌──「 *ULTIMATE GROUP INFO* 」
▢ *🔖 SUBJECT:* ${groupMetadata.subject}
▢ *♻️ ID:* ${groupMetadata.id}
▢ *📅 CREATED:* ${creationDate}
▢ *👑 MAIN ADMIN:* @${owner.split('@')[0]}

▢ *📊 STATS:*
   • Total Participants: ${participants.length}
   • Regular Members: ${participants.length - allAdmins.length}
   • Total Admins: ${allAdmins.length}

▢ *⚙️ SETTINGS:*
   • Bot is Admin?: ${isBotAdmin}
   • Send Messages: ${canSendMessages}
   • Edit Info: ${canEditInfo}
   • Disappearing: ${ephemeral}
   • Community: ${isCommunity}

▢ *🕵🏻‍♂️ ADMIN ROSTER:*
${allAdmins.map((v, i) => `   ${i + 1}. @${v.id.split('@')[0]} ${v.admin === 'superadmin' ? '*(Main)*' : ''}`).join('\n') || '   • No admins found'}

▢ *📌 DESCRIPTION:*
${groupMetadata.desc?.toString() || 'No description provided.'}
└──────────────────────────`.trim();

        // Prepare the mentions array so tags actually work
        const mentions = [...allAdmins.map(v => v.id), owner];

        // 8. Fetch Profile Picture Safely (Crash-Proof)
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(chatId, 'image');
        } catch (err) {
            console.log(`[GroupInfo] No profile picture for ${chatId}. Sending text-only version.`);
        }

        // 9. Send the Message
        if (ppUrl) {
            // Group has an image, send as an image message
            await sock.sendMessage(chatId, { image: { url: ppUrl }, caption: text, mentions }, { quoted: msg });
        } else {
            // Fallback: Send plain text to avoid the 404/429 crashes
            await sock.sendMessage(chatId, { text: text, mentions }, { quoted: msg });
        }

    } catch (error) {
        // 10. Safe Error Handling
        console.error('CRITICAL ERROR in groupInfoCommand:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to gather group info. I might not have access to the metadata.' 
        }, { quoted: msg });
    }
}

module.exports = groupInfoCommand;
