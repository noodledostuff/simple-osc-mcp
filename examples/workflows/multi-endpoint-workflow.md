# Multi-Endpoint Workflow

This workflow demonstrates managing multiple OSC endpoints simultaneously for different types of messages or sources.

## Scenario

You're building a music application that receives:
- Synthesizer control messages on port 8000
- MIDI-style messages on port 8001  
- Transport/timing messages on port 8002

## Step-by-Step Workflow

### 1. Create Multiple Endpoints

Create three endpoints with different configurations:

**Synthesizer Endpoint:**
```json
{
  "tool": "create_osc_endpoint",
  "parameters": {
    "port": 8000,
    "bufferSize": 1000,
    "addressFilters": ["/synth/*", "/effects/*"]
  }
}
```

**MIDI Endpoint:**
```json
{
  "tool": "create_osc_endpoint",
  "parameters": {
    "port": 8001,
    "bufferSize": 2000,
    "addressFilters": ["/midi/*"]
  }
}
```

**Transport Endpoint:**
```json
{
  "tool": "create_osc_endpoint",
  "parameters": {
    "port": 8002,
    "bufferSize": 100,
    "addressFilters": ["/transport/*", "/clock/*"]
  }
}
```

### 2. Verify All Endpoints

Check the status of all endpoints:

```json
{
  "tool": "get_endpoint_status",
  "parameters": {}
}
```

**Expected Response:**
```json
{
  "endpoints": [
    {
      "id": "endpoint_8000_1234567890",
      "port": 8000,
      "status": "active",
      "bufferSize": 1000,
      "addressFilters": ["/synth/*", "/effects/*"],
      "createdAt": "2024-01-01T12:00:00.000Z",
      "messageCount": 0
    },
    {
      "id": "endpoint_8001_1234567891",
      "port": 8001,
      "status": "active",
      "bufferSize": 2000,
      "addressFilters": ["/midi/*"],
      "createdAt": "2024-01-01T12:00:01.000Z",
      "messageCount": 0
    },
    {
      "id": "endpoint_8002_1234567892",
      "port": 8002,
      "status": "active",
      "bufferSize": 100,
      "addressFilters": ["/transport/*", "/clock/*"],
      "createdAt": "2024-01-01T12:00:02.000Z",
      "messageCount": 0
    }
  ]
}
```

### 3. Send Messages to Different Endpoints

Using SuperCollider, send messages to each endpoint:

```supercollider
// Synthesizer messages to port 8000
~synthServer = NetAddr("127.0.0.1", 8000);
~synthServer.sendMsg("/synth/freq", 440.0);
~synthServer.sendMsg("/synth/amp", 0.8);
~synthServer.sendMsg("/effects/reverb", 0.3);

// MIDI messages to port 8001
~midiServer = NetAddr("127.0.0.1", 8001);
~midiServer.sendMsg("/midi/note_on", 60, 127);
~midiServer.sendMsg("/midi/note_off", 60, 0);
~midiServer.sendMsg("/midi/cc", 1, 64);

// Transport messages to port 8002
~transportServer = NetAddr("127.0.0.1", 8002);
~transportServer.sendMsg("/transport/play");
~transportServer.sendMsg("/transport/bpm", 120);
~transportServer.sendMsg("/clock/tick", 0);
```

### 4. Query Messages from Specific Endpoints

**Get synthesizer messages:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890",
    "limit": 10
  }
}
```

**Get MIDI messages:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8001_1234567891",
    "limit": 10
  }
}
```

**Get transport messages:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8002_1234567892",
    "limit": 10
  }
}
```

### 5. Query Messages from All Endpoints

Get messages from all endpoints at once:

```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "timeWindowSeconds": 60,
    "limit": 50
  }
}
```

This returns messages from all active endpoints, useful for getting a complete picture of activity.

### 6. Monitor Activity Across Endpoints

Check message counts for all endpoints:

```json
{
  "tool": "get_endpoint_status",
  "parameters": {}
}
```

Look at the `messageCount` field for each endpoint to see activity levels.

### 7. Selective Message Filtering

**Get only note messages from MIDI endpoint:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8001_1234567891",
    "addressPattern": "/midi/note*",
    "limit": 20
  }
}
```

**Get only reverb messages from synth endpoint:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890",
    "addressPattern": "/effects/reverb",
    "limit": 10
  }
}
```

### 8. Handle High-Traffic Endpoints

For the MIDI endpoint (which might receive many messages), query recent messages only:

```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8001_1234567891",
    "timeWindowSeconds": 10,
    "limit": 100
  }
}
```

### 9. Clean Up Specific Endpoints

Stop endpoints individually as needed:

```json
{
  "tool": "stop_osc_endpoint",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890"
  }
}
```

Or stop all by querying status first, then stopping each:

```json
{
  "tool": "get_endpoint_status",
  "parameters": {}
}
```

Then stop each endpoint using their IDs.

## Advanced Patterns

### Port Range Strategy

Use consecutive ports for related functionality:
- 8000-8009: Synthesizer channels
- 8010-8019: Effects processing
- 8020-8029: MIDI devices
- 8030-8039: Transport/timing

### Buffer Size Strategy

Adjust buffer sizes based on expected message frequency:
- **High-frequency** (MIDI, control): 2000-5000 messages
- **Medium-frequency** (synth params): 1000 messages  
- **Low-frequency** (transport): 100-500 messages

### Address Filter Strategy

Use hierarchical addressing for better organization:
```
/app/synth/channel1/freq
/app/synth/channel1/amp
/app/effects/reverb/room
/app/effects/delay/time
/app/midi/device1/note
/app/transport/play
```

## Error Handling

### Port Conflicts
If a port is already in use, try the next available port:

```json
{
  "tool": "create_osc_endpoint",
  "parameters": {
    "port": 8001,
    "bufferSize": 1000
  }
}
```

If this fails with "PORT_IN_USE", try 8002, 8003, etc.

### Endpoint Monitoring
Regularly check endpoint status to detect failures:

```json
{
  "tool": "get_endpoint_status",
  "parameters": {}
}
```

Look for endpoints with `status: "error"` and recreate them if needed.

## Performance Considerations

- **Limit concurrent endpoints** to what you actually need
- **Use appropriate buffer sizes** to balance memory usage and message retention
- **Apply address filters** to reduce processing overhead
- **Query messages efficiently** using time windows and limits
- **Stop unused endpoints** to free system resources

## Next Steps

- Explore [Real-time Monitoring](realtime-monitoring.md) for continuous processing
- See [Advanced Filtering](advanced-filtering.md) for complex message routing
- Try [Performance Optimization](performance-optimization.md) for high-throughput scenarios