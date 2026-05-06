import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import * as qrcode from 'qrcode-terminal';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import * as cron from 'node-cron';
import { Temporal } from '@js-temporal/polyfill';
import { aimessageSend, rememberWrite, whatsHistoryFetch, rememberRead, rememberDeleteInterface, rememberWriteInterface, aimessageModel } from './whatsGemini.mjs';
import fs from "fs/promises";

const startUpTime = Math.floor(Date.now() / 1000);
const admin = process.env.ADMIN_ID;
let onSleep = false;

// Creates an AI
const pomniAi = new GoogleGenAI({apiKey: process.env.API_KEY});

// Create a new client instance
const client = new Client({
	authStrategy: new LocalAuth({clientId: "PomniAccount"}),
	puppeteer: { args: ['--no-sandbox'] }
});


// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Client is ready!');
});

// When the client received QR-Code
client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
});


// Listen and reply to messages
client.on('message', async (message) => {
	const chatWhatsapp = await message.getChat();
	const sentFilters = message.body.includes(process.env.MY_MENTION_ID) || !(chatWhatsapp.isGroup);
	const talkChance = Math.floor(Math.random() * (100)) + 1;
	const isMsgQuoting = message.hasQuotedMsg;
	let isFromAdmin = false;
	let quotedMsg;


	//Caso alguém envie figurinha ou quando o WhatsApp envia vazio na primeira interação
	if (!message.body || !(message.body.trim().length)) return;


	// Se a mensagem for velha, não responda
	if(message.timestamp < startUpTime) return;

	// Testa se é do admin
	if(message.from === admin || message.author === admin){
		isFromAdmin = true;
	}

	//TODO transformar isso em uma função de comandos
	//COMANDOS
	if(message.body.startsWith('!')){
		if(message.body.includes('!remember') && isFromAdmin){
			rememberWriteInterface(message);
			return;
		}

		if(message.body.includes('!forget') && isFromAdmin){
			rememberDeleteInterface(message);
			return;
		}
		if(message.body.includes("!sleep") && isFromAdmin){
			if(!onSleep){
				onSleep = true;
				console.log("onSleep set as true");
				chatWhatsapp.sendMessage("*Dormindo...*");

			}
			else{
				chatWhatsapp.sendMessage("Já estou dormindo!");
			}
			return;
		}
		if(message.body.includes("!wake") && isFromAdmin){
			if(!onSleep){
				chatWhatsapp.sendMessage("Já estou acordada!");
		
			}
			else{
				onSleep = false;
				console.log("onSleep set as false");
				chatWhatsapp.sendMessage("*Acordando...*");
			}
			return;
		}
		if(message.body.includes("!help")){
			let commands = await fs.readFile("./commands.txt", 'utf8');
			chatWhatsapp.sendMessage(commands);
			return;
		}
		if(message.body.includes("!fetchHistory")){
			let history = await whatsHistoryFetch(chatWhatsapp);
			chatWhatsapp.sendMessage(history);
			return;
		}
		if(message.body.includes("!getProfilePic")){
			if(isMsgQuoting){
				quotedMsg = await message.getQuotedMessage();
				const contact = await quotedMsg.getContact();
				const imgUrl = await contact.getProfilePicUrl();
				const imgMedia = await MessageMedia.fromUrl(imgUrl);
				message.reply(imgMedia);
			}
			else{
				message.reply("A imagem do perfil de quem?");
			}
			return;
		}
		if(message.body.includes("!stickerfy")){
			if(isMsgQuoting){
				quotedMsg = await message.getQuotedMessage();
				if(!(quotedMsg.hasMedia)){ 
					message.reply("Não tem imagem aí.")
					return;
				}
				const imgMedia = await quotedMsg.downloadMedia();
				message.reply(imgMedia, undefined, {sendMediaAsSticker: true});
			}
			else{
				message.reply("Quer que eu transforme o que em figurinha?");
			}
			return;
		}
		chatWhatsapp.sendMessage("_Comando inválido._");
		return;
	}

	if(isMsgQuoting){
		quotedMsg = message.getQuotedMessage();
	}
	else{
		quotedMsg = null;
	}

	//Filtro de resposta
	//TODO - Ver se minha mensagem foi citada
	if( sentFilters || talkChance >= 95 || (await quotedMsg)?.fromMe){
		//Caso esteja dormindo, parar função
		if(onSleep){
			if(sentFilters){
				chatWhatsapp.sendMessage("A mimir");
			}
			return;
		}

		//FETCH CHAT HISTORY
		let historyNormalized = await whatsHistoryFetch(chatWhatsapp);

		//Envia a mensagem para a IA e espera ela retornar a resposta
		aimessageSend(historyNormalized, pomniAi, message);
		
	}
});

client.on("group_join", async (notification) => {
	//Enviar mensagem de boas-vindas
	const chat = await notification.getChat();
	const message = await aimessageModel(pomniAi, "Alguém acabou de entrar no grupo, dê as boas vindas!");
	chat.sendMessage(message);
});

//Chance de falar no grupo a cada minuto
cron.schedule("* * * * *", async () => {
	if(!client.pupPage || onSleep) return;
	const talkChance = Math.floor(Math.random() * 100) + 1;
	const instant = Temporal.Now.instant(); //Pega o tempo atual em forma de Temporal
	const grupoID = await client.getChatById(process.env.CHAT_ID).catch(error => { 
		console.error(`Erro dentro do cron: `, error);
		//fs.appendFile("./error.log", error, 'utf8');
	})
	const lastMessage = grupoID.lastMessage;
	const lastMessageTime = lastMessage.timestamp;
	const lastMessageTimeTemporal = Temporal.Instant.fromEpochMilliseconds(lastMessageTime*1000);
	const lastMessageNowDiffM = ((instant.epochMilliseconds) - lastMessageTimeTemporal.epochMilliseconds)/60000;
	/* console.log(`Última mensagem: ${lastMessageTimeTemporal.epochMilliseconds}`);
	console.log(`Agora: ${instant.epochMilliseconds}`);
	console.log(lastMessageNowDiffM); */ //Debug code
	console.log(`Chance de falar: ${talkChance}`);

	
	//Se a mensagem for muito nova ou ser minha, encerra função
	if((lastMessageNowDiffM < 10 || talkChance < 95) || lastMessage.fromMe) return;
		//FETCH CHAT HISTORY
		let historyNormalized = await whatsHistoryFetch(grupoID);

		//Envia a mensagem para a IA e espera ela retornar a resposta
		aimessageSend(historyNormalized, pomniAi, lastMessage);
	
})



// Envia o tempo que falta até o lançamento do novo filme
cron.schedule('00 14 * * *', async () => {
		const timeNow = Temporal.Now.plainDateISO();
		const eventTime = new Temporal.PlainDate(2026, 6, 4);
		const timeUntilEvent = timeNow.until(eventTime);
		const grupoID = await client.getChatById(process.env.CHAT_ID);
		const messageSent = grupoID.sendMessage(`*Faltam ${timeUntilEvent.days} dias para lançar o último ep!!!*`);
		messageSent.then(element => {element.pin(86400)});
	},
	{
        scheduled: true,
        timezone: "America/Sao_Paulo" // Garante que use o horário de Brasília
    });

// Start your client
client.initialize();