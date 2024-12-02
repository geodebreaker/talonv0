const mic = require('mic');
// const Speaker = require('speaker');
const stream = require('stream');
const fs = require('fs');
const Vosk = require('vosk');

let audioChunks = [];
let silenceStart = null;
let recStart = null;
class AudioBufferStream extends stream.Writable {
  _write(chunk, encoding, callback) {
    if (recStart > 0) {
      audioChunks.push(chunk);
    }
    callback();
  }
}

Vosk.setLogLevel(-1);
const voskModel = new Vosk.Model("vosk-model-small-en-us-0.15");
const recognizer = new Vosk.Recognizer({ model: voskModel, sampleRate: 16000 });

function transcribe(audioBuffer) {
  recognizer.acceptWaveform(audioBuffer);
  return recognizer.result();
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

micInputStream.on('data', (data) => {
  if (avg(data) > 8) {
    if (!recStart) recStart = Date.now();
    if (Date.now() - recStart < 50) return;

    silenceStart = null;
  } else {
    if (Date.now() - recStart < 50) return recStart = null;

    silence();
  }
});

micInputStream.on('error', (err) => {
  console.error('Microphone error:', err);
});

micInputStream.on('silence', silence);

function silence() {
  if (!silenceStart)
    silenceStart = Date.now();
  else if (Date.now() - silenceStart > 3000)
    return end();
}

function end() {
  console.log('Stopped recording...');
  recStart = null;
  silenceStart = null;
  micInstance.stop();
  const audioBuffer = Buffer.concat(audioChunks);
  console.log(transcribe(audioBuffer).text);
  audioChunks = [];
}

function avg(data) {
  let sum = 0;
  let s;
  for (let i = 0; i < data.length; i++) {
    s = data[i] - 128;
    sum += s * s;
  }
  const rms = Math.abs(103 - Math.sqrt(sum / data.length));
  return rms;
}

micInstance.start();
recStart = null;
console.log('Microphone started. Speak into the mic!');

// setTimeout(() => {
//   end();
// }, 10000);
