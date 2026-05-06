import fs from 'fs/promises';
import 'dotenv/config';
import { promises } from 'dns';
const ERROR_WAIT = 3500;

export async function rememberRead(file_path){ //Lê arquivos com históricos e retorna em array
    let ltMemory = await fs.readFile(file_path, 'utf-8');
    ltMemory = JSON.parse(ltMemory).conhecidos;
    return ltMemory;
}

export async function rememberWrite(file_path, info) { //Escreve em artigos com históricos
    let ltMemory = await fs.readFile(file_path, 'utf8');
    let ltMemoryObj = JSON.parse(ltMemory);
    let ltMemoryProp = ltMemoryObj.conhecidos;
    ltMemoryProp.push(info);
    Object.defineProperty(ltMemoryObj, "conhecidos", {value: ltMemoryProp});
    let ltMemoryString = JSON.stringify(ltMemoryObj);
    fs.writeFile(file_path, ltMemoryString, 'utf8');
}

async function rememberDelete(file_path, entry){ //Remove elementos da memória por meio do index
    let ltMemory = await fs.readFile(file_path, 'utf8');
    let ltMemoryObj = JSON.parse(ltMemory);
    let ltMemoryProp = ltMemoryObj.conhecidos;
    ltMemoryProp.splice(entry, 1);
    Object.defineProperty(ltMemoryObj, "conhecidos", {value: ltMemoryProp});
    let ltMemoryString = JSON.stringify(ltMemoryObj);
    fs.writeFile(file_path, ltMemoryString, 'utf8');
}

export async function rememberWriteInterface(messageObject) {
    let chatWhatsapp = await messageObject.getChat();
    let messageToRemember = messageObject.body.replace("!remember", '').trimStart();
    if(!messageToRemember){ //caso não tenha nada depois do remember
        chatWhatsapp.sendMessage("Lembrar do que?");
        return;
    }
    if(messageToRemember.startsWith("@")){
        messageToRemember = messageToRemember.replace('@', '');
        messageToRemember = messageToRemember.replace(' ', '@lid ');
    }
    rememberWrite(process.env.MEMORY_FILE, messageToRemember)
    .then(() =>
    chatWhatsapp.sendMessage("_Memória adicionada!_")
    );
}

export async function rememberDeleteInterface(messageObject){
    let memory = await rememberRead(process.env.MEMORY_FILE);
    let chatWhatsapp = await messageObject.getChat();
    let memoryFormated = [];
    let entryIndex = -1;
    memory.forEach(entry => {
        ++entryIndex;
        memoryFormated.push(`${entryIndex} - ` + entry);
    });
    if(messageObject.body === '!forget'){
        memoryFormated = memoryFormated.join('\n');
        await chatWhatsapp.sendMessage(memoryFormated);
        chatWhatsapp.sendMessage("Qual memória deseja excluir?(Escreva o !forget índice)");
        return;
    }
    const entryStr = messageObject.body.replace('!forget ', '');
    const entry = parseInt(entryStr);
    console.log(`Entry: ${entry} EntryIndex: ${entryIndex}`);
    if(entry > entryIndex || !(Number.isInteger(entry)) || entry < 0){
		chatWhatsapp.sendMessage("_Índice inválido_");
		return;
	}
    rememberDelete(process.env.MEMORY_FILE, entry).then(() => {
        chatWhatsapp.sendMessage(`Memória ${entry} apagada com sucesso!`);
    });
}

export async function whatsHistoryFetch(chatObject){
    let tries = 3;
    let historyNormalized
    while(tries){
        try{
            // Simula digitação
            await chatObject.sendStateTyping();
            const historyPure = await chatObject.fetchMessages({limit: process.env.HISTORY_SIZE});
            let historyPromises = historyPure.map(async (element, msgIndex) => {
                let author = element.author||element.from;
                let context = '';
                if(author == process.env.AI_ID){
                    author = "Você" //Criar AI_NICKNAME
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

//Busca todos os IDs no histórico acessível e retorna em forma de set
async function searchIds(messageObject){ //ou chatobject direto?
    let chatObject = await messageObject.getChat();
    let historyPure = await chatObject.fetchMessages({limit: process.env.HISTORY_SIZE});
    let ids = new Set();
    historyPure.forEach(element => {
        let author = element.author || element.from;
        ids.add(author);
        element.mentionedIds.forEach(elementId => {
            ids.add(elementId?._serialized || elementId);
        });
    });
    return ids;
}
//Recebe um array ou set de ids e busca na memória as strings que os incluem e retorna uma versão otimizada
async function optimizedMemorySearch(ids, file_path){
    const memory = await rememberRead(file_path);
    let optimizedMemory = [];
    ids.forEach(id =>{ 
        memory.forEach(entry =>{
            if(entry.startsWith(id)){
                optimizedMemory.push(entry);
            }
        })
    });
    return optimizedMemory;
}

export async function aimessageSend(historyNormalized, aiAPI, messageObject){ //colocar um callback de fetchhistory
    //Envia a mensagem para a IA e espera ela retornar a resposta
    const ids = await searchIds(messageObject);
    const memory = await optimizedMemorySearch(ids, process.env.MEMORY_FILE);
    console.log(`Memória: ${memory.join("\n")}`);//Debug
    const prompt = `
                    CONTEXTO FIXO (MEMÓRIA DE LONGO PRAZO):
                    ${memory.join("\n")}

                    HISTÓRICO RECENTE:
                    ${historyNormalized}

                    Pomni, responda considerando tanto a memória fixa quanto o histórico recente.
                    `;
    const answer = await aimessageModel(aiAPI, prompt, messageObject);
    messageObject.reply(answer);
}

export async function aimessageModel(aiAPI, prompt) {
    let tries = 5;
    while(tries){
        try{
            const resposta = await aiAPI.models.generateContent({
                model: "gemini-2.5-flash",
                config:{
                    temperature: 1.0,
                    systemInstruction: await fs.readFile(process.env.PROMPT_PATH, "utf-8")
                },
                contents: prompt
            });
            return resposta.text
            tries = 0;
        }
        catch(error){
            console.error(`Erro ao responder(${tries} tentativas restantes): `, error);
            tries--;
            await new Promise(resolve => setTimeout(resolve, ERROR_WAIT));
        }
    }
    return "Alguma coisa deu errada";
}