import { triggerOverlay } from "./Overlay";
import { FileOrDirectoryEntry, scanFileEntry } from "./PlaylistFileHelper";

/**
 * When a file is detected as being 'dropped', this method is called to
 * -- handle the introduction of the files into the playlist.
 */
export async function drop_handler(event: DragEvent) {
  event.preventDefault();
  let items = event.dataTransfer?.items;

  if (items == undefined) return // TODO: Display an error
  // Loop through every file and add them to the list.

  for (let file of items) {
    await scanFileEntry(file.webkitGetAsEntry() as unknown as FileOrDirectoryEntry);
  }

  triggerOverlay({ action: "remove" });
}

// Called when the file is dragged over the "drop zone".
export function dragover_handler(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer === null) return;

  event.dataTransfer.dropEffect = "copy"; // Gives a plus symbol for the cursor.
  triggerOverlay({ action: "add" });
}

// Called when the file has left the "drop zone".
export function dragleave_handler(event: DragEvent) {
  triggerOverlay({ action: "remove" });
}
