export interface CloudinaryError {
  public_id: string;
  message: string;
}

export interface CloudinaryUploadSuccess {
  id_public: string;
  url: string;
}

export interface CloudinaryDeleteResult {
  success: number;
  total: number;
  failed: boolean;
  errors?: CloudinaryError[];
}

export interface CloudinaryFolder {
  name: string;
  path: string;
}

export interface CloudinaryDeleteFolderResult {
  assetsDeleted: number;
  folderRemoved: boolean;
  reason?: string;
}
