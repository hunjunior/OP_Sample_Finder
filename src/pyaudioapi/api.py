from __future__ import print_function
from melodic_processing import find_melodic_samples
from melodic_processing import matrix_to_samples
from drum_processing import find_drum_samples
import sys
import zerorpc



class AudioProcessingAPI(object):

    msg = 'Processing...'
    similarityMatrix = []
    times = []

    def echo(self, text):
        return text

    def getArray(self, text, thrshld):
        """echo any text"""
        print("STARTED")
        print(self.msg)
        self.msg = 'hahaha'
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
