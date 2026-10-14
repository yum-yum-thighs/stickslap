"""Prepare a 128-kbps playback copy of the supplied track. Requires PyAV."""
from pathlib import Path
import sys
import av

source, target = map(Path, sys.argv[1:3])
temporary = target.with_suffix('.encoding.mp3')
with av.open(str(source)) as incoming, av.open(str(temporary), 'w') as outgoing:
    stream = incoming.streams.audio[0]
    audio = outgoing.add_stream('libmp3lame', rate=44100)
    audio.layout = 'stereo'
    audio.bit_rate = 128000
    resampler = av.AudioResampler(format='fltp', layout='stereo', rate=44100)
    for frame in incoming.decode(stream):
        for converted in resampler.resample(frame):
            for packet in audio.encode(converted):
                outgoing.mux(packet)
    for converted in resampler.resample(None):
        for packet in audio.encode(converted):
            outgoing.mux(packet)
    for packet in audio.encode(None):
        outgoing.mux(packet)
temporary.replace(target)
print(f'Playback copy: {target.stat().st_size:,} bytes', flush=True)
