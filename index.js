require("dotenv").config();
const { OpenAI } = require("openai");
const fs = require("fs");

const ai = new OpenAI({ apiKey: process.env.AIKEY });
var msgs = [];
const chat = process.env.CHAT;
const prompt = 'You are an ai assistant named "talon". ' + 
  'You are using STT and TTS so some words may be mispelled. ' + 
  'You also cannot use MD. ';

function load() {
  try {
    msgs = JSON.parse(fs.readFileSync('chatlog/' + chat + '.json').toString());
    console.log('Loaded messages for', chat + '...');
  } catch (e) {
    console.error('There was an error loading messages for', chat);
    msgs = [];
  }
}

function save() {
  fs.writeFileSync('chatlog/', chat + '.json', JSON.stringify(msgs));
  console.log('Saved messages for', chat);
}

async function runai() {
  var res = (await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt + client.user.id }].concat(msgs),
    tools: functions,
    tool_choice: "required",
  })).choices[0].message;

  res = {
    role: res.role,
    content: res.content,
  }

  console.log('Got AI response');
  msgs.push(res);
  return res;
}

async function sendmsg(data) {
  msgs.push({ role: 'user', content: data });
  console.log('Sent message to AI...');
  sendmsgres(await runai().content);
}

function sendmsgres(e) {
  
}

async function init() {
  process.on('uncaughtException', e => console.error(e));
  process.on('unhandledRejection', e => console.error(e));
  process.on('exit', save);
  process.on('SIGINT', () => process.exit(0));
  setInterval(save, 600e3);
  load();
}

init();