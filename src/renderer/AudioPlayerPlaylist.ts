import { $ } from './Helper'
import { openOSFileImportPrompt } from './PlaylistFileHelper';
import * as musicMetadata from 'music-metadata-browser';
import fs from 'fs'
import { ipcRenderer } from 'electron';
export interface Track {
  name: string,
  url: string
  file: File,
  path: string
}

export class AudioPlayerPlaylist {
  private readonly element_playlistContainer = $("#playlist__list") as HTMLElement;
  private readonly element_addTrackBtn = $("#btn-add-track") as HTMLElement;
  private readonly element_savePlaylistBtn = $("#btn-save-playlist") as HTMLElement;
  private track_playlist: Track[] = []
  private elements_playlistEntries: HTMLElement[] = [];
  private playlistIndex: number = 0;

  constructor() {
    this.element_addTrackBtn.addEventListener('click', async () => await this.openFileOrPlaylist());
    this.element_savePlaylistBtn.addEventListener('click', async () => await this.savePlaylist());
  }

  /**
   * Wrap an index around the playlist index space.
   * Negative numbers reference the end of the playlist.
   * 
   * @param index An arbitrary integer
   * @returns An integer within the range of the current playlist index space
   */
  private _wrapIndex(index: number) {
    if (index < 0) index = this.trackCount + index;
    return index % this.trackCount;
  }
  /**
   * Queue a track to the playlist and update the DOM to display the new track.
   * @param track Track to add.
   * @param clickCallback On-click callback to be added to the corresponding track element in the DOM.
   */
  addTrack(track: Track, clickCallback: (number: number, element: HTMLElement) => void) {

    // Add the new element to the playlist.
    let element_entryContainer = document.createElement("div")
    element_entryContainer.classList.add("trackEntry")

    let element_p = document.createElement("p");

    element_p.textContent = track.name;
    element_entryContainer.appendChild(element_p)

    // If this is the first item in the list, set it to be the selected track entry.
    if (this.elements_playlistEntries.length == 0) {
      element_entryContainer.classList.add("selected");
    }

    // Store the element reference and the track entry in memory for later removal.
    this.elements_playlistEntries.push(element_entryContainer);
    this.track_playlist.push(track)

    // Add a listener to change the current track when a playlist item is clicked.
    // TODO: This will need to be revised when track re-ordering is added.
    element_entryContainer.addEventListener("click", () => {
      // indexOf is not performant for (very) large lists
      clickCallback(this.elements_playlistEntries.indexOf(element_entryContainer), element_entryContainer)
    })

    this.element_playlistContainer.appendChild(element_entryContainer)
  }

  scrollToCurrentTrack() {
    this.elements_playlistEntries[this.playlistIndex].scrollIntoView({
      block: "center"
    })
  }

  changeTrack(index: number): Track | null {
    if (this.trackCount == 0) return null

    // Find the first DOM element with a "selected" class name.
    let selectedElement = $(".selected")

    if (selectedElement != null) {
      // The current item is de-selected
      selectedElement.classList.remove("selected");
    }

    index = this._wrapIndex(index)

    this.playlistIndex = index
    this.element_playlistContainer.children[index].classList.add("selected");

    return this.track_playlist[index]
  }

  /**
   * Read the metadata of a track and return the picture information.
   * @param index Index of the track. If left empty it defaults to the current playlist index
   * @returns An array of picture metadata objects, otherwise undefined
   */
  async getTrackMetadata(index: number) {
    index = this._wrapIndex(index);
    let metadata = await musicMetadata.parseBlob(this.track_playlist[index].file);
    if (metadata) return metadata

    throw "No image found"
  }

  getPreviousTrack() {
    return this.changeTrack(this.playlistIndex - 1);
  }

  getNextTrack() {
    return this.changeTrack(this.playlistIndex + 1);
  }

  removeCurrentTrack() {
    this.removeTrackAtIndex(this.playlistIndex)
  }

  removeTrackAtIndex(index: number) {
    this.elements_playlistEntries[index].remove();
    this.elements_playlistEntries.splice(index, 1);
    this.track_playlist.splice(index, 1);
  }

  /**
   * Opens a dialog to save the current playlist.
   * The playlist is stored as a stringified array of the media paths.
   */
  async savePlaylist() {
    let playlist = this.track_playlist.map(track => track.path);
    let file: Electron.SaveDialogReturnValue = await ipcRenderer.invoke("app:on-fs-dialog-save")

    if (file.filePath == undefined) return; // No path specified
    await fs.promises.writeFile(file.filePath, JSON.stringify(playlist), { encoding: 'ascii' })
  }

  /**
   * Opens a dialog to open a media file, directory, or playlist file.
   */
  async openFileOrPlaylist() {
    await openOSFileImportPrompt()
  }

  /**
   * Sets the index of the current playlist to 0.
   */
  resetIndex() {
    this.playlistIndex = 0;
  }

  clear() {
    this.resetIndex();
    this.track_playlist = [];
  }

  get currentPlaylist() {
    return JSON.stringify(this.track_playlist)
  }

  get currentTrack() {
    return this.track_playlist[this.playlistIndex]
  }

  get currentTrackIndex() {
    return this.playlistIndex;
  }

  get trackCount() {
    return this.track_playlist.length;
  }

  get isAtEnd() {
    return this.playlistIndex == this.track_playlist.length - 1;
  }
}