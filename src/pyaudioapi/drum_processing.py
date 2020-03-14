import scipy
from scipy.fftpack import fft
from scipy.io import wavfile
import numpy as np
import math



def get_array_energy(input_array):
    energy = 0
    for i in range(0, len(input_array)):
        energy = energy + (input_array[i] * input_array[i])
        #energy = energy + abs(input_array[i])
    return energy

def get_energy_array(input_array, window_length):
    energy_array = []
    for i in range(0, len(input_array) - window_length, window_length):
        energy_array.append(get_array_energy(input_array[i:i + window_length]))
    return energy_array

def get_tangent_array(input_array, time_window):
    tangent_array = [input_array[0] / time_window]
    for i in range(1, len(input_array)):
        tangent_array.append((input_array[i] - input_array[i-1]) / time_window)
    return tangent_array

def get_peak_index_array(input_array):
    peak_index_array = []
    for i in range(1, len(input_array) - 1):
        if(input_array[i] > input_array[i-1] and input_array[i] > input_array[i+1]):
            peak_index_array.append(i)
    return peak_index_array

def get_local_max_value_array(input_array, sec_per_sample, time_window):
    local_max_value_array = []
    N = len(input_array)
    max_window = 0.0

    if((N * sec_per_sample) < time_window):
        max_window = float(max(input_array))

    window_length = int(time_window / sec_per_sample)
    window_N = math.floor(N / window_length)

    for i in range(0, N):
        if(i%window_length == 0 and (i/window_length) < window_N):
            max_window = float(max(input_array[i:(i+window_length)]))
        
        local_max_value_array.append(max_window)
    
    return local_max_value_array



def get_max_peak_time_array(input_array, sec_per_sample):
    max_peak_time_array = []
    limit_ratio = 0.2
    #min_val = min(input_array)
    max_val = max(input_array)
    #limit_val = min_val + ((max_val - min_val) * limit_ratio)
    limit_val = max_val * limit_ratio
    peak_index_array = get_peak_index_array(input_array)
    for i in range(0, len(peak_index_array)):
        if(input_array[peak_index_array[i]] > limit_val):
            max_peak_time_array.append(peak_index_array[i] * sec_per_sample)
    return max_peak_time_array, limit_val

def get_max_peak_time_array_local(input_array, sec_per_sample):
    max_peak_time_array = []
    limit_ratio = 0.5
    peak_index_array = get_peak_index_array(input_array)
    max_val_array = get_local_max_value_array(input_array, sec_per_sample, 1)
    limit_val_array = np.array(max_val_array) * limit_ratio
    for i in range(0, len(peak_index_array)):
        limit_val = limit_val_array[peak_index_array[i]]
        if(input_array[peak_index_array[i]] > limit_val):
            max_peak_time_array.append(peak_index_array[i] * sec_per_sample)
    return max_peak_time_array

def get_max_peak_spectrum_array(input_array, max_peak_time_array):
    spectrum_array = []
    for max_peak_time in max_peak_time_array:
        index = int(max_peak_time * 44100)
        if((index - 11025) >= 0 and (index + 11025) < len(input_array)):
            sample_chunk = input_array[(index - 11025) : (index + 11025)]
            chunk_spectrum = fft(sample_chunk)
            chunk_spectrum = 2.0 / 22050 * np.abs( chunk_spectrum[:22050//2])
            spectrum_array.append(chunk_spectrum)
    return spectrum_array

def get_unique_max_peak_times(input_array, max_peak_time_array):
    unique_spectrum_array = []
    unique_time_array = []

    if(len(max_peak_time_array) > 0):
        spectrum_array = get_max_peak_spectrum_array(input_array, max_peak_time_array)
        unique_spectrum_array.append(spectrum_array[0])
        unique_time_array.append(max_peak_time_array[0])

        for i in range(1, len(spectrum_array)):
            is_unique = True
            for j in range(0, len(unique_spectrum_array)):
                similarity = scipy.spatial.distance.cosine(spectrum_array[i], unique_spectrum_array[j])
                if(similarity < 0.4):
                    is_unique = False
                    break
            if(is_unique):
                unique_spectrum_array.append(spectrum_array[i])
                unique_time_array.append(max_peak_time_array[i])
    
    return unique_time_array


def find_drum_samples(wav_file_path):
    ### Open the file
    sample_rate, samples = wavfile.read(wav_file_path)

    ### norm values to [-1 , 1]
    samples = samples / 32768.0

    ### sample rate to float
    sample_rate = sample_rate * 1.0

    ### sample length in seconds
    sample_time_length = len(samples) / sample_rate

    ### Energy array with window size of 0.05 secs
    time_window = 0.05
    window_length = int(time_window * sample_rate)
    energy_array = get_energy_array(samples, window_length)

    ### Tangent values of the energy array
    tangent_array = get_tangent_array(energy_array, time_window)

    #max_peak_time_array, limit_val = get_max_peak_time_array(tangent_array, time_window)
    max_peak_time_array = get_max_peak_time_array_local(tangent_array, time_window)

    unique_time_array = get_unique_max_peak_times(samples, max_peak_time_array)

    sample_start_end_time_array = []
    for unique_time in unique_time_array:
        if((unique_time - 0.05) > 0 and (unique_time + 0.45) < sample_time_length):
            sample_start_end_time_array.append([(unique_time - 0.05), (unique_time + 0.45)])

    return sample_start_end_time_array