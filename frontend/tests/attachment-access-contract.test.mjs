import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const attachments = read('backend/JournalBackend/Controllers/AttachmentsController.cs');
const documents = read('backend/JournalBackend/Controllers/DocumentsController.cs');

test('attachment endpoints require JWT and resolve the current user from authenticated claims', () => {
  assert.match(attachments, /\[Authorize\][\s\S]*?public class AttachmentsController/);
  assert.match(attachments, /FindFirstValue\(ClaimTypes\.NameIdentifier\)/);
  assert.match(attachments, /private Task<bool> CanAccessLesson/);
  assert.match(attachments, /private async Task<bool> CanAccessMaterial/);
  assert.match(attachments, /private async Task<bool> CanAccessHomework/);
});

test('attachment mutations are role-restricted and teacher operations verify ownership', () => {
  for (const action of ['UploadMaterial', 'DeleteMaterial', 'UploadHomework', 'DeleteHomework']) {
    const declaration = new RegExp('\\[Authorize\\(Roles = UserRoles\\.Teacher \\+ \",\" \\+ UserRoles\\.Admin\\)\\][\\s\\S]{0,180}public async Task<IActionResult> ' + action);
    assert.match(attachments, declaration, `${action} must be teacher/admin restricted`);
  }
  assert.match(attachments, /IsOwnerOrAdmin\(user, item\.StudyMaterial\.ScheduleEntry\.TeacherId\)/);
  assert.match(attachments, /IsOwnerOrAdmin\(user, item\.Homework\.ScheduleEntry\.TeacherId\)/);
  assert.match(attachments, /user\.Role == UserRoles\.Teacher && teacherId == user\.Id/);
});

test('attachment storage guards against path traversal and limits accepted file types', () => {
  assert.match(attachments, /MaxBytes = 25L \* 1024 \* 1024/);
  assert.match(attachments, /AllowedTypes/);
  assert.match(attachments, /Path\.GetFullPath\(Path\.Combine\(root, storageKey\)\)/);
  assert.match(attachments, /!path\.StartsWith\(root \+ Path\.DirectorySeparatorChar/);
});

test('documents enforce publication and group/parent-child access for student and parent roles', () => {
  assert.match(documents, /\[Authorize\][\s\S]*?public sealed class DocumentsController/);
  assert.match(documents, /material\.IsPublished && await _db\.Users\.AnyAsync/);
  assert.match(documents, /_db\.ParentStudents[\s\S]*?x => x\.ParentId == uid/);
  assert.match(documents, /material\.ScheduleEntry\.TeacherId == uid/);
});
