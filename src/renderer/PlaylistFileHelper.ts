import { ipcRenderer } from "electron";
import { player_instance } from "./AudioPlayer";
import fs from 'fs';
import { Track } from "./AudioPlayerPlaylist";
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
  ipcRenderer.invoke('app:on-fs-dialog-open').then(async (files: string[] | undefined) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      let path = files[i];
      let stats = await fs.promises.lstat(path);
      stats.ctime
      if (stats.isDirectory()) {
        // TODO: Implement
      } else {
        const file = new File([await fs.promises.readFile(path)], path.replace(/^.*[\\\/]/, ''))
        player_instance.addTrack({
          url: URL.createObjectURL(file),
          name: file.name,
          file: file
        })
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
    player_instance.addTrack({
      name: file.name,
      url: URL.createObjectURL(file),
      file: file
    });
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