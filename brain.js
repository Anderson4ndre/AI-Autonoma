const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenAI }  = require("@google/genai");
const cron = require('node-cron');

let onSleep = false;

// Creates an AI
const pomniAi = new GoogleGenAI({apiKey: "DIGITE A CHAVE DA API AQUI"}); 
// Starts a chat session
const chat = pomniAi.chats.create({
	config: {maxOutputTokens: 2000,
		temperature: 1.0
	},
	model: "gemini-2.5-flash",
	config: {systemInstruction: "Seu nome é Pomni, as pessoas podem acabar lhe confundindo com a personagem de The Amazing Digital Circus.\
Personalidade: Gentil, compassiva e simpática\
Regra de Escrita: Respostas extremamente curtas, informais e diretas (estilo WhatsApp). Nunca use textos longos."}
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
client.on('message_create', async (message) => {
	const chatWhatsapp = message.getChat();
	// Simula digitação
	(await chatWhatsapp).sendStateTyping();

	//!sleep e !wake
	if(message.body === "!sleep"){
		if(!onSleep){
			onSleep = true;
			console.log("onSleep set as true");
			(await chatWhatsapp).sendMessage("*Dormindo...*");

		}
		else{
			(await chatWhatsapp).sendMessage("Já estou dormindo!");
		}
	}
	if(message.body === "!wake"){
		if(!onSleep){
			(await chatWhatsapp).sendMessage("Já estou acordada!");
	
		}
		else{
			onSleep = false;
			console.log("onSleep set as false");
			(await chatWhatsapp).sendMessage("*Acordando...*");
		}
	}
	//Caso esteja dormindo, parar função
	if(onSleep){
		return;
		(await chatWhatsapp).sendMessage("A mimir");
	}
	//Enviar mensagem caso seja marcada
	if((!(message.fromMe) && message.body.includes(`@273774905675938`)) || (!(message.fromMe) && !((await chatWhatsapp).isGroup))){
		const normalizedMessage = message.body.replace(`@273774905675938`, '');
		//Envia a mensagem para a IA e espera ela retornar a resposta
		try{
			const response = await chat.sendMessage({
				message: `[Usuário ${message.author}]:${normalizedMessage}`
			});
			message.reply(response.text);
		}
		catch(error){
			console.error("Erro ao responder menção: ", error);
			message.reply("Minha cabeça está muito cheia, pode perguntar isso depois?");
		}
		
	}
});
// Envia o tempo que falta até o lançamento do novo filme
cron.schedule('0 0 * * *', async () => {
		const grupoID = await client.getChatById("120363166360682726@g.us");
		await grupoID.sendMessage(`Faltam *** dias para lançar o último ep!!!`);
	},
	{
        scheduled: true,
        timezone: "America/Sao_Paulo" // Garante que use o horário de Brasília
    });

// Start your client
client.initialize();
