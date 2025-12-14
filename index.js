import qrcode from 'qrcode-terminal';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import pkg from 'whatsapp-web.js';

const { Client, LocalAuth, MessageMedia } = pkg;

console.log("Iniciando bot figurinha...");

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "figurinha-bot" })
});


const estados = new Map();

const FASE = {
    ESPERANDO_IMAGEM: 'esperando_imagem',
    PERGUNTA_TEXTO: 'pergunta_texto',
    ESPERANDO_FRASE: 'esperando_frase',
    ESPERANDO_POSICAO: 'esperando_posicao'
};

const TEMPO_LIMITE = 2 * 60 * 1000; 


client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("Bot conectado com sucesso!");
});

client.on('authenticated', () => {
    console.log("Autenticado!");
});

function cancelarFluxo(remetente, motivo) {
    estados.delete(remetente);
    client.sendMessage(remetente, motivo);
}

function criarTimer(remetente) {
    return setTimeout(() => {
        cancelarFluxo(
            remetente,
            "Tempo esgotado. Processo encerrado. Use *IAsticker2.0* novamente."
        );
    }, TEMPO_LIMITE);
}

function escapeFFmpeg(texto) {
    return texto.replace(/:/g, '\\:')
                .replace(/'/g, "\\'")
                .replace(/"/g, '\\"');
}


client.on('message', async message => {
    const remetente = message.from;
    const texto = (message.body || '').trim();
    const estado = estados.get(remetente);

    /* INÍCIO */
    if (texto === 'IAsticker2.0') {
        if (estado?.timer) clearTimeout(estado.timer);

        estados.set(remetente, {
            fase: FASE.ESPERANDO_IMAGEM,
            timer: criarTimer(remetente)
        });

        await message.reply("Envie a imagem da figurinha.");
        return;
    }

    /* ESPERANDO IMAGEM */
    if (estado?.fase === FASE.ESPERANDO_IMAGEM) {
        if (!message.hasMedia) {
            await message.reply("Preciso de uma *imagem*. Envie a imagem.");
            return;
        }

        const media = await message.downloadMedia();
        if (!media.mimetype.startsWith('image')) {
            await message.reply("Isso não é uma imagem.");
            return;
        }

        const buffer = Buffer.from(media.data, 'base64');
        fs.mkdirSync('./temp', { recursive: true });

        const inputPath = `./temp/input-${Date.now()}.jpg`;
        fs.writeFileSync(inputPath, buffer);

        estado.inputPath = inputPath;
        estado.fase = FASE.PERGUNTA_TEXTO;

        await message.reply("Quer adicionar texto?\n1️⃣ Sim\n2️⃣ Não");
        return;
    }

    /* PERGUNTA TEXTO */
    if (estado?.fase === FASE.PERGUNTA_TEXTO) {
        if (texto !== '1' && texto !== '2') {
            await message.reply("Responda apenas com 1 ou 2.");
            return;
        }

        if (texto === '2') {
            gerarStickerSimples(estado.inputPath, remetente);
            estados.delete(remetente);
            return;
        }

        estado.fase = FASE.ESPERANDO_FRASE;
        await message.reply("Envie a frase (máx 30 caracteres).");
        return;
    }

    /* ESPERANDO FRASE */
    if (estado?.fase === FASE.ESPERANDO_FRASE) {
        let frase = texto;

        if (!frase) {
            cancelarFluxo(remetente, "Frase inválida. Processo cancelado.");
            return;
        }

        if (frase.length > 30) frase = frase.slice(0, 30);

        estado.frase = frase;
        estado.fase = FASE.ESPERANDO_POSICAO;

        await message.reply("Onde colocar o texto?\n1️⃣ Em cima\n2️⃣ Embaixo");
        return;
    }

    /* ESPERANDO POSIÇÃO */
    if (estado?.fase === FASE.ESPERANDO_POSICAO) {
        if (texto !== '1' && texto !== '2') {
            await message.reply("Responda apenas com 1 ou 2.");
            return;
        }

        gerarStickerComTexto(
            estado.inputPath,
            estado.frase,
            texto === '1' ? 'top' : 'bottom',
            remetente
        );

        estados.delete(remetente);
        return;
    }
});

function gerarStickerSimples(inputPath, remetente) {
    const outputPath = `${inputPath}.webp`;

    ffmpeg(inputPath)
        .outputOptions([
            '-vcodec', 'libwebp',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15'
        ])
        .toFormat('webp')
        .save(outputPath)
        .on('end', async () => {
            const media = MessageMedia.fromFilePath(outputPath);
            await client.sendMessage(remetente, media, { sendMediaAsSticker: true });
        });
}

function gerarStickerComTexto(inputPath, frase, posicao, remetente) {
    const outputPath = `${inputPath}.webp`;
    const texto = escapeFFmpeg(frase);

    const y = posicao === 'top' ? '20' : 'h-text_h-20';

    const filtro =
        `scale=512:512:force_original_aspect_ratio=decrease,fps=15,` +
        `drawtext=text='${texto}':fontcolor=white:fontsize=40:` +
        `bordercolor=black:borderw=2:x=(w-text_w)/2:y=${y}`;

    ffmpeg(inputPath)
        .outputOptions([
            '-vcodec', 'libwebp',
            '-vf', filtro
        ])
        .toFormat('webp')
        .save(outputPath)
        .on('end', async () => {
            const media = MessageMedia.fromFilePath(outputPath);
            await client.sendMessage(remetente, media, { sendMediaAsSticker: true });
        });


}


client.initialize();
