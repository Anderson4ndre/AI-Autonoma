import fs from 'fs/promises';
import 'dotenv/config';
import { promises } from 'dns';
const HISTORY_SIZE = 25;
const ERROR_WAIT = 3500;

async function rememberRead(file_path){
    let ltMemory = await fs.readFile(file_path, 'utf-8');
    ltMemory = JSON.parse(ltMemory).fatos.join("\n");
    return ltMemory;
}

export async function rememberWrite(file_path, info) {
    let ltMemory = await fs.readFile(file_path, 'utf8');
    let ltMemoryObj = JSON.parse(ltMemory);
    let ltMemoryProp = ltMemoryObj.fatos;
    ltMemoryProp.push(info);
    Object.defineProperty(ltMemoryObj, "fatos", {value: ltMemoryProp});
    let ltMemoryString = JSON.stringify(ltMemoryObj);
    fs.writeFile(file_path, ltMemoryString, 'utf8');
}

export async function whatsHistoryFetch(chatObject){
    let tries = 3;
    let historyNormalized
    while(tries){
        try{
            // Simula digitação
            await chatObject.sendStateTyping();
            const historyPure = await chatObject.fetchMessages({limit: HISTORY_SIZE});
            let historyPromises = historyPure.map(async (element, msgIndex) => {
                let author = element.author||element.from;
                let context = '';
                if(author == process.env.AI_ID){
                    author = "Pomni(Você)" //Criar AI_NICKNAME //Será que uma das duas palavras são redundantes?
                }
                if(element.hasQuotedMsg){
                    try{
                        const quotedMsg = await element.getQuotedMessage().catch(err => console.error("Erro em getQuotedMessage: ", err));
                        const foundIndex = historyPure.findIndex(m => m.id._serialized === quotedMsg.id._serialized); //.id.id seria melhor?
                        if(foundIndex !== -1){
                            context = `(#${foundIndex})`;
                        }
                        else{
                            context = `(Citação não encontrada)`;
                        }
                    }
                    catch(err){
                        context = `(Citação indisponível)`;
                    }
                }
                const body = element.body.replace(process.env.MY_MENTION_ID, '').trim();
                return `[#${msgIndex}]${author}${context}: ${body}`
            });
            const finalResult = await Promise.all(historyPromises);
            historyNormalized = finalResult.join('\n');
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
    const memory = await rememberRead(process.env.MEMORY_FILE);
    let tries = 5;
    while(tries){
        try{
            const resposta = await aiAPI.models.generateContent({
                model: "gemini-2.5-flash",
                config:{
                    temperature: 1.0,
                    systemInstruction: await fs.readFile(process.env.PROMPT_PATH, "utf-8")
                },
                contents: `
                    CONTEXTO FIXO (MEMÓRIA DE LONGO PRAZO):
                    ${memory}

                    HISTÓRICO RECENTE:
                    ${historyNormalized}

                    Pomni, responda considerando tanto a memória fixa quanto o histórico recente.
                    `
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

