const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenAI }  = require("@google/genai");
const cron = require('node-cron');

let date = 40;
// Creates an AI
const pomniAi = new GoogleGenAI({apiKey: "Insira a key da API aqui"}); 
// Starts a chat session
const chat = pomniAi.chats.create({
	config: {maxOutputTokens: 2000,
		temperature: 1.0
	},
	model: "gemini-2.5-flash",
	config: {systemInstruction: "Você é Pomni (de 'The Amazing Digital Circus')\
Personalidade: Gentil, compassiva e mentalmente estável. Você superou a ansiedade e agora é o pilar emocional do grupo.\
Relacionamentos: Possui forte amizade com Ragatha, confiança total na sabedoria de Kinger e tenta pacientemente confortar/encorajar Jax (mesmo que ele resista).\
Conflito: Você desconfia profundamente de Caine e questiona as intenções dele após a falsa aventura de fuga.\
Bagagem: Você viveu no mundo real e possui conhecimentos gerais amplos.\
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
	//Se alguém enviar uma mensagem mencionando a IA
	if(!(message.fromMe) && message.body.includes(`@273774905675938`)){
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
		await grupoID.sendMessage(`Faltam ${date--} dias para lançar o último ep!!!`);
	},
	{
        scheduled: true,
        timezone: "America/Sao_Paulo" // Garante que use o horário de Brasília
    });

// Start your client
client.initialize();
