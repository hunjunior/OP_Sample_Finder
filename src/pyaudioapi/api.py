import timeit
start = timeit.timeit()
print("Timer start..")
from melodic_processing import find_melodic_samples
from melodic_processing import matrix_to_samples
from drum_processing import find_drum_samples
from drum_processing import separate_drum_track
from drum_classification import predict_drum_classes
import sys
import zerorpc
#import tensorflow as tf
from tensorflow.python.keras.models import load_model
import os

class AudioProcessingAPI(object):

    msg = 'Processing...'
    similarityMatrix = []
    times = []
    model = ""

    def echo(self, text):
        return text

    def getArray(self, text, thrshld):
        """echo any text"""
        print("STARTED")
        print(self.msg)
        print('Threshold: ', thrshld)
        print(type(thrshld))
        sys.stdout.flush()
        arr, self.similarityMatrix, self.times = find_melodic_samples(text, 0.9, thrshld)
        #print(arr)
        sys.stdout.flush()
        return arr

    def getNewArray(self, thrshld):
        print("STARTED NEW ARRAY")
        print(self.msg)
        print(type(self.similarityMatrix))
        print(self.similarityMatrix.shape)
        print('Threshold: ', thrshld)
        print(type(thrshld))
        print(self.times.shape)
        sys.stdout.flush()
        arr = matrix_to_samples(self.similarityMatrix, self.times, thrshld)
        #print(arr)
        sys.stdout.flush()
        return arr

    def getDrumSamples(self, file_path):
        print("STARTED DRUM SAMPLES")
        print(self.msg)
        sys.stdout.flush()
        arr = find_drum_samples(file_path)
        sys.stdout.flush()
        return arr
    
    def getDrumTrack(self, file_path):
        print("DRUM SEPARATION")
        sys.stdout.flush()
        track_file_path = separate_drum_track(file_path)
        sys.stdout.flush()
        return track_file_path

    def loadModel(self, modelDir):
        print("LOADING THE MODEL...")
        sys.stdout.flush()

        MODEL_PATH = modelDir
        
        try:
            #self.model = tf.keras.models.load_model(MODEL_PATH)
            self.model = load_model(MODEL_PATH)
            print("MODEL LOADED")
            print(sys.version)
            sys.stdout.flush()
            return True
        except Exception as e:
            print("Model loading error:")
            print(e)
            sys.stdout.flush()
            return False
        
    
    def getDrumClasses(self, file_path, temp_dir, time_array):
        print("STARTED DRUM CLASSES PREDICTION")
        print(file_path)
        sys.stdout.flush()
        arr = predict_drum_classes(file_path, temp_dir, time_array, self.model)
        sys.stdout.flush()
        return arr

    def getStatus(self, text):
        return status()

def parse_port():
    port = 4242
    try:
        port = int(sys.argv[1])
    except Exception as e:
        pass
    return '{}'.format(port)

def main():
    print('Main() started.')
    end = timeit.timeit()
    print('Timer stop: ' + str(end - start))
    addr = 'tcp://127.0.0.1:' + parse_port()
    s = zerorpc.Server(AudioProcessingAPI())
    s.bind(addr)
    print('start running on {}'.format(addr))
    s.run()

if __name__ == '__main__':
    main()
