#!/usr/bin/env python3
"""
Python OSC Test Sender
Sends test OSC messages to the OSC MCP Server using python-osc library.

Installation:
pip install python-osc

Usage:
python python-test.py [host] [port]
"""

import sys
import time
import random
import math
from pythonosc import udp_client

def main():
    # Parse command line arguments
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    
    print(f"Sending OSC messages to {host}:{port}")
    
    # Create OSC client
    client = udp_client.SimpleUDPClient(host, port)
    
    # Test 1: Simple messages with different data types
    print("Test 1: Simple messages")
    client.send_message("/test/int", 42)
    client.send_message("/test/float", 3.14159)
    client.send_message("/test/string", "hello world")
    client.send_message("/test/mixed", [440, 0.5, "note"])
    time.sleep(0.1)
    
    # Test 2: Synthesizer control
    print("Test 2: Synthesizer control")
    client.send_message("/synth/freq", 440.0)
    client.send_message("/synth/amp", 0.8)
    client.send_message("/synth/filter", [2000.0, 0.5])
    client.send_message("/synth/envelope", [0.01, 0.3, 0.7, 1.2])
    time.sleep(0.1)
    
    # Test 3: Effects control
    print("Test 3: Effects control")
    client.send_message("/effects/reverb/room", 0.3)
    client.send_message("/effects/reverb/damp", 0.5)
    client.send_message("/effects/delay/time", 0.25)
    client.send_message("/effects/delay/feedback", 0.4)
    client.send_message("/effects/chorus/rate", 2.0)
    client.send_message("/effects/chorus/depth", 0.3)
    time.sleep(0.1)
    
    # Test 4: MIDI-style messages
    print("Test 4: MIDI-style messages")
    for note in [60, 64, 67, 72]:  # C major chord
        client.send_message("/midi/note_on", [note, 100])
        time.sleep(0.1)
    
    for note in [60, 64, 67, 72]:
        client.send_message("/midi/note_off", [note, 0])
        time.sleep(0.1)
    
    # Test 5: Transport control
    print("Test 5: Transport control")
    client.send_message("/transport/play", [])
    time.sleep(0.5)
    client.send_message("/transport/bpm", 120)
    time.sleep(0.5)
    client.send_message("/transport/stop", [])
    time.sleep(0.1)
    
    # Test 6: Sequence of messages
    print("Test 6: Message sequence")
    for i in range(10):
        freq = 220 * (2 ** (i / 12))  # Chromatic scale
        client.send_message("/sequence/step", [i, freq])
        time.sleep(0.05)
    
    # Test 7: High-frequency messages (for buffer testing)
    print("Test 7: High-frequency messages")
    start_time = time.time()
    for i in range(100):
        value = math.sin(i * 0.1)
        client.send_message("/highfreq/data", [i, value])
        time.sleep(0.01)  # 100 messages per second
    
    duration = time.time() - start_time
    print(f"Sent 100 messages in {duration:.2f} seconds")
    
    # Test 8: Different address patterns
    print("Test 8: Address patterns")
    patterns = [
        "/instruments/piano/note",
        "/instruments/drums/kick",
        "/instruments/bass/note",
        "/mixer/channel1/volume",
        "/mixer/channel2/pan",
        "/master/volume"
    ]
    
    for pattern in patterns:
        value = random.uniform(0.0, 1.0)
        client.send_message(pattern, value)
        time.sleep(0.05)
    
    # Test 9: Blob data (binary)
    print("Test 9: Blob data")
    blob_data = bytes([random.randint(0, 255) for _ in range(16)])
    client.send_message("/data/blob", blob_data)
    time.sleep(0.1)
    
    # Test 10: Stress test with random messages
    print("Test 10: Random message stress test")
    addresses = [
        "/synth/freq", "/synth/amp", "/effects/reverb",
        "/midi/note", "/transport/bpm", "/test/random",
        "/mixer/volume", "/filter/cutoff", "/lfo/rate"
    ]
    
    for _ in range(50):
        addr = random.choice(addresses)
        value = random.uniform(0.0, 1.0)
        client.send_message(addr, value)
        time.sleep(0.02)
    
    print("All tests completed!")

def send_continuous_messages(host="127.0.0.1", port=8000, duration=10):
    """Send continuous random messages for testing"""
    print(f"Sending continuous messages to {host}:{port} for {duration} seconds")
    
    client = udp_client.SimpleUDPClient(host, port)
    
    addresses = [
        "/synth/freq", "/synth/amp", "/effects/reverb",
        "/midi/note", "/transport/bpm", "/test/continuous"
    ]
    
    start_time = time.time()
    message_count = 0
    
    while time.time() - start_time < duration:
        addr = random.choice(addresses)
        value = random.uniform(0.0, 1.0)
        client.send_message(addr, value)
        message_count += 1
        time.sleep(0.1)  # 10 messages per second
    
    print(f"Sent {message_count} messages in {duration} seconds")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        send_continuous_messages()
    else:
        main()