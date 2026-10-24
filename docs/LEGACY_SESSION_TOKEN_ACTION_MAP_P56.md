# Legacy sessionToken action map (P57)

Detected actions: 18

- GetStatus — [HttpGet("status")] — line 71: `public async Task<IActionResult> GetStatus([FromQuery] string sessionToken, [FromQuery] int homeworkId)`
- GetPlanDetails — [HttpGet("plan-details")] — line 304: `public async Task<IActionResult> GetPlanDetails([FromQuery] string sessionToken, [FromQuery] int homeworkId)`
- GetCalibrationStatus — [HttpGet("calibration-status")] — line 377: `public async Task<IActionResult> GetCalibrationStatus([FromQuery] string sessionToken, [FromQuery] string subjectName)`
- DownloadArchive — [HttpGet("download-archive")] — line 703: `public async Task<IActionResult> DownloadArchive([FromQuery] string sessionToken, [FromQuery] int homeworkId)`
- DownloadReport — [HttpGet("download-report")] — line 755: `public async Task<IActionResult> DownloadReport([FromQuery] string sessionToken, [FromQuery] int homeworkId)`
- DownloadPresentation — [HttpGet("download-presentation")] — line 768: `public async Task<IActionResult> DownloadPresentation([FromQuery] string sessionToken, [FromQuery] int homeworkId)`
- GetGithubStatus — [HttpGet("github/status")] — line 781: `public async Task<IActionResult> GetGithubStatus([FromQuery] string sessionToken)`

## HomeworkController.cs (8)
- GetHomeworkList — [HttpGet("list")] — line 39: `public async Task<IActionResult> GetHomeworkList([FromQuery] string sessionToken)`
- CreateHomework — [HttpPost("create")] — line 110: `public async Task<IActionResult> CreateHomework([FromQuery] string sessionToken)`
- DeleteHomework — [HttpPost("delete")] — line 158: `public async Task<IActionResult> DeleteHomework([FromQuery] string sessionToken, [FromBody] JsonElement payload)`
- GetFileToken — [HttpPost("file-token")] — line 202: `public async Task<IActionResult> GetFileToken([FromQuery] string sessionToken)`
- GetGroupHistory — [HttpGet("group-history")] — line 291: `public async Task<IActionResult> GetGroupHistory([FromQuery] string sessionToken)`
- GetEvaluationTags — [HttpGet("evaluation/tags")] — line 331: `public async Task<IActionResult> GetEvaluationTags([FromQuery] string sessionToken)`
- GetHomeworkEvaluation — [HttpGet("evaluation/get")] — line 371: `public async Task<IActionResult> GetHomeworkEvaluation([FromQuery] string sessionToken, [FromQuery] int id)`
- SaveHomeworkEvaluation — [HttpPost("evaluation/save")] — line 411: `public async Task<IActionResult> SaveHomeworkEvaluation([FromQuery] string sessionToken, [FromBody] JsonElement payload)`

## ScheduleController.cs (3)
- ForwardScheduleAction — [HttpGet("operations/{actionName}")] — line 38: `public async Task<IActionResult> ForwardScheduleAction(string actionName, [FromQuery] string sessionToken)`
- GetEvaluateLessonList — [HttpGet("feedback/evaluate-lesson-list")] — line 102: `public async Task<IActionResult> GetEvaluateLessonList([FromQuery] string sessionToken)`
- EvaluateLesson — [HttpPost("feedback/evaluate-lesson")] — line 153: `public async Task<IActionResult> EvaluateLesson([FromQuery] string sessionToken, [FromBody] JsonElement payload)`

PASS: 18 remaining legacy action declarations mapped after migrating LeaderboardController to JWT. This is an inventory, not a security fix.
