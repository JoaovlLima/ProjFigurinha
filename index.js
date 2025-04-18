
import qrcode from 'qrcode-terminal';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { join } from 'path';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

ffmpeg.setFfmpegPath(ffmpegPath);
const { Client, LocalAuth } = pkg;

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('🟢 Cliente pronto!');
});
const aguardandoimagem = new Set();

client.on('message', async (message) => {
    const remetente = message.from;

//     if (message.from.includes('@g.us')) {
//         console.log('🔕 Mensagem de grupo ignorada');
//        return;
//    }

const agora = new Date();
const hora = agora.getHours().toString().padStart(2, '0');
const minuto = agora.getMinutes().toString().padStart(2, '0');
const segundo = agora.getSeconds().toString().padStart(2, '0');

const texto = message.body
console.log(`📝 Mensagem recebida: "${texto}  ${hora}:${minuto}:${segundo}"`);

    if (texto == "IAsticker2.0") {
        aguardandoimagem.add(remetente);
        message.reply("Aguardando imagem....");
        return
    }

    if (aguardandoimagem.has(remetente) && message.hasMedia) {
        const media = await message.downloadMedia();
        if (media.mimetype.startsWith('image')) {
            const buffer = Buffer.from(media.data, 'base64');
            const inputPath = './temp/input.jpg';
            const outputPath = './temp/sticker.webp';

            // Salva imagem
            fs.writeFileSync(inputPath, buffer);

            // Converte para webp
            ffmpeg(inputPath)
                .outputOptions([ 
                    '-vcodec', 'libwebp', 
                    '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15'
                ])
                .toFormat('webp')
                .save(outputPath)
                .on('end', async () => {
                    // Envia como figurinha
                    const stickerMedia = MessageMedia.fromFilePath(outputPath);
                    await message.reply(stickerMedia, undefined, { sendMediaAsSticker: true });

                    console.log('✅ Figurinha enviada!');
                    aguardandoimagem.delete(remetente)
                });
        }

    }

});

client.initialize();
