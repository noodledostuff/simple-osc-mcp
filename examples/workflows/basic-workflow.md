# Basic OSC MCP Server Workflow

This document demonstrates a basic workflow for using the OSC MCP Server to receive and process OSC messages.

## Scenario

You want to receive OSC messages from a SuperCollider synthesizer and monitor the frequency and amplitude parameters being sent.

## Step-by-Step Workflow

### 1. Create an OSC Endpoint

First, create an endpoint to listen for OSC messages on port 8000:

```json
{
  "tool": "create_osc_endpoint",
  "parameters": {
    "port": 8000,
    "bufferSize": 500,
    "addressFilters": ["/synth/*"]
  }
}
```

**Expected Response:**
```json
{
  "endpointId": "endpoint_8000_1234567890",
  "port": 8000,
  "status": "active",
  "message": "OSC endpoint created successfully"
}
```

### 2. Verify Endpoint Status

Check that the endpoint is running correctly:

```json
{
  "tool": "get_endpoint_status",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890"
  }
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
      "bufferSize": 500,
      "addressFilters": ["/synth/*"],
      "createdAt": "2024-01-01T12:00:00.000Z",
      "messageCount": 0
    }
  ]
}
```

### 3. Send Test Messages

Using SuperCollider, send some test messages:

```supercollider
// Create NetAddr for the OSC MCP Server
~oscServer = NetAddr("127.0.0.1", 8000);

// Send synthesizer control messages
~oscServer.sendMsg("/synth/freq", 440.0);
~oscServer.sendMsg("/synth/amp", 0.8);
~oscServer.sendMsg("/synth/filter", 2000.0, 0.5);
```

### 4. Query Received Messages

Retrieve the messages that were sent:

```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890",
    "timeWindowSeconds": 60,
    "limit": 10
  }
}
```

**Expected Response:**
```json
{
  "messages": [
    {
      "timestamp": "2024-01-01T12:01:00.000Z",
      "address": "/synth/freq",
      "typeTags": "f",
      "arguments": [440.0],
      "sourceIp": "127.0.0.1",
      "sourcePort": 57120
    },
    {
      "timestamp": "2024-01-01T12:01:01.000Z",
      "address": "/synth/amp",
      "typeTags": "f",
      "arguments": [0.8],
      "sourceIp": "127.0.0.1",
      "sourcePort": 57120
    },
    {
      "timestamp": "2024-01-01T12:01:02.000Z",
      "address": "/synth/filter",
      "typeTags": "ff",
      "arguments": [2000.0, 0.5],
      "sourceIp": "127.0.0.1",
      "sourcePort": 57120
    }
  ],
  "totalCount": 3,
  "filteredCount": 3
}
```

### 5. Filter Messages by Address

Query only frequency messages:

```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890",
    "addressPattern": "/synth/freq",
    "limit": 5
  }
}
```

### 6. Monitor Real-time Activity

Check endpoint status to see message count:

```json
{
  "tool": "get_endpoint_status",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890"
  }
}
```

The `messageCount` field will show how many messages have been received.

### 7. Clean Up

When finished, stop the endpoint:

```json
{
  "tool": "stop_osc_endpoint",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890"
  }
}
```

**Expected Response:**
```json
{
  "endpointId": "endpoint_8000_1234567890",
  "message": "OSC endpoint stopped successfully"
}
```

## Key Points

- **Address Filters**: Using `/synth/*` filters only messages starting with `/synth/`
- **Buffer Management**: With bufferSize 500, only the most recent 500 messages are kept
- **Time Windows**: Use `timeWindowSeconds` to get recent messages only
- **Pattern Matching**: Address patterns support wildcards for flexible filtering
- **Resource Cleanup**: Always stop endpoints when done to free resources

## Next Steps

- Try the [Multi-Endpoint Workflow](multi-endpoint-workflow.md) for handling multiple sources
- Explore [Real-time Monitoring](realtime-monitoring.md) for continuous message processing
- See [Advanced Filtering](advanced-filtering.md) for complex message routing