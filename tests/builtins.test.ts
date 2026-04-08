/**
 * Unit tests for built-in main-process helper registrars:
 * - registerDialogHandlers
 * - registerShellHandlers
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { dialog, ipcMain, shell, resetMocks } from './__mocks__/electron.js';
import { registerDialogHandlers, registerShellHandlers } from '../src/main.js';

beforeEach(() => {
  resetMocks();
});

describe('registerDialogHandlers', () => {
  it('registers expected dialog channels', () => {
    registerDialogHandlers();

    expect(ipcMain.handle).toHaveBeenCalledWith('dialog:open-file', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('dialog:open-directory', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('dialog:save-file', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('dialog:message-box', expect.any(Function));
  });

  it('open-file handler returns first path or null', async () => {
    registerDialogHandlers();

    const openFileHandler = ipcMain._handlers.get('dialog:open-file')!;
    const selected = await openFileHandler({}, { title: 'Pick file' });

    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ title: 'Pick file', properties: ['openFile'] });
    expect(selected).toBe('C:/tmp/default.txt');

    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    const canceled = await openFileHandler({}, {});
    expect(canceled).toBeNull();

    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [] });
    const noPath = await openFileHandler({}, {});
    expect(noPath).toBeNull();
  });

  it('open-directory handler enforces openDirectory property', async () => {
    registerDialogHandlers();

    const handler = ipcMain._handlers.get('dialog:open-directory')!;
    await handler({}, { title: 'Pick dir' });

    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ title: 'Pick dir', properties: ['openDirectory'] });

    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [] });
    const noPath = await handler({}, {});
    expect(noPath).toBeNull();

    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    const canceled = await handler({}, {});
    expect(canceled).toBeNull();
  });

  it('save-file and message-box return normalized values', async () => {
    registerDialogHandlers();

    const saveHandler = ipcMain._handlers.get('dialog:save-file')!;
    const msgHandler = ipcMain._handlers.get('dialog:message-box')!;

    const savePath = await saveHandler({}, { defaultPath: 'x.txt' });
    const responseIndex = await msgHandler({}, { message: 'Hello' });

    expect(dialog.showSaveDialog).toHaveBeenCalledWith({ defaultPath: 'x.txt' });
    expect(savePath).toBe('C:/tmp/saved.txt');
    expect(dialog.showMessageBox).toHaveBeenCalledWith({ message: 'Hello' });
    expect(responseIndex).toBe(0);

    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true });
    const canceledSave = await saveHandler({}, undefined);
    expect(canceledSave).toBeNull();

    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false });
    const missingPath = await saveHandler({}, undefined);
    expect(missingPath).toBeNull();
  });

  it('message-box handler rejects non-object payloads', async () => {
    registerDialogHandlers();

    const msgHandler = ipcMain._handlers.get('dialog:message-box')!;

    await expect(msgHandler({}, 'not-an-object')).rejects.toThrow(
      'requires an options object with a string "message" property',
    );
  });

  it('message-box handler rejects null payload', async () => {
    registerDialogHandlers();

    const msgHandler = ipcMain._handlers.get('dialog:message-box')!;

    await expect(msgHandler({}, null)).rejects.toThrow(
      'requires an options object with a string "message" property',
    );
  });

  it('message-box handler rejects payloads without string message', async () => {
    registerDialogHandlers();

    const msgHandler = ipcMain._handlers.get('dialog:message-box')!;

    await expect(msgHandler({}, { title: 'Missing message' })).rejects.toThrow(
      'requires an options object with a string "message" property',
    );
    await expect(msgHandler({}, { message: 123 })).rejects.toThrow(
      'requires an options object with a string "message" property',
    );
  });

  it('dispose unregisters all channels', () => {
    const reg = registerDialogHandlers('native-dialog');

    reg.dispose();

    expect(ipcMain.removeHandler).toHaveBeenCalledWith('native-dialog:open-file');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('native-dialog:open-directory');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('native-dialog:save-file');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('native-dialog:message-box');
  });
});

describe('registerShellHandlers', () => {
  it('registers expected shell channels', () => {
    registerShellHandlers();

    expect(ipcMain.handle).toHaveBeenCalledWith('shell:open-external', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('shell:open-path', expect.any(Function));
  });

  it('forwards openExternal and openPath calls to shell', async () => {
    registerShellHandlers();

    const openExternal = ipcMain._handlers.get('shell:open-external')!;
    const openPath = ipcMain._handlers.get('shell:open-path')!;

    await openExternal({}, 'https://example.com');
    const result = await openPath({}, 'C:/tmp/file.txt');

    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    expect(shell.openPath).toHaveBeenCalledWith('C:/tmp/file.txt');
    expect(result).toBe('');
  });

  it('dispose unregisters all channels', () => {
    const reg = registerShellHandlers('native-shell');

    reg.dispose();

    expect(ipcMain.removeHandler).toHaveBeenCalledWith('native-shell:open-external');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('native-shell:open-path');
  });
});
