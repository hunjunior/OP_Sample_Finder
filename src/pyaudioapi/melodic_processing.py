import scipy
import os
from scipy import signal
from scipy.io import wavfile
import numpy as np

cntr = 0
elements = 0
globalSimilarityM = []
# A and B are 2D vectors of two spectrograms
def matrix_similarity_cosine(A,B):
    n = len(A[0])
    
    A = np.transpose(A)
    B = np.transpose(B)

    M = np.zeros((n,n))

    # x axis: time domain of A
    # y axis: time domain of B
    elements = n*n
    cntr = 0
    for y in range(0, n):
        for x in range(0, n):
            M[x,y] = scipy.spatial.distance.cosine(A[x],B[y])
            #print(cntr, ' / ', elements)
            cntr += 1
    return M

# A and B are 2D vectors of two spectrograms
def matrix_similarity_euclidean(A,B):
    n = len(A[0])
    
    A = np.transpose(A)
    B = np.transpose(B)

    M = np.zeros((n,n))

    # x axis: time domain of A
    # y axis: time domain of B
    elements = n*n
    cntr = 0
    for y in range(0, n):
        for x in range(0, n):
            M[x,y] = np.linalg.norm(A[x] - B[y])
            #print(cntr, ' / ', elements)
            cntr += 1
    
    #print(type(A[0]))

    return M


def find_melodic_samples(wav_file_path, threshold_spectrogram, threshold_similarity):
    sample_rate, samples = wavfile.read(wav_file_path)

    ### Get the spectrogram
    #frequencies, times, spectrogram = signal.spectrogram(samples, sample_rate)
    frequencies, times, spectrogram = signal.spectrogram(samples, fs=sample_rate, nperseg=(sample_rate/4), noverlap=None)
    
    maxTime = np.amax(times)
    minTime = np.amin(times)
    
    ### log(0) prevention: replacing zeros with the half of the second smallest element
    zeroreplace = (np.amin(np.array(spectrogram)[spectrogram != np.amin(spectrogram)])) / 2
    spectrogram[spectrogram == 0] = zeroreplace
    
    # Performing the LOG_10
    spectrogram = np.log10(spectrogram)

    if(threshold_spectrogram >= 0 and threshold_spectrogram <= 1):
        ### calculate threshold limit
        maxVal = np.amax(spectrogram)
        minVal = np.amin(spectrogram)
        deltaLog = maxVal - minVal
        thresholdLimit = (deltaLog * threshold_spectrogram) + minVal

        ### Performing threshold
        spectrogram[spectrogram <= thresholdLimit] = 0
        spectrogram[spectrogram > thresholdLimit] = 1

    #similarityM = matrix_similarity_cosine(spectrogram,spectrogram)
    similarityM = matrix_similarity_euclidean(spectrogram,spectrogram)
    print(type(similarityM))
    similarityMatrixCopy = np.copy(similarityM)
    print('COPY M: ', similarityMatrixCopy.shape)
    timesCopy = np.copy(times)
    #similarityM = similarityM * -1

    samplesArrReduced = matrix_to_samples(similarityM, times, threshold_similarity)
    print(samplesArrReduced)
    
    return samplesArrReduced, similarityMatrixCopy, timesCopy


def matrix_to_samples(similarityMatrix, times, threshold_similarity):
    print('ENTERS matrix_to_samples')
    print(threshold_similarity)
    
    similarityM = np.copy(similarityMatrix)

    if(threshold_similarity >= 0 and threshold_similarity <= 1):
        ### calculate threshold limit
        maxVal = np.amax(similarityM)
        minVal = np.amin(similarityM)
        deltaLog = maxVal - minVal
        thresholdLimit = (deltaLog * threshold_similarity) + minVal
        
        ### Performing threshold
        similarityM[similarityM <= thresholdLimit] = 1
        similarityM[similarityM > thresholdLimit] = 0

        # finding diagonal lines which are longer than 3 units (~ 0.75 secs)
        rows = similarityM.shape[0]
        cols = similarityM.shape[1]
        print('Similarity Matrix y: ', rows)
        print('Similarity Matrix x: ', cols)
        rows = cols
        sampleCntrStart = 0
        sampleCntrEnd = 0
        samplesArr = []
        
        for x in range(3, cols-6):
            for y in range(3, rows-6):
                #print('[ ',x+y,' , ',y,' ]')
                if(similarityM[x+y-3,y-3] > 0 and similarityM[x+y-2,y-2] > 0 and similarityM[x+y-1,y-1] > 0 and similarityM[x+y,y] > 0 and similarityM[x+y+1,y+1] > 0 and similarityM[x+y+2,y+2] > 0 and similarityM[x+y+3,y+3] > 0):
                    similarityM[x+y-3,y-3] = 0.5
                    similarityM[x+y-2,y-2] = 0.5
                    similarityM[x+y-1,y-1] = 0.5
                    similarityM[x+y,y] = 0.5
                    similarityM[x+y+1,y+1] = 0.5
                    similarityM[x+y+2,y+2] = 0.5
                    similarityM[x+y+3,y+3] = 0.5
                    if(y-4 >= 0):
                        if(similarityM[x+y-4,y-4] == 0):
                            sampleCntrStart += 1
                            samplesArr.append([x+y-3, 0])
                            samplesArr.append([y-3, 0])
                    else:
                        sampleCntrStart += 1
                        samplesArr.append([x+y-3, 0])
                        samplesArr.append([y-3, 0])
                    if(x+y+4 < cols):
                        if(similarityM[x+y+4,y+4] == 0):
                            sampleCntrEnd += 1
                            samplesArr[-2][1] = x+y+3
                            samplesArr[-1][1] = y+3
                    else:
                        sampleCntrEnd += 1
                        samplesArr[-2][1] = x+y+3
                        samplesArr[-1][1] = y+3
            rows = rows - 1

        samplesArrReduced = []
        isIn = False
        
        for i in range(0, len(samplesArr)):
            for j in range(len(samplesArr)):
                length_i = samplesArr[i][1] - samplesArr[i][0]
                length_j = samplesArr[j][1] - samplesArr[j][0]
                if(i!=j):
                    if(samplesArr[i][0] >= samplesArr[j][0] and samplesArr[i][1] <= samplesArr[j][1]):
                        isIn = True
                        break
                    elif(samplesArr[i][0] > samplesArr[j][0] and samplesArr[i][0] < samplesArr[j][1]):
                        overlap = samplesArr[j][1] - samplesArr[i][0]
                        overlap_ratio_i = overlap / length_i
                        overlap_ratio_j = overlap / length_j
                        if(overlap > (length_i * 0.6)):
                            if(overlap_ratio_i > overlap_ratio_j):
                                isIn = True
                                break
                    elif(samplesArr[i][1] < samplesArr[j][1] and samplesArr[i][1] > samplesArr[j][0]):
                        overlap = samplesArr[i][1] - samplesArr[j][0]
                        overlap_ratio_i = overlap / length_i
                        overlap_ratio_j = overlap / length_j
                        if(overlap > (length_i * 0.6)):
                            if(overlap_ratio_i >= overlap_ratio_j):
                                isIn = True
                                break
            if(i%2 == 1):
                if(isIn == False):
                    samplesArrReduced.append(samplesArr[i])
                isIn = False

    print(samplesArrReduced)

    for i in range(0, len(samplesArrReduced)):
        samplesArrReduced[i][0] = times[samplesArrReduced[i][0]]
        samplesArrReduced[i][1] = times[samplesArrReduced[i][1]]

    return samplesArrReduced