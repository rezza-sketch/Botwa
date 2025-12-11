import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from "@whiskeysockets/baileys";
import fs from "fs";
import axios from "axios";
import child_process from "child_process";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        browser: ["Chrome", "Ubuntu", "1.0"]
    });

    // Wajib — biar QR muncul & status jelas
    sock.ev.on("connection.update", (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.log("\n=== SCAN QR NYA BRO ===\n");
            console.log(qr);
            console.log("\n========================\n");
        }

        if (connection === "open") {
            console.log("🔥 BOT ONLINE — WHATSAPP CONNECTED");
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log("⚠️  KONEKSI PUTUS — Reconnecting:", shouldReconnect);

            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // PESAN MASUK
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";
        const from = msg.key.remoteJid;

        // MENU
        if (body === "menu" || body === ".menu") {
            let menu = `🔥 *FULL MENU BOT*

✨ STIKER
- stiker
- toimg

🎧 AUDIO
- tomp3
- bass
- slowmo

🎞 DOWNLOADER
- ytmp3 <url>
- ytmp4 <url>
- tt <url>
- ig <url>

🧰 TOOLS
- removebg
- ocr
- ssweb <link>
- getpp

Ketik perintahnya langsung bro.`;

            await sock.sendMessage(from, { text: menu });
        }

        // STIKER
        if (body === "stiker" || body === "s" || body === "/s") {
            const media = msg.message.imageMessage || msg.message.videoMessage;
            if (!media)
                return sock.sendMessage(from, { text: "Kirim foto/video dulu bro" });

            const buffer = await sock.downloadMediaMessage(msg);
            fs.writeFileSync("./media", buffer);

            child_process.execSync(
                `ffmpeg -i media -vcodec libwebp -filter:v fps=fps=15 -lossless 1 -preset default output.webp`
            );

            const sticker = fs.readFileSync("output.webp");
            await sock.sendMessage(from, { sticker: sticker });
        }

        // TOIMG
        if (body === "toimg") {
            let buffer = await sock.downloadMediaMessage(msg);
            fs.writeFileSync("stiker.webp", buffer);
            child_process.execSync("dwebp stiker.webp -o result.png");
            let img = fs.readFileSync("result.png");
            sock.sendMessage(from, { image: img });
        }

        // YTMP4
        if (body.startsWith("ytmp4")) {
            let url = body.split(" ")[1];
            if (!url)
                return sock.sendMessage(from, { text: "Linknya mana bang" });

            let api = await axios.get(
                `https://api.akuari.my.id/downloader/yt?link=${url}`
            );

            await sock.sendMessage(from, {
                video: { url: api.data.result.video }
            });
        }
    });
}

startBot();