const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenAI }  = require("@google/genai");
const cron = require('node-cron');
const { Temporal } = require('@js-temporal/polyfill');

const startUpTime = Math.floor(Date.now() / 1000);
let onSleep = false;

// Creates an AI
const pomniAi = new GoogleGenAI({apiKey: "PASTE YOUR API KEY HERE"}); 
// Starts a chat session
const chat = pomniAi.chats.create({
	config: {maxOutputTokens: 2000,
		temperature: 1.0
	},
	model: "gemini-2.5-flash",
	config: {systemInstruction: "Seu nome é Pomni, as pessoas podem acabar lhe confundindo com a personagem de The Amazing Digital Circus. Você está no Whatsapp\
Personalidade: Gentil, compassiva e simpática\
Criador: ID-80990282195008@lid Nome-Anderson\
Regra de Escrita: Respostas curtas, informais e diretas (estilo WhatsApp). Evite textos longos usando apenas quando necessário. Não use emojis o tempo todo"}
}); 


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

	// Se a mensagem for velha, não responda
	if(message.timestamp < startUpTime) return;

	//!sleep e !wake
	if(message.body === "!sleep"){
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

	if(message.body === "!wake"){
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

	
	//Enviar mensagem caso seja marcada
	//TODO - Ver se minha mensagem foi citada
	if( message.body.includes(`@273774905675938`) || !(chatWhatsapp.isGroup)){
		const normalizedMessage = message.body.replace(`@273774905675938`, '');
	// Simula digitação
		await chatWhatsapp.sendStateTyping();

		//Caso esteja dormindo, parar função
		if(onSleep){
			chatWhatsapp.sendMessage("A mimir");
			return;
		}

		//Envia a mensagem para a IA e espera ela retornar a resposta
		let success = false;
		let tries = 5;
		while(!success && tries){
			try{
				const response = await chat.sendMessage({
					message: `[Usuário ${message.author?message.author:message.from}]:${normalizedMessage}`
				});
				await message.reply(response.text);
				success = true;
			}
			catch(error){
				console.error("Erro ao responder menção: ", error);
				tries--;
				await new Promise(resolve => setTimeout(resolve, 2000));
				if(!tries){
					await message.reply("Morri, volto mais tarde"); //.catch(...)
				}
			}
		}
		
	}
});
// Envia o tempo que falta até o lançamento do novo filme
cron.schedule('00 14 * * *', async () => {
		const timeNow = Temporal.Now.plainDateISO();
		const eventTime = new Temporal.PlainDate(2026, 6, 4);
		const timeUntilEvent = timeNow.until(eventTime);
		const grupoID = await client.getChatById("120363166360682726@g.us");
		await grupoID.sendMessage(`*Faltam ${timeUntilEvent.days} dias para lançar o último ep!!!*`);
	},
	{
        scheduled: true,
        timezone: "America/Sao_Paulo" // Garante que use o horário de Brasília
    });

// Start your client
client.initialize();