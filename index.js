require("dotenv").config({ path: 'private/.env' });
const { OpenAI } = require("openai");
const fs = require("fs");
const mic = require('mic');
const Speaker = require('speaker');
const stream = require('stream');
const speech = require('@google-cloud/speech');
const tts = require('google-tts-api');
const ffmpeg = require('fluent-ffmpeg');

const ai = new OpenAI({ apiKey: process.env.AIKEY });
var msgs = [];
const prompt =
  'You are an ai assistant named "talon" which may be mispelled as "town" or "tell em" ' +
  'DUE TO TTS, DO NOT CORRECT THEM ON ANYTHING. ' +
  'You are using STT and TTS so some words may be mispelled. ' +
  'Keep messages as simple and as short as possible! ' +
  'You also cannot use MD since TTS. ' +
  'If you are asked to play a song / sfx type in [play:MUSICIAN - SONG NAME] and say something like "' +
  'Playing XYZ by ABC". ' +
  'You can stop the song by saying [stop]';

function load() {
  try {
    msgs = JSON.parse(fs.readFileSync('chatlog.json').toString());
    console.log('Loaded messages');
  } catch (e) {
    console.error('There was an error loading messages');
    msgs = [];
  }
}

function save() {
  fs.writeFileSync('chatlog.json', JSON.stringify(msgs));
  console.log('Saved messages');
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
  let blank = null;
  const regex = /\[(play|stop):?(.*?)]/g;
  if (e.match(regex)) {
    blank = e.replace(regex, '');
    const cmd = regex.exec(e);
    if (cmd[1] == 'play') {
      if (music) {
        music.end();
        music = null;
      }
      playSong(cmd[2]);
    } else if (music) {
      music.end();
      music = null;
    }
  }
  await dotts(blank ?? e);
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
const micInputStream = micInstance.getAudioStream();
const audioBufferStream = new AudioBufferStream();
micInputStream.pipe(audioBufferStream);

const speechclient = new speech.SpeechClient({
  keyFilename: 'private/CERT.json',
});

async function transcribe(audioBuffer) {
  const res = await speechclient.recognize({
    audio: {
      content: audioBuffer.toString('base64')
    }, config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
    }
  });
  return res[0] ?
    res[0].results.map((result) => result.alternatives[0].transcript).join('\n') :
    '';
}

micInputStream.on('data', (data) => {
  if (process.argv[2] == '1') console.log(avg(data));
  if (recFirst < 5) return recFirst++;
  if (avg(data) > 5) {
    if (!recStart) recStart = Date.now();
    if (Date.now() - recStart > 100 && recStartDone == false) {
      audioChunks = oldChunks.slice(-5);
      oldChunks = [];
      recStartDone = true;
      console.log('Started recording...');
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

async function end() {
  try {
    console.log('Stopped recording...');
    silenceStart = null;
    recStartDone = false;
    recStart = null;
    micInstance.pause();
    if (!music) {
      let mkping = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 24000
      });
      mkping.write(lping);
      mkping.end();
    }
    const audioBuffer = Buffer.concat(audioChunks);
    var text = await transcribe(audioBuffer);
    if (text) {
      console.log('user:', text);
      await sendmsg(text)
      audioChunks = [];
    } else {
      console.log('request empty');
      if (!music) {
        let mkping = new Speaker({
          channels: 1,
          bitDepth: 16,
          sampleRate: 24000
        });
        mkping.write(ping);
        mkping.end();
      }
    }
  } catch (e) {
    console.error(e);
  }
  start();
}

function avg(data) {
  let sum = 0;
  let s;
  for (let i = 0; i < data.length; i++) {
    s = data[i] - 128;
    sum += s * s;
  }
  const rms = 103 - Math.sqrt(sum / data.length);
  return rms;
}

function start(x) {
  recFirst = 0;
  if (x)
    micInstance.start();
  else
    micInstance.resume();
  console.log('Microphone started...');
}

/////////////////////////////////////////////////////////////

const ping = fs.readFileSync('sound/ping.raw');
const lping = fs.readFileSync('sound/listen.raw');

async function dotts(text) {
  console.log('Getting tts...');
  if (!text) return { end: () => { } };
  var b64 = await tts.getAudioBase64(text, {
    lang: 'en',
    slow: false,
    host: 'https://translate.google.com',
  });
  const buffer = Buffer.from(b64, 'base64');
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
  speaker.write(ping);
  audio.pipe(speaker);
  await new Promise(y => speaker.on('finish', y));
  return speaker;
}

////////////////////////////////////////

let music = null;
const ytSearch = require('yt-search');
const ytdl = require('@distube/ytdl-core');

async function playSong(query) {
  try {
    const searchResults = await ytSearch(query);
    const firstVideo = searchResults.videos[0];

    if (!firstVideo) return;

    let mp3 = null;
    if (fs.existsSync('music_cache/' + firstVideo.videoId + '.mp3')) {
      console.log(`Playing cached audio from: ${firstVideo.title}`);
      mp3 = fs.createReadStream('music_cache/' + firstVideo.videoId + '.mp3');
    } else {
      console.log(`Downloading audio from: ${firstVideo.title}`);
      mp3 = new stream.PassThrough();
      ytdl(firstVideo.url, { filter: 'audioonly', quality: 'highestaudio' }).pipe(mp3);
      mp3.pipe(fs.createWriteStream('music_cache/' + firstVideo.videoId + '.mp3'));
    }

    music = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000
    });

    ffmpeg(mp3)
      .format('s16le')
      .audioChannels(1)
      .audioFrequency(24000)
      .pipe(music);

    music.on('finish', () => music = null);
  } catch (error) {
    console.error('Error searching YouTube:', error);
  }
}

init();