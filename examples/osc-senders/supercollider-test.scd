// SuperCollider OSC Test Sender
// This script sends test OSC messages to the OSC MCP Server

// Create a NetAddr pointing to the OSC MCP Server
~oscServer = NetAddr("127.0.0.1", 8000); // Change port as needed

// Test 1: Simple message with different data types
~oscServer.sendMsg("/test/simple", 440, 0.5, "hello");

// Test 2: Synthesizer control messages
~oscServer.sendMsg("/synth/freq", 440.0);
~oscServer.sendMsg("/synth/amp", 0.8);
~oscServer.sendMsg("/synth/filter", 2000.0, 0.5);

// Test 3: Effects control
~oscServer.sendMsg("/effects/reverb/room", 0.3);
~oscServer.sendMsg("/effects/delay/time", 0.25);
~oscServer.sendMsg("/effects/chorus/rate", 2.0);

// Test 4: Sequence of messages
(
fork {
    10.do { |i|
        ~oscServer.sendMsg("/sequence/step", i, rrand(200, 800));
        0.1.wait;
    };
}
)

// Test 5: High-frequency messages (for buffer testing)
(
fork {
    100.do { |i|
        ~oscServer.sendMsg("/highfreq/data", i, sin(i * 0.1));
        0.01.wait; // 100 messages per second
    };
}
)

// Test 6: Different address patterns
~oscServer.sendMsg("/midi/note", 60, 127);
~oscServer.sendMsg("/midi/cc", 1, 64);
~oscServer.sendMsg("/transport/play");
~oscServer.sendMsg("/transport/stop");
~oscServer.sendMsg("/transport/bpm", 120);

// Test 7: Complex nested addresses
~oscServer.sendMsg("/instruments/piano/note", 60, 0.8, 1.0);
~oscServer.sendMsg("/instruments/drums/kick", 127);
~oscServer.sendMsg("/instruments/bass/note", 36, 0.9);

// Test 8: Blob data (binary)
~oscServer.sendMsg("/data/blob", Int8Array.fill(16, { rrand(0, 255) }));

// Utility function to send random messages
~sendRandomMessage = {
    var addresses = [
        "/synth/freq", "/synth/amp", "/effects/reverb",
        "/midi/note", "/transport/bpm", "/test/random"
    ];
    var addr = addresses.choose;
    var value = rrand(0.0, 1.0);
    ~oscServer.sendMsg(addr, value);
    ("Sent: " ++ addr ++ " " ++ value).postln;
};

// Send random messages every second
~randomTask = Task({
    inf.do {
        ~sendRandomMessage.value;
        1.0.wait;
    };
});

// Start/stop random messages
// ~randomTask.start;
// ~randomTask.stop;