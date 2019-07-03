///////////////////// IMPORTS /////////////////////////////
const zerorpc = require("zerorpc");
const fs = require('fs');
const AudioContext = require('web-audio-api').AudioContext;
const fileType = require('file-type');
const toWav = require('audiobuffer-to-wav');
const path = require('path');


///////////////////// ZERO RPC SERVER SETUP /////////////////////
let client = new zerorpc.Client({
  heartbeatInterval: 14000
})

client.connect("tcp://127.0.0.1:4242")

client.invoke("echo", "server ready", (error, res) => {
  if (error || res !== 'server ready') {
    console.error(error)
  } else {
    console.log("server is ready")
  }
})


//////////////////// Buttons and on-click methods ///////////////////////////

let getLoopSamplesBtn = document.querySelector('#get-loop-samples-btn');
getLoopSamplesBtn.onclick = getLoopSamples;

let getDrumSamplesBtn = document.querySelector('#get-drum-samples-btn');
getDrumSamplesBtn.onclick = getDrumSamples;

var samplePlayStopBtn = document.querySelector("#sample-play-stop-btn");
samplePlayStopBtn.onclick = playPauseSample;

var samplePlayBtn = document.querySelector("#sample-play-btn");
samplePlayBtn.onclick = playSample;

var sampleStopBtn = document.querySelector("#sample-stop-btn");
sampleStopBtn.onclick = pauseSample;

var editInZoomBtn = document.querySelector('#edit-in-zoom-btn');
editInZoomBtn.onclick = editInZoom;

var prevBtn = document.querySelector("#prev-btn");
prevBtn.onclick = stepPrev;

var nextBtn = document.querySelector("#next-btn");
nextBtn.onclick = stepNext;

/////////////////// KEY events //////////////////////////////

document.addEventListener('keydown', keyDownHandle);
document.addEventListener('keyup', keyUpHandle);

function keyDownHandle(event) {
  let key = event.keyCode;
  if (key == 16) { // Shift
    if (currentRegion) playSample();
  }
  else if (key == 37) { // Arrow left
    if (currentRegion) stepPrev();
  }
  else if (key == 39) { // Arrow right
    if (currentRegion) stepNext();
  }
}

function keyUpHandle(event) {
  let key = event.keyCode;
  if (key == 32) { // SPACE
    if (currentRegion) playPauseSample();
  } else if (key == 69) { // E
    if (currentRegion) editInZoom();
  } else if (key == 40) { // Down arrow
    if (currentRegion) selectView("zoom");
  } else if (key == 38) { // Up arrow
    if (currentRegion) selectView("primary");
  }
}


////////////////// Other UI elements ////////////////////////

let wavesurferZoomElement = document.querySelector('#waveform-zoom');
let wavesurferElement = document.querySelector('#waveform');
var timeValsElement = document.querySelector("#time-vals");
var currentIndexElement = document.querySelector('#current-index');
var allIndexElement = document.querySelector('#all-index');


////////////////// Variables and constants ///////////////////

const MAX_FILE_SIZE = 30; // max file size in MB

let newFileUpload = false;
let matrixLoaded = false;
let filePath = "";
let timeVals = [];
let regions = [];
var currentTimeValsIndex = -1;
var maxIndex = -1;
var isSamplePlaying = false;
var wavesurferReady = false;
var songLength = 0;

var finalFilePath = "";
var currentBufferData = [];

var selectedWavesurfer = null;

var currentView = "primary";

var currentRegion = null;
var currentZoomRegion = null;

var selectedCurrentRegion = null;
var wavesurfer = null;
var wavesurferZoom = null;

clearTempDir();

wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#5b5b98',
  progressColor: '#518e53',
  barWidth: 1,
  responsive: true,
  normalize: true,
  plugins: [
    WaveSurfer.regions.create({
      loop: true
    })
  ]
});

wavesurferZoom = WaveSurfer.create({
  container: '#waveform-zoom',
  waveColor: '#5b5b98',
  autoCenter: false,
  progressColor: '#518e53',
  barWidth: 1,
  responsive: true,
  normalize: true,
  plugins: [
    WaveSurfer.regions.create({
      loop: true
    })
  ]
});

wavesurfer.on("pause", function () {
  if (isSamplePlaying) wavesurfer.play(currentRegion.start, currentRegion.end);
});

wavesurferZoom.on("pause", function () {
  if (isSamplePlaying) wavesurferZoom.play(currentZoomRegion.start, currentZoomRegion.end);
});

// first region is created when the wavesurfer element is ready
wavesurfer.on("ready", function () {
  wavesurferReady = true;
  if (timeVals.length > 0) {
    addAllRegions();
    selectCurrentRegion();
  }
  songLength = wavesurfer.getDuration();
});

function loadSamples(error, res, newMatrix) {
  document.querySelectorAll("button").forEach((btn) => btn.disabled = false);
  if (error) {
    console.error(error);
    alert(error);
    document.querySelector("#loading-msg").innerHTML = "Unexpected error.";
  } else {
    document.querySelector("#loading-msg").innerHTML = "Finished.";
    newFileUpload = false;
    if (newMatrix) matrixLoaded = true;
    timeVals = res;
    if (timeVals.length > 0) {
      timeVals = timeVals.sort((a, b) => { return a[0] - b[0] });
      currentTimeValsIndex = 0;
      maxIndex = timeVals.length - 1;
      isSamplePlaying = false;
      enableSampleButtons();
      if (wavesurferReady) {
        addAllRegions();
        selectCurrentRegion();
      }
    } else {
      disableSampleButtons();
    }
  }

}

function getLoopSamples() {
  if (filePath) {
    pauseSample();
    let treshold = Number(document.querySelector("#treshold-select").value);
    console.log(treshold);
    document.querySelector("#loading-msg").innerHTML = "Processing...";
    document.querySelectorAll("button").forEach((btn) => btn.disabled = true);
    if (newFileUpload || !matrixLoaded) {
      client.invoke("getArray", filePath, treshold, (error, res) => loadSamples(error, res, true))
    } else {
      client.invoke("getNewArray", treshold, (error, res) => loadSamples(error, res, false))
    }
  }
}

function getDrumSamples() {
  if (filePath) {
    pauseSample();
    document.querySelector("#loading-msg").innerHTML = "Processing...";
    document.querySelectorAll("button").forEach((btn) => btn.disabled = true);
    client.invoke("getDrumSamples", filePath, (error, res) => loadSamples(error, res, false))
  }
}

document.querySelector('#fileUpload').onchange = function () {
  if (this.files[0]) {
    filePath = this.files[0].path;
    convertToWav(filePath, async (convertedFilePath, errorMsg) => {
      if (errorMsg) {
        document.querySelector('#upload-msg').innerHTML = errorMsg;
      } else {
        filePath = convertedFilePath;
        newFileUpload = true;
        matrixLoaded = false;
        getLoopSamplesBtn.disabled = false;
        getDrumSamplesBtn.disabled = false;

        let buffer = await getAudioBuffer(filePath);
        currentBufferData = buffer.getChannelData(0);

        wavesurfer.load(filePath);
        wavesurferZoom.load(filePath);

        selectView("primary");
      }
    })
  }
}

document.querySelector('#save-sample-btn').onclick = function () {

  if (currentZoomRegion) {
    console.log('Start zoom sec: ' + currentZoomRegion.start);
    console.log('End zoom sec: ' + currentZoomRegion.end);

    console.log(currentBufferData.length);

    let startIndex = Math.round(currentZoomRegion.start * 44100);
    let endIndex = Math.round(currentZoomRegion.end * 44100);

    let chunk = currentBufferData.slice(startIndex, endIndex);

    console.log(chunk.length);

    concatenateBufferToFile(finalFilePath, chunk, (newFilePath, error) => {
      if (error) {
        console.log("Error.");
      } else {
        finalFilePath = newFilePath;
      }
    })
  }
};

function playPauseSample() {
  if (isSamplePlaying) {
    isSamplePlaying = false;
    samplePlayStopBtn.innerHTML = "Play";
    selectedWavesurfer.pause();
    selectedCurrentRegion.update({ drag: true, resize: true });
  } else {
    isSamplePlaying = true;
    samplePlayStopBtn.innerHTML = "Stop";
    selectedWavesurfer.play(selectedCurrentRegion.start, selectedCurrentRegion.end);
    selectedCurrentRegion.update({ drag: false, resize: false });
  }
}

function playSample() {
  if (!isSamplePlaying) {
    isSamplePlaying = true;
    samplePlayStopBtn.innerHTML = "Stop";
    selectedCurrentRegion.update({ drag: false, resize: false });
  }
  selectedWavesurfer.play(selectedCurrentRegion.start, selectedCurrentRegion.end);
}

function pauseSample() {
  if (isSamplePlaying) {
    isSamplePlaying = false;
    samplePlayStopBtn.innerHTML = "Play";
    selectedWavesurfer.pause();
    selectedCurrentRegion.update({ drag: true, resize: true });
  }
}

function stepNext() {
  if (currentView == "primary") {
    currentTimeValsIndex += 1;
    if (currentTimeValsIndex > maxIndex) {
      currentTimeValsIndex = 0;
    }
    selectCurrentRegion()
  }
}

function stepPrev() {
  if (currentView == "primary") {
    currentTimeValsIndex -= 1;
    if (currentTimeValsIndex < 0) {
      currentTimeValsIndex = maxIndex;
    }
    selectCurrentRegion()
  }
}



function selectView(view) {
  if (view == "primary") {
    if (currentView != view) pauseSample();
    currentView = view;
    selectedCurrentRegion = currentRegion;
    selectedWavesurfer = wavesurfer;
    wavesurferZoomElement.style.border = "solid 1px #6f6f6f";
    wavesurferElement.style.border = "solid 1px #f57047";
  } else if (view == "zoom") {
    if (currentZoomRegion && wavesurferZoom) {
      if (currentView != view) pauseSample();
      currentView = view;
      selectedCurrentRegion = currentZoomRegion;
      selectedWavesurfer = wavesurferZoom;
      wavesurferZoomElement.style.border = "solid 1px #f57047";
      wavesurferElement.style.border = "solid 1px #6f6f6f";
    }
  }
}


function addAllRegions() {
  regions = [];
  wavesurfer.clearRegions();
  timeVals.forEach((timeElem) => {
    let startSec = timeElem[0];
    let endSec = timeElem[1];

    let newRegion = wavesurfer.addRegion({
      start: startSec,
      end: endSec,
      color: 'rgba(108, 108, 132, 0.39)'
    });

    regions.push(newRegion);

    newRegion.on("update-end", function (e) {
      console.log("Region update-end event.");
      console.log("Start sec: " + currentRegion.start);
      console.log("End sec: " + currentRegion.end);
    });
  })
}

function updateZoomView() {
  let windowLengthPx = wavesurferZoomElement.clientWidth;
  let startSec = currentRegion.start;
  let endSec = currentRegion.end;
  let regionLengthSec = endSec - startSec;
  let pxPerSec = Math.round(windowLengthPx / (regionLengthSec * 2));

  //set cursor
  wavesurferZoom.seekTo((startSec + (regionLengthSec / 2)) / songLength);
  //zoom
  wavesurferZoom.zoom(pxPerSec);
}

function selectCurrentRegion() {
  regions.forEach((reg) => reg.update({ drag: false, resize: false, color: 'rgba(108, 108, 132, 0.39)' }))

  currentIndexElement.innerHTML = currentTimeValsIndex + 1;

  currentRegion = regions[currentTimeValsIndex]

  if (isSamplePlaying) currentRegion.update({ drag: false, resize: false, color: 'rgba(255,255,51,0.3)' });
  else currentRegion.update({ drag: true, resize: true, color: 'rgba(255,255,51,0.3)' });

  let startSec = currentRegion.start;
  let endSec = currentRegion.end;

  let startSecRounded = Math.round(startSec * 100) / 100;
  let endSecRounded = Math.round(endSec * 100) / 100;

  if (isSamplePlaying) wavesurfer.play(startSec, endSec);

  timeValsElement.innerHTML = startSecRounded + " sec - " + endSecRounded + " sec";

  if (currentView == "primary") {
    selectedCurrentRegion = currentRegion;
    selectedWavesurfer = wavesurfer;
  } else if (currentView == "zoom") {
    selectedCurrentRegion = currentZoomRegion;
    selectedWavesurfer = wavesurferZoom;
  }

}

function editInZoom() {
  wavesurferZoom.clearRegions();
  currentZoomRegion = wavesurferZoom.addRegion({
    start: currentRegion.start,
    end: currentRegion.end,
    color: 'rgba(108, 108, 132, 0.39)'
  });

  updateZoomView();
}

function enableSampleButtons() {
  document.querySelectorAll('.sample-btn').forEach((btn) => btn.disabled = false);
  allIndexElement.innerHTML = timeVals.length;
}

function disableSampleButtons() {
  currentRegion = null;
  regions = [];
  wavesurfer.clearRegions();
  document.querySelectorAll('.sample-btn').forEach((btn) => btn.disabled = true);
  timeValsElement.innerHTML = "No samples";
  currentIndexElement.innerHTML = 0;
  allIndexElement.innerHTML = 0;
}

function stereoToMono(buffer) {
  let audioContext = new AudioContext;
  let length = buffer.length;

  let tmpBuff = audioContext.createBuffer(1, length, buffer.sampleRate);
  let channel = tmpBuff.getChannelData(0);

  let bufferData = buffer.getChannelData(0);
  channel.set(bufferData, 0);

  return tmpBuff;
}

function getAudioBuffer(filePath) {
  let audioContext = new AudioContext;
  let resp = fs.readFileSync(filePath);

  return new Promise((resolve, reject) => {
    audioContext.decodeAudioData(resp, buffer => {
      resolve(buffer);
    })
  })
}

function convertToWav(filepath, callback) {
  let msg = "";
  let stats = fs.statSync(filepath)
  let fileSizeInBytes = stats["size"]
  if (fileSizeInBytes < (MAX_FILE_SIZE * 1000000)) {
    fs.readFile(filepath, async (err, buf) => {
      if (err) {
        console.log(err);
        return callback("", err);
      } else if (!fileType(buf) || (fileType(buf).mime != "audio/vnd.wave" && fileType(buf).mime != "audio/aiff" && fileType(buf).mime != "audio/mpeg")) {
        msg = "Supported file types are WAV, MP3 and AIFF."
        console.log(msg);
        return callback("", msg);
      } else {
        let stereobuffer = await getAudioBuffer(filepath);
        let buffer = stereoToMono(stereobuffer);
        let wav = toWav(buffer);
        let chunk = new Uint8Array(wav);
        let isoDateString = new Date().toISOString();
        let filename = 'converted-' + isoDateString + '.wav';
        let outputDir = path.resolve('./temp/' + filename);
        fs.writeFile(outputDir, Buffer.from(chunk), function (err) {
          if (err) {
            console.log(err);
            return callback("", err);
          }
          else {
            return callback(outputDir, null);
          }
        });
      }
    })
  }
}

async function concatenateBufferToFile(filePath, bufferDataNew, callback) {
  let audioContext = new AudioContext;
  let baseLength = 0;
  let outputFilePath = filePath;
  let baseBuffer = null;

  if (filePath) {
    baseBuffer = await getAudioBuffer(filePath);
    baseLength = baseBuffer.length;
  }

  let totalLength = bufferDataNew.length + baseLength;

  let tmpBuff = audioContext.createBuffer(1, totalLength, 44100);
  let channel = tmpBuff.getChannelData(0);

  if (filePath) {

    let bufferDataBase = baseBuffer.getChannelData(0);
    channel.set(bufferDataBase, 0);
  } else {
    let isoDateString = new Date().toISOString();
    outputFilePath = path.resolve('./temp/finalWav-' + isoDateString + '.wav');
  }
  channel.set(bufferDataNew, baseLength);

  let wav = toWav(tmpBuff);
  let chunk = new Uint8Array(wav);

  if (filePath) fs.unlinkSync(filePath);

  fs.writeFile(outputFilePath, Buffer.from(chunk), function (err) {
    if (err) {
      console.log(err);
      return callback("", err);
    }
    else {
      console.log(filePath + ' was created.');
      return callback(outputFilePath, null);
    }
  });

}

function clearTempDir() {
  const directory = path.resolve('./temp');
  let tempFileCntr = 0;
  fs.readdir(directory, (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(path.join(directory, file), err => {
        if (err) throw err;
        tempFileCntr++;
        if(tempFileCntr == files.length) console.log(tempFileCntr + ' temp files deleted.');
      });
    }
  });
}