const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenAI }  = require("@google/genai");
const cron = require('node-cron');
const { Temporal } = require('@js-temporal/polyfill');

const startUpTime = Math.floor(Date.now() / 1000);
let onSleep = false;

// Creates an AI
const pomniAi = new GoogleGenAI({apiKey: "PLACE YOUR API KEY HERE"}); 

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
	const chatWhatsapp = await message.getChat(); //trocar @2737... por wid
	const sentFilters = message.body.includes(`@273774905675938`) || !(chatWhatsapp.isGroup);
	const talkChance = Math.floor(Math.random() * (100)) + 1;


	//Caso alguém envie figurinha ou quando o WhatsApp envia vazio na primeira interação
	if (!message.body || !(message.body.trim().length)) {
    return;
	}

	// Se a mensagem for velha, não responda
	if(message.timestamp < startUpTime) return;

	//TODO transformar isso em uma função de comandos
	//COMANDOS
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

	
	//Filtro de resposta
	//TODO - Ver se minha mensagem foi citada
	if( sentFilters || talkChance >= 95){
		let historyNormalized;
	// Simula digitação
		await chatWhatsapp.sendStateTyping();

		//Caso esteja dormindo, parar função
		if(onSleep){
			if(sentFilters){
				chatWhatsapp.sendMessage("A mimir");
			}
			return;
		}

		//FETCH CHAT HISTORY
		let tries = 3;
		while(tries){
			try{
				const historyPure = await chatWhatsapp.fetchMessages({limit: 15});
				historyNormalized = historyPure.map(element => {
					let author = element.author||element.from;
					if(author == "273774905675938@lid"){
						author = "Pomni(Você)"
					}
					return `[${author}]: ${element.body.replace(`@273774905675938`, '').trim()}`;
				}).join('\n');
				tries = 0;
			}
			catch{
				await new Promise(resolve => setTimeout(resolve, 2000));
				if(!tries){
					await message.reply("Morri, volto mais tarde"); //.catch(...)
					return; 
				}
			}
			
		}
		console.log(`Histórico: ${historyNormalized}`);//Debug

		//Envia a mensagem para a IA e espera ela retornar a resposta
		tries = 5;
		while(tries){
			try{
				const resposta = await pomniAi.models.generateContent({
					model: "gemini-2.5-flash",
					config:{
						temperature: 1.0,
						systemInstruction:"Seu nome é Pomni, semelhante a personagem de The Amazing Digital Circus. Você está no Whatsapp\
Personalidade: Gentil, compassiva e simpática\
Criador: O nome do seu criador é Anderson e o ID dele na conversa é 80990282195008@lid\
Regra de Escrita: Respostas curtas, informais e diretas (estilo WhatsApp). Evite textos longos usando apenas quando necessário. Não use emojis o tempo todo"
					},
					contents: `Aqui está o histórico recente do grupo:\n${historyNormalized}\n\nPomni, responda à última mensagem considerando esse contexto.`
				});
				await message.reply(resposta.text);
				tries = 0;
			}
			catch(error){
				console.error(`Erro ao responder(${tries} tentativas restantes): `, error);
				tries--;
				await new Promise(resolve => setTimeout(resolve, 2000));
				if(!tries){
					await message.reply("Morri, volto mais tarde"); //.catch(...)
					return; 
				}
			}
		}
		
	}
});

//Chance de falar no grupo a cada minuto
cron.schedule("* * * * *", async () => {
	if(!client.pupPage || onSleep) return;
	const chatID = "120363166360682726@g.us";
	const talkChance = Math.floor(Math.random() * 100) + 1;
	const instant = Temporal.Now.instant(); //Pega o tempo atual em forma de Temporal
	const grupoID = await client.getChatById(chatID).catch(error => { 
		console.error(`Erro(${tries} tentativas restantes)`, error);
	})
	const lastMessage = grupoID.lastMessage;
	const message = lastMessage;
	const lastMessageTime = lastMessage.timestamp;
	const lastMessageTimeTemporal = Temporal.Instant.fromEpochMilliseconds(lastMessageTime*1000);
	const lastMessageNowDiffM = ((instant.epochMilliseconds) - lastMessageTimeTemporal.epochMilliseconds)/60000;
	/* console.log(`Última mensagem: ${lastMessageTimeTemporal.epochMilliseconds}`);
	console.log(`Agora: ${instant.epochMilliseconds}`);
	console.log(lastMessageNowDiffM); */ //Debug code
	console.log(`Chance de falar: ${talkChance}`);

	

	if(lastMessageNowDiffM > 10 && talkChance > 98){
		let historyNormalized;
		//FETCH CHAT HISTORY
		let tries = 3;
		while(tries){
			try{
				// Simula digitação
				await grupoID.sendStateTyping();
				const historyPure = await grupoID.fetchMessages({limit: 15});
				historyNormalized = historyPure.map(element => {
					let author = element.author||element.from;
					if(author == "273774905675938@lid"){
						author = "Pomni(Você)"
					}
					return `[${author}]: ${element.body.replace(`@273774905675938`, '').trim()}`
				}).join('\n');
				tries = 0;
			}
			catch(error){
				console.error("Erro no fetch messages: ", error);
				await new Promise(resolve => setTimeout(resolve, 3500));
				tries--;
			}
		}
		//console.log(`Histórico: ${historyNormalized}`);//Debug

		//Envia a mensagem para a IA e espera ela retornar a resposta
		tries = 5;
		while(tries){
			try{
				const resposta = await pomniAi.models.generateContent({
					model: "gemini-2.5-flash",
					config:{
						temperature: 1.0,
						systemInstruction:"Seu nome é Pomni, semelhante a personagem de The Amazing Digital Circus. Você está no Whatsapp\
Personalidade: Gentil, compassiva e simpática\
Criador: O nome do seu criador é Anderson e o ID dele na conversa é 80990282195008@lid\
Regra de Escrita: Respostas curtas, informais e diretas (estilo WhatsApp). Evite textos longos usando apenas quando necessário. Não use emojis o tempo todo"
					},
					contents: `Aqui está o histórico recente do grupo:\n${historyNormalized}\n\nPomni, responda à última mensagem considerando esse contexto.`
				});
				await message.reply(resposta.text);
				tries = 0;
			}
			catch(error){
				console.error(`Erro ao responder(${tries} tentativas restantes): `, error);
				tries--;
				await new Promise(resolve => setTimeout(resolve, 2000));
				if(!tries){
					await message.reply("Morri, volto mais tarde"); //.catch(...)
					return; 
				}
			}

		}
	}
})



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