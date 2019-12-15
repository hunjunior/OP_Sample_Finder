from __future__ import print_function
from melodic_processing import find_melodic_samples
from melodic_processing import matrix_to_samples
from drum_processing import find_drum_samples
from drum_classification import predict_drum_classes
import sys
import zerorpc
import tensorflow as tf
import os


class AudioProcessingAPI(object):

    msg = 'Processing...'
    similarityMatrix = []
    times = []
    model = ""

    model_file_path = os.path.dirname(__file__)
    model_file_path = os.path.join(model_file_path, 'fft-model.model')

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

    def loadModel(self):
        print("LOADING THE MODEL...")
        sys.stdout.flush()

        MODEL_PATH = self.model_file_path
        
        try:
            self.model = tf.keras.models.load_model(MODEL_PATH)
            print("MODEL LOADED")
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
    addr = 'tcp://127.0.0.1:' + parse_port()
    s = zerorpc.Server(AudioProcessingAPI())
    s.bind(addr)
    print('start running on {}'.format(addr))
    s.run()

if __name__ == '__main__':
    main()
