# Code Lab / Judge0 — v19

Code Lab now has a real server-side execution endpoint:

`POST /api/code-lab/exercise/{exerciseId}/run`

The backend validates the user's access to the lesson, limits source/stdin sizes and sends execution to Judge0 with:

- CPU limit: 2 seconds
- wall-clock limit: 5 seconds
- memory limit: 128 MB
- network disabled in the Judge0 request

Configure `Judge0:Url` in `appsettings.json` or `JUDGE0_URL` in the environment. The application does not execute student code inside the ASP.NET process.

Supported language IDs: JavaScript 63, TypeScript 74, Python 71, C# 51, C++ 54, Java 62.
