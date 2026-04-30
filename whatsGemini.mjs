const HISTORY_SIZE = 15;
const ERROR_WAIT = 3500;

export async function whatsHistoryFetch(chatObject, myUserId){
    let tries = 3;
    let historyNormalized
    while(tries){
        try{
            // Simula digitação
            await chatObject.sendStateTyping();
            const historyPure = await chatObject.fetchMessages({limit: HISTORY_SIZE});
            historyNormalized = historyPure.map(element => {
                let author = element.author||element.from;
                if(author == "273774905675938@lid"){
                    author = "Pomni(Você)"
                }
                return `[${author}]: ${element.body.replace(myUserId, '').trim()}`
            }).join('\n');
            tries = 0;
        }
        catch(error){
            console.error("Erro no fetch messages: ", error);
            await new Promise(resolve => setTimeout(resolve, ERROR_WAIT));
            tries--;
            if(!tries){
                console.log("Alguma coisa deu errada");
            }
        }
    }
    console.log(`Histórico: ${historyNormalized}`);//Debug
    return historyNormalized;
    
}

export async function aimessageSend(historyNormalized, aiAPI, messageObject){
    //Envia a mensagem para a IA e espera ela retornar a resposta
    let tries = 5;
    while(tries){
        try{
            const resposta = await aiAPI.models.generateContent({
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
            await messageObject.reply(resposta.text);
            tries = 0;
        }
        catch(error){
            console.error(`Erro ao responder(${tries} tentativas restantes): `, error);
            tries--;
            await new Promise(resolve => setTimeout(resolve, ERROR_WAIT));
            if(!tries){
                await messageObject.reply("Alguma coisa deu errada"); //.catch(...)
                return; 
            }
        }

    }
}