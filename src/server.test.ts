import { OSCMCPServer } from './server';

describe('OSCMCPServer', () => {
  let server: OSCMCPServer;

  beforeEach(() => {
    server = new OSCMCPServer();
  });

  it('should create a server instance', () => {
    expect(server).toBeInstanceOf(OSCMCPServer);
  });

  it('should start and shutdown successfully', async () => {
    await expect(server.start()).resolves.toBeUndefined();
    await expect(server.shutdown()).resolves.toBeUndefined();
  });

  it('should throw error when starting already running server', async () => {
    await server.start();
    await expect(server.start()).rejects.toThrow('Server is already running');
    await server.shutdown();
  });
});
