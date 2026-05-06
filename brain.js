import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import * as qrcode from 'qrcode-terminal';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import * as cron from 'node-cron';
import { Temporal } from '@js-temporal/polyfill';
import { aimessageSend, rememberWrite, whatsHistoryFetch, rememberRead, rememberDeleteInterface } from './whatsGemini.mjs';
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
	if(message.body.startsWith('!') && isFromAdmin){

		if(message.body.includes('!remember')){
			let messageToRemember = message.body.replace("!remember ", '');
			rememberWrite(process.env.MEMORY_FILE, messageToRemember)
			.then(() =>
			chatWhatsapp.sendMessage("_Memória adicionada!_")
			);
			return;
		}

		if(message.body.includes('!forget')){
			let entryIndex;
			rememberDeleteInterface(message);
			return;
		}
		switch(message.body){
			case "!sleep":
				if(!onSleep){
					onSleep = true;
					console.log("onSleep set as true");
					chatWhatsapp.sendMessage("*Dormindo...*");

				}
				else{
					chatWhatsapp.sendMessage("Já estou dormindo!");
				}
				break;
			case "!wake":
				if(!onSleep){
					chatWhatsapp.sendMessage("Já estou acordada!");
			
				}
				else{
					onSleep = false;
					console.log("onSleep set as false");
					chatWhatsapp.sendMessage("*Acordando...*");
				}
				break;
			case "!help":
				let commands = await fs.readFile("./commands.txt", 'utf8');
				chatWhatsapp.sendMessage(commands);
				break;
			default:
				chatWhatsapp.sendMessage("_Comando inválido._");
		}
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
		await aimessageSend(historyNormalized, pomniAi, message);
		
	}
});

//Chance de falar no grupo a cada minuto
cron.schedule("* * * * *", async () => {
	if(!client.pupPage || onSleep) return;
	const talkChance = Math.floor(Math.random() * 100) + 1;
	const instant = Temporal.Now.instant(); //Pega o tempo atual em forma de Temporal
	const grupoID = await client.getChatById(process.env.CHAT_ID).catch(error => { 
		console.error(`Erro dentro do cron: `, error);
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
		await aimessageSend(historyNormalized, pomniAi, lastMessage);
	
})



// Envia o tempo que falta até o lançamento do novo filme
cron.schedule('00 14 * * *', async () => {
		const timeNow = Temporal.Now.plainDateISO();
		const eventTime = new Temporal.PlainDate(2026, 6, 4);
		const timeUntilEvent = timeNow.until(eventTime);
		const grupoID = await client.getChatById(process.env.CHAT_ID);
		await grupoID.sendMessage(`*Faltam ${timeUntilEvent.days} dias para lançar o último ep!!!*`);
	},
	{
        scheduled: true,
        timezone: "America/Sao_Paulo" // Garante que use o horário de Brasília
    });

// Start your client
client.initialize();