/** Explicit opt-in when deleting a folder and its assets via Admin API. */
export type DeleteFolderPrepareOptions = { save_deleted: boolean };

/**
 * Argument to CloudinaryService.delete. Pass one spec, an array of specs,
 * or an empty array for a no-op batch. Execution happens when you call save() on the batch.
 */
export type CloudinaryDeleteSpec =
  | { kind: 'one'; publicId: string }
  | { kind: 'many'; publicIds: string[] }
  | { kind: 'byFolder'; path: string }
  | { kind: 'folder'; path: string; options: DeleteFolderPrepareOptions };
