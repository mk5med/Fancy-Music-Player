'use strict'
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { format as formatUrl } from "url";
import * as path from "path";

const isDevelopment = process.env.NODE_ENV !== 'production'

var mainWindow: BrowserWindow | null;
function createWindow() {

    let window: BrowserWindow | null = new BrowserWindow({
        width: 1168,
        height: 526,
        minWidth: 1168,
        minHeight: 526,
        // icon: path.join(__dirname, "../icons/png/64x64.png"),
        // frame: false,
        webPreferences: { nodeIntegration: true }
    });

    if (isDevelopment) {
        window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
        window.webContents.openDevTools()
    } else {
        window.loadURL(formatUrl({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file:",
            slashes: true
        }));
    }
    // Turn off the menubar at the top.
    window.setMenu(null);

    window.on('closed', () => {
        window = null
    })

    return window
}

app.on("ready", () => {
    mainWindow = createWindow();
    { mainWindow };

    console.log("Ready")
});

app.on("window-all-closed", () => {
    app.quit();
});

ipcMain.handle('app:on-fs-dialog-open', async (event) => {
    const files = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory', 'multiSelections'],
    });
    return files;
});

ipcMain.handle('app:on-fs-dialog-save', async (event) => {
    const saveFile = await dialog.showSaveDialog({
        properties: ['createDirectory', 'showHiddenFiles', 'showOverwriteConfirmation'],
    });
    
    return saveFile;
});