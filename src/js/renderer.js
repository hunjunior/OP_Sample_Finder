///////////////////// IMPORTS /////////////////////////////
const zerorpc = require("zerorpc");
const fs = require('fs');
const AudioContext = require('web-audio-api').AudioContext;
const fileType = require('file-type');
const toWav = require('audiobuffer-to-wav');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');



////////////////// UI elements ////////////////////////

let wavesurferElement = document.querySelector('#waveform');
let wavesurferZoomElement = document.querySelector('#waveform-zoom');
let wavesurferFinalElement = document.querySelector('#waveform-final');

let appContent = document.querySelector('#app-content');
let cover = document.querySelector('#cover');
let loaderMsg = document.querySelector('#loader-msg');




///////////////////// ZERO RPC SERVER SETUP /////////////////////
let client = new zerorpc.Client({
  timeout: 60,
  heartbeatInterval: 60000
})

client.connect("tcp://127.0.0.1:4242")

client.invoke("echo", "server ready", (error, res) => {
  if (error || res !== 'server ready') {
    console.error(error)
  } else {
    console.log("server is ready")
  }
})



///////////////////// LOADING THE MODEL /////////////////////

startLoader("Loading the AI model...")

client.invoke("loadModel", (error, res) => {
  console.log(res);
  stopLoader();
})



///////////////////// Playground ////////////////////////////////

document.querySelectorAll("button, select, #file-upload").forEach(function (item) {
  item.addEventListener('focus', function () {
    this.blur();
  })
})

document.ondragover = (ev) => {
  document.body.style.backgroundColor = '#524c4c';
  ev.preventDefault()
}

document.ondragleave = () => {
  document.body.style.backgroundColor = '#2f2b2b';
}

document.body.ondrop = (ev) => {
  console.log(ev.dataTransfer.files[0].path);
  document.body.style.backgroundColor = '#2f2b2b';
  handleNewFile(ev.dataTransfer.files[0].path)
  ev.preventDefault();
}

/* navigator.requestMIDIAccess()
  .then(onMIDISuccess, onMIDIFailure);

function onMIDISuccess(midiAccess) {
  for (var input of midiAccess.inputs.values()) {
    input.onmidimessage = getMIDIMessage;
  }
  //console.log(midiAccess.inputs.values());
}

function getMIDIMessage(message) {
  var command = message.data[0];
  var note = message.data[1];
  var velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command

  switch (command) {
    case 144: // noteOn
      if (velocity > 0) {
        noteOn(note, velocity);
      } else {
        noteOff(note);
      }
      break;
    case 128: // noteOff
      noteOff(note);
      break;
    // we could easily expand this switch statement to cover other types of commands such as controllers or sysex
  }
}

function onMIDIFailure() {
  console.log('Could not access your MIDI devices.');
} */



//////////////////// Buttons and on-click methods ///////////////////////////

let getLoopSamplesBtn = document.querySelector('#get-loop-samples-btn');
getLoopSamplesBtn.onclick = getLoopSamples;

let getDrumSamplesBtn = document.querySelector('#get-drum-samples-btn');
getDrumSamplesBtn.onclick = getDrumSamples;

let keepSampleBtn = document.querySelector('#keep-sample-btn');
keepSampleBtn.onclick = addSample;

let uploadField = document.querySelector('#upload-field');
uploadField.onclick = () => document.querySelector('#file-upload').click();

let keyElements = document.querySelectorAll('.white-key, .black-key');
keyElements.forEach((element, index) => {
  element.onclick = () => {
    if (currentFinalRegion) {
      console.log("Add key " + index + " to region.");
      addKeyToFinalRegion(currentFinalRegion, index);
      updateKeyColors();
    }
  }
})

let saveSampleBtn = document.querySelector('#save-sample-btn');
saveSampleBtn.onclick = saveSample;



/////////////////// KEY events //////////////////////////////

document.addEventListener('keydown', keyDownHandle);
document.addEventListener('keyup', keyUpHandle);

let keyDown_W = false;
let keyDown_L = false;
let keyDown_Q = false;
let keyDown_Space = false;
let keyDown_Shift = false;
let keyDown_Ctrl = false;

function keyDownHandle(event) {
  let key = event.keyCode;
  if (key == 16 && !keyDown_Shift) { // Shift
    keyDown_Shift = true;
  } else if (key == 17 && !keyDown_Ctrl) { //Ctrl
    keyDown_Ctrl = true;
  } /* else if (key == 87 && !keyDown_W) { // W
    keyDown_W = true;
    if (currentRegion) playSample();
  } */ else if (key == 76 && !keyDown_L) { // L
    keyDown_L = true;
    loopPlaying = true;
    if (currentRegion) playPauseSample();
  } else if (key == 32 && !keyDown_Space) { // Space
    keyDown_Space = true;
    loopPlaying = false;
    if (currentRegion) playSample();
  } else if (key == 37) { // Arrow left
    if (currentView == 'primary' || currentView == 'final') stepPrev();
    else if (currentView == 'zoom') leftInZoom();
  } else if (key == 39) { // Arrow right
    if (currentView == 'primary' || currentView == 'final') stepNext();
    else if (currentView == 'zoom') rightInZoom();
  }
}

function keyUpHandle(event) {
  let key = event.keyCode;
  /* if (key == 81) { // Q
    if (currentRegion) playPauseSample();
  }  */if (key == 69) { // E
    if (currentRegion) editInZoom();
  } else if (key == 40) { // Down arrow
    if (currentView == "primary") {
      if (currentRegion) selectView("zoom");
    } else if (currentView == "zoom") {
      if (currentRegion) selectView("final");
    } else if (currentView == "final") {
      if (currentRegion) selectView("primary");
    }
  } else if (key == 38) { // Up arrow
    if (currentView == "primary") {
      if (currentRegion) selectView("final");
    } else if (currentView == "zoom") {
      if (currentRegion) selectView("primary");
    } else if (currentView == "final") {
      if (currentRegion) selectView("zoom");
    }
  } /* else if (key == 87) { // W
    keyDown_W = false;
  }  */else if (key == 76) { // L
    keyDown_L = false;
  } else if (key == 17) { //Ctrl
    keyDown_Ctrl = false;
  } else if (key == 32) { //Space
    keyDown_Space = false;
  } else if (key == 16) { //Shift
    keyDown_Shift = false;
  } else if (key == 65) { //A
    addSample();
  } else if (key == 46) {
    if (currentView == "final") deleteCurrentFinalRegion();
  }
}

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
var loopPlaying = false;
var wavesurferReady = false;
var songLength = 0;

var currentFinalRegionIndex = -1;
var finalFilePath = "";
var finalBaseLength = 0;
var currentBufferData = [];
var finalRegions = [];
var availableFinalKeys = [];
for (let i = 0; i < 24; i++) availableFinalKeys.push(i);

var selectedWavesurfer = null;

var currentView = "primary";

var currentRegion = null;
var currentZoomRegion = null;
var currentFinalRegion = null;

var selectedCurrentRegion = null;
var wavesurfer = null;
var wavesurferZoom = null;
var wavesurferFinal = null;

clearTempDir();

wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#317d53',
  /* progressColor: '#518e53', */
  progressColor: '#317d54',
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
  waveColor: '#317d53',
  autoCenter: false,
  /* progressColor: '#518e53', */
  progressColor: '#317d54',
  barWidth: 1,
  responsive: true,
  normalize: true,
  plugins: [
    WaveSurfer.regions.create({
      loop: true
    })
  ]
});

wavesurferFinal = WaveSurfer.create({
  container: '#waveform-final',
  waveColor: '#317d53',
  autoCenter: false,
  /* progressColor: '#518e53', */
  progressColor: '#317d54',
  barWidth: 0.2,
  responsive: true,
  normalize: true,
  plugins: [
    WaveSurfer.regions.create({
      loop: true
    })
  ]
});

wavesurfer.on("pause", function () {
  if (loopPlaying) {
    if (isSamplePlaying) {
      wavesurfer.play(currentRegion.start, currentRegion.end);
    }
  } else {
    isSamplePlaying = false;
  }
});

wavesurferZoom.on("pause", function () {
  if (loopPlaying) {
    if (isSamplePlaying) {
      wavesurferZoom.play(currentZoomRegion.start, currentZoomRegion.end);
    }
  } else {
    isSamplePlaying = false;
  }
});

// first region is created when the wavesurfer element is ready
wavesurfer.on("ready", function () {
  wavesurferReady = true;
  if (timeVals.length > 0) {
    addAllRegions();
    selectCurrentRegion();
  }
  songLength = wavesurfer.getDuration();
  stopLoader();
});

wavesurferFinal.on("ready", function () {
  /* let windowLengthPx = wavesurferFinalElement.clientWidth;
  let pxPerSec = Math.round(windowLengthPx / 12);
  //zoom
  wavesurferFinal.zoom(pxPerSec); */
});

function addKeyToFinalRegion(region, key) {

  if (key < 0) {
    if (region.key > -1) availableFinalKeys.push(region.key);
    let keyToAdd = Math.min(...availableFinalKeys);
    region.key = keyToAdd;
    let keyIndex = availableFinalKeys.indexOf(keyToAdd);
    availableFinalKeys.splice(keyIndex, 1);
  } else {
    let keyIndex = availableFinalKeys.indexOf(key);
    if (keyIndex == -1) {
      let oldRegion = getFinalRegionByKey(key);
      oldRegion.key = region.key;
      region.key = key;
    } else {
      availableFinalKeys.splice(keyIndex, 1);
      if (region.key > -1) availableFinalKeys.push(region.key);
      region.key = key;
    }
  }
}

function updateKeyColors() {
  keyElements.forEach((keyElement) => {
    keyElement.style.backgroundColor = "#C7C7C7";
  });

  finalRegions.forEach((region) => {
    if (region.key != -1) {
      keyElements[region.key].style.backgroundColor = "#e49898";
    }
  })

  if (currentFinalRegion) {
    keyElements[currentFinalRegion.key].style.backgroundColor = "#89bd82";
  }
}

function getFinalRegionByKey(key) {
  let regionArray = finalRegions.filter((region) => region.key == key);
  if (regionArray.length > 0) return regionArray[0];
  else return null;
}

function loadSamples(error, res, newMatrix, isDrumSample) {
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
        if(isDrumSample) getDrumClasses();
      }
    } else {
      disableSampleButtons();
    }
  }

}

function getLoopSamples() {
  if (filePath) {
    pauseSample();
    startLoader("Searching for loop samples...");
    let treshold = Number(document.querySelector("#treshold-select").value);
    console.log(treshold);
    document.querySelector("#loading-msg").innerHTML = "Processing...";
    document.querySelectorAll("button").forEach((btn) => btn.disabled = true);
    if (newFileUpload || !matrixLoaded) {
      client.invoke("getArray", filePath, treshold, (error, res) => {
        stopLoader();
        loadSamples(error, res, true, false)
      })
    } else {
      client.invoke("getNewArray", treshold, (error, res) => {
        stopLoader();
        loadSamples(error, res, false, false)
      })
    }
  }
}

function getDrumClasses() {
  let times_array = [];
  let tempDir = path.resolve('./temp');

  regions.forEach((region) => {
    let tempTimes = [0,0];
    tempTimes[0] = region.start;
    tempTimes[1] = region.end;
    times_array.push(tempTimes);
  })
  
  startLoader("Predicting drum classes...");
  
  client.invoke("getDrumClasses", filePath, tempDir, times_array, (error, res) => {
    console.log(res);
    stopLoader();
  })

}

function getDrumSamples() {
  if (filePath) {
    pauseSample();
    startLoader("Searching for drum samples...");
    document.querySelector("#loading-msg").innerHTML = "Processing...";
    document.querySelectorAll("button").forEach((btn) => btn.disabled = true);
    client.invoke("getDrumSamples", filePath, (error, res) => {
      loadSamples(error, res, false, true);
    })
  }
}

document.querySelector('#file-upload').onchange = function () {
  if (this.files[0]) handleNewFile(this.files[0].path)
}

function handleNewFile(newFilePath) {
  startLoader("Converting the audio file...");
  filePath = newFilePath;
  convertToWav(filePath, async (convertedFilePath, errorMsg) => {
    if (errorMsg) {
      document.querySelector('#upload-msg').innerHTML = errorMsg;
    } else {

      document.querySelector('#upload-field-msg').innerHTML = newFilePath.split('/').pop();

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

function startLoader(msg) {
  cover.style.display = "block";
  appContent.style.filter = "blur(5px)";
  loaderMsg.innerHTML = msg;
}

function stopLoader() {
  cover.style.display = "none";
  appContent.style.filter = "blur(0)";
}

function addSample() {
  if (currentZoomRegion) {

    let startIndex = Math.round(currentZoomRegion.start * 44100);
    let endIndex = Math.round(currentZoomRegion.end * 44100);

    let chunk = currentBufferData.slice(startIndex, endIndex);

    concatenateBufferToFile(finalFilePath, chunk, finalBaseLength, (newFilePath, newBaseLength, error) => {
      if (error) {
        console.log("Error.");
      } else {
        finalFilePath = newFilePath;
        finalBaseLength = newBaseLength;
        wavesurferFinal.load(finalFilePath);
      }
    })
  }
};

function saveSample() {
  if (finalRegions.length) {
    getOpzObject((obj) => {
      console.log(obj);

      let date = new Date();
      let isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
      let outputDir = "./temp/OP-Z_join_" + isoDate + ".aiff";

      convertFile(finalFilePath, outputDir, (success, error) => {
        if (error) {
          alert(error);
        } else {
          //sendSuccess(success);
          joinJSONtoAIFF(outputDir, obj, (resultDir) => {

          })
        }
      })

    });
  }
}

function convertFile(inputPath, outputPath, callback) {
  let inMedia = path.resolve("" + inputPath + "");
  let outMedia = path.resolve("" + outputPath + "");
  console.log("Transcoding: " + inputPath + " > " + outputPath);

  var command = ffmpeg(inMedia).addOptions([
    '-preset veryslow'
  ]);

  command.save(outMedia).audioFilters(
    {
      filter: 'silencedetect',
      options: { n: '-50dB', d: 5 }
    }
  )
    .on('error', function (err) {
      callback(null, 'Cannot process file: ' + err.message);
    })
    .on('end', function () {
      callback('Processing finished successfully', null);
    });
}

function joinJSONtoAIFF(aiffPath, obj, callback) {
  fs.readFile(aiffPath, (err, buf) => {
    if (err) throw err;

    let startBuf = Buffer.from(new Uint8Array([0x41, 0x50, 0x50, 0x4c]));
    let json = "op-1" + JSON.stringify(obj);

    json += String.fromCharCode(0x0a);
    if (json.length % 2 !== 0) {
      json += " ";
    }
    let jsonBuf = Buffer.from(json);
    let lenBuf = Buffer.alloc(4);
    lenBuf.writeInt32BE(jsonBuf.length);

    let applBuf = Buffer.concat([startBuf, lenBuf, jsonBuf]);

    let sndPos = buf.indexOf("SSND");
    let output = Buffer.alloc(buf.length + applBuf.length);
    //console.log("SSND position: " + sndPos);

    buf.copy(output, 0, 0, sndPos);
    applBuf.copy(output, sndPos);
    buf.copy(output, sndPos + applBuf.length, sndPos);
    let blob = new Blob([output], { type: "audio/x-aiff; charset=binary" });

    let date = new Date();
    let isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    let outputDir = "./outputs/OP-Z_JSON_" + isoDate + ".aif";

    //FileSaver.saveAs(blob, outputDir + fileName);

    var fileReader = new FileReader();
    fileReader.onload = function () {
      fs.writeFileSync(outputDir, Buffer.from(new Uint8Array(this.result)));
      callback(outputDir);
    };
    fileReader.readAsArrayBuffer(blob);
  });
}

function playPauseSample() {
  if (isSamplePlaying) {
    isSamplePlaying = false;
    selectedWavesurfer.pause();
    selectedCurrentRegion.update({ drag: true, resize: true });
  } else {
    isSamplePlaying = true;
    selectedWavesurfer.play(selectedCurrentRegion.start, selectedCurrentRegion.end);
    selectedCurrentRegion.update({ drag: false, resize: false });
  }
}

function playSample() {
  if (!isSamplePlaying) {
    isSamplePlaying = true;
    selectedCurrentRegion.update({ drag: false, resize: false });
  }
  selectedWavesurfer.play(selectedCurrentRegion.start, selectedCurrentRegion.end);
}

function pauseSample() {
  if (isSamplePlaying) {
    isSamplePlaying = false;
    selectedWavesurfer.pause();
    selectedCurrentRegion.update({ drag: true, resize: true });
  }
}

function stepNext() {
  if (currentView == "primary" && regions.length > 0) {
    currentTimeValsIndex += 1;
    if (currentTimeValsIndex > maxIndex) {
      currentTimeValsIndex = 0;
    }
    selectCurrentRegion()
  } else if (currentView == "final" && finalRegions.length > 0) {
    currentFinalRegionIndex += 1;
    if (currentFinalRegionIndex >= finalRegions.length) {
      currentFinalRegionIndex = 0;
    }
    selectCurrentFinalRegion();
  }
}

function stepPrev() {
  if (currentView == "primary" && regions.length > 0) {
    currentTimeValsIndex -= 1;
    if (currentTimeValsIndex < 0) {
      currentTimeValsIndex = maxIndex;
    }
    selectCurrentRegion()
  } else if (currentView == "final" && finalRegions.length > 0) {
    currentFinalRegionIndex -= 1;
    if (currentFinalRegionIndex < 0) {
      currentFinalRegionIndex = finalRegions.length - 1;
    }
    selectCurrentFinalRegion();
  }
}

function leftInZoom() {
  let startSec = selectedCurrentRegion.start;
  let endSec = selectedCurrentRegion.end;
  if (keyDown_Shift) {
    selectedCurrentRegion.update({ start: startSec - 0.01 });
    updateZoomTime(endSec - startSec);
  }
  else if (keyDown_Ctrl) {
    selectedCurrentRegion.update({ end: endSec - 0.01 });
    updateZoomTime(endSec - startSec);
  }
  else {
    selectedCurrentRegion.update({ start: startSec - 0.01, end: endSec - 0.01 })
  }
}

function rightInZoom() {
  let startSec = selectedCurrentRegion.start;
  let endSec = selectedCurrentRegion.end;
  if (keyDown_Shift) {
    selectedCurrentRegion.update({ start: startSec + 0.01 });
    updateZoomTime(endSec - startSec);
  }
  else if (keyDown_Ctrl) {
    selectedCurrentRegion.update({ end: endSec + 0.01 });
    updateZoomTime(endSec - startSec);
  }
  else {
    selectedCurrentRegion.update({ start: startSec + 0.01, end: endSec + 0.01 })
  }
}



function selectView(view) {
  if (view == "primary") {
    if (currentView != view) pauseSample();
    currentView = view;
    selectedCurrentRegion = currentRegion;
    selectedWavesurfer = wavesurfer;
    wavesurferElement.style.border = "solid 1px #f57047";
    wavesurferZoomElement.style.border = "solid 1px #6f6f6f";
    wavesurferFinalElement.style.border = "solid 1px #6f6f6f";
  } else if (view == "zoom") {
    if (currentZoomRegion && wavesurferZoom) {
      if (currentView != view) pauseSample();
      currentView = view;
      selectedCurrentRegion = currentZoomRegion;
      selectedWavesurfer = wavesurferZoom;
      wavesurferZoomElement.style.border = "solid 1px #f57047";
      wavesurferElement.style.border = "solid 1px #6f6f6f";
      wavesurferFinalElement.style.border = "solid 1px #6f6f6f";
    }
  } else if (view == "final") {
    if (currentFinalRegion && wavesurferFinal) {
      if (currentView != view) pauseSample();
      currentView = view;
      selectedCurrentRegion = currentFinalRegion;
      selectedWavesurfer = wavesurferFinal;
      wavesurferFinalElement.style.border = "solid 1px #f57047";
      wavesurferElement.style.border = "solid 1px #6f6f6f";
      wavesurferZoomElement.style.border = "solid 1px #6f6f6f";
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
      color: 'rgba(160, 37, 54, 0.43)'
    });

    regions.push(newRegion);

    newRegion.on("update-end", function (e) {
      console.log("Region update-end event.");
      console.log("Start sec: " + currentRegion.start);
      console.log("End sec: " + currentRegion.end);
    });
  })
}

function addFinalRegion(startSec, endSec) {
  let newRegion = wavesurferFinal.addRegion({
    start: startSec,
    end: endSec,
    color: 'rgba(108, 108, 132, 0.13)'
  });

  newRegion.key = -1;
  addKeyToFinalRegion(newRegion, -1);

  finalRegions.push(newRegion);

  currentFinalRegionIndex = finalRegions.length - 1

  selectCurrentFinalRegion()
}

function updateFinalTime(endSec) {
  let time = Math.round(endSec * 100) / 100;
  let msg = time + " / 12.0 sec";
  document.querySelector('#final-sample-length-msg').innerHTML = msg;
}

function updateZoomTime(durationSec) {
  let time = Math.round(durationSec * 100) / 100;
  let msg = time + " sec";
  document.querySelector('#zoom-sample-length-msg').innerHTML = msg;
}

function getOpzObject(callback) {
  let starts = new Array(24).fill(0);
  let ends = new Array(24).fill(0);
  let OpzObject = {};

  finalRegions.forEach((region) => {
    let i = region.key;
    starts[i] = toOPTime(region.start);
    ends[i] = toOPTime(region.end);
  })

  fs.readFile('./src/drum_JSON_template.json', (err, data) => {
    if (err) throw err;
    OpzObject = JSON.parse(data);
    OpzObject.start = starts;
    OpzObject.end = ends;
    callback(OpzObject)
  });
}

function toOPTime(seconds) {
  return Math.round(seconds / 12 * 2147483647);
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
  regions.forEach((reg) => reg.update({ drag: false, resize: false, color: 'rgba(160, 37, 54, 0.43)' }))

  currentRegion = regions[currentTimeValsIndex]

  if (isSamplePlaying) currentRegion.update({ drag: false, resize: false, color: 'rgba(255,255,51,0.3)' });
  else currentRegion.update({ drag: true, resize: true, color: 'rgba(255,255,51,0.3)' });

  let startSec = currentRegion.start;
  let endSec = currentRegion.end;

  let startSecRounded = Math.round(startSec * 100) / 100;
  let endSecRounded = Math.round(endSec * 100) / 100;

  if (isSamplePlaying) wavesurfer.play(startSec, endSec);

  if (currentView == "primary") {
    selectedCurrentRegion = currentRegion;
    selectedWavesurfer = wavesurfer;
  } else if (currentView == "zoom") {
    selectedCurrentRegion = currentZoomRegion;
    selectedWavesurfer = wavesurferZoom;
  }
}

function selectCurrentFinalRegion() {
  finalRegions.forEach((reg) => reg.update({ color: 'rgba(108, 108, 132, 0.13)' }));

  currentFinalRegion = finalRegions[currentFinalRegionIndex];

  selectedCurrentRegion = currentFinalRegion;

  currentFinalRegion.update({ color: 'rgba(255,255,51,0.3)' });

  let startSec = currentFinalRegion.start;
  let endSec = currentFinalRegion.end;

  if (isSamplePlaying) wavesurferFinal.play(startSec, endSec);

  updateKeyColors();

}

function editInZoom() {
  wavesurferZoom.clearRegions();
  currentZoomRegion = wavesurferZoom.addRegion({
    start: currentRegion.start,
    end: currentRegion.end,
    color: 'rgba(255, 255, 255, 0.13)'
  });

  updateZoomTime(currentRegion.end - currentRegion.start);

  updateZoomView();
}

function enableSampleButtons() {
  document.querySelectorAll('.sample-btn').forEach((btn) => btn.disabled = false);
}

function disableSampleButtons() {
  currentRegion = null;
  regions = [];
  wavesurfer.clearRegions();
  document.querySelectorAll('.sample-btn').forEach((btn) => btn.disabled = true);
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

async function concatenateBufferToFile(filePath, bufferDataNew, baseLength, callback) {
  let audioContext = new AudioContext;
  let outputFilePath = filePath;
  let baseBuffer = null;

  if (filePath) {
    baseBuffer = await getAudioBuffer(filePath);
  }

  let totalSamplesLength = bufferDataNew.length + baseLength;
  let totalLength = 12 * 44100;
  let zerosLength = totalLength - totalSamplesLength;

  let tmpBuff = audioContext.createBuffer(1, totalLength, 44100);
  let channel = tmpBuff.getChannelData(0);

  if (filePath) {

    let bufferDataBase = baseBuffer.getChannelData(0).slice(0, baseLength);
    channel.set(bufferDataBase, 0);
  } else {
    let isoDateString = new Date().toISOString();
    outputFilePath = path.resolve('./temp/finalWav-' + isoDateString + '.wav');
  }
  channel.set(bufferDataNew, baseLength);

  // fill up with zeros
  let zeros = new Array(zerosLength).fill(0);
  channel.set(zeros, totalSamplesLength);

  let wav = toWav(tmpBuff);
  let chunk = new Uint8Array(wav);

  if (filePath) fs.unlinkSync(filePath);

  fs.writeFile(outputFilePath, Buffer.from(chunk), function (err) {
    if (err) {
      console.log(err);
      return callback("", 0, err);
    }
    else {
      let startSec = baseLength / 44100;
      let endSec = totalSamplesLength / 44100;
      updateFinalTime(endSec);
      addFinalRegion(startSec, endSec);

      console.log(filePath + ' was created.');

      return callback(outputFilePath, totalSamplesLength, null);
    }
  });

}

function deleteCurrentFinalRegion() {
  let startIndex = currentFinalRegion.start * 44100;
  let endIndex = currentFinalRegion.end * 44100;

  let duration = currentFinalRegion.end - currentFinalRegion.start;

  deleteFromFile(finalFilePath, finalBaseLength, startIndex, endIndex, (newBaseLength, err) => {
    if (err) {
      console.log(err);
    } else {
      availableFinalKeys.push(currentFinalRegion.key);

      if (finalRegions.length > 1) {
        if (currentFinalRegionIndex == finalRegions.length - 1) {
          finalRegions.pop();
          currentFinalRegionIndex -= 1;
        } else {
          finalRegions.splice(currentFinalRegionIndex, 1);
          for (let i = currentFinalRegionIndex; i < finalRegions.length; i++) {
            let newStart = finalRegions[i].start - duration;
            let newEnd = finalRegions[i].end - duration;
            finalRegions[i].update({ start: newStart, end: newEnd })
          }
        }
        finalBaseLength = newBaseLength;
        currentFinalRegion.remove();
        selectCurrentFinalRegion();
        wavesurferFinal.load(finalFilePath);
      } else {
        finalRegions = [];
        finalFilePath = "";
        currentFinalRegion = null;
        finalBaseLength = 0;
        currentFinalRegionIndex = -1;
        wavesurferFinal.clearRegions();
        wavesurferFinal.empty();
        selectView("primary");
        updateKeyColors();
      }

    }
  })

}

async function deleteFromFile(filePath, baseLength, startIndex, endIndex, callback) {
  let audioContext = new AudioContext;

  let baseBuffer = await getAudioBuffer(filePath);

  let firstHalfBufferData = baseBuffer.getChannelData(0).slice(0, startIndex);
  let secondHalfBufferData = baseBuffer.getChannelData(0).slice(endIndex, baseLength);

  let newLength = firstHalfBufferData.length + secondHalfBufferData.length;

  let totalLength = 12 * 44100;
  let zerosLength = totalLength - newLength;

  let tmpBuff = audioContext.createBuffer(1, totalLength, 44100);
  let channel = tmpBuff.getChannelData(0);

  channel.set(firstHalfBufferData, 0);
  channel.set(secondHalfBufferData, firstHalfBufferData.length);

  // fill up with zeros
  let zeros = new Array(zerosLength).fill(0);
  channel.set(zeros, newLength);

  let wav = toWav(tmpBuff);
  let chunk = new Uint8Array(wav);

  fs.unlinkSync(filePath);

  fs.writeFile(filePath, Buffer.from(chunk), function (err) {
    if (err) {
      console.log(err);
      return callback(0, err);
    }
    else {
      console.log(filePath + ' was updated.');
      return callback(newLength, null);
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
        if (tempFileCntr == files.length) console.log(tempFileCntr + ' temp files deleted.');
      });
    }
  });
}