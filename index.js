require("dotenv").config();
const { OpenAI } = require("openai");
const fs = require("fs");
const mic = require('mic');
const Speaker = require('speaker');
const stream = require('stream');
const Vosk = require('vosk');
const tts = require('google-tts-api');
const ffmpeg = require('fluent-ffmpeg');

const ai = new OpenAI({ apiKey: process.env.AIKEY });
var msgs = [];
const chat = process.env.CHAT;
const prompt =
  'You are an ai assistant named "talon" which may be mispelled as "town" or "tell em" ' +
  'DUE TO TTS, DO NOT CORRECT THEM ON ANYTHING. ' +
  'You are using STT and TTS so some words may be mispelled. ' +
  'Keep messages as simple and as short as possible! ' +
  'You also cannot use MD since TTS. ';

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
  fs.writeFileSync('chatlog/' + chat + '.json', JSON.stringify(msgs));
  console.log('Saved messages for', chat);
}

async function runai() {
  var res = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt }].concat(msgs)
  });
  res = res.choices[0].message;
  res = {
    role: res.role,
    content: res.content,
  }
  msgs.push(res);
  await sendmsgres(res.content);
}

async function sendmsg(data) {
  msgs.push({ role: 'user', content: data });
  await runai()
}

async function sendmsgres(e) {
  console.log('res:', e);
  var x = await dotts(e)
  speakerToEnd = x;
}

async function init() {
  process.on('uncaughtException', e => console.error(e));
  process.on('unhandledRejection', e => console.error(e));
  process.on('exit', save);
  process.on('SIGINT', () => process.exit(0));
  setInterval(save, 600e3);
  load();
  setTimeout(start, 100, true);
}

/////////////////////////////////////////////////////////////////

let audioChunks = [];
let oldChunks = [];
let silenceStart = null;
let recStartDone = false;
let recStart = null;
let recFirst = true;
class AudioBufferStream extends stream.Writable {
  _write(chunk, encoding, callback) {
    if (recStart > 0) {
      audioChunks.push(chunk);
    } else {
      oldChunks.push(chunk);
    }
    callback();
  }
}

const micInstance = mic({
  rate: '16000',
  channels: '1',
  device: 'hw:0,0',
  debug: false,
});
let speakerToEnd = null;
const micInputStream = micInstance.getAudioStream();
const audioBufferStream = new AudioBufferStream();
micInputStream.pipe(audioBufferStream);

Vosk.setLogLevel(-1);
const voskModel = new Vosk.Model("vosk-model-small-en-us-0.15");
const recognizer = new Vosk.Recognizer({ model: voskModel, sampleRate: 16000 });

function transcribe(audioBuffer) {
  recognizer.acceptWaveform(audioBuffer);
  return recognizer.result();
}

micInputStream.on('data', (data) => {
  console.log(avg(data));
  if (recFirst == true) return recFirst = false;
  if (avg(data) > 8) {
    if (!recStart) recStart = Date.now();
    if (Date.now() - recStart > 100 && recStartDone == false) {
      audioChunks = oldChunks.slice(-4);
      oldChunks = [];
      recStartDone = true;
      console.log('Started recording...');
      if (speakerToEnd) speakerToEnd.end();
    }
    if (Date.now() - recStart < 100 && recStart) return;
    silenceStart = null;
  } else {
    if (Date.now() - recStart < 100) return recStart = null;
    if (recStart) silence();
  }
});

micInputStream.on('error', (err) => {
  console.error('Microphone error:', err);
});

function silence() {
  if (!silenceStart)
    silenceStart = Date.now();
  else if (silenceStart && Date.now() - silenceStart > 1500)
    return end();
}

function end() {
  console.log('Stopped recording...');
  silenceStart = null;
  recStartDone = false;
  recStart = null;
  micInstance.pause();
  const audioBuffer = Buffer.concat(audioChunks);
  var { text } = transcribe(audioBuffer);
  if (text) {
    console.log('user:', text);
    sendmsg(text).then(() => {
      audioChunks = [];
      setTimeout(start, 1000)
    })
  }
}

function avg(data) {
  let sum = 0;
  let s;
  for (let i = 0; i < data.length; i++) {
    s = data[i] - 128;
    sum += s * s;
  }
  const rms = Math.abs(128 - Math.sqrt(sum / data.length));
  return rms;
}

function start(x) {
  recFirst = true;
  if (x)
    micInstance.start();
  else
    micInstance.resume();
  console.log('Microphone started...');
}

/////////////////////////////////////////////////////////////

const ping = fs.readFileSync('ping.raw');

async function dotts(text) {
  console.log('Getting tts...');
  if (!text) return { end: () => { } };
  var b64 = await tts.getAudioBase64(text, {
    lang: 'en',
    slow: false,
    host: 'https://translate.google.com',
  });
  const buffer = Buffer.from(b64, 'base64');
  fs.writeFileSync('res.mp3', buffer)
  let audioStream = new stream.Readable();
  audioStream.push(buffer);
  audioStream.push(null);
  const audio = ffmpeg(audioStream)
    .format('s16le')
    .audioChannels(1)
    .audioFrequency(24000)
  const speaker = new Speaker({
    channels: 1,
    bitDepth: 16,
    sampleRate: 24000
  });
  audioStream = new stream.Readable();
  audioStream.push(ping);
  audio.pipe(audioStream).pipe(speaker);
  return speaker;
}

/////////////////////////////

init();