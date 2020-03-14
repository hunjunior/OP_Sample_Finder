import os
import sys
import matplotlib.pyplot as plt
from scipy.fftpack import fft
import numpy as np
import cv2
from scipy.io import wavfile




def getDrumClass(timeValues, startIndex, endIndex, temp_img_dir, index, model):

    png_file_path = temp_img_dir + "/" + str(index) + ".png"

    sample_rate = 44100
    duration_seconds = 1

    IMG_SIZE_H = 150
    IMG_SIZE_W = 240

    samples = timeValues[startIndex:endIndex]

    original_lenght = len(samples)

    sample_lenght = sample_rate * duration_seconds

    if(original_lenght < sample_lenght):
        zeros_lenght = sample_lenght - original_lenght
        
        ### array of zeros for zero padding
        zeros_array = np.zeros(zeros_lenght, dtype=int)

        ### zero padding
        samples_for_fft = np.concatenate((samples,zeros_array))

    else:
        samples_for_fft = samples[0:sample_lenght]

    # sample spacing
    T = 1.0 / sample_rate
    N = len(samples_for_fft)

    yf = fft(samples_for_fft)

    xf_plot = np.linspace(0.0, 1.0 / (2.0 * T), N // 2)

    yf_plot = 2.0 / N * np.abs( yf[:N//2])

    xf_log_plot = []

    for i in range(1, len(xf_plot)): xf_log_plot.append(np.log10(xf_plot[i]))

    ### Saving plots to images
    fig = plt.figure(figsize=(8,5))
    ax = plt.gca()
    plt.axis('off')
    plt.plot(xf_log_plot, yf_plot[1:])
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.savefig(png_file_path, dpi=30)
    plt.close()

    img_array = cv2.imread(png_file_path, cv2.IMREAD_GRAYSCALE)
    img_resized = cv2.resize(img_array, (IMG_SIZE_W, IMG_SIZE_H)).reshape(-1, IMG_SIZE_W, IMG_SIZE_H, 1)
    img_resized = img_resized / 255.0

    try:
        prediction = model.predict([img_resized])[0]
        index = int(np.argmax(prediction))
        percentage = int(prediction[index] * 10000) / 100.0
    except Exception as e:
        print("Image reading error:")
        print(e)
        sys.stdout.flush()
    
    return [index, percentage]


def predict_drum_classes(wav_file_path, temp_dir, time_array, model):

    try:
        sample_rate, timeValues = wavfile.read(wav_file_path)
    except Exception as e:
        print(e)
        return
    

    result_array = []
    for i in range(0, len(time_array)):
        startIndex = int(time_array[i][0] * 44100)
        endIndex = int(time_array[i][1] * 44100)
        result = getDrumClass(timeValues, startIndex, endIndex, temp_dir, i, model)
        print(result)
        sys.stdout.flush()
        result_array.append(result)
    
    return result_array