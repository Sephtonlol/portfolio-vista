import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FileNode, FileNodeType } from '../../../interfaces/file.interface';
import { ApiBaseService } from '../api-base.service';

@Injectable({
  providedIn: 'root',
})
export class FilesService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  // GET /items?parentId=<id|null>
  listByParent(parentId: string | null) {
    const params = new HttpParams().set('parentId', parentId ?? 'null');
    return this.http.get<FileNode[]>(`${this.baseUrl}/items`, { params });
  }

  // POST /items (auth)
  create(input: {
    name: string;
    type: FileNodeType;
    parentId: string | null;
    content?: string;
    url?: string;
    shortcutTo?: string;
  }) {
    return this.http.post<FileNode>(`${this.baseUrl}/items`, input);
  }

  // PATCH /items/:id (auth)
  update(
    id: string,
    patch: Partial<
      Pick<FileNode, 'name' | 'type' | 'content' | 'url' | 'shortcutTo'>
    >,
  ) {
    return this.http.patch<FileNode>(`${this.baseUrl}/items/${id}`, patch);
  }

  // DELETE /items/:id (auth)
  delete(id: string) {
    return this.http.delete<{ deletedCount: number }>(
      `${this.baseUrl}/items/${id}`,
    );
  }

  // PATCH /items/:id/move (auth)
  move(id: string, newParentId: string | null) {
    return this.http.patch<FileNode>(`${this.baseUrl}/items/${id}/move`, {
      newParentId,
    });
  }
}
