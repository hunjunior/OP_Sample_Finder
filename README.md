# OP-Sample-Finder

This is an Electron + Python app for the [OP-Z sequencer and synthesizer](https://teenage.engineering/products/op-z) to generate OP-Z compatible AIF drum kit files from audio files. The app can search for melodic loops and drum samples in an audio file (WAV,MP3 or AIFF). Furthermore, the application is able to perform drum classification on the extracted drum samples. The MSc thesis paper based on this project can be found [here](https://github.com/hunjunior/OP_Sample_Finder/releases/download/v1.0/MSc_Thesis_David_Pituk.pdf).

<p align="center">  <img width="700" src="https://i.imgur.com/Rk42RLN.png](https://i.imgur.com/HkpXb2E.png">  </p>

The main important files and directories of the project:

- `package.json` - Points to the app's main file and lists its details and dependencies.
- `main.js` - Starts the app and creates a browser window to render HTML. This is the app's **main process**.
- `src/html/index.html` - A web page to render. This is the app's **renderer process**.
- `src/js/renderer.js` - The JS file which contains the functions to perform file/audio processing, DOM manipulation etc.
- `src/drum_JSON_template.json` - The template OP-1 JSON. This will be modified and concatenated to the final AIF kit.
- `src/pyaudioapi/` - This folder contains the python scripts for the back-end (RPC) and for the drum classification and drum track separation.
- `pretrained_models/` - Place holder for the models 

A small pdf guide about the app [here](https://github.com/hunjunior/OP_Sample_Finder/releases/download/v1.0/OP_Sample_Finder_Guide.pdf).

## Setup

The following tools are required to be installed to run the project:
- [Git](https://git-scm.com) to clone the repository
- [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) 
- [Python 3.7](https://www.python.org/downloads/release/python-370/) with the [Virtual Environment (venv)](https://docs.python.org/3/library/venv.html) module 

Clone the repository
```bash
git clone https://github.com/hunjunior/OP_Sample_Finder.git
```

Download the models:
- Get the fft-model.model file from [here](https://github.com/hunjunior/OP_Sample_Finder/releases/download/v1.0/fft-model.model) and copy it to the `pretrained_models/drum_classes` folder.
- Download the [4stems.tar.gz](https://github.com/deezer/spleeter/releases/download/v1.4.0/4stems.tar.gz) file from Spleeter and extract its content (checkpoint, model.data-00000-of-00001, model.meta, model.index) to the `pretrained_models/4stems` folder.


Then install the 

```bash
# Go into the repository
cd OP_Sample_Finder

# Setup the virtual environment (venv) for the python back-end
# Make sure the python command points to Python 3.7 (on some system it's python3 or python3.7)
python -m venv op_venv/
# Activate the virtualenv (for Linux and Mac) (for Windows it should be 'op_venv\Scripts\activate')
source op_venv/bin/activate
# Install all python dependencies 
pip install -r src/pyaudioapi/requirements.txt
# Deactivate virtualenv
deactivate

# Install Node.js dependencies
npm install
# Run the app
npm start
```
