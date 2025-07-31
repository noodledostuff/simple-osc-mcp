# OSC MCP Server API Reference

This document provides a complete reference for all MCP tools provided by the OSC MCP Server.

## Overview

The OSC MCP Server exposes four main tools through the Model Context Protocol:

1. **create_osc_endpoint** - Create new OSC listening endpoints
2. **stop_osc_endpoint** - Stop and remove existing endpoints
3. **get_osc_messages** - Query received OSC messages
4. **get_endpoint_status** - Get endpoint status information

All tools return JSON responses and follow MCP protocol standards for error handling.

## Tools Reference

### create_osc_endpoint

Creates a new OSC endpoint to listen for incoming OSC messages on a specified UDP port.

#### Parameters

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| `port` | number | Yes | UDP port number to listen on | 1024-65535 |
| `bufferSize` | number | No | Maximum messages to store in buffer | 1-10000, default: 1000 |
| `addressFilters` | string[] | No | OSC address patterns to filter messages | Array of OSC address patterns |

#### Parameter Details

**port**
- Must be between 1024 and 65535 (ports below 1024 require admin privileges)
- Port must not be in use by another application
- Each endpoint requires a unique port

**bufferSize**
- Controls how many messages are stored in memory
- When buffer is full, oldest messages are removed (circular buffer)
- Larger buffers use more memory but retain more message history
- Default value of 1000 is suitable for most applications

**addressFilters**
- Optional array of OSC address patterns
- If provided, only messages matching these patterns are stored
- Supports wildcards: `/synth/*` matches `/synth/freq`, `/synth/amp`, etc.
- Empty array or omitted parameter means no filtering (all messages stored)
- Patterns are case-sensitive

#### Request Example

```json
{
  "tool": "create_osc_endpoint",
  "parameters": {
    "port": 8000,
    "bufferSize": 1500,
    "addressFilters": ["/synth/*", "/effects/reverb"]
  }
}
```

#### Response Format

```json
{
  "endpointId": "endpoint_8000_1234567890",
  "port": 8000,
  "status": "active",
  "message": "OSC endpoint created successfully"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `endpointId` | string | Unique identifier for the created endpoint |
| `port` | number | Port number the endpoint is listening on |
| `status` | string | Current status ("active", "error") |
| `message` | string | Success or error message |

#### Error Responses

**Port in Use:**
```json
{
  "error": {
    "code": "PORT_IN_USE",
    "message": "Port 8000 is already in use",
    "details": {
      "suggestedPorts": [8001, 8002, 8003]
    }
  }
}
```

**Invalid Port:**
```json
{
  "error": {
    "code": "PORT_INVALID",
    "message": "Port must be between 1024 and 65535",
    "details": {
      "providedPort": 80,
      "validRange": "1024-65535"
    }
  }
}
```

**Permission Denied:**
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Permission denied to bind to port 80",
    "details": {
      "suggestion": "Use ports 1024 and above, or run with elevated privileges"
    }
  }
}
```

---

### stop_osc_endpoint

Stops and removes an existing OSC endpoint, closing the UDP socket and cleaning up resources.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `endpointId` | string | Yes | ID of the endpoint to stop |

#### Parameter Details

**endpointId**
- Must be a valid endpoint ID returned from `create_osc_endpoint`
- Use `get_endpoint_status` to list available endpoint IDs
- Stopping a non-existent endpoint returns an error

#### Request Example

```json
{
  "tool": "stop_osc_endpoint",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890"
  }
}
```

#### Response Format

```json
{
  "endpointId": "endpoint_8000_1234567890",
  "message": "OSC endpoint stopped successfully"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `endpointId` | string | ID of the stopped endpoint |
| `message` | string | Success or error message |

#### Error Responses

**Endpoint Not Found:**
```json
{
  "error": {
    "code": "ENDPOINT_NOT_FOUND",
    "message": "Endpoint with ID 'invalid_id' not found",
    "details": {
      "providedId": "invalid_id",
      "suggestion": "Use get_endpoint_status to list available endpoints"
    }
  }
}
```

---

### get_osc_messages

Queries received OSC messages from one or more endpoints with optional filtering.

#### Parameters

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| `endpointId` | string | No | Specific endpoint ID to query | Must be valid endpoint ID |
| `addressPattern` | string | No | OSC address pattern to filter messages | OSC address pattern with wildcards |
| `timeWindowSeconds` | number | No | Time window in seconds (from now backwards) | Minimum: 1 |
| `limit` | number | No | Maximum number of messages to return | 1-1000 |

#### Parameter Details

**endpointId**
- If provided, queries only the specified endpoint
- If omitted, queries all active endpoints
- Must be a valid endpoint ID from `create_osc_endpoint`

**addressPattern**
- Filters messages by OSC address pattern
- Supports wildcards: `*` matches any characters
- Examples: `/synth/*`, `/effects/reverb`, `/midi/note*`
- Case-sensitive matching

**timeWindowSeconds**
- Only returns messages received within this time window
- Time is calculated backwards from the current moment
- Example: `60` returns messages from the last minute
- If omitted, returns messages from entire buffer

**limit**
- Maximum number of messages to return
- Messages are returned in reverse chronological order (newest first)
- If omitted, returns all matching messages (up to buffer size)
- Maximum allowed value is 1000

#### Request Examples

**Query all messages from all endpoints:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {}
}
```

**Query specific endpoint with filters:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890",
    "addressPattern": "/synth/freq",
    "timeWindowSeconds": 30,
    "limit": 10
  }
}
```

**Query recent messages from all endpoints:**
```json
{
  "tool": "get_osc_messages",
  "parameters": {
    "timeWindowSeconds": 60,
    "limit": 50
  }
}
```

#### Response Format

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
      "timestamp": "2024-01-01T12:00:59.000Z",
      "address": "/synth/amp",
      "typeTags": "f",
      "arguments": [0.8],
      "sourceIp": "127.0.0.1",
      "sourcePort": 57120
    }
  ],
  "totalCount": 150,
  "filteredCount": 2
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `messages` | OSCMessage[] | Array of matching OSC messages |
| `totalCount` | number | Total messages in buffer(s) |
| `filteredCount` | number | Number of messages matching filter criteria |

#### OSCMessage Format

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp when message was received |
| `address` | string | OSC address pattern (e.g., "/synth/freq") |
| `typeTags` | string | OSC type tags (e.g., "f" for float, "if" for int+float) |
| `arguments` | array | Array of message arguments in order |
| `sourceIp` | string | IP address of the message sender |
| `sourcePort` | number | Port number of the message sender |

#### OSC Type Tags

| Tag | Type | Description | Example |
|-----|------|-------------|---------|
| `i` | int32 | 32-bit integer | 42 |
| `f` | float32 | 32-bit float | 3.14159 |
| `s` | string | Null-terminated string | "hello" |
| `b` | blob | Binary data | Buffer |

#### Error Responses

**Endpoint Not Found:**
```json
{
  "error": {
    "code": "ENDPOINT_NOT_FOUND",
    "message": "Endpoint with ID 'invalid_id' not found"
  }
}
```

**Invalid Parameters:**
```json
{
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "timeWindowSeconds must be at least 1",
    "details": {
      "parameter": "timeWindowSeconds",
      "providedValue": 0,
      "minimumValue": 1
    }
  }
}
```

---

### get_endpoint_status

Gets status information for one or more OSC endpoints.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `endpointId` | string | No | Specific endpoint ID to query |

#### Parameter Details

**endpointId**
- If provided, returns status for only the specified endpoint
- If omitted, returns status for all endpoints
- Must be a valid endpoint ID from `create_osc_endpoint`

#### Request Examples

**Get status for all endpoints:**
```json
{
  "tool": "get_endpoint_status",
  "parameters": {}
}
```

**Get status for specific endpoint:**
```json
{
  "tool": "get_endpoint_status",
  "parameters": {
    "endpointId": "endpoint_8000_1234567890"
  }
}
```

#### Response Format

```json
{
  "endpoints": [
    {
      "id": "endpoint_8000_1234567890",
      "port": 8000,
      "status": "active",
      "bufferSize": 1000,
      "addressFilters": ["/synth/*", "/effects/reverb"],
      "createdAt": "2024-01-01T12:00:00.000Z",
      "messageCount": 42
    },
    {
      "id": "endpoint_8001_1234567891",
      "port": 8001,
      "status": "error",
      "bufferSize": 500,
      "addressFilters": [],
      "createdAt": "2024-01-01T12:01:00.000Z",
      "messageCount": 0
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `endpoints` | EndpointInfo[] | Array of endpoint status information |

#### EndpointInfo Format

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique endpoint identifier |
| `port` | number | UDP port number |
| `status` | string | Current status ("active", "stopped", "error") |
| `bufferSize` | number | Maximum messages stored in buffer |
| `addressFilters` | string[] | Array of address filter patterns |
| `createdAt` | string | ISO 8601 timestamp when endpoint was created |
| `messageCount` | number | Total messages received by this endpoint |

#### Status Values

| Status | Description |
|--------|-------------|
| `active` | Endpoint is running and receiving messages |
| `stopped` | Endpoint has been stopped |
| `error` | Endpoint encountered an error and is not functioning |

#### Error Responses

**Endpoint Not Found:**
```json
{
  "error": {
    "code": "ENDPOINT_NOT_FOUND",
    "message": "Endpoint with ID 'invalid_id' not found"
  }
}
```

## Common Error Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| `PORT_IN_USE` | Specified port is already in use | Another application using the port |
| `PORT_INVALID` | Port number is outside valid range | Port < 1024 or > 65535 |
| `PERMISSION_DENIED` | Insufficient permissions | Trying to use privileged ports |
| `ENDPOINT_NOT_FOUND` | Endpoint ID doesn't exist | Invalid ID or endpoint was stopped |
| `INVALID_PARAMETERS` | Parameter validation failed | Missing required params or invalid values |
| `NETWORK_ERROR` | Network-related error | Firewall, network connectivity issues |
| `INTERNAL_ERROR` | Server internal error | Unexpected server-side error |

## Rate Limits and Performance

### Message Buffer Limits
- Maximum buffer size per endpoint: 10,000 messages
- Default buffer size: 1,000 messages
- Circular buffer behavior: oldest messages removed when full

### Query Limits
- Maximum messages per query: 1,000
- Recommended query frequency: No more than 10 queries per second
- Time window queries are more efficient than full buffer scans

### Endpoint Limits
- Maximum concurrent endpoints: Limited by available ports and system resources
- Recommended maximum: 50 concurrent endpoints
- Each endpoint uses one UDP socket

## Best Practices

### Endpoint Management
- Use descriptive endpoint configurations
- Stop endpoints when no longer needed
- Monitor endpoint status regularly
- Handle port conflicts gracefully

### Message Querying
- Use time windows to limit query scope
- Apply address filters to reduce processing
- Limit result sets to reasonable sizes
- Query frequently to prevent buffer overflow

### Error Handling
- Always check for error responses
- Implement retry logic for network errors
- Validate parameters before sending requests
- Handle endpoint failures gracefully

### Performance Optimization
- Use address filters to reduce message processing
- Choose appropriate buffer sizes for your use case
- Query messages efficiently with time windows
- Consider multiple endpoints for high-traffic scenarios