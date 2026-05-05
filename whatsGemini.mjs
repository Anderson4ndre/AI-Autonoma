import fs from 'fs/promises';
import 'dotenv/config';
const HISTORY_SIZE = 25;
const ERROR_WAIT = 3500;

export async function whatsHistoryFetch(chatObject){
    let tries = 3;
    let historyNormalized
    while(tries){
        try{
            // Simula digitação
            await chatObject.sendStateTyping();
            const historyPure = await chatObject.fetchMessages({limit: HISTORY_SIZE});
            historyNormalized = historyPure.map(element => {
                let author = element.author||element.from;
                if(author == process.env.AI_ID){
                    author = "Pomni(Você)"
                }
                return `[${author}]: ${element.body.replace(process.env.MY_MENTION_ID, '').trim()}`
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
                    systemInstruction: await fs.readFile(process.env.PROMPT_PATH, "utf-8")
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
            }
        }

    }
}