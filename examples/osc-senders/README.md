# OSC Sender Examples

This directory contains example OSC message senders for testing the OSC MCP Server.

## Available Examples

### SuperCollider (supercollider-test.scd)
A comprehensive SuperCollider script that sends various types of OSC messages.

**Usage:**
1. Open SuperCollider
2. Load the `supercollider-test.scd` file
3. Make sure your OSC MCP Server is running on port 8000
4. Execute different test sections by selecting code and pressing Ctrl+Enter (Cmd+Enter on Mac)

**Features:**
- Simple message types (int, float, string)
- Synthesizer control messages
- Effects parameter messages
- High-frequency message sequences
- Random message generation
- Blob (binary) data testing

### Python (python-test.py)
A Python script using the python-osc library for comprehensive OSC testing.

**Installation:**
```bash
pip install python-osc
```

**Usage:**
```bash
# Run all tests
python python-test.py

# Specify custom host/port
python python-test.py 192.168.1.100 9000

# Send continuous messages for testing
python python-test.py --continuous
```

**Features:**
- Automated test suite with multiple message types
- Stress testing with high-frequency messages
- MIDI-style note on/off messages
- Transport control messages
- Binary blob data testing
- Continuous message mode for buffer testing

### Max/MSP (max-msp-test.maxpat)
A Max/MSP patch with interactive controls for sending OSC messages.

**Usage:**
1. Open Max/MSP
2. Load the `max-msp-test.maxpat` file
3. Ensure the udpsend object is configured for your server (default: 127.0.0.1:8000)
4. Click buttons and move sliders to send different message types

**Features:**
- Interactive GUI controls
- Real-time parameter adjustment
- MIDI note sending with slider control
- Transport control buttons
- Random sequence generation
- BPM control

## Testing Workflow

1. **Start the OSC MCP Server** with an endpoint on port 8000:
   ```json
   {
     "tool": "create_osc_endpoint",
     "parameters": {
       "port": 8000,
       "bufferSize": 1000
     }
   }
   ```

2. **Choose a sender** based on your preferred environment:
   - SuperCollider for audio programming
   - Python for scripted testing
   - Max/MSP for interactive control

3. **Run the sender** to generate test messages

4. **Query messages** from the MCP server:
   ```json
   {
     "tool": "get_osc_messages",
     "parameters": {
       "limit": 50
     }
   }
   ```

## Message Types Tested

All senders test these common OSC message patterns:

### Basic Types
- `/test/int` - Integer values
- `/test/float` - Floating point values
- `/test/string` - String values
- `/test/mixed` - Multiple argument types

### Audio/Music Control
- `/synth/freq` - Synthesizer frequency
- `/synth/amp` - Amplitude control
- `/effects/reverb` - Reverb parameters
- `/effects/delay` - Delay parameters

### MIDI-Style
- `/midi/note_on` - Note on messages
- `/midi/note_off` - Note off messages
- `/midi/cc` - Control change messages

### Transport
- `/transport/play` - Start playback
- `/transport/stop` - Stop playback
- `/transport/bpm` - Tempo control

### Sequences
- `/sequence/step` - Step sequencer data
- `/highfreq/data` - High-frequency test data

## Troubleshooting

### No Messages Received
1. Verify the OSC MCP Server endpoint is active
2. Check that the sender is configured for the correct IP and port
3. Ensure firewall isn't blocking UDP traffic
4. Test with a simple message first

### Performance Issues
1. Reduce message frequency in high-frequency tests
2. Increase buffer size in the MCP server endpoint
3. Use address filters to reduce processing overhead

### Connection Errors
1. Verify network connectivity between sender and server
2. Check that the specified port is available
3. Try using localhost (127.0.0.1) for local testing

## Custom Senders

To create your own OSC sender:

1. **Choose an OSC library** for your language
2. **Configure the destination** to match your MCP server endpoint
3. **Send test messages** with various data types
4. **Verify reception** by querying the MCP server

Common OSC libraries:
- **JavaScript/Node.js**: node-osc, osc-js
- **Python**: python-osc
- **C++**: oscpack, JUCE
- **Java**: JavaOSC
- **C#**: Rug.Osc