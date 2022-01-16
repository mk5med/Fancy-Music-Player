import { $ } from './Helper';
import playSVG from './svg/play.svg';
import pauseSVG from './svg/pause.svg';
import { AudioPlayerPlaylist, Track } from './AudioPlayerPlaylist';

export class AudioPlayer {
  private element_playBtn = $("#btn-play") as HTMLElement;
  private element_nextBtn = $("#btn-next") as HTMLElement;
  private element_prevBtn = $("#btn-prev") as HTMLElement;

  private element_playBtn_img = this.element_playBtn.querySelector("img") as HTMLImageElement;
  private element_currentEntryDisplay: HTMLElement = $("#playing") as HTMLElement;
  private element_currentAuthorDisplay: HTMLElement = $("#playingAuthor") as HTMLElement;
  private element_thumbnail: HTMLImageElement = $("#thumbnail") as HTMLImageElement
  private element_playbackTrack: HTMLInputElement = $("#seek_bar") as HTMLInputElement

  private _audioPlayer = new Audio();
  private playlistManager = new AudioPlayerPlaylist();

  private seekbarInterval: number = -1;

  constructor() {
    // Prepare event listeners.
    this._audioPlayer.addEventListener("ended", () => this.audioPlayerOnEnd());
    this._audioPlayer.addEventListener("error", (e) => this.audioPlayerError(e));

    this.element_playBtn.addEventListener("click", () => this.togglePlay());
    this.element_nextBtn.addEventListener("click", () => this.gotoNextTrack());
    this.element_prevBtn.addEventListener("click", () => this.gotoPreviousTrack());
    this.element_playbackTrack.addEventListener("input", () => this.updateTrackPlaybackPosition())
  }

  // Add tracks to the DOM playlist.
  addTrack(track: Track) {
    this.playlistManager.addTrack(track, (index) => {
      this.changeTrackToIndex(index)
      // If this is the first item in the list, set it to be the selected track.
      if (this.playlistManager.currentTrackIndex === 0) {
        this.updateTrackTitle(track);
      }
    })

    if (this.playlistManager.trackCount === 1) {
      this.updateTrackTitle(track)
    }
  }

  removeCurrentTrack() {
    this.removeTrack(this.playlistManager.currentTrackIndex)
  }

  removeTrack(index: number) {
    this.playlistManager.removeTrackAtIndex(index)

    this.togglePlay(); // Pause audio playback
    this.changeTrackToIndex(index); // Update the DOM with the new track information
    this.togglePlay()
  }

  updateTrackPlaybackPosition() {
    this._audioPlayer.currentTime = parseFloat(this.element_playbackTrack.value)
  }

  // Change the current song header.
  updateTrackTitle(song: Track) {
    this.element_currentEntryDisplay.innerText = `${song.name}`;
    this.playlistManager.getTrackMetadata(this.playlistManager.currentTrackIndex).then(metadata => {
      if (metadata.common.picture) {
        this.element_thumbnail.style.backgroundImage = `url("data:image/png;base64,${metadata.common.picture[0].data.toString("base64")}")`
      }

      this.element_currentAuthorDisplay.innerText = metadata.common.artist ?? "No author"
    })
  }

  // Changes the track to the specified index.
  changeTrackToIndex(index: number) {
    let track = this.playlistManager.changeTrack(index)
    if (track == null) return; // If there are no tracks available, do nothing

    this.updateTrackTitle(track);

    if (this.isPlaying) {
      this.playCurrentTrack();
    }
  }

  // Deals with playing next track after previous is finished.
  // Stops at end of playlist to prevent looping.
  // TODO: This (^) should be an option.
  // TODO: An option for enabling auto-play
  audioPlayerOnEnd() {
    // If the next track doesn't exist, pause the playback.
    if (this.playlistManager.isAtEnd) {
      this.togglePlay();
      this.playlistManager.resetIndex()
      return
    };

    this.gotoNextTrack();
    this.togglePlay()
  }

  updateTrack() {
    this.updateTrackTitle(this.playlistManager.currentTrack)
    this.playlistManager.scrollToCurrentTrack()
  }

  gotoPreviousTrack() {
    AudioPlayer.pauseActRestore(() => {
      this.playlistManager.getPreviousTrack()
      this.updateTrack()
    }, this)
  }

  gotoNextTrack() {
    AudioPlayer.pauseActRestore(() => {
      this.playlistManager.getNextTrack()
      this.updateTrack()
    }, this)
  }

  /**
   * Handler for toggling audio playback. If the state was paused, it will play; otherwise it will pause.
   */
  togglePlay() {
    // If there are no pending tracks, do nothing.
    if (this.playlistManager.trackCount === 0) {
      console.error("No tracks.")
      return;
    }

    this.element_playBtn_img.src = this.isPlaying ? playSVG : pauseSVG;

    if (this.isPlaying) {
      this._audioPlayer.pause();
      if (this.seekbarInterval != -1) {
        // When the playback is paused, remove the timed interval
        clearInterval(this.seekbarInterval);
      }
    } else {
      this.playCurrentTrack();

      // Update the seekbar every 10ms
      this.seekbarInterval = setInterval(() => {
        this.element_playbackTrack.max = this._audioPlayer.duration + ""
        this.element_playbackTrack.value = this._audioPlayer.currentTime + ""
        this.element_playbackTrack.style.backgroundSize = `${this._audioPlayer.currentTime / this._audioPlayer.duration * 100}% 100%`
      }, 10) as unknown as number
    }
  }

  // Starts playing the current track.
  playCurrentTrack() {
    let track = this.playlistManager.currentTrack;

    // Don't re-add the same source URL. Even if the source is identical. When the source changes the track commences at the begining.
    if (this._audioPlayer.src != track.url) this._audioPlayer.src = track.url;
    this._audioPlayer.play();
  }

  /**
   * Callback for any errors raised by the internal AudioPlayer reference.
   * 
   * @param error Event from AudioPlayer. Not used.
   */
  audioPlayerError(error: any) {
    try {
      // Remove the current track
      this.removeCurrentTrack();
    } catch (e) {
      console.error("Something went wrong when removing a track entry.");
      console.error(e);
    }
  }

  clearPlaylist() {
    this._audioPlayer.pause();
    this.playlistManager.clear();
  }

  get isPlaying() {
    return this._audioPlayer.paused === false;
  }

  /**
   * Get the duration of the current loaded audio file.
   * 
   * @returns: 
   * - The length in seconds of the current audio file if it exists.
   * - NaN if no audio exists.
   * - Inf if there is no predefined length.
   */
  get audioDuration() {
    return this._audioPlayer.duration;
  }

  /**
   * Intent-based wrapper for actions involving audio tracks.
   * Use this method to perform tasks requiring audio-element play state to be paused and restored.
   * Cases:
   *  If the player was playing, pause and execute the callback. Resume playback after the callback.
   *  Otherwise, if the player was paused, execute the callback and keep the player paused.
   * 
   * @param callback Action to perform when the audio element is ready.
   * @param context AudioPlayer context to perform the action on.
   */
  static pauseActRestore(callback: () => void, context: AudioPlayer) {
    let was_playing = context.isPlaying;
    if (was_playing) context.togglePlay();

    callback();
    if (was_playing) context.togglePlay();
  }
}

// AudioPlayer singleton for the app
export var player_instance: AudioPlayer;

export function setup_player() {
  player_instance = new AudioPlayer();
}