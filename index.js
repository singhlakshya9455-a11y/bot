const mineflayer = require("mineflayer");
const express = require("express"); // ← This was missing!
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();

// Use Render's assigned port if present
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0"; // IMPORTANT

app.get("/", (req, res) => {
  res.send("Mineflayer bot is running!");
});

app.listen(PORT, HOST, () => {
  console.log(`Web server started on http://${HOST}:${PORT}`);
});

const config = {
  mc: {
    host: "play.pika-network.net",
    port: 25565,
    username: "SilverMoon",
    version: "1.18.1",
    loginPassword: process.env.MC_LOGIN_PASSWORD, // change this to your real password
  },
  discord: {
    token:
      process.env.DISCORD_TOKEN,
    channelId: "1451178112367984672",
  },
};

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let bot = null;
let afkJumpInterval = null;

// =============== AFK JUMP LOOP =================
function startAfkJumpLoop() {
  // Clear old interval if exists (for safety on reconnect)
  if (afkJumpInterval) clearInterval(afkJumpInterval);

  afkJumpInterval = setInterval(() => {
    if (!bot || !bot.entity) return;

    try {
      // Press jump
      bot.setControlState("jump", true);

      // Release after 300 ms so it’s a quick hop
      setTimeout(() => {
        if (bot) bot.setControlState("jump", false);
      }, 300);
      console.log("⬆ AFK jump executed");
    } catch (e) {
      console.log("Error during AFK jump:", e);
    }
  }, 60 * 1000); // every 60 seconds
}

// ======================
// START MINEFLAYER BOT
// ======================
function startMinecraftBot() {
  bot = mineflayer.createBot({
    host: config.mc.host,
    port: config.mc.port,
    username: config.mc.username,
    version: config.mc.version,
  });

  bot.once("spawn", () => {
    console.log("🟢 Bot successfully joined the Minecraft server!");
    bot.chat("✔ Bot is now connected to the server!");

    // Auto /login
    setTimeout(() => {
      bot.chat(`/login ${config.mc.loginPassword}`);
      console.log("🔐 Sent /login command");
    }, 2000);

    // Auto /server survival
    setTimeout(() => {
      bot.chat(`/server survival`);
      console.log("🌍 Sent /server survival command");
    }, 4000);

    // Start AFK jump loop
    startAfkJumpLoop();
  });

  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    const channel = discord.channels.cache.get(config.discord.channelId);
    if (channel) channel.send(`**${username} ➤** ${message}`);
  });

  bot.on("kicked", (reason) => console.log("Kicked:", reason));
  bot.on("error", (err) => console.log("Error:", err));

  bot.on("end", () => {
    console.log("Bot disconnected. Reconnecting in 5 seconds...");

    // Stop AFK loop when bot disconnects
    if (afkJumpInterval) {
      clearInterval(afkJumpInterval);
      afkJumpInterval = null;
    }

    setTimeout(startMinecraftBot, 5000);
  });
}

startMinecraftBot();

// ======================
// Discord → Minecraft relay
// ======================
discord.on("messageCreate", (msg) => {
  // Ignore other bots
  if (msg.author.bot) return;

  // Optional: only allow messages from the specific linked channel
  if (msg.channel.id !== config.discord.channelId) return;

  // Ensure MC bot is connected
  if (!bot || !bot.chat) return;

  const content = msg.content.trim();
  if (!content) return;

  // 🚀 If message starts with "/", treat as a command
  if (content.startsWith("/")) {
    const command = content.slice(1); // remove leading "/"
    bot.chat("/" + command);
    msg.reply(`🟢 Command executed: /${command}`).catch(console.error);
    return;
  }

  // 💬 Otherwise, send as normal chat to Minecraft
  bot.chat(content);
});

// ======================
// Discord login
// ======================
discord.once("clientReady", () => {
  console.log(`🔹 Discord bot logged in as ${discord.user.tag}`);
});

discord.login(config.discord.token);

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});
