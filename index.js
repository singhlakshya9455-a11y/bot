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

bot.on("message", async (jsonMsg, position, sender) => {
  // sender can be null sometimes
  if (!sender || sender === bot.username) return;

  const message = jsonMsg.toString();

  try {
    const channel = await discord.channels
      .fetch(config.discord.channelId)
      .catch(() => null);

    if (channel) {
      channel.send(`**${sender} ➤** ${message}`);
    }
  } catch (e) {
    console.error("Discord relay error:", e);
  }
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
// Discord → Minecraft relay (PREFIX: !)
// ======================
discord.on("messageCreate", (msg) => {
  // Ignore bots
  if (msg.author.bot) return;

  // Only allow messages from linked channel
  if (msg.channel.id !== config.discord.channelId) return;

  // Only process messages starting with "!"
  if (!msg.content.startsWith("!")) return;

  // Ensure MC bot is connected
  if (!bot || !bot.chat) {
    msg.reply("🔴 Minecraft bot is not connected.");
    return;
  }

  // Remove "!" prefix
  const content = msg.content.slice(1).trim();
  if (!content) return;

  // 🚀 Minecraft command
  if (content.startsWith("/")) {
    bot.chat(content); // sends "/tps", "/spawn", etc.
    msg.reply(`🟢 Command sent: ${content}`).catch(() => {});
    return;
  }

  // 💬 Normal Minecraft chat
  bot.chat(content);
});

// ======================
// Discord login
// ======================
discord.once("ready", () => {
  console.log(`🔹 Discord bot logged in as ${discord.user.tag}`);
});

discord.login(config.discord.token);

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});
