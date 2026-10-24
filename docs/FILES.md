# Files

Attachments are stored under `storage/attachments` or the corresponding internal storage directories, outside the public frontend directory.

## Rules

- Maximum upload size: 25 MB for classroom attachments.
- MIME type and extension allowlists are enforced.
- Server-generated UUID storage keys prevent user-controlled filesystem paths.
- `Path.GetFileName` and invalid-character sanitization are applied to display names.
- Download endpoints re-check lesson/material access before reading the file.
- Teacher deletion requires ownership of the lesson; admin can manage globally.
- Audit entries are written for upload/download/delete operations.

## Security test targets

Test cross-user/cross-group access for every attachment type and test path traversal strings such as `../../file`, Windows separators and executable double extensions.
