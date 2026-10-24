# Files and audit — v20

The backend now supports authenticated lesson attachments. Teachers/admins can upload files; authorized students, parents, teachers and admins can download files attached to lessons they can access.

Allowed types: PDF, plain text/Markdown, PNG/JPEG/WebP, ZIP, DOCX, PPTX, XLSX. Maximum size: 25 MB.

Every upload and download is written to `audit_logs`. Administrators can read recent audit entries through `GET /api/admin/audit`.
