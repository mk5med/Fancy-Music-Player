import { ipcRenderer } from "electron";
import { player_instance } from "./AudioPlayer";
import fs from 'fs';
import path from 'path'
export interface DirectoryReader {
  readEntries: (a: (e: any[]) => void) => void
}

export interface FileOrDirectoryEntry {
  file: (file: any) => void;
  createReader: () => DirectoryReader
  isFile: boolean,
  isDirectory: boolean,
}

export async function openOSFileImportPrompt() {
  // The dialog import only exists in the main process
  ipcRenderer.invoke('app:on-fs-dialog-open').then(async ({ filePaths: file_paths }: Electron.OpenDialogReturnValue) => {
    if (!file_paths) {
      return;
    }

    for (let i = 0; i < file_paths.length; i++) {
      let file_path = file_paths[i];
      let stats = await fs.promises.lstat(file_path);

      if (stats.isDirectory()) {
        let paths = await fs.promises.readdir(file_path) // `readdir` returns file names without the current path
        paths = paths.map(fileName => path.join(file_path, fileName)) // For each element, add the full path
        arrPushUnique(file_paths, paths); // Only append new paths that do not exist into the files buffer
      } else {
        try {
          // Try parsing the file as a playlist file
          let paths: string[] = JSON.parse(await fs.promises.readFile(file_path, 'ascii'))
          arrPushUnique(file_paths, paths) // Only append new paths that do not exist into the files buffer

        } catch {
          // The parsing failed, try parsing the file as a media file
          const file = new File([await fs.promises.readFile(file_path)], file_path.replace(/^.*[\\\/]/, ''))

          // The file path is empty as it is generated from a Buffer. We need to explicitly state the current buffer
          addTrackToPlaylist(file, file_path);
        }
      }
    }
  })
}

/**
 * Takes a file object and determines how to parse the object
 * depending on whether it is a singular file or a directory.
 * 
 * @param item File to scan
 * @returns A promise to complete the file or directory scan
 */
export async function scanFileEntry(item: FileOrDirectoryEntry): Promise<any> {
  // If it is a directory, wait to scan all files within it
  if (item.isDirectory) {
    let files = await dirReader(item);
    return Promise.all(files.map(file => scanFileEntry(file)))
  }

  return fileReader(item).then((file: File) => {
    addTrackToPlaylist(file)
  });
}

/**
 * Read each file within the directory and run
 * scanFile to each file to properly add it into the playlist.
 * Deprecated and no longer recommended.
 * https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryReader/readEntries
 * 
 * @param directory
 */
async function dirReader(directory: FileOrDirectoryEntry): Promise<FileOrDirectoryEntry[]> {
  var reader = directory.createReader();

  // Read files within the directory
  return await new Promise(res =>
    reader.readEntries((fileList: FileOrDirectoryEntry[]) => res(fileList)))
}

/**
 * Takes a File object as input and returns the contents of it.
 * This wrapper is to ease development.
 * 
 * @param file File object
 */
function fileReader(file: FileOrDirectoryEntry): Promise<File> {
  return new Promise((res) => {
    file.file((_file: File) => res(_file));
  });
}

/**
 * Converts a media file into a track object and adds it to
 * the current audioplayer playlist.
 * The path value is optional as importing a file from
 * the open-file dialog sets an empty path value on the `File` instance.
 * @param file A media file
 */
function addTrackToPlaylist(file: File, path: string = file.path) {
  player_instance.addTrack({
    url: URL.createObjectURL(file),
    name: file.name,
    file: file,
    path
  });
}

/**
 * Provides a wrapper to only push unique strings into the `parent` array.
 * @param parent The array to mutate
 * @param incoming The array with new data
 */
function arrPushUnique(parent: string[], incoming: string[]) {
  parent.push(...incoming.filter(newPath => !parent.includes(newPath)));
}